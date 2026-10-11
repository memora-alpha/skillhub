import { createContext, useContext, useState, type ReactNode } from "react";
export type Material = {
  id: string;
  owner: "me" | "partner";
  title: string;
  description: string;
  skill: string;
  access: "FREE" | "PAID";
  price: string;
  version: number;
  status: "DRAFT" | "PENDING_REVIEW" | "PUBLISHED" | "REJECTED" | "ARCHIVED";
  file: string;
  reason?: string;
};
const initial: Material[] = [
  {
    id: "react-guide",
    owner: "partner",
    title: "React: từ component đến ứng dụng",
    description:
      "Tài liệu thực hành component, props, state và hook qua ví dụ dễ hiểu.",
    skill: "React",
    access: "FREE",
    price: "0",
    version: 1,
    status: "PUBLISHED",
    file: "react-guide.pdf",
  },
  {
    id: "ux-workbook",
    owner: "partner",
    title: "UX workbook: thiết kế từ vấn đề thật",
    description:
      "Bộ bài tập nghiên cứu người dùng và xây dựng prototype cho sản phẩm số.",
    skill: "UI/UX",
    access: "PAID",
    price: "25",
    version: 2,
    status: "PUBLISHED",
    file: "ux-workbook.pdf",
  },
  {
    id: "typescript-notes",
    owner: "partner",
    title: "TypeScript trong dự án thực tế",
    description:
      "Tổng hợp mẫu type, generic và cách đọc lỗi trình biên dịch TypeScript.",
    skill: "TypeScript",
    access: "PAID",
    price: "15",
    version: 1,
    status: "PUBLISHED",
    file: "typescript-notes.pdf",
  },
  {
    id: "my-guide",
    owner: "me",
    title: "Ghi chú JavaScript của tôi",
    description:
      "Ghi chú minh họa của người chia sẻ đang chờ xem xét trước khi công bố.",
    skill: "JavaScript",
    access: "FREE",
    price: "0",
    version: 1,
    status: "PENDING_REVIEW",
    file: "du-an.docx",
  },
  {
    id: "my-rejected",
    owner: "me",
    title: "Tài liệu thực hành giao diện",
    description:
      "Bộ bài tập minh họa trạng thái bị từ chối và cần bổ sung quyền phân phối.",
    skill: "UI/UX",
    access: "FREE",
    price: "0",
    version: 1,
    status: "REJECTED",
    file: "chung-chi.pdf",
    reason:
      "Vui lòng bổ sung xác nhận quyền phân phối nội dung trước khi gửi lại.",
  },
];
const Context = createContext<{
  materials: Material[];
  library: Record<string, number>;
  save: (m: Material) => void;
  grantFree: (id: string) => void;
} | null>(null);
export function MaterialsPreviewProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [materials, setMaterials] = useState(initial);
  const [library, setLibrary] = useState<Record<string, number>>({
    "typescript-notes": 1,
  });
  return (
    <Context.Provider
      value={{
        materials,
        library,
        save: (material) =>
          setMaterials((items) => [
            material,
            ...items.filter((i) => i.id !== material.id),
          ]),
        grantFree: (id) => {
          const m = materials.find((i) => i.id === id);
          if (m?.status === "PUBLISHED" && m.access === "FREE")
            setLibrary((v) => ({ ...v, [id]: m.version }));
        },
      }}
    >
      {children}
    </Context.Provider>
  );
}
export function useMaterialsPreview() {
  const v = useContext(Context);
  if (!v) throw new Error("MaterialsPreviewProvider missing");
  return v;
}
