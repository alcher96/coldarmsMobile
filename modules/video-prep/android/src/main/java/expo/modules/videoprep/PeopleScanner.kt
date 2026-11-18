package expo.modules.videoprep

import android.content.Context
import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.util.Log
import com.google.mediapipe.framework.image.BitmapImageBuilder
import com.google.mediapipe.framework.image.ByteBufferExtractor
import com.google.mediapipe.framework.image.MPImage
import com.google.mediapipe.tasks.components.containers.NormalizedKeypoint
import com.google.mediapipe.tasks.core.BaseOptions
import com.google.mediapipe.tasks.core.Delegate
import com.google.mediapipe.tasks.vision.core.RunningMode
import com.google.mediapipe.tasks.vision.imagesegmenter.ImageSegmenter
import com.google.mediapipe.tasks.vision.interactivesegmenter.InteractiveSegmenter
import com.google.mediapipe.tasks.vision.interactivesegmenter.InteractiveSegmenterOptions
import com.google.mediapipe.tasks.vision.interactivesegmenter.Stroke
import com.google.mediapipe.tasks.vision.objectdetector.ObjectDetector
import java.io.File
import java.io.FileOutputStream
import java.nio.ByteBuffer
import java.nio.ByteOrder
import kotlin.math.abs
import kotlin.math.hypot
import kotlin.math.max
import kotlin.math.min

/**
 * Силуэты людей на замершем кадре вступления MIRA — для «скана» в интерфейсе (только украшение, в разбор не идёт).
 *
 * Как на стенде annotator/report/scan_contours.html (эксперт, 2026-11-18: «идеально» — способ 1):
 *  1. детектор людей EfficientDet-Lite2 (int8, процессор) — рамка на каждого человека;
 *  2. сегментатор Magic Touch v2 (MediaPipe 1.2) на ЦЕЛОМ кадре: картинка задаётся один раз, затем на каждого человека
 *     штрих через корпус; маска обрезается рамкой (+8%), чтобы руки в захвате не склеивали двух борцов. На вырезке
 *     человека Magic Touch выделяет не того (стенд, способ 2: руки, захват) — ему нужен весь кадр. Старый Magic Touch
 *     (MediaPipe 0.10.35) на Android отметку не учитывал ни на процессоре, ни на видеокарте — одна маска на всех;
 *  3. проверка: маска не про этого человека (почти вся вне его рамки) — запасной путь: сегментатор людей selfie
 *     (0,25 МБ) по вырезке человека (стенд, способ 3а);
 *  4. маска → внешний контур крупнейшего пятна (обход по соседям), упрощение и сглаживание.
 * Модели — в ресурсах модуля (assets/scan, MediaPipe, Apache-2.0); загружаются на время одного скана и сразу
 * закрываются — в памяти между сканами ничего не остаётся.
 */
class PeopleScanner(private val context: Context) {

  /** Силуэт: контур в долях кадра (x0, y0, x1, y1, …), по часовой стрелке. */
  data class Person(val points: FloatArray, val left: Float, val right: Float)

  /** Маска и где она лежит на кадре: (ox, oy) — левый верхний угол, sw × sh — размер в пикселях кадра. */
  private class Placed(val m: FloatArray, val mw: Int, val mh: Int, val ox: Int, val oy: Int, val sw: Int, val sh: Int)

