package expo.modules.skillhubvideo

import com.oney.WebRTCModule.SkillHubEffectsBridge
import com.oney.WebRTCModule.WebRTCModule
import expo.modules.kotlin.Promise
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition
import java.util.UUID
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicReference
import java.util.concurrent.atomic.AtomicBoolean

class SkillHubVideoEffectsModule : Module() {
  private data class Entry(val name: String, val processor: AtomicReference<BackgroundProcessor?>)
  private val entries = mutableMapOf<String, Entry>()
  private val commands = Executors.newSingleThreadExecutor()
  @Volatile private var destroyed = false

  override fun definition() = ModuleDefinition {
    Name("SkillHubVideoEffects")
    Events("onStatus")
    Function("isSupported") { !destroyed }
    Function("apiVersion") { 1 }
    AsyncFunction("configure") { trackId: String, mode: String, preset: String?, requestId: String, promise: Promise ->
      commands.execute {
        try {
          require(!destroyed && trackId.isNotBlank() && trackId.length <= 128) { "CAMERA_NOT_AVAILABLE" }
          require(mode in listOf("off", "blur", "image")) { "INVALID_BACKGROUND_MODE" }
          require(mode != "image" || preset in listOf("ocean", "sunset", "violet")) { "INVALID_BACKGROUND_PRESET" }
          require(requestId.length in 1..64) { "INVALID_REQUEST_ID" }
          configure(trackId, mode, preset, requestId)
          promise.resolve()
        } catch (_: Exception) {
          promise.reject("BACKGROUND_PROCESSOR_FAILED", "Could not apply the camera background.", null)
        }
      }
    }
    OnDestroy {
      destroyed = true
      commands.execute {
        entries.keys.toList().forEach { track -> runCatching { configure(track, "off", null) } }
        entries.values.forEach { it.processor.get()?.close(); SkillHubEffectsBridge.remove(it.name) }
        entries.clear()
      }
      commands.shutdown()
    }
  }

  private fun configure(trackId: String, mode: String, preset: String?, requestId: String = "cleanup") {
    val webRtc = appContext.reactContext?.getNativeModule(WebRTCModule::class.java)
      ?: throw IllegalStateException("WEBRTC_NOT_AVAILABLE")
    val previous = entries[trackId]
    if (mode == "off" && previous == null) return
    val processor = AtomicReference<BackgroundProcessor?>(null)
    val created = AtomicBoolean(false)
    val name = if (mode == "off") null else "skillhub-background-${UUID.randomUUID()}"
    if (name != null) processor.set(BackgroundProcessor(mode, preset ?: "ocean") { status ->
      if (!destroyed) runCatching { sendEvent("onStatus", mapOf("trackId" to trackId, "state" to status, "requestId" to requestId)) }
    })
    val applied = CountDownLatch(1)
    SkillHubEffectsBridge.apply(webRtc, trackId, name, {
      created.set(true)
      processor.get()!!
    }, previous?.name) { applied.countDown() }
    val attached = applied.await(5, TimeUnit.SECONDS)
    previous?.processor?.get()?.close()
    if (name == null) entries.remove(trackId)
    else {
      entries[trackId] = Entry(name, processor)
      if (!attached || !created.get() || destroyed) {
        configure(trackId, "off", null)
        error("CAMERA_TRACK_NOT_AVAILABLE")
      }
    }
  }
}
