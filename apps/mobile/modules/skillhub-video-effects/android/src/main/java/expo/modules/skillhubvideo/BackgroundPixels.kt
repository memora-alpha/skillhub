package expo.modules.skillhubvideo

import android.graphics.Bitmap
import android.graphics.Canvas
import android.graphics.LinearGradient
import android.graphics.Matrix
import android.graphics.Paint
import android.graphics.Shader
import java.nio.ByteBuffer
import livekit.org.webrtc.VideoFrame

internal data class Planes(val y: ByteArray, val u: ByteArray, val v: ByteArray)

internal object BackgroundPixels {
  fun read(buffer: ByteBuffer, stride: Int, width: Int, height: Int): ByteArray {
    val output = ByteArray(width * height)
    val input = buffer.duplicate()
    for (row in 0 until height) {
      input.position(row * stride)
      input.get(output, row * width, width)
    }
    return output
  }

  fun fromFrame(frame: VideoFrame.I420Buffer): Planes = Planes(
    read(frame.dataY, frame.strideY, frame.width, frame.height),
    read(frame.dataU, frame.strideU, frame.width / 2, frame.height / 2),
    read(frame.dataV, frame.strideV, frame.width / 2, frame.height / 2)
  )

  fun nv21(planes: Planes): ByteArray {
    val output = ByteArray(planes.y.size + planes.u.size * 2)
    planes.y.copyInto(output)
    for (index in planes.u.indices) {
      output[planes.y.size + index * 2] = planes.v[index]
      output[planes.y.size + index * 2 + 1] = planes.u[index]
    }
    return output
  }

  fun preset(name: String, width: Int, height: Int, rotation: Int): Planes {
    val uprightWidth = if (rotation % 180 == 0) width else height
    val uprightHeight = if (rotation % 180 == 0) height else width
    val colors = when (name) {
      "ocean" -> intArrayOf(0xff143e61.toInt(), 0xff2b8192.toInt(), 0xffa7d9ca.toInt())
      "sunset" -> intArrayOf(0xff5c344b.toInt(), 0xffb96e69.toInt(), 0xffe8bf91.toInt())
      else -> intArrayOf(0xff352c59.toInt(), 0xff7162a3.toInt(), 0xffc0b9dd.toInt())
    }
    val bitmap = Bitmap.createBitmap(uprightWidth, uprightHeight, Bitmap.Config.ARGB_8888)
    Canvas(bitmap).drawPaint(Paint().apply {
      shader = LinearGradient(0f, 0f, uprightWidth.toFloat(), uprightHeight.toFloat(), colors, null, Shader.TileMode.CLAMP)
    })
    val rotated = if (rotation == 0) bitmap else Bitmap.createBitmap(
      bitmap, 0, 0, uprightWidth, uprightHeight, Matrix().apply { postRotate(-rotation.toFloat()) }, false
    )
    val pixels = IntArray(width * height)
    rotated.getPixels(pixels, 0, width, 0, 0, width, height)
    if (rotated !== bitmap) rotated.recycle()
    bitmap.recycle()
    val y = ByteArray(width * height)
    val u = ByteArray(width * height / 4)
    val v = ByteArray(u.size)
    for (row in 0 until height) for (column in 0 until width) {
      val color = pixels[row * width + column]
      val r = color shr 16 and 255
      val g = color shr 8 and 255
      val b = color and 255
      y[row * width + column] = (((66 * r + 129 * g + 25 * b + 128) shr 8) + 16).coerceIn(16, 235).toByte()
      if (row % 2 == 0 && column % 2 == 0) {
        val index = row / 2 * (width / 2) + column / 2
        u[index] = (((-38 * r - 74 * g + 112 * b + 128) shr 8) + 128).coerceIn(16, 240).toByte()
        v[index] = (((112 * r - 94 * g - 18 * b + 128) shr 8) + 128).coerceIn(16, 240).toByte()
      }
    }
    return Planes(y, u, v)
  }
}
