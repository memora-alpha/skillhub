export const previewCatalog = [
  { id: "catalog-react", name: "React" },
  { id: "catalog-typescript", name: "TypeScript" },
  { id: "catalog-javascript", name: "JavaScript" },
  { id: "catalog-ux", name: "UI/UX" },
  { id: "catalog-english", name: "Tiếng Anh" },
  { id: "catalog-guitar", name: "Guitar" },
  { id: "catalog-photography", name: "Nhiếp ảnh" },
] as const;
export function previewSkillId(name: string) {
  return previewCatalog.find((s) => s.name === name)?.id;
}
