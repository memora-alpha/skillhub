import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import {
  agreementPath,
  learnerId,
  teacherId,
} from "./fixtures/learning-agreement";
import { fixtureId } from "./fixtures/learning-requests-data";

type Node = {
  type: unknown;
  props: Record<string, unknown> & {
    onPress?: () => void;
    onChange?: (value: number) => void;
    onChangeText?: (value: string) => void;
  };
  key?: string;
};
type ReviewRow = {
  id: string;
  reviewerId: string;
  rating: number;
  comment: string;
};
function nodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const node = value as Node;
  return [
    node,
    ...nodes(node.props.children),
    ...nodes(node.props.stickyFooter),
  ];
}

test("completed path reviews preserve drafts, gate writes and recover by reading both path and reviews", async () => {
  const local = createRequire(
    new URL(
      "../src/features/community/screens/review-editor-screen.tsx",
      import.meta.url,
    ),
  );
  const file = local.resolve("./review-editor-screen.tsx");
  const actionFile = local.resolve("../components/path-review-action.tsx");
  const path = agreementPath();
  path.status = "COMPLETED";
  path.settledAt = "2026-11-15T12:00:00Z";
  let userId = learnerId;
  const values: unknown[] = [];
  let slot = 0;
  let writes = 0,
    pathReads = 0,
    reviewReads = 0;
  const routes: string[] = [];
  const reviews = {
    data: [] as ReviewRow[],
    error: null as unknown,
    denied: false,
    isFetching: false,
    isLoading: false,
  };
  const query = {
    data: path,
    error: null as unknown,
    isFetching: false,
    denied: false,
    refetch: async () => {
      pathReads++;
    },
  };
  const submission = {
    reviews,
    own: undefined as ReviewRow | undefined,
    state: "ready",
    error: undefined,
    send: async (input: unknown) => {
      writes++;
      assert.deepEqual(input, { rating: 4, comment: "Bản nháp" });
    },
    refresh: async () => {
      reviewReads++;
    },
  };
  const jsx = (type: unknown, props: unknown, key?: string) => ({
    type,
    props,
    key,
  });
  const contexts = Object.entries({
    react: {
      useState: (initial: unknown) => {
        const n = slot++;
        if (!(n in values)) values[n] = initial;
        return [
          values[n],
          (value: unknown) => {
            values[n] = value;
          },
        ];
      },
    },
    "react/jsx-runtime": { jsx, jsxs: jsx, Fragment: "Fragment" },
    "react-native": {
      Text: "Text",
      View: "View",
      StyleSheet: { create: (s: unknown) => s },
    },
    "expo-router": {
      useLocalSearchParams: () => ({ id: path.id }),
      useRouter: () => ({
        push: (route: string) => routes.push(route),
        dismissTo: (route: string) => routes.push(route),
      }),
    },
    "@/components/Avatar": { Avatar: "Avatar" },
    "@/components/Button": { Button: "Button" },
    "@/components/Input": { Input: "Input" },
    "@/components/Icon": { Icon: "Icon" },
    "@/components/EmptyState": { EmptyState: "EmptyState" },
    "@/components/FormNotice": { FormNotice: "Notice" },
    "@/components/feature-page": { FeaturePage: "Page" },
    "@/features/connections": {
      useConnections: () => ({ userId, key: ["connections", userId, 1] }),
      ConnectionFeedback: "Feedback",
      useParticipantProfile: () => ({ data: { fullName: "Minh Anh" } }),
      useCatalogName: () => ({ data: "React" }),
    },
    "@/features/learning-paths": { useLearningPath: () => query },
    "../hooks/use-review-submission": { useReviewSubmission: () => submission },
    "../hooks/use-community": { usePathReviews: () => reviews },
    "../components/review-stars": {
      ReviewRatingPicker: "Picker",
      ReviewStars: "Stars",
    },
    "../components/review-card": { ReviewCard: "ReviewCard" },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  try {
    delete local.cache[file];
    delete local.cache[actionFile];
    const { ReviewEditorScreen } = local(file);
    const { PathReviewAction } = local(actionFile);
    const render = () => {
      slot = 0;
      const root = ReviewEditorScreen();
      return nodes(
        typeof root.type === "function" ? root.type(root.props) : root,
      );
    };
    const get = (tree: Node[], type: string) =>
      tree.find((node) => node.type === type)!;
    const button = (tree: Node[], label: string) =>
      tree.find(
        (node) =>
          node.type === "Button" &&
          (node.props.children === label ||
            node.props.accessibilityLabel === label),
      );
    let tree = render();
    assert.equal(get(tree, "Page").props.backBehavior, "history");
    assert.equal(button(tree, "Gửi đánh giá")?.props.disabled, true);
    get(tree, "Picker").props.onChange!(4);
    get(tree, "Input").props.onChangeText!("Bản nháp");
    tree = render();
    assert.equal(button(tree, "Gửi đánh giá")?.props.disabled, false);
    for (const blocked of ["fetching", "error", "denied"] as const) {
      query.isFetching = blocked === "fetching";
      query.error = blocked === "error" ? new Error("offline") : null;
      reviews.denied = blocked === "denied";
      tree = render();
      const send = button(tree, "Gửi đánh giá");
      if (send) {
        assert.equal(send.props.disabled, true);
        send.props.onPress!();
      }
      assert.equal(writes, 0);
    }
    reviews.denied = false;
    query.error = null;
    query.isFetching = false;
    submission.state = "check";
    tree = render();
    assert.equal(get(tree, "Input").props.editable, false);
    assert.equal(get(tree, "Input").props.value, "Bản nháp");
    button(tree, "Làm mới đánh giá")!.props.onPress!();
    assert.equal(pathReads, 1);
    assert.equal(reviewReads, 1);
    assert.equal(writes, 0);
    submission.state = "ready";
    button(render(), "Gửi đánh giá")!.props.onPress!();
    assert.equal(writes, 1);
    const row = {
      id: fixtureId(88),
      reviewerId: learnerId,
      rating: 4,
      comment: "Đã lưu",
    };
    reviews.data = [row];
    submission.own = row;
    tree = render();
    assert.equal(button(tree, "Gửi đánh giá"), undefined);
    assert.equal(tree.filter((node) => node.type === "Stars").length, 1);
    assert.equal(
      tree.filter((node) => node.type === "ReviewCard").length,
      0,
      "own review appears once",
    );
    button(tree, "Về lộ trình")!.props.onPress!();
    assert.equal(routes.pop(), `/paths/${path.id}`);
    assert.equal(
      PathReviewAction({ path }).props.children,
      "Xem đánh giá đã gửi",
    );
    reviews.data = [];
    submission.own = undefined;
    assert.equal(
      PathReviewAction({ path }).props.children,
      "Đánh giá người dạy",
    );
    PathReviewAction({ path }).props.onPress();
    assert.equal(routes.pop(), `/paths/${path.id}/review`);
    path.settledAt = null;
    assert.equal(PathReviewAction({ path }), null);
    assert.equal(button(render(), "Gửi đánh giá"), undefined);
    path.settledAt = "2026-11-15T12:00:00Z";
    userId = teacherId;
    assert.equal(
      button(render(), "Gửi đánh giá"),
      undefined,
      "one-way teacher reads only",
    );
    assert.equal(PathReviewAction({ path }).props.children, "Xem đánh giá");
  } finally {
    contexts.reverse().forEach((context) => context.restore());
    delete local.cache[file];
    delete local.cache[actionFile];
  }
});
