package expo.modules.videoprep

import android.content.Context
import android.graphics.Bitmap
import android.graphics.ImageFormat
import android.graphics.Matrix
import android.media.Image
import android.media.MediaCodec
import android.media.MediaCodecInfo
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMetadataRetriever
import android.net.Uri
import android.os.Build
import android.util.Log
import android.os.Handler
import android.os.Looper
import androidx.media3.common.C
import androidx.media3.common.MediaItem
import androidx.media3.common.MimeTypes
import androidx.media3.common.util.UnstableApi
import androidx.media3.effect.Presentation
import androidx.media3.transformer.Composition
import androidx.media3.transformer.DefaultEncoderFactory
import androidx.media3.transformer.EditedMediaItem
import androidx.media3.transformer.EditedMediaItemSequence
import androidx.media3.transformer.Effects
import androidx.media3.transformer.ExportException
import androidx.media3.transformer.ExportResult
import androidx.media3.transformer.ProgressHolder
import androidx.media3.transformer.Transformer
import androidx.media3.transformer.VideoEncoderSettings
import expo.modules.kotlin.Promise
import expo.modules.kotlin.exception.CodedException
import expo.modules.kotlin.functions.Queues
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.io.File
import java.io.FileOutputStream
import kotlin.math.max
import kotlin.math.min
import kotlin.math.roundToInt

/**
 * Обрезка и приведение видео к стандарту на телефоне перед отправкой — за один проход, аппаратным кодировщиком
 * (Media3 Transformer). Тот же стандарт, что у сервера (annotator/video_ingest.py): H.264 без звука, короткая сторона
 * не больше 1080, HDR → обычный цвет, поворот применяется к кадру, ~4 Мбит/с при 30 к/с и ~6 при 60 (для меньших
 * кадров — пропорционально площади, не ниже 1.5). Сервер всё равно проверяет результат и при нужде пересобирает сам.
 */
@UnstableApi
class VideoPrepModule : Module() {
  private var transformer: Transformer? = null
  private var preparing: File? = null   // файл, который сейчас пишет сжатие (отмена — стереть недописанное)
  @Volatile private var introCancelled = false
  @Volatile private var scanCancelled = false
  private val main = Handler(Looper.getMainLooper())

  private val context: Context
    get() = appContext.reactContext ?: throw CodedException("Нет контекста приложения")

  override fun definition() = ModuleDefinition {
    Name("VideoPrep")
    Events("onProgress")

    AsyncFunction("prepare") { uri: String, startS: Double?, endS: Double?, promise: Promise ->
      try {
        start(uri, startS, endS, promise)
      } catch (e: Throwable) {
        promise.reject(CodedException(e.message ?: "не получилось подготовить видео", e))
      }
    }.runOnQueue(Queues.MAIN)

    Function("cancel") {
      main.post {
        transformer?.cancel()
        transformer = null
        preparing?.delete()
        preparing = null
      }
    }

    // сжатая копия больше не нужна (видео уже на сервере) — стереть сразу
    Function("releasePrepared") { uri: String -> preparedFile(uri)?.delete() }

    // уборка кэша: сжатые копии, кроме тех, что ещё досылаются (keep), и папки кадров прерванных вступлений
    Function("cleanCache") { keep: List<String> ->
      val keepPaths = keep.mapNotNull { preparedFile(it)?.canonicalPath }.toSet()
      context.cacheDir.listFiles()?.forEach { f ->
        when {
          f.isFile && f.name.startsWith(PREP_PREFIX) && f.canonicalPath !in keepPaths -> f.delete()
          f.isDirectory && f.name.startsWith(INTRO_PREFIX) -> f.deleteRecursively()
        }
      }
    }

    // кадры вступления MIRA: секунда схватки → JPEG во временной папке кэша (смешивание кадров рисует приложение)
    AsyncFunction("introFrames") { uri: String, startS: Double, durS: Double, maxSide: Int ->
      introFrames(uri, startS, durS, maxSide)
    }

    Function("cancelIntro") { introCancelled = true }

    // ушли с экрана — поиск людей останавливается на ближайшем шаге
    Function("cancelScan") { scanCancelled = true }

    // силуэты людей на кадре (файл кадра вступления) — для «скана» в интерфейсе; контуры в долях кадра
    // deadlineMs — не дольше (0 — без срока): вышло время — поиск останавливается и отдаёт готовые силуэты
    AsyncFunction("scanPeople") { uri: String, maxPeople: Int, deadlineMs: Double ->
      val path = Uri.parse(uri).path ?: throw CodedException("нет кадра")
      val t0 = System.currentTimeMillis()
      scanCancelled = false
      val until = if (deadlineMs > 0) t0 + deadlineMs.toLong() else Long.MAX_VALUE
      val people = try {
        PeopleScanner(context).scan(path, maxPeople) { scanCancelled || System.currentTimeMillis() > until }
      } catch (e: Throwable) {
        Log.e("VideoPrep", "scan people failed", e)
        throw CodedException("не получилось найти людей на кадре", e)
      }
      Log.i("VideoPrep", "scan people: ${people.size} in ${System.currentTimeMillis() - t0} ms")
      mapOf("people" to people.map { p ->
        mapOf("points" to p.points.map { it.toDouble() }, "left" to p.left.toDouble(), "right" to p.right.toDouble())
      })
    }

    // кадры больше не нужны — папку стереть сразу (не ждать, пока система почистит кэш)
    Function("releaseIntro") { dir: String -> releaseIntroDir(dir) }
  }

