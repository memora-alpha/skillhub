import Link from "next/link";
import { legalPolicies } from "./legal-content";

export function LegalPage({ type }: Readonly<{ type: "terms" | "privacy" }>) {
  const policy = legalPolicies[type];
  return (
    <main className="auth-page legal-page">
      <Link className="auth-brand" href="/">
        <span>S</span> SkillHub
      </Link>
      <div className="legal-heading">
        <Link href="/register">← Quay lại đăng ký</Link>
        <h1>{policy.title}</h1>
        <p>
          Cập nhật {legalPolicies.updatedAt} · Phiên bản {legalPolicies.version}
        </p>
      </div>
      <div className="legal-grid">
        <nav aria-label={`Mục lục ${policy.title.toLowerCase()}`}>
          <strong>Nội dung</strong>
          {policy.sections.map((section) => (
            <a key={section.id} href={`#${section.id}`}>
              {section.title}
            </a>
          ))}
          <Link href={type === "terms" ? "/privacy" : "/terms"}>
            {type === "terms" ? "Chính sách bảo mật" : "Điều khoản sử dụng"}
          </Link>
        </nav>
        <article className="auth-card legal-document" aria-label={policy.title}>
          <p className="legal-draft">{legalPolicies.notice}</p>
          <p>{policy.introduction}</p>
          {policy.sections.map((section) => (
            <section
              key={section.id}
              id={section.id}
              aria-labelledby={`${section.id}-title`}
            >
              <h2 id={`${section.id}-title`}>{section.title}</h2>
              {section.paragraphs.map((paragraph) => (
                <p key={paragraph}>{paragraph}</p>
              ))}
            </section>
          ))}
          <Link href={type === "terms" ? "/privacy" : "/terms"}>
            Đọc {type === "terms" ? "chính sách bảo mật" : "điều khoản sử dụng"}
          </Link>
        </article>
      </div>
    </main>
  );
}
