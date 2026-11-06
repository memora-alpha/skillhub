package expo.modules.skillhubvideo

import android.os.SystemClock
import com.google.mlkit.vision.common.InputImage
import com.google.mlkit.vision.segmentation.Segmentation
import com.google.mlkit.vision.segmentation.selfie.SelfieSegmenterOptions
import com.oney.WebRTCModule.videoEffects.VideoFrameProcessor
import java.nio.ByteOrder
import java.nio.ByteBuffer
import java.util.concurrent.atomic.AtomicBoolean
import java.util.concurrent.atomic.AtomicInteger
import java.util.concurrent.atomic.AtomicReference
import livekit.org.webrtc.JavaI420Buffer
import livekit.org.webrtc.SurfaceTextureHelper
import livekit.org.webrtc.VideoFrame
import kotlin.math.max

internal class BackgroundProcessor(
  private val mode: String,
  private val preset: String,
  private val status: (String) -> Unit
) : VideoFrameProcessor, AutoCloseable {
  private data class Mask(val values: FloatArray, val width: Int, val height: Int, val at: Long)
  private data class BlendTarget(val data: ByteBuffer, val stride: Int, val width: Int, val height: Int)
  private val segmenter = Segmentation.getClient(SelfieSegmenterOptions.Builder()
    .setDetectorMode(SelfieSegmenterOptions.STREAM_MODE).enableRawSizeMask().build())
  private val mask = AtomicReference<Mask?>(null)
  private val detecting = AtomicBoolean(false)
  private val failed = AtomicBoolean(false)
  private val generation = AtomicInteger(0)
  @Volatile private var closed = false
  private var cached: VideoFrame? = null
  private var image: Planes? = null
  private var sourceWidth = 0
  private var sourceHeight = 0
  private var sourceRotation = 0
  private var lastFrameAt = 0L
  private var lastDetectionAt = 0L
  private var ready = false
  private val createdAt = SystemClock.elapsedRealtime()

  @Synchronized
  override fun process(frame: VideoFrame, textureHelper: SurfaceTextureHelper): VideoFrame {
    try {
      updateDimensions(frame)
      val now = SystemClock.elapsedRealtime()
      if (!ready && now - createdAt > 5_000) reportFailure()
      val previous = cached
      // A bounded 15 fps avoids running segmentation/compositing at camera frame rate.
      if (previous != null && (closed || failed.get() || now - lastFrameAt < 66))
        return copyFrame(previous, frame.timestampNs)
      val scale = minOf(1.0, 640.0 / max(sourceWidth, sourceHeight))
      val width = max(2, ((sourceWidth * scale).toInt() / 2) * 2)
      val height = max(2, ((sourceHeight * scale).toInt() / 2) * 2)
      if (closed) return solid(width, height, frame.rotation, frame.timestampNs)
      if (failed.get()) return remember(solid(width, height, frame.rotation, frame.timestampNs), now)
      val scaled = frame.buffer.cropAndScale(0, 0, sourceWidth, sourceHeight, width, height)
      val input = try { scaled.toI420() ?: error("I420_CONVERSION_FAILED") } finally { scaled.release() }
      val planes = try { BackgroundPixels.fromFrame(input) } finally { input.release() }
      detect(planes, width, height, frame.rotation, now)
      val snapshot = mask.get()?.takeIf { now - it.at <= 500 }
      if (snapshot == null) return remember(solid(width, height, frame.rotation, frame.timestampNs), now)
      val background = if (mode == "blur") Planes(
        MaskMath.blur(planes.y, width, height, 10),
        MaskMath.blur(planes.u, width / 2, height / 2, 5),
        MaskMath.blur(planes.v, width / 2, height / 2, 5)
      ) else image ?: BackgroundPixels.preset(preset, width, height, frame.rotation).also { image = it }
      val alpha = alphaMask(snapshot, width, height, frame.rotation)
      val output = JavaI420Buffer.allocate(width, height)
      try {
        blend(planes.y, background.y, BlendTarget(output.dataY, output.strideY, width, height), alpha, width, false)
        blend(planes.u, background.u, BlendTarget(output.dataU, output.strideU, width / 2, height / 2), alpha, width, true)
        blend(planes.v, background.v, BlendTarget(output.dataV, output.strideV, width / 2, height / 2), alpha, width, true)
      } catch (cause: Exception) { output.release(); throw cause }
      if (!ready) { ready = true; status("ready") }
      return remember(VideoFrame(output, frame.rotation, frame.timestampNs), now)
    } catch (_: Exception) {
      reportFailure()
      val previous = cached
      // Never let WebRTC's null-result fallback publish the unprocessed camera.
      return if (previous != null) copyFrame(previous, frame.timestampNs)
      else solid(320, 240, frame.rotation, frame.timestampNs)
    }
  }

  private fun updateDimensions(frame: VideoFrame) {
    if (frame.buffer.width == sourceWidth && frame.buffer.height == sourceHeight && frame.rotation == sourceRotation) return
    sourceWidth = frame.buffer.width
    sourceHeight = frame.buffer.height
    sourceRotation = frame.rotation
    generation.incrementAndGet()
    mask.set(null)
    cached?.release()
    cached = null
    image = null
    ready = false
  }

  private fun alphaMask(snapshot: Mask, width: Int, height: Int, rotation: Int): ByteArray {
    val alpha = ByteArray(width * height)
    for (y in 0 until height) for (x in 0 until width)
      alpha[y * width + x] = MaskMath.alpha(snapshot.values, snapshot.width, snapshot.height,
        (x + 0.5f) / width, (y + 0.5f) / height, rotation).toByte()
    return alpha
  }

  private fun detect(planes: Planes, width: Int, height: Int, rotation: Int, now: Long) {
    if (now - lastDetectionAt < 100 || !detecting.compareAndSet(false, true)) return
    lastDetectionAt = now
    val ticket = generation.get()
    try {
      val input = InputImage.fromByteArray(BackgroundPixels.nv21(planes), width, height, rotation, InputImage.IMAGE_FORMAT_NV21)
      segmenter.process(input)
        .addOnSuccessListener { result ->
          if (!closed && !failed.get() && ticket == generation.get()) {
            try {
              val values = FloatArray(result.width * result.height)
              result.buffer.duplicate().order(ByteOrder.nativeOrder()).apply { rewind() }.asFloatBuffer().get(values)
              mask.set(Mask(values, result.width, result.height, now))
            } catch (_: Exception) { reportFailure() }
          }
        }
        .addOnFailureListener { if (!closed) reportFailure() }
        .addOnCompleteListener { detecting.set(false) }
    } catch (_: Exception) { detecting.set(false); reportFailure() }
  }

  private fun blend(
    foreground: ByteArray, background: ByteArray, target: BlendTarget,
    alpha: ByteArray, alphaWidth: Int, chroma: Boolean
  ) {
    val (output, stride, width, height) = target
    for (y in 0 until height) for (x in 0 until width) {
      val a = if (chroma) {
        val p = y * 2 * alphaWidth + x * 2
        ((alpha[p].toInt() and 255) + (alpha[p + 1].toInt() and 255) +
          (alpha[p + alphaWidth].toInt() and 255) + (alpha[p + alphaWidth + 1].toInt() and 255)) / 4
      } else alpha[y * alphaWidth + x].toInt() and 255
      val index = y * width + x
      output.put(y * stride + x, MaskMath.blend(foreground[index].toInt() and 255, background[index].toInt() and 255, a))
    }
  }

  private fun solid(width: Int, height: Int, rotation: Int, time: Long): VideoFrame {
    val buffer = JavaI420Buffer.allocate(width, height)
    for (y in 0 until height) for (x in 0 until width) buffer.dataY.put(y * buffer.strideY + x, 32.toByte())
    for (y in 0 until height / 2) for (x in 0 until width / 2) {
      buffer.dataU.put(y * buffer.strideU + x, 128.toByte())
      buffer.dataV.put(y * buffer.strideV + x, 128.toByte())
    }
    return VideoFrame(buffer, rotation, time)
  }

  private fun copyFrame(frame: VideoFrame, time: Long): VideoFrame {
    frame.buffer.retain()
    return VideoFrame(frame.buffer, frame.rotation, time)
  }

  private fun remember(frame: VideoFrame, at: Long): VideoFrame {
    cached?.release()
    frame.retain()
    cached = frame
    lastFrameAt = at
    return frame
  }

  private fun reportFailure() { if (failed.compareAndSet(false, true)) status("error") }

  @Synchronized
  override fun close() {
    if (closed) return
    closed = true
    generation.incrementAndGet()
    segmenter.close()
    mask.set(null)
    cached?.release()
    cached = null
    image = null
  }
}