  /**
   * Кадры [startS, startS + durS] исходного видео — все подряд, с его частотой: в замедлении нужен каждый.
   * Уменьшены до maxSide по длинной стороне, повёрнуты как на экране. Прежние папки кадров (экран закрыли посреди
   * вступления, приложение упало) удаляются перед каждым запуском — мусор в кэше не копится.
   * Android 9+: getFramesAtIndex (декодирование подряд, пачками — чтобы не держать в памяти десятки кадров 4K);
   * старее — getFrameAtTime(OPTION_CLOSEST) по одному.
   */
  private fun introFrames(uriStr: String, startS: Double, durS: Double, maxSide: Int): Map<String, Any> {
    introCancelled = false
    val t0 = System.currentTimeMillis()
    context.cacheDir.listFiles { f -> f.isDirectory && f.name.startsWith(INTRO_PREFIX) }?.forEach { it.deleteRecursively() }
    val dir = File(context.cacheDir, "$INTRO_PREFIX${System.currentTimeMillis()}")
    if (!dir.mkdirs()) throw CodedException("не получилось создать папку для кадров")
    val r = MediaMetadataRetriever()
    try {
      val uri = Uri.parse(uriStr)
      val p = probe(uri)
      r.setDataSource(context, uri)
      val rot = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_ROTATION)?.toIntOrNull() ?: 0
      val fps = if (p.fps in 5f..240f) p.fps else 30f
      val count = if (Build.VERSION.SDK_INT >= 28) {
        r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_FRAME_COUNT)?.toIntOrNull() ?: 0
      } else 0
      val first = (startS * fps).roundToInt().coerceAtLeast(0)
      var n = (durS * fps).roundToInt() + 1
      if (count > 0) n = min(n, count - first)
      if (n < 2) throw CodedException("в видео нет нужной секунды")

      val files = ArrayList<String>(n)
      var outW = 0
      var outH = 0
      fun save(raw: Bitmap) {
        val fixed = orient(raw, rot, p.width, p.height)
        val k = min(1.0, maxSide.toDouble() / max(fixed.width, fixed.height))
        val small = if (k < 1.0) {
          Bitmap.createScaledBitmap(fixed, (fixed.width * k).roundToInt(), (fixed.height * k).roundToInt(), true)
        } else fixed
        outW = small.width
        outH = small.height
        val f = File(dir, "%03d.jpg".format(files.size))
        FileOutputStream(f).use { small.compress(Bitmap.CompressFormat.JPEG, 88, it) }
        files.add(Uri.fromFile(f).toString())
        if (small !== fixed) small.recycle()
        if (fixed !== raw) fixed.recycle()
        raw.recycle()
      }

