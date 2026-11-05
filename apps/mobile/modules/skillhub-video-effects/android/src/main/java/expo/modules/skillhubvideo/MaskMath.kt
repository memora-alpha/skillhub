package expo.modules.skillhubvideo

import kotlin.math.floor

/** Maps an unrotated I420 pixel into ML Kit's upright confidence mask. */
internal object MaskMath {
  fun alpha(mask: FloatArray, width: Int, height: Int, x: Float, y: Float, rotation: Int): Int {
    val u = when (rotation) { 90 -> 1f - y; 180 -> 1f - x; 270 -> y; else -> x }
    val v = when (rotation) { 90 -> x; 180 -> 1f - y; 270 -> 1f - x; else -> y }
    val px = (u * width - 0.5f).coerceIn(0f, (width - 1).toFloat())
    val py = (v * height - 0.5f).coerceIn(0f, (height - 1).toFloat())
    val x0 = floor(px).toInt()
    val y0 = floor(py).toInt()
    val x1 = (x0 + 1).coerceAtMost(width - 1)
    val y1 = (y0 + 1).coerceAtMost(height - 1)
    val dx = px - x0
    val dy = py - y0
    val top = mask[y0 * width + x0] * (1 - dx) + mask[y0 * width + x1] * dx
    val bottom = mask[y1 * width + x0] * (1 - dx) + mask[y1 * width + x1] * dx
    val confidence = top * (1 - dy) + bottom * dy
    if (!confidence.isFinite()) return 0
    val t = ((confidence - 0.2f) / 0.65f).coerceIn(0f, 1f)
    return (255 * t * t * (3 - 2 * t)).toInt()
  }

  fun blend(foreground: Int, background: Int, alpha: Int): Byte =
    ((foreground * alpha + background * (255 - alpha) + 127) / 255).toByte()

  fun blur(source: ByteArray, width: Int, height: Int, radius: Int): ByteArray {
    val horizontal = ByteArray(source.size)
    val output = ByteArray(source.size)
    val divisor = radius * 2 + 1
    for (y in 0 until height) {
      var sum = 0
      for (offset in -radius..radius) sum += source[y * width + offset.coerceIn(0, width - 1)].toInt() and 255
      for (x in 0 until width) {
        horizontal[y * width + x] = (sum / divisor).toByte()
        sum -= source[y * width + (x - radius).coerceIn(0, width - 1)].toInt() and 255
        sum += source[y * width + (x + radius + 1).coerceIn(0, width - 1)].toInt() and 255
      }
    }
    for (x in 0 until width) {
      var sum = 0
      for (offset in -radius..radius) sum += horizontal[offset.coerceIn(0, height - 1) * width + x].toInt() and 255
      for (y in 0 until height) {
        output[y * width + x] = (sum / divisor).toByte()
        sum -= horizontal[(y - radius).coerceIn(0, height - 1) * width + x].toInt() and 255
        sum += horizontal[(y + radius + 1).coerceIn(0, height - 1) * width + x].toInt() and 255
      }
    }
    return output
  }
}