  /**
   * stop — пора остановиться (вышел срок или ушли с экрана): проверяется перед каждым тяжёлым шагом (модель сегментатора,
   * каждый следующий человек). Остановились — возвращаются силуэты, готовые к этому моменту (может быть пусто).
   */
  fun scan(imagePath: String, maxPeople: Int, stop: () -> Boolean = { false }): List<Person> {
    val bitmap = BitmapFactory.decodeFile(imagePath, BitmapFactory.Options().apply {
      inPreferredConfig = Bitmap.Config.ARGB_8888
    }) ?: throw IllegalArgumentException("кадр не прочитался")
    val image = BitmapImageBuilder(bitmap).build()
    val w = bitmap.width
    val h = bitmap.height
    var detector: ObjectDetector? = null
    var touch: InteractiveSegmenter? = null
    var selfie: ImageSegmenter? = null
    try {
      detector = ObjectDetector.createFromOptions(
        context,
        ObjectDetector.ObjectDetectorOptions.builder()
          .setBaseOptions(options(DETECTOR))
          .setRunningMode(RunningMode.IMAGE)
          .setScoreThreshold(SCORE)
          .setMaxResults(maxPeople)
          .setCategoryAllowlist(listOf("person"))
          .build(),
      )
      val t0 = System.currentTimeMillis()
      val boxes = detector.detect(image).detections().map { it.boundingBox() }
      Log.i(TAG, "people: ${boxes.size} boxes on ${w}x$h in ${System.currentTimeMillis() - t0} ms")
      detector.close()
      detector = null
      if (boxes.isEmpty() || stop()) return emptyList()

      // Magic Touch v2: модель квантована (int8) — процессор; картинка — один раз на все штрихи
      val tTouch = System.currentTimeMillis()
      touch = InteractiveSegmenter.createFromOptions(
        context,
        InteractiveSegmenterOptions.builder()
          .setBaseOptions(BaseOptions.builder().setModelAssetPath(modelFile(SEGMENTER).absolutePath).setDelegate(Delegate.CPU).build())
          .build(),
      )
      touch.setImage(image)
      Log.i(TAG, "people: Magic Touch ready in ${System.currentTimeMillis() - tTouch} ms")
      val people = ArrayList<Person>(boxes.size)
      var byTouch = 0
      var bySelfie = 0
      for (b in boxes) {
        if (stop()) {
          Log.i(TAG, "people: stopped after ${people.size} of ${boxes.size} (deadline or leave)")
          break
        }
        val x0 = max(0, (b.left - b.width() * PAD).toInt())
        val y0 = max(0, (b.top - b.height() * PAD).toInt())
        val x1 = min(w, (b.right + b.width() * PAD).toInt())
        val y1 = min(h, (b.bottom + b.height() * PAD).toInt())
        if (x1 - x0 < 8 || y1 - y0 < 8) continue
        // 1) Magic Touch на целом кадре: штрих по корпусу (верх груди → живот), маска — только в рамке
        val cx = b.centerX() / w
        val stroke = listOf(0.30f, 0.42f, 0.55f).map { NormalizedKeypoint.create(cx, (b.top + b.height() * it) / h) }
        val brush = Stroke.builder().setBrushMode(Stroke.BrushMode.POSITIVE).setPoints(stroke).setCompleted(true).build()
        var placed = firstMask(listOf(touch.segment(listOf(brush))))
          ?.let { (m, mw, mh) -> keepInBox(m, mw, mh, w, h, x0, y0, x1, y1) }
        // 2) не про этого человека — selfie по вырезке
        if (placed == null) {
          if (selfie == null) selfie = ImageSegmenter.createFromOptions(
            context,
            ImageSegmenter.ImageSegmenterOptions.builder()
              .setBaseOptions(options(SELFIE))
              .setRunningMode(RunningMode.IMAGE)
              .setOutputConfidenceMasks(true)
              .setOutputCategoryMask(false)
              .build(),
          )
          placed = selfieCrop(selfie!!, bitmap, b.left, b.top, b.right, b.bottom, w, h)
          if (placed != null) bySelfie++
        } else byTouch++
        val pl = placed ?: continue
        val c = contour(pl.m, pl.mw, pl.mh) ?: continue
        // контур маски → доли всего кадра
        val pts = FloatArray(c.size * 2)
        var minX = 1f
        var maxX = 0f
        c.forEachIndexed { i, q ->
          pts[i * 2] = (pl.ox + q[0] / pl.mw * pl.sw) / w
          pts[i * 2 + 1] = (pl.oy + q[1] / pl.mh * pl.sh) / h
          minX = min(minX, pts[i * 2])
          maxX = max(maxX, pts[i * 2])
        }
        people.add(Person(pts, minX, maxX))
      }
      Log.i(TAG, "people: ${people.size} contours (Magic Touch $byTouch, selfie $bySelfie) in ${System.currentTimeMillis() - t0} ms")
      return people
    } finally {
      detector?.close()
      touch?.close()
      selfie?.close()
      image.close()
      bitmap.recycle()
    }
  }

  /** Последняя маска уверенности (передний план) как массив; маски закрываются. */
  private fun firstMask(masks: List<MPImage>?): Triple<FloatArray, Int, Int>? {
    if (masks.isNullOrEmpty()) return null
    val mask = masks.last()
    val mw = mask.width
    val mh = mask.height
    val fb = ByteBufferExtractor.extract(mask).order(ByteOrder.nativeOrder()).asFloatBuffer()
    val m = FloatArray(mw * mh).also { fb.get(it) }
    masks.forEach { it.close() }
    return Triple(m, mw, mh)
  }