      // быстрый путь: один проход аппаратного декодера по нужной секунде; не вышел (HDR, необычный формат) — системный
      val fast = try {
        decodeSegment(uri, first / fps.toDouble(), n, fps, maxSide, rot) { save(it) }
      } catch (e: CodedException) {
        throw e
      } catch (_: Throwable) {
        false
      }
      if (!fast) {
        files.forEach { u -> Uri.parse(u).path?.let { File(it).delete() } }
        files.clear()
      }
      if (fast) {
        // кадры уже сохранены
      } else if (Build.VERSION.SDK_INT >= 28 && count > 0) {
        val params = MediaMetadataRetriever.BitmapParams().apply { preferredConfig = Bitmap.Config.RGB_565 }
        val frameBytes = max(1, p.width * p.height * 2)
        val batch = (INTRO_BATCH_BYTES / frameBytes).coerceIn(2, 16)
        var i = 0
        while (i < n) {
          if (introCancelled) throw CodedException("отменено")
          val k = min(batch, n - i)
          r.getFramesAtIndex(first + i, k, params).forEach { save(it) }
          i += k
        }
      } else {
        for (i in 0 until n) {
          if (introCancelled) throw CodedException("отменено")
          val us = ((first + i + 0.5) / fps * 1_000_000).toLong()   // середина кадра — без попадания на соседний
          save(r.getFrameAtTime(us, MediaMetadataRetriever.OPTION_CLOSEST) ?: break)
        }
      }
      if (files.size < 2) throw CodedException("не получилось достать кадры")
      Log.i("VideoPrep", "intro frames: ${files.size} (${outW}x${outH}, $fps fps) in ${System.currentTimeMillis() - t0} ms, " + (if (fast) "decoder" else "retriever"))
      return mapOf("dir" to dir.absolutePath, "frames" to files, "fps" to fps.toDouble(), "width" to outW, "height" to outH)
    } catch (e: Throwable) {
      dir.deleteRecursively()
      throw if (e is CodedException) e else CodedException(e.message ?: "не получилось достать кадры", e)
    } finally {
      r.release()
    }
  }

  /**
   * Кадры [startS, startS + n кадров) одним проходом декодера: от опорного кадра перед startS подряд, без новой
   * перемотки на каждый кадр (системный getFramesAtIndex на Samsung заново запускает декодер на каждый кадр — ~0,2 с).
   * Выход декодера — YUV 4:2:0 (8 бит); перевод в RGB сразу с уменьшением (шаг по пикселям), поворот — как на экране.
   * false — этот путь не подходит (HDR / 10 бит, нет кадров в YUV): вызывающий берёт системный.
   */
  private fun decodeSegment(uri: Uri, startS: Double, n: Int, fps: Float, maxSide: Int, rot: Int, onFrame: (Bitmap) -> Unit): Boolean {
    val ex = MediaExtractor()
    var codec: MediaCodec? = null
    try {
      ex.setDataSource(context, uri, null)
      val track = (0 until ex.trackCount).firstOrNull {
        ex.getTrackFormat(it).getString(MediaFormat.KEY_MIME)?.startsWith("video/") == true
      } ?: return false
      val fmt = ex.getTrackFormat(track)
      val transfer = if (fmt.containsKey(MediaFormat.KEY_COLOR_TRANSFER)) fmt.getInteger(MediaFormat.KEY_COLOR_TRANSFER) else 0
      if (transfer == MediaFormat.COLOR_TRANSFER_ST2084 || transfer == MediaFormat.COLOR_TRANSFER_HLG) return false
      val full = fmt.containsKey(MediaFormat.KEY_COLOR_RANGE) &&
        fmt.getInteger(MediaFormat.KEY_COLOR_RANGE) == MediaFormat.COLOR_RANGE_FULL
      val std = if (fmt.containsKey(MediaFormat.KEY_COLOR_STANDARD)) fmt.getInteger(MediaFormat.KEY_COLOR_STANDARD) else 0
      val mime = fmt.getString(MediaFormat.KEY_MIME) ?: return false
      ex.selectTrack(track)
      fmt.setInteger(MediaFormat.KEY_COLOR_FORMAT, MediaCodecInfo.CodecCapabilities.COLOR_FormatYUV420Flexible)
      val c = MediaCodec.createDecoderByType(mime)
      codec = c
      c.configure(fmt, null, null, 0)
      c.start()
      val startUs = (startS * 1_000_000).toLong()
      val halfUs = (500_000 / fps).toLong()
      ex.seekTo(startUs, MediaExtractor.SEEK_TO_PREVIOUS_SYNC)
      val info = MediaCodec.BufferInfo()
      val deadline = System.currentTimeMillis() + 15_000
      var inputDone = false
      var got = 0
      while (got < n) {
        if (introCancelled) throw CodedException("отменено")
        if (System.currentTimeMillis() > deadline) return false
        if (!inputDone) {
          val ii = c.dequeueInputBuffer(10_000)
          if (ii >= 0) {
            val size = ex.readSampleData(c.getInputBuffer(ii)!!, 0)
            if (size < 0) {
              c.queueInputBuffer(ii, 0, 0, 0, MediaCodec.BUFFER_FLAG_END_OF_STREAM)
              inputDone = true
            } else {
              c.queueInputBuffer(ii, 0, size, ex.sampleTime, 0)
              ex.advance()
            }
          }
        }
        val oi = c.dequeueOutputBuffer(info, 10_000)
        if (oi < 0) continue
        val eos = (info.flags and MediaCodec.BUFFER_FLAG_END_OF_STREAM) != 0
        if (info.size > 0 && info.presentationTimeUs >= startUs - halfUs) {
          val img = c.getOutputImage(oi)
          if (img == null || img.format != ImageFormat.YUV_420_888) {
            img?.close()
            c.releaseOutputBuffer(oi, false)
            return false
          }
          val bmp = try {
            yuvToBitmap(img, maxSide, full, std)
          } finally {
            img.close()
          }
          c.releaseOutputBuffer(oi, false)
          onFrame(orientTo(bmp, rot))
          got++
        } else {
          c.releaseOutputBuffer(oi, false)
        }
        if (eos) break
      }
      return got >= 2
    } finally {
      try {
        codec?.stop()
      } catch (_: Throwable) {
      }
      codec?.release()
      ex.release()
    }
  }

  /** YUV 4:2:0 → RGB с целым шагом уменьшения (до maxSide по длинной стороне); матрица BT.709 / BT.601, диапазон. */
  private fun yuvToBitmap(img: Image, maxSide: Int, full: Boolean, std: Int): Bitmap {
    val crop = img.cropRect
    val cw = crop.width()
    val ch = crop.height()
    val step = max(1, max(cw, ch) / maxSide)   // целый шаг не крупнее нужного; точно до maxSide уменьшает save()
    val w = cw / step
    val h = ch / step
    val yP = img.planes[0]
    val uP = img.planes[1]
    val vP = img.planes[2]
    val yB = ByteArray(yP.buffer.remaining()).also { yP.buffer.get(it) }
    val uB = ByteArray(uP.buffer.remaining()).also { uP.buffer.get(it) }
    val vB = ByteArray(vP.buffer.remaining()).also { vP.buffer.get(it) }
    val yRow = yP.rowStride
    val yPix = yP.pixelStride
    val uRow = uP.rowStride
    val uPix = uP.pixelStride
    val vRow = vP.rowStride
    val vPix = vP.pixelStride
    // коэффициенты ×1024; стандарт не указан — HD считаем BT.709, SD — BT.601
    val bt709 = when (std) {
      MediaFormat.COLOR_STANDARD_BT709 -> true
      MediaFormat.COLOR_STANDARD_BT601_PAL, MediaFormat.COLOR_STANDARD_BT601_NTSC -> false
      else -> min(cw, ch) >= 720
    }
    val ky = if (full) 1024 else 1192
    val kr: Int
    val kgu: Int
    val kgv: Int
    val kb: Int
    if (bt709) {
      if (full) { kr = 1613; kgu = 192; kgv = 479; kb = 1900 } else { kr = 1836; kgu = 218; kgv = 546; kb = 2163 }
    } else {
      if (full) { kr = 1436; kgu = 352; kgv = 731; kb = 1815 } else { kr = 1634; kgu = 401; kgv = 832; kb = 2066 }
    }
    val y0 = if (full) 0 else 16
    val px = IntArray(w * h)
    for (j in 0 until h) {
      val sy = crop.top + j * step
      val yBase = sy * yRow
      val cy = sy / 2
      for (i in 0 until w) {
        val sx = crop.left + i * step
        val yy = ((yB[yBase + sx * yPix].toInt() and 0xff) - y0) * ky
        val cx = sx / 2
        val u = (uB[cy * uRow + cx * uPix].toInt() and 0xff) - 128
        val v = (vB[cy * vRow + cx * vPix].toInt() and 0xff) - 128
        val r = ((yy + kr * v) shr 10).coerceIn(0, 255)
        val g = ((yy - kgu * u - kgv * v) shr 10).coerceIn(0, 255)
        val b = ((yy + kb * u) shr 10).coerceIn(0, 255)
        px[j * w + i] = (0xff shl 24) or (r shl 16) or (g shl 8) or b
      }
    }
    return Bitmap.createBitmap(px, w, h, Bitmap.Config.ARGB_8888)
  }

  /** Повернуть кадр декодера (он без поворота) как на экране. */
  private fun orientTo(b: Bitmap, rot: Int): Bitmap {
    if (rot % 360 == 0) return b
    val m = Matrix().apply { postRotate(rot.toFloat()) }
    val out = Bitmap.createBitmap(b, 0, 0, b.width, b.height, m, true)
    if (out !== b) b.recycle()
    return out
  }

  /** Повернуть кадр как на экране, если система не сделала это сама (по размеру: повёрнутый кадр — «высота × ширина»). */
  private fun orient(b: Bitmap, rot: Int, codedW: Int, codedH: Int): Bitmap {
    val quarter = rot % 180 != 0
    if (!quarter || codedW == codedH || b.width != codedW || b.height != codedH) return b
    val m = Matrix().apply { postRotate(rot.toFloat()) }
    return Bitmap.createBitmap(b, 0, 0, b.width, b.height, m, true)
  }

  /** Наша сжатая копия (prep_*.mp4 прямо в кэше приложения) — иначе null: чужие файлы и оригиналы из галереи не трогаем. */
  private fun preparedFile(uri: String): File? {
    val path = Uri.parse(uri).path ?: return null
    val f = File(path)
    val ours = f.parentFile?.canonicalPath == context.cacheDir.canonicalPath && f.name.startsWith(PREP_PREFIX) && f.name.endsWith(".mp4")
    return if (ours) f else null
  }

  /** Стереть папку кадров — только нашу, внутри кэша приложения. */
  private fun releaseIntroDir(path: String) {
    val f = File(path)
    if (f.parentFile?.canonicalPath == context.cacheDir.canonicalPath && f.name.startsWith(INTRO_PREFIX)) f.deleteRecursively()
  }

  private data class Probe(val width: Int, val height: Int, val fps: Float, val durationMs: Long)

  private fun probe(uri: Uri): Probe {
    val r = MediaMetadataRetriever()
    try {
      r.setDataSource(context, uri)
      val w = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_WIDTH)?.toIntOrNull() ?: 0
      val h = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_VIDEO_HEIGHT)?.toIntOrNull() ?: 0
      val d = r.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)?.toLongOrNull() ?: 0L
      var fps = 30f
      val ex = MediaExtractor()
      try {
        ex.setDataSource(context, uri, null)
        for (i in 0 until ex.trackCount) {
          val f = ex.getTrackFormat(i)
          if (f.getString(MediaFormat.KEY_MIME)?.startsWith("video/") == true && f.containsKey(MediaFormat.KEY_FRAME_RATE)) {
            fps = f.getInteger(MediaFormat.KEY_FRAME_RATE).toFloat()
          }
        }
      } catch (_: Throwable) {
      } finally {
        ex.release()
      }
      return Probe(w, h, fps, d)
    } finally {
      r.release()
    }
  }

  private fun start(uriStr: String, startS: Double?, endS: Double?, promise: Promise) {
    val uri = Uri.parse(uriStr)
    val p = probe(uri)
    val shortSide = min(p.width, p.height)
    val outShort = if (shortSide > MAX_SHORT) MAX_SHORT else shortSide
    val scale = if (shortSide > 0) outShort.toDouble() / shortSide else 1.0
    val area = p.width * scale * p.height * scale
    val baseMbps = if (p.fps > 31) MBPS_60 else MBPS_30
    val bitrate = max(1_500_000, (baseMbps * 1_000_000 * area / (1920.0 * 1080.0)).toInt())

    val item = MediaItem.Builder().setUri(uri)
    if (startS != null || endS != null) {
      val clip = MediaItem.ClippingConfiguration.Builder()
      if (startS != null) clip.setStartPositionMs((startS * 1000).toLong())
      if (endS != null) clip.setEndPositionMs((endS * 1000).toLong())
      item.setClippingConfiguration(clip.build())
    }
    val effects = if (shortSide > MAX_SHORT) listOf(Presentation.createForShortSide(MAX_SHORT)) else emptyList()
    val edited = EditedMediaItem.Builder(item.build())
      .setRemoveAudio(true)
      .setEffects(Effects(emptyList(), effects))
      .build()
    val composition = Composition.Builder(EditedMediaItemSequence.Builder(setOf(C.TRACK_TYPE_VIDEO)).addItem(edited).build())
      .setHdrMode(Composition.HDR_MODE_TONE_MAP_HDR_TO_SDR_USING_OPEN_GL)
      .build()

    val out = File(context.cacheDir, "$PREP_PREFIX${System.currentTimeMillis()}.mp4")
    preparing = out
    val encoder = DefaultEncoderFactory.Builder(context)
      .setRequestedVideoEncoderSettings(VideoEncoderSettings.Builder().setBitrate(bitrate).build())
      .build()
    val progress = ProgressHolder()
    lateinit var tick: Runnable
    val t = Transformer.Builder(context)
      .setVideoMimeType(MimeTypes.VIDEO_H264)
      // вертикальное видео — вертикальным кадром: по умолчанию Media3 кодирует «лёжа» и ставит пометку поворота, а
      // сервер (стандарт разбора: поворот применён к картинке) тогда пересжимает ролик заново — ~75 с на VPS
      .setPortraitEncodingEnabled(true)
      .setEncoderFactory(encoder)
      .addListener(object : Transformer.Listener {
        override fun onCompleted(composition: Composition, result: ExportResult) {
          main.removeCallbacks(tick)
          transformer = null
          preparing = null
          promise.resolve(
            mapOf(
              "uri" to Uri.fromFile(out).toString(),
              "bytes" to out.length().toDouble(),
              "durationS" to result.durationMs / 1000.0,
              "sourceWidth" to p.width,
              "sourceHeight" to p.height,
              "bitrate" to bitrate,
            ),
          )
        }

        override fun onError(composition: Composition, result: ExportResult, e: ExportException) {
          main.removeCallbacks(tick)
          transformer = null
          preparing = null
          out.delete()
          promise.reject(CodedException("не получилось подготовить видео: ${e.errorCodeName}", e))
        }
      })
      .build()
    transformer = t
    tick = Runnable {
      val cur = transformer ?: return@Runnable
      if (cur.getProgress(progress) == Transformer.PROGRESS_STATE_AVAILABLE) {
        sendEvent("onProgress", mapOf("progress" to progress.progress / 100.0))
      }
      main.postDelayed(tick, 250)
    }
    t.start(composition, out.absolutePath)
    main.postDelayed(tick, 250)
  }

  companion object {
    const val MAX_SHORT = 1080
    const val MBPS_30 = 4.0
    const val MBPS_60 = 6.0
    const val INTRO_PREFIX = "intro_frames_"
    const val PREP_PREFIX = "prep_"
    // память на пачку кадров полного размера при извлечении (RGB 565): 4K — по 3 кадра, 1080p — по 16
    const val INTRO_BATCH_BYTES = 64 * 1024 * 1024
  }
}
