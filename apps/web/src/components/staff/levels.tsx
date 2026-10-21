"use client";
import { useState } from "react";
import { Card, Empty, PageHeader } from "@/components/console/ui";
import { useStaffList } from "./hooks";
import { useStaffSession } from "./session";
import { QueueState } from "./common";

type Level = {
  id: string;
  code: string;
  name: string;
  description: string | null;
  sortOrder: number;
  status: string;
  version: number;
};

export function SkillLevelsScreen({ skillId }: Readonly<{ skillId: string }>) {
  const { api } = useStaffSession();
  const queue = useStaffList<Level>(`skills/${skillId}/levels`);
  const [code, setCode] = useState("");
  const [name, setName] = useState("");
  const [message, setMessage] = useState("");
  return (
    <>
      <PageHeader
        title="Cấp độ kỹ năng"
        desc={`Các cấp độ của kỹ năng ${skillId}.`}
      />
      <Card className="section" title="Thêm cấp độ">
        <form
          className="stack"
          onSubmit={async (event) => {
            event.preventDefault();
            setMessage("");
            try {
              await api(`skills/${skillId}/levels`, {
                method: "POST",
                key: crypto.randomUUID(),
                body: {
                  reason: "Bổ sung cấp độ cho danh mục.",
                  code,
                  name,
                  description: null,
                  sortOrder: queue.items.length,
                  status: "ACTIVE",
                },
              });
              setCode("");
              setName("");
              setMessage("Đã thêm cấp độ.");
              void queue.reload();
            } catch (error) {
              setMessage(
                error instanceof Error ? error.message : "Không thêm được cấp độ.",
              );
            }
          }}
        >
          <label className="staff-field">
            Mã
            <input
              className="input"
              value={code}
              onChange={(event) => setCode(event.target.value.toUpperCase())}
              required
            />
          </label>
          <label className="staff-field">
            Tên
            <input
              className="input"
              value={name}
              onChange={(event) => setName(event.target.value)}
              required
            />
          </label>
          <button className="btn btn-primary" type="submit">
            Thêm
          </button>
        </form>
        {message && <p>{message}</p>}
      </Card>
      <QueueState
        loading={queue.loading}
        error={queue.error}
        empty={queue.items.length === 0}
        reload={() => void queue.reload()}
      >
        {queue.items.length === 0 ? (
          <Empty title="Chưa có cấp độ riêng" />
        ) : (
          <ul className="q-list">
            {queue.items.map((level) => (
              <li className="q-item" key={level.id}>
                <span>
                  {level.code} · {level.name}
                </span>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={async () => {
                    await api(`skills/${skillId}/levels/${level.id}`, {
                      method: "PATCH",
                      key: crypto.randomUUID(),
                      body: {
                        status: level.status === "ACTIVE" ? "INACTIVE" : "ACTIVE",
                        expectedVersion: level.version,
                        reason: "Đổi trạng thái cấp độ.",
                      },
                    });
                    void queue.reload();
                  }}
                >
                  {level.status === "ACTIVE" ? "Tắt" : "Bật"}
                </button>
              </li>
            ))}
          </ul>
        )}
      </QueueState>
    </>
  );
}
