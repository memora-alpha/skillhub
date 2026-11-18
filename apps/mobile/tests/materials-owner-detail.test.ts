import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { AppError } from "../src/lib/http/errors";
import { fixtureMaterial, materialOwnerId } from "./fixtures/materials-data";

type Node = { type: unknown; props: Record<string, unknown> };
function nodes(value: unknown): Node[] {
  if (Array.isArray(value)) return value.flatMap(nodes);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const node = value as Node;
  return [node, ...nodes(node.props.children)];
}

test("owner detail reads private data, shows complete content and metadata, and gates downloads without management modals", () => {
  const local = createRequire(
    new URL(
      "../src/features/materials/screens/owner-material-detail-screen.tsx",
      import.meta.url,
    ),
  );
  const material = fixtureMaterial({
    status: "ARCHIVED",
    description: "Nội dung chi tiết dài. ".repeat(40),
    reviewedAt: "2026-11-18T01:00:00Z",
  });
  let id = material.id;
  const query = {
    data: undefined as typeof material | undefined,
    isLoading: true,
    isFetching: true,
    error: undefined as unknown,
    denied: false,
    refetch: async () => {},
  };
  const reads: string[] = [];
  const downloads: boolean[] = [];
  const jsx = (type: unknown, props: unknown) => ({ type, props });
  const contexts = Object.entries({
    react: { useState: (initial: unknown) => [initial, () => {}] },
    "react/jsx-runtime": { jsx, jsxs: jsx },
    "react-native": { View: "View", Text: "Text" },
    "expo-router": { useLocalSearchParams: () => ({ id }) },
    "@/components/feature-page": { FeaturePage: "Page" },
    "@/components/Button": { Button: "Button" },
    "@/components/FormNotice": { FormNotice: "Notice" },
    "@/features/connections": {
      useConnections: () => ({ key: [materialOwnerId, 1] }),
      ConnectionFeedback: "Feedback",
    },
    "../hooks/use-materials": {
      useOwnerMaterial: (value: string) => {
        reads.push(value);
        return query;
      },
      useMaterial: () => {
        assert.fail("owner detail cannot rely on a public listing");
      },
    },
    "../hooks/use-material-download": {
      useMaterialDownload: () => ({
        pending: false,
        awaitingConfirmation: false,
        start: (purchased: boolean) => downloads.push(purchased),
      }),
    },
    "../components/material-summary": { MaterialSummary: "Summary" },
    "../components/material-publisher": { MaterialPublisher: "Publisher" },
    "../components/owner-material-card": { MaterialStatusBadge: "Status" },
    "../components/material-detail-skeleton": {
      MaterialDetailSkeleton: "Skeleton",
    },
    "../components/material-download-feedback": {
      MaterialDownloadFeedback: "DownloadFeedback",
    },
    "../components/material-reviews": { MaterialReviews: "Reviews" },
    "../components/material-unavailable": {
      MaterialUnavailable: "Unavailable",
    },
    "../components/material.styles": { materialStyles: {} },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  const file = local.resolve("./owner-material-detail-screen.tsx");
  try {
    delete local.cache[file];
    const { OwnerMaterialDetailScreen } = local(file);
    const render = () => {
      const root = OwnerMaterialDetailScreen();
      return root.type(root.props) as Node;
    };
    let page = render();
    assert.equal(page.props.stickyFooter, undefined);
    assert.ok(nodes(page).some((node) => node.type === "Skeleton"));
    query.data = material;
    query.isLoading = query.isFetching = false;
    page = render();
    assert.equal(page.props.title, "Chi tiết tài liệu");
    assert.equal(page.props.back, "/materials/mine?tab=posted");
    assert.equal(
      nodes(page).find((node) => node.type === "Summary")?.props
        .ownershipStatus,
      "own",
    );
    assert.ok(
      nodes(page).some(
        (node) =>
          node.props.children === material.description && node.props.selectable,
      ),
    );
    assert.ok(
      nodes(page).some(
        (node) => node.props.children === material.file?.originalFilename,
      ),
    );
    assert.ok(nodes(page).some((node) => node.type === "Publisher"));
    assert.ok(nodes(page).some((node) => node.type === "Status"));
    assert.equal(
      nodes(page).some((node) => node.type === "Reviews"),
      false,
    );
    const download = () =>
      nodes(render().props.stickyFooter).find(
        (node) => node.type === "Button",
      )!;
    assert.equal(download().props.disabled, false);
    (download().props.onPress as () => void)();
    assert.deepEqual(downloads, [false]);
    for (const reason of ["fetching", "error", "scan"]) {
      query.isFetching = reason === "fetching";
      query.error = reason === "error" ? new AppError("network") : undefined;
      query.data = {
        ...material,
        scanStatus: reason === "scan" ? "UNKNOWN" : "CLEAN",
      };
      assert.equal(download().props.disabled, true, reason);
      (download().props.onPress as () => void)();
      assert.equal(downloads.length, 1, reason);
    }
    query.isFetching = query.denied = false;
    query.error = undefined;
    query.denied = true;
    assert.equal(render().props.stickyFooter, undefined);
    assert.equal(
      nodes(render()).some((node) => node.type === "Summary"),
      false,
    );
    query.denied = false;
    query.data = fixtureMaterial({
      status: "DRAFT",
      file: null,
      scanStatus: null,
    });
    page = render();
    assert.equal(page.props.stickyFooter, undefined);
    assert.ok(
      nodes(page).some(
        (node) => node.props.children === "Chưa có tệp đính kèm",
      ),
    );
    query.data = fixtureMaterial({
      status: "REJECTED",
      rejectReason: "Cần bổ sung nguồn nội dung",
    });
    assert.ok(
      nodes(render()).some(
        (node) =>
          Array.isArray(node.props.children) &&
          node.props.children.includes(query.data!.rejectReason),
      ),
    );
    query.data = fixtureMaterial({ status: "PUBLISHED" });
    assert.ok(nodes(render()).some((node) => node.type === "Reviews"));
    // A confirmed 404 must also remove previously cached content and download.
    query.error = new AppError("http", 404, "MATERIAL_NOT_FOUND");
    assert.equal(
      nodes(render()).some((node) => node.type === "Summary"),
      false,
    );
    assert.equal(render().props.stickyFooter, undefined);
    assert.equal(
      nodes(render()).find((node) => node.type === "Unavailable")?.props.owner,
      true,
    );
    assert.equal(
      nodes(render()).some((node) => node.type === "Feedback"),
      false,
    );
    for (const error of [
      new AppError("network"),
      new AppError("http", 403),
      new AppError("http", 500),
    ]) {
      query.error = error;
      assert.equal(
        nodes(render()).some((node) => node.type === "Unavailable"),
        false,
      );
      assert.ok(nodes(render()).some((node) => node.type === "Feedback"));
    }
    query.data = undefined;
    query.error = undefined;
    id = "invalid-id";
    assert.ok(
      nodes(render()).some(
        (node) => node.props.children === "Tài liệu không khả dụng.",
      ),
    );
    assert.equal(reads[0], material.id);
    assert.equal(
      nodes(page).some(
        (node) => node.type === "Modal" || node.type === "ActionDialog",
      ),
      false,
    );
  } finally {
    contexts.reverse().forEach((context) => context.restore());
    delete local.cache[file];
  }
});
