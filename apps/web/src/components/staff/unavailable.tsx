"use client";

import Link from "next/link";
import { useId, useState } from "react";
import {
  Badge,
  Card,
  Empty,
  Notice,
  PageHeader,
  SearchBox,
} from "@/components/console/ui";
import {
  developmentFeatures,
  type DevelopmentFeatureKey,
} from "@/lib/staff/development-features";

export function UnavailableScreen({
  feature,
}: Readonly<{ feature: DevelopmentFeatureKey }>) {
  const content = developmentFeatures[feature];
  const [preview, setPreview] = useState(false);
  const [query, setQuery] = useState("");
  const previewId = useId();
  const search = query.trim().toLocaleLowerCase("vi");
  const rows = content.rows.filter((row) =>
    row.cells.join(" ").toLocaleLowerCase("vi").includes(search),
  );

  return (
    <>
      <PageHeader
        title={content.title}
        desc={content.description}
        back={
          <Link className="back-link" href="/admin">
            ← Về tổng quan
          </Link>
        }
      />
      <Card>
        <Empty
          title="Tính năng đang phát triển"
          desc="Bạn có thể xem trước giao diện với dữ liệu mẫu."
        />
        <div className="staff-development-actions">
          <button
            type="button"
            className="btn btn-primary"
            aria-expanded={preview}
            aria-controls={preview ? previewId : undefined}
            onClick={() => {
              setPreview(!preview);
              setQuery("");
            }}
          >
            {preview ? "Đóng xem thử" : "Xem thử với dữ liệu mẫu"}
          </button>
        </div>
      </Card>
      {preview && (
        <section
          id={previewId}
          className="staff-development-preview stack section"
          aria-label={`Xem thử ${content.title.toLocaleLowerCase("vi")}`}
        >
          <Notice>
            Bản xem thử sử dụng dữ liệu mẫu để minh họa giao diện.
          </Notice>
          <div className="toolbar">
            <SearchBox
              label="Tìm trong dữ liệu mẫu"
              placeholder="Tìm trong dữ liệu mẫu…"
              value={query}
              onChange={setQuery}
            />
          </div>
          <Card
            title={content.previewTitle}
            actions={<Badge tone="warn">Dữ liệu mẫu</Badge>}
            flush
          >
            {!rows.length ? (
              <Empty title="Không có dữ liệu mẫu phù hợp" />
            ) : (
              <div className="table-wrap">
                <table className="table">
                  <caption className="sr-only">{content.previewTitle}</caption>
                  <thead>
                    <tr>
                      {content.columns.map((column) => (
                        <th key={column} scope="col">
                          {column}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {rows.map((row) => (
                      <tr key={row.id}>
                        {row.cells.map((cell, index) => (
                          <td key={index}>{cell}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </section>
      )}
    </>
  );
}
