"use client";
import { LoadingButton } from "@/components/loading-button";
import { MaterialThumbnail } from "./material-cover";
import { MaterialRating } from "./material-reviews";
import { SearchInput } from "@/components/search-input";
import Link from "next/link";
import { useState } from "react";
import type { Skill } from "../types";
import { useUserResource, useUserList } from "../hooks/use-user-resource";
import { Empty, Feedback, PageHeading } from "../components/common";
import type { Material } from "./account-types";
import { MaterialsSubnav } from "./materials-subnav";
import { PageNavigation } from "@/components/pagination/page-navigation";
export function MaterialsScreen() {
  const skills = useUserList<Skill>("skills?limit=50");
  const [skillId, setSkillId] = useState("");
  const [search, setSearch] = useState("");
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
      <MaterialsSubnav current="/learn/materials" />
      <PageHeading
        eyebrow="Kho tài liệu số"
        title="Thư viện tài liệu"
        description="Khám phá tài liệu miễn phí (0 CR) hoặc mua bằng Credit khả dụng. Mọi tệp đều qua kiểm duyệt an toàn và cấp quyền tải riêng tư."
        action={
          <Link className="btn btn-primary" href="/learn/materials/new">
            + Chia sẻ tài liệu
          </Link>
        }
      />
      <div className="product-material-filters">
        <div className="learner-search">
          <SearchInput
            name="q"
            aria-label="Tìm tài liệu"
            placeholder="Tìm tài liệu…"
            maxLength={100}
            value={search}
            onChange={setSearch}
            onSearch={(value) => {
              setQ(value);
              setPage(1);
            }}
          />
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
      </div>
      <Feedback error={skills.error} reload={skills.reload} />
      {skills.cursor && (
        <LoadingButton
          type="button"
          className="btn"
          disabled={skills.loading}
          onClick={() => {
            void skills.more();
          }}
          loading={!!skills.loading}
        >
          Tải thêm kỹ năng cho bộ lọc
        </LoadingButton>
      )}
      <Feedback
        loading={query.initialLoading}
        error={query.error}
        reload={query.reload}
        refreshing={!!(query.loading && !query.initialLoading)}
      />
      <div className="product-materials">
        {query.data?.map((material) => (
          <article className="learner-card product-material" key={material.id}>
            <div className="product-material-cover">
              <MaterialThumbnail thumbnail={material.thumbnail} />
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
              <MaterialRating summary={material.ratingSummary} />
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
      <PageNavigation
        pageNumber={page}
        totalPages={
          typeof total === "number"
            ? Math.max(1, Math.ceil(total / 12))
            : undefined
        }
        loading={query.loading}
        hasNext={
          !query.error && !!query.data && page * 12 < (total ?? page * 12)
        }
        onPageChange={setPage}
      />
    </>
  );
}
