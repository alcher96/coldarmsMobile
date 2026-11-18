package expo.modules.videoprep

import android.content.Context
import android.media.MediaExtractor
import android.media.MediaFormat
import android.media.MediaMetadataRetriever
import android.net.Uri
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
import kotlin.math.max
import kotlin.math.min

/**
 * Обрезка и приведение видео к стандарту на телефоне перед отправкой — за один проход, аппаратным кодировщиком
 * (Media3 Transformer). Тот же стандарт, что у сервера (annotator/video_ingest.py): H.264 без звука, короткая сторона
 * не больше 1080, HDR → обычный цвет, поворот применяется к кадру, ~4 Мбит/с при 30 к/с и ~6 при 60 (для меньших
 * кадров — пропорционально площади, не ниже 1.5). Сервер всё равно проверяет результат и при нужде пересобирает сам.
 */
@UnstableApi
class VideoPrepModule : Module() {
  private var transformer: Transformer? = null
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
      main.post { transformer?.cancel(); transformer = null }
    }
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

    val out = File(context.cacheDir, "prep_${System.currentTimeMillis()}.mp4")
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
  }
}
