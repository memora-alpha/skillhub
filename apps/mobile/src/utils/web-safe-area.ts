import type { ViewStyle } from "react-native";
import type { Edge, EdgeMode, Edges } from "react-native-safe-area-context";

const sides = {
  top: "Top",
  right: "Right",
  bottom: "Bottom",
  left: "Left",
} as const;
export const safeAreaInset = (edge: Edge) =>
  `env(safe-area-inset-${edge}, 0px)`;

function resolveEdgeBehavior(edge: Edge, edges?: Edges): EdgeMode | undefined {
  if (edges == null) return "additive";
  if (Array.isArray(edges)) {
    return edges.includes(edge) ? "additive" : "off";
  }
  return (edges as Partial<Record<Edge, EdgeMode>>)[edge];
}

export function webSafeAreaSpacing(
  style: ViewStyle = {},
  edges?: Edges,
  mode: "padding" | "margin" = "padding",
): ViewStyle {
  const result: Record<string, string> = {};
  for (const edge of Object.keys(sides) as Edge[]) {
    const behavior = resolveEdgeBehavior(edge, edges);
    if (!behavior || behavior === "off") continue;
    const property = `${mode}${sides[edge]}` as keyof ViewStyle;
    const axis =
      edge === "top" || edge === "bottom" ? "Vertical" : "Horizontal";
    const value =
      style[property] ?? style[`${mode}${axis}`] ?? style[mode] ?? 0;
    const base = typeof value === "number" ? `${value}px` : String(value);
    const inset = safeAreaInset(edge);
    result[property] =
      behavior === "maximum"
        ? `max(${base}, ${inset})`
        : `calc(${base} + ${inset})`;
  }
  // CSS expressions are supported by RN Web; native ViewStyle omits this syntax.
  return result as ViewStyle;
}

export function webSafeAreaPosition(
  offsets: Partial<Record<Edge, number>>,
): ViewStyle {
  return Object.fromEntries(
    Object.entries(offsets).map(([edge, distance]) => [
      edge,
      `calc(${safeAreaInset(edge as Edge)} + ${distance}px)`,
    ]),
  ) as ViewStyle;
}
