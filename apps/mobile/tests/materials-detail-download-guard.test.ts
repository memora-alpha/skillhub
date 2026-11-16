import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mock, test } from "node:test";
import { pathToFileURL } from "node:url";
import { fixtureMaterial, materialOtherId } from "./fixtures/materials-data";

test("detail waits for ownership even on free listings and confirms a purchased snapshot before download", () => {
  const local = createRequire(
    new URL(
      "../src/features/materials/screens/material-detail-screen.tsx",
      import.meta.url,
    ),
  );
  let material = fixtureMaterial({ status: "PUBLISHED" });
  let ownership: { data: unknown; isFetching: boolean; error?: unknown } = {
    data: undefined,
    isFetching: true,
  };
  const starts: boolean[] = [],
    navigation: string[] = [];
  const contexts = Object.entries({
    react: { useState: (initial: unknown) => [initial, () => {}] },
    "react/jsx-runtime": {
      jsx: (type: unknown, props: unknown) => ({ type, props }),
      jsxs: (type: unknown, props: unknown) => ({ type, props }),
    },
    "react-native": { View: "View", Text: "Text", Pressable: "Pressable" },
    "@tanstack/react-query": { useQueryClient: () => ({}) },
    "expo-router": {
      useLocalSearchParams: () => ({ id: material.id }),
      useRouter: () => ({ push: (path: string) => navigation.push(path) }),
    },
    "@/features/connections": {
      useConnections: () => ({
        userId: materialOtherId,
        key: [materialOtherId],
      }),
      ConnectionFeedback: "ConnectionFeedback",
    },
    "@/components/feature-page": { FeaturePage: "FeaturePage" },
    "@/components/Button": { Button: "Button" },
    "@/components/Icon": { Icon: "Icon" },
    "@/components/FormNotice": { FormNotice: "FormNotice" },
    "../components/material.styles": { materialStyles: {} },
    "../components/material-summary": { MaterialSummary: "MaterialSummary" },
    "../components/material-publisher": {
      MaterialPublisher: "MaterialPublisher",
    },
    "../components/material-download-feedback": {
      MaterialDownloadFeedback: "MaterialDownloadFeedback",
    },
    "../components/material-detail-sections": {
      RelatedMaterials: "RelatedMaterials",
    },
    "../components/material-reviews": { MaterialReviews: "MaterialReviews" },
    "../components/material-detail-skeleton": {
      MaterialDetailSkeleton: "MaterialDetailSkeleton",
    },
    "../components/material-favorite-button": {
      MaterialFavoriteButton: "MaterialFavoriteButton",
    },
    "../hooks/use-materials": {
      useMaterial: () => ({ data: material, isFetching: false }),
      useMaterialOwnership: () => ownership,
    },
    "../hooks/use-material-download": {
      useMaterialDownload: () => ({
        pending: false,
        awaitingConfirmation: false,
        start: (purchased: boolean) => starts.push(purchased),
      }),
    },
  }).map(([name, namedExports]) =>
    mock.module(pathToFileURL(local.resolve(name)), { namedExports }),
  );
  const file = local.resolve("./material-detail-screen.tsx");
  try {
    delete local.cache[file];
    const { MaterialDetailScreen } = local(file);
    const render = () => {
      const root = MaterialDetailScreen();
      return root.type(root.props).props.stickyFooter.props.children.props;
    };
    assert.equal(render().disabled, true);
    render().onPress();
    assert.deepEqual(starts, []);
    ownership = {
      data: undefined,
      isFetching: false,
      error: new Error("unavailable"),
    };
    render().onPress();
    assert.equal(render().disabled, true);
    assert.deepEqual(starts, []);
    ownership = { data: { id: "purchased-order" }, isFetching: true };
    render().onPress();
    assert.equal(render().disabled, true);
    assert.deepEqual(starts, []);
    ownership = { data: { id: "purchased-order" }, isFetching: false };
    assert.equal(render().disabled, false);
    render().onPress();
    assert.deepEqual(starts, [true]);
    ownership = { data: null, isFetching: false };
    render().onPress();
    assert.deepEqual(starts, [true, false]);
    material = { ...material, accessType: "PAID", priceCredit: "10" };
    render().onPress();
    assert.deepEqual(navigation, [`/materials/${material.id}/purchase`]);
    material = { ...material, ownerId: materialOtherId };
    ownership = { data: undefined, isFetching: false };
    assert.equal(render().disabled, false);
    render().onPress();
    assert.deepEqual(starts, [true, false, false]);
  } finally {
    contexts.forEach((context) => context.restore());
    delete local.cache[file];
  }
});
