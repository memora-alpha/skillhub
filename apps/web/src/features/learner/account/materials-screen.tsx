"use client";
import Link from "next/link";
import { useState } from "react";
import type { Skill } from "../types";
import { useUserResource, useUserList } from "../hooks/use-user-resource";
import { Empty, Feedback, PageHeading } from "../components/common";
import { ProductIcon } from "../components/product-icon";
import type { Material } from "./account-types";
export function MaterialsScreen() {
  const skills = useUserList<Skill>("skills?limit=50");
  const [skillId, setSkillId] = useState("");
  const [page, setPage] = useState(1),
    [q, setQ] = useState(""),
    [access, setAccess] = useState("");
  const params = new URLSearchParams({
    limit: "12",
    page: String(page),
    q,
    ...(access ? { accessType: access } : {}),
    ...(skillId ? { skillId } : {}),
  });
  const query = useUserResource<Material[]>("materials?" + params);
  const total = query.pagination?.total;
  return (
    <>
      <PageHeading
        eyebrow="KIẾN THỨC ĐƯỢC CHIA SẺ"
        title="Thư viện tài liệu"
        action={
          <div className="learner-actions">
            <Link className="btn" href="/learn/materials/mine">
              Tài liệu của tôi
            </Link>
            <Link className="btn btn-primary" href="/learn/materials/new">
              + Chia sẻ tài liệu
            </Link>
          </div>
        }
        description="Tìm tài liệu cho kỹ năng bạn đang học."
      />
      <form
        className="product-material-filters"
        onSubmit={(e) => {
          e.preventDefault();
          setQ(String(new FormData(e.currentTarget).get("q") ?? "").trim());
          setPage(1);
        }}
      >
        <div className="learner-search">
          <input
            name="q"
            aria-label="Tìm tài liệu"
            placeholder="Tìm tài liệu…"
            maxLength={100}
          />
          <button className="btn">Tìm</button>
        </div>
        <select
          aria-label="Kỹ năng của tài liệu"
          value={skillId}
          onChange={(e) => {
            setSkillId(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Tất cả kỹ năng</option>
          {skills.items.map((skill) => (
            <option key={skill.id} value={skill.id}>
              {skill.name}
            </option>
          ))}
        </select>
        <select
          aria-label="Hình thức tài liệu"
          value={access}
          onChange={(e) => {
            setAccess(e.target.value);
            setPage(1);
          }}
        >
          <option value="">Miễn phí &amp; có phí</option>
          <option value="FREE">Miễn phí</option>
          <option value="PAID">Có phí</option>
        </select>
      </form>
      <Feedback error={skills.error} reload={skills.reload} />
      {skills.cursor && (
        <button
          className="btn"
          disabled={skills.loading}
          onClick={() => {
            void skills.more();
          }}
        >
          Tải thêm kỹ năng cho bộ lọc
        </button>
      )}
      <Feedback
        loading={query.loading}
        error={query.error}
        reload={query.reload}
      />
      <div className="product-materials">
        {query.data?.map((material) => (
          <article className="learner-card product-material" key={material.id}>
            <div className="product-material-cover">
              <ProductIcon name="file" size={45} />
              <span>
                {material.file?.mimeType.split("/").at(-1)?.toUpperCase() ??
                  "TÀI LIỆU"}
              </span>
            </div>
            <div className="product-material-body">
              <span className="learner-status">
                {material.accessType === "FREE" ? "Miễn phí" : "Có phí"}
              </span>
              <h2>
                <Link href={"/learn/materials/" + material.id}>
                  {material.title}
                </Link>
              </h2>
              <p className="learner-clamp">{material.description}</p>
              <div className="learner-card-top">
                <strong className="product-price">
                  {material.accessType === "FREE"
                    ? "Miễn phí"
                    : material.priceCredit + " CR"}
                </strong>
                <Link
                  className="learner-card-link"
                  href={"/learn/materials/" + material.id}
                >
                  Xem tài liệu →
                </Link>
              </div>
            </div>
          </article>
        ))}
      </div>
      {!query.loading && !query.error && !query.data?.length && (
        <Empty>Chưa có tài liệu phù hợp với bộ lọc này.</Empty>
      )}
      <div className="learner-actions">
        <button
          className="btn"
          disabled={page === 1 || query.loading}
          onClick={() => setPage((v) => Math.max(1, v - 1))}
        >
          ← Trang trước
        </button>
        <span>
          Trang {page}
          {typeof total === "number" ? " · " + total + " tài liệu" : ""}
        </span>
        <button
          className="btn"
          disabled={
            query.loading ||
            !!query.error ||
            !query.data ||
            page * 12 >= (total ?? page * 12)
          }
          onClick={() => setPage((v) => v + 1)}
        >
          Trang sau →
        </button>
      </div>
    </>
  );
}
