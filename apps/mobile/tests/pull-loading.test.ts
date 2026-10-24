import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";

test("native pull previews share the loader while only RefreshControl triggers a read", () => {
  const local = createRequire(
    new URL("../src/components/use-scroll-refresh.tsx", import.meta.url),
  );
  const filename = local.resolve("./use-scroll-refresh.tsx");
  const boundaryFile = local.resolve("./PullRefreshBoundary.tsx");
  let slot = 0,
    appRefreshes = 0,
    screenRefreshes = 0,
    forwarded = 0;
  let focused = true;
  const slots: unknown[] = [];
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const contexts = [
    mock.module(pathToFileURL(local.resolve("react")), {
      namedExports: {
        useRef: (initial: unknown) => {
          const i = slot++;
          return (slots[i] ??= { current: initial });
        },
        useState: (initial: unknown) => {
          const i = slot++;
          if (!(i in slots)) slots[i] = initial;
          return [
            slots[i],
            (value: unknown) => {
              slots[i] = value;
            },
          ];
        },
        useEffect: () => {},
      },
    }),
    mock.module(pathToFileURL(local.resolve("react/jsx-runtime")), {
      namedExports: { jsx, jsxs: jsx },
    }),
    mock.module(pathToFileURL(local.resolve("react-native")), {
      namedExports: {
        Platform: { OS: "ios" },
        RefreshControl: "RefreshControl",
        View: "View",
        Text: "Text",
      },
    }),
    mock.module(
      pathToFileURL(local.resolve("../providers/AppRefreshProvider")),
      {
        namedExports: {
          useAppRefresh: () => ({
            refreshing: false,
            refresh: () => {
              appRefreshes++;
            },
          }),
        },
      },
    ),
    mock.module(pathToFileURL(local.resolve("./LoadingScreenBoundary")), {
      namedExports: { useLoadingVisible: () => focused },
    }),
    mock.module(pathToFileURL(local.resolve("./LoadingIndicator")), {
      namedExports: { LoadingIndicator: "Loader" },
    }),
  ];
  try {
    delete local.cache[filename];
    delete local.cache[boundaryFile];
    const { useScrollRefresh } = local(filename);
    const { PullRefreshBoundary } = local(boundaryFile);
    const props = {
      onRefresh: () => {
        screenRefreshes++;
      },
      onTouchStart: () => {
        forwarded++;
      },
      onTouchMove: () => {
        forwarded++;
      },
      onTouchEnd: () => {
        forwarded++;
      },
      onScroll: () => {
        forwarded++;
      },
    };
    const render = (extra = {}) => {
      slot = 0;
      return useScrollRefresh({ ...props, ...extra });
    };
    const touch = (x: number, y: number) => ({
      nativeEvent: { pageX: x, pageY: y },
    });
    let view = render();
    assert.equal(view.scroll.refreshControl.props.tintColor, "transparent");
    assert.deepEqual(view.scroll.refreshControl.props.colors, ["transparent"]);
    view.scroll.onTouchStart(touch(0, 0));
    view.scroll.onTouchMove(touch(0, 70));
    view = render();
    assert.equal(view.boundary.pulling, true);
    let tree = PullRefreshBoundary({ ...view.boundary, children: "content" });
    const loader = tree.props.children[1].props.children;
    assert.equal(loader.type, "Loader");
    assert.equal(loader.props.animating, false);
    assert.equal(loader.props.busy, false);
    view.scroll.onTouchEnd(touch(0, 70));
    assert.equal(
      screenRefreshes,
      0,
      "touch observers must never duplicate the native callback",
    );
    view.scroll.refreshControl.props.onRefresh();
    assert.equal(screenRefreshes, 1);
    assert.equal(appRefreshes, 0);
    view = render({ refreshing: true });
    view.scroll.refreshControl.props.onRefresh();
    assert.equal(screenRefreshes, 1);
    tree = PullRefreshBoundary({ ...view.boundary, children: "content" });
    assert.equal(tree.props.children[1].props.children.props.animating, true);
    const disabled = PullRefreshBoundary({
      ...view.boundary,
      enabled: false,
      children: "content",
    });
    assert.equal(
      disabled.type,
      tree.type,
      "disabling scrolling keeps the same native wrapper and child position",
    );
    assert.equal(disabled.props.children[0], "content");
    assert.equal(disabled.props.children[1], false);
    view = render();
    view.scroll.onTouchStart(touch(0, 0));
    view.scroll.onTouchMove(touch(100, 50));
    assert.equal(render().boundary.pulling, false);
    view.scroll.onScroll({ nativeEvent: { contentOffset: { y: 100 } } });
    view.scroll.onTouchStart(touch(0, 0));
    view.scroll.onTouchMove(touch(0, 100));
    assert.equal(render().boundary.pulling, false);
    view.scroll.onScroll({ nativeEvent: { contentOffset: { y: 0 } } });
    focused = false;
    view = render();
    view.scroll.onTouchStart(touch(0, 0));
    view.scroll.onTouchMove(touch(0, 100));
    assert.equal(render().boundary.pulling, false);
    assert.ok(
      forwarded >= 10,
      "caller touch and scroll observers are preserved",
    );
    render({ onRefresh: undefined }).scroll.refreshControl.props.onRefresh();
    assert.equal(appRefreshes, 1);
  } finally {
    delete local.cache[filename];
    delete local.cache[boundaryFile];
    contexts.reverse().forEach((context) => context.restore());
  }
});
