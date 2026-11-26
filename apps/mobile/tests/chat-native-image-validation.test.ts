import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";

test("native image validation finishes failures/timeouts once and ignores results after source change or unmount", (context) => {
  context.mock.timers.enable({ apis: ["setTimeout"] });
  const local = createRequire(
    new URL(
      "../src/features/messages/hooks/use-native-chat-image.ts",
      import.meta.url,
    ),
  );
  const filename = local.resolve("./use-native-chat-image.ts");
  let cursor = 0,
    errors = 0;
  const slots: unknown[] = [];
  const effects = new Map<number, { deps: unknown[]; cleanup?: () => void }>();
  const reads: {
    uri: string;
    success: (width: number, height: number) => void;
    fail: () => void;
  }[] = [];
  const contexts = Object.entries({
    react: {
      useState: (initial: unknown) => {
        const i = cursor++;
        if (!(i in slots)) slots[i] = initial;
        return [
          slots[i],
          (value: unknown) => {
            slots[i] = value;
          },
        ];
      },
      useRef: (value: unknown) => {
        const i = cursor++;
        return (slots[i] ??= { current: value });
      },
      useEffect: (effect: () => (() => void) | undefined, deps: unknown[]) => {
        const i = cursor++;
        const previous = effects.get(i);
        if (
          previous &&
          deps.every((dep, n) => Object.is(dep, previous.deps[n]))
        )
          return;
        previous?.cleanup?.();
        effects.set(i, { deps, cleanup: effect() });
      },
    },
    "react-native": {
      Image: {
        getSize: (
          uri: string,
          success: (w: number, h: number) => void,
          fail: () => void,
        ) => reads.push({ uri, success, fail }),
      },
    },
  }).map(([id, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(id)), { namedExports }),
  );
  try {
    delete local.cache[filename];
    const { useNativeChatImage, NATIVE_CHAT_IMAGE_TIMEOUT_MS } = local(
      filename,
    ) as typeof import("../src/features/messages/hooks/use-native-chat-image");
    const render = (uri: string, enabled = true) => {
      cursor = 0;
      return useNativeChatImage(uri, enabled, () => errors++);
    };
    assert.equal(render("file:///good.jpg").ready, false);
    reads[0]!.success(800, 600);
    assert.equal(render("file:///good.jpg").ready, true);
    context.mock.timers.tick(NATIVE_CHAT_IMAGE_TIMEOUT_MS);
    assert.equal(errors, 0);
    render("file:///missing.jpg");
    reads[1]!.fail();
    reads[1]!.fail();
    assert.equal(render("file:///missing.jpg").error, "Không đọc được ảnh.");
    assert.equal(errors, 1);
    render("file:///stalled.jpg");
    context.mock.timers.tick(NATIVE_CHAT_IMAGE_TIMEOUT_MS);
    assert.equal(render("file:///stalled.jpg").ready, false);
    assert.equal(errors, 2);
    reads[2]!.success(800, 600);
    assert.equal(render("file:///stalled.jpg").error, "Không đọc được ảnh.");
    render("file:///old.jpg");
    render("file:///new.jpg");
    reads[3]!.success(800, 600);
    assert.equal(render("file:///new.jpg").ready, false);
    reads[4]!.success(0, 600);
    assert.equal(errors, 3);
    render("file:///retry.jpg");
    reads[5]!.success(800, 600);
    assert.equal(render("file:///retry.jpg").ready, true);
    assert.equal(render("file:///retry.jpg", false).ready, false);
    assert.equal(reads.length, 6);
    render("file:///unmounted.jpg");
    for (const effect of effects.values()) effect.cleanup?.();
    reads[6]!.fail();
    context.mock.timers.tick(NATIVE_CHAT_IMAGE_TIMEOUT_MS);
    assert.equal(errors, 3);
  } finally {
    for (const effect of effects.values()) effect.cleanup?.();
    delete local.cache[filename];
    contexts.reverse().forEach((entry) => entry.restore());
  }
});