  /**
   * Маска целого кадра → только рамка человека. null — маска не про него: внутри рамки меньше 60% силуэта
   * или почти пусто (так выходит, когда сегментатор выделил кого-то другого).
   */
  private fun keepInBox(m: FloatArray, mw: Int, mh: Int, w: Int, h: Int, x0: Int, y0: Int, x1: Int, y1: Int): Placed? {
    val sx = mw.toFloat() / w
    val sy = mh.toFloat() / h
    val bx0 = (x0 * sx).toInt()
    val by0 = (y0 * sy).toInt()
    val bx1 = (x1 * sx).toInt()
    val by1 = (y1 * sy).toInt()
    var total = 0
    var inside = 0
    for (y in 0 until mh) for (x in 0 until mw) {
      if (m[y * mw + x] > 0.5f) {
        total++
        if (x in bx0 until bx1 && y in by0 until by1) inside++
      }
    }
    val boxArea = max(1, (bx1 - bx0) * (by1 - by0))
    if (total == 0 || inside < total * 0.6f || inside < boxArea * 0.08f) return null
    for (y in 0 until mh) for (x in 0 until mw) {
      if (x !in bx0 until bx1 || y !in by0 until by1) m[y * mw + x] = 0f
    }
    return Placed(m, mw, mh, 0, 0, w, h)
  }

  /** Запасной путь: сегментатор людей по вырезке человека (рамка +15% — меньше срезов по краю вырезки). */
  private fun selfieCrop(seg: ImageSegmenter, bitmap: Bitmap, l: Float, t: Float, r: Float, b: Float, w: Int, h: Int): Placed? {
    val bw = r - l
    val bh = b - t
    val x0 = max(0, (l - bw * CROP_PAD).toInt())
    val y0 = max(0, (t - bh * CROP_PAD).toInt())
    val x1 = min(w, (r + bw * CROP_PAD).toInt())
    val y1 = min(h, (b + bh * CROP_PAD).toInt())
    val cw = x1 - x0
    val ch = y1 - y0
    if (cw < 8 || ch < 8) return null
    val crop = Bitmap.createBitmap(bitmap, x0, y0, cw, ch)
    val img = BitmapImageBuilder(crop).build()
    try {
      val (m, mw, mh) = firstMask(seg.segment(img).confidenceMasks().orElse(null)) ?: return null
      return Placed(m, mw, mh, x0, y0, cw, ch)
    } finally {
      img.close()
      if (crop !== bitmap) crop.recycle()
    }
  }

  /**
   * Модель из ресурсов — файлом на устройстве: новый сегментатор (Magic Touch v2) грузит модель только по пути к файлу,
   * не из памяти. Копируется один раз (размер совпал — уже на месте) в служебную папку приложения (не кэш: уборка кэша
   * её не трогает, удаляется вместе с приложением).
   */
  private fun modelFile(asset: String): File {
    val dir = File(context.noBackupFilesDir, "mediapipe").apply { mkdirs() }
    val out = File(dir, asset.substringAfterLast('/'))
    // сжатый ресурс дескриптором не открыть — тогда размер неизвестен, хватит того, что файл уже есть
    val size = runCatching { context.assets.openFd(asset).use { it.length } }.getOrNull()?.takeIf { it > 0 }
    if (out.exists() && (size == null || out.length() == size)) return out
    val tmp = File(dir, out.name + ".part")
    context.assets.open(asset).use { input -> FileOutputStream(tmp).use { input.copyTo(it) } }
    if (!tmp.renameTo(out)) throw IllegalStateException("модель не сохранилась")
    return out
  }

  /** Модель из ресурсов в прямой буфер (сжатие ресурса в APK тогда не важно). */
  private fun options(asset: String, delegate: Delegate = Delegate.CPU): BaseOptions {
    val bytes = context.assets.open(asset).use { it.readBytes() }
    val buf = ByteBuffer.allocateDirect(bytes.size).order(ByteOrder.nativeOrder())
    buf.put(bytes).rewind()
    return BaseOptions.builder().setModelAssetBuffer(buf).setDelegate(delegate).build()
  }

