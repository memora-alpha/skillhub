package com.oney.WebRTCModule;

import com.facebook.react.bridge.Arguments;
import com.oney.WebRTCModule.videoEffects.ProcessorProvider;
import com.oney.WebRTCModule.videoEffects.VideoFrameProcessorFactoryInterface;
import java.util.Collections;

/** Keeps access to WebRTC's package-private queue isolated from the Expo module. */
public final class SkillHubEffectsBridge {
  private SkillHubEffectsBridge() {}

  public static void remove(String name) {
    ThreadUtils.runOnExecutor(() -> {
      try { ProcessorProvider.removeProcessor(name); }
      catch (RuntimeException ignored) { /* Already detached. */ }
    });
  }

  public static void apply(
      WebRTCModule module, String trackId, String name,
      VideoFrameProcessorFactoryInterface factory, String previous, Runnable applied) {
    ThreadUtils.runOnExecutor(() -> {
      if (name != null) ProcessorProvider.addProcessor(name, factory);
      // null detaches the processor. An empty list creates an unnecessary pass-through processor.
      module.mediaStreamTrackSetVideoEffects(
          trackId, name == null ? null : Arguments.fromList(Collections.singletonList(name)));
      ThreadUtils.runOnExecutor(() -> {
        if (previous != null) {
          try { ProcessorProvider.removeProcessor(previous); }
          catch (RuntimeException ignored) { /* A retired attach may already have removed it. */ }
        }
        applied.run();
      });
    });
  }
}
