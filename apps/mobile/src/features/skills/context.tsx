import { createContext, useContext, useState, type ReactNode } from "react";
export const skillCatalog = [
  "React",
  "TypeScript",
  "JavaScript",
  "UI/UX",
  "Tiếng Anh",
  "Guitar",
  "Nhiếp ảnh",
] as const;
export type SharingSkill = {
  id: string;
  skillId: string;
  name: string;
  level: string;
  description: string;
  experienceYears?: string;
  visible: boolean;
  status: "UNVERIFIED" | "PENDING" | "VERIFIED" | "REJECTED";
  reason?: string;
  evidence?: string[];
  pendingEvidence?: string[];
};
const initialSkills: SharingSkill[] = [
  {
    id: "react",
    skillId: "catalog-react",
    name: "React",
    level: "ADVANCED",
    description:
      "Xây dựng ứng dụng React với component, hook và quản lý trạng thái.",
    visible: true,
    status: "VERIFIED",
  },
  {
    id: "english",
    skillId: "catalog-english",
    name: "Tiếng Anh",
    level: "INTERMEDIATE",
    description: "Luyện giao tiếp tiếng Anh trong công việc hằng ngày.",
    visible: true,
    status: "UNVERIFIED",
  },
  {
    id: "guitar",
    skillId: "catalog-guitar",
    name: "Guitar",
    level: "BEGINNER",
    description: "Hướng dẫn hợp âm cơ bản và nhịp điệu.",
    visible: false,
    status: "REJECTED",
    reason:
      "Bằng chứng chưa thể hiện rõ tên người sở hữu và kỹ năng được xác minh.",
  },
];
const Context = createContext<{
  skills: SharingSkill[];
  save: (skill: SharingSkill) => void;
} | null>(null);
export function SkillsPreviewProvider({ children }: { children: ReactNode }) {
  const [skills, setSkills] = useState(initialSkills);
  const save = (skill: SharingSkill) =>
    setSkills((items) => [...items.filter((i) => i.id !== skill.id), skill]);
  return (
    <Context.Provider value={{ skills, save }}>{children}</Context.Provider>
  );
}
export function useSkillsPreview() {
  const value = useContext(Context);
  if (!value) throw new Error("SkillsPreviewProvider missing");
  return value;
}