  /** Маска (0…1) → внешний контур крупнейшего пятна в пикселях маски: шаг 2 px, обход по соседям, упрощение, сглаживание. */
  private fun contour(m: FloatArray, mw: Int, mh: Int): List<FloatArray>? {
    val s = 2
    val w = mw / s
    val h = mh / s
    val gw = w + 2                                     // рамка из фона — обход не выходит за край
    val g = ByteArray(gw * (h + 2))
    for (y in 0 until h) for (x in 0 until w) {
      var a = 0f
      for (dy in 0 until s) for (dx in 0 until s) a += m[(y * s + dy) * mw + x * s + dx]
      if (a / (s * s) > 0.5f) g[(y + 1) * gw + x + 1] = 1
    }
    // крупнейшее связное пятно
    val lab = IntArray(g.size)
    val q = IntArray(g.size)
    var best = 0
    var bestN = 0
    var cur = 0
    for (i in g.indices) {
      if (g[i].toInt() == 0 || lab[i] != 0) continue
      cur++
      var qh = 0
      var qt = 0
      var n = 0
      q[qt++] = i
      lab[i] = cur
      while (qh < qt) {
        val k = q[qh++]
        n++
        for (nb in intArrayOf(k - 1, k + 1, k - gw, k + gw)) {
          if (g[nb].toInt() == 1 && lab[nb] == 0) { lab[nb] = cur; q[qt++] = nb }
        }
      }
      if (n > bestN) { bestN = n; best = cur }
    }
    if (bestN < MIN_AREA) return null
    for (i in g.indices) g[i] = if (lab[i] == best) 1 else 0
    // обход границы (Мур), по часовой стрелке
    val dx = intArrayOf(1, 1, 0, -1, -1, -1, 0, 1)
    val dy = intArrayOf(0, 1, 1, 1, 0, -1, -1, -1)
    val start = g.indexOfFirst { it.toInt() == 1 }
    var x = start % gw
    var y = start / gw
    var back = 4                                       // пришли с запада (там фон)
    val sx0 = x
    val sy0 = y
    val pts = ArrayList<FloatArray>()
    pts.add(floatArrayOf(x.toFloat(), y.toFloat()))
    for (step in 0 until 40000) {
      var moved = false
      for (i in 1..8) {
        val d = (back + i) % 8
        val nx = x + dx[d]
        val ny = y + dy[d]
        if (g[ny * gw + nx].toInt() == 1) {
          val pd = (back + i - 1) % 8
          val bx = x + dx[pd] - nx
          val by = y + dy[pd] - ny
          x = nx
          y = ny
          back = (0 until 8).first { k -> dx[k] == bx && dy[k] == by }
          moved = true
          break
        }
      }
      if (!moved || (x == sx0 && y == sy0)) break
      pts.add(floatArrayOf(x.toFloat(), y.toFloat()))
    }
    val simple = rdp(pts, 1.1f).map { floatArrayOf((it[0] - 1 + 0.5f) * s, (it[1] - 1 + 0.5f) * s) }
    return chaikin(chaikin(simple))
  }

  private fun rdp(p: List<FloatArray>, eps: Float): List<FloatArray> {
    if (p.size < 3) return p
    val a = p.first()
    val b = p.last()
    val len = hypot(b[0] - a[0], b[1] - a[1]).takeIf { it > 0f } ?: 1f
    var idx = 0
    var dm = 0f
    for (i in 1 until p.size - 1) {
      val d = abs((b[0] - a[0]) * (a[1] - p[i][1]) - (a[0] - p[i][0]) * (b[1] - a[1])) / len
      if (d > dm) { dm = d; idx = i }
    }
    if (dm <= eps) return listOf(a, b)
    return rdp(p.subList(0, idx + 1), eps).dropLast(1) + rdp(p.subList(idx, p.size), eps)
  }

  private fun chaikin(p: List<FloatArray>): List<FloatArray> {
    val o = ArrayList<FloatArray>(p.size * 2)
    for (i in p.indices) {
      val a = p[i]
      val b = p[(i + 1) % p.size]
      o.add(floatArrayOf(a[0] * .75f + b[0] * .25f, a[1] * .75f + b[1] * .25f))
      o.add(floatArrayOf(a[0] * .25f + b[0] * .75f, a[1] * .25f + b[1] * .75f))
    }
    return o
  }

  companion object {
    const val TAG = "VideoPrep"
    const val DETECTOR = "scan/efficientdet_lite2.tflite"
    const val SEGMENTER = "scan/interactive_segmentation.task"
    const val SELFIE = "scan/selfie_segmenter.tflite"
    const val CROP_PAD = 0.15f
    const val SCORE = 0.3f
    const val PAD = 0.08f
    const val MIN_AREA = 60
  }
}
