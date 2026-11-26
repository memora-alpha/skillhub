"use client";

import { useState } from "react";
import Link from "next/link";
import { Icon, type IconName } from "./icon";

type ModeId = "exchange" | "guided" | "materials";

interface ModeConfig {
  id: ModeId;
  tab: string;
  icon: IconName;
  title: string;
  summary: string;
  points: readonly string[];
}

const MODE_ORDER: readonly ModeId[] = ["exchange", "guided", "materials"];

const MODES: Record<ModeId, ModeConfig> = {
  exchange: {
    id: "exchange",
    tab: "Trao đổi 2 chiều",
    icon: "users",
    title: "Dạy điều bạn giỏi, học điều bạn cần",
    summary:
      "Ghép cặp trực tiếp với người có kỹ năng bạn muốn học và dạy chéo theo lộ trình rõ ràng.",
    points: [
      "Thống nhất hai lộ trình đối ứng trước khi xếp lịch",
      "Cùng giữ cam kết từ 20 CR để đảm bảo nghiêm túc",
      "Hoàn lại 96% Credit khi hoàn tất toàn bộ buổi học",
    ],
  },
  guided: {
    id: "guided",
    tab: "Học 1 chiều",
    icon: "video",
    title: "Học 1:1 cùng người có kinh nghiệm",
    summary:
      "Chưa có kỹ năng để trao đổi? Thương lượng mức Credit và bắt đầu học ngay cùng người hướng dẫn.",
    points: [
      "Chỉ người học giữ Credit — người dạy không cần đặt cọc",
      "Phòng học trực tuyến 1:1 linh hoạt 60–180 phút/buổi",
      "Người dạy nhận 96% Credit sau khi hoàn tất lộ trình",
    ],
  },
  materials: {
    id: "materials",
    tab: "Tài liệu số",
    icon: "file",
    title: "Kho tài liệu thực chiến theo kỹ năng",
    summary:
      "Tải miễn phí hoặc mở khóa bằng Credit các bộ tài liệu được cộng đồng chọn lọc và kiểm duyệt.",
    points: [
      "Tìm nhanh theo đúng kỹ năng bạn đang theo đuổi",
      "Có sẵn cả tài liệu miễn phí lẫn tài liệu chuyên sâu",
      "Kiểm tra an toàn và cấp quyền tải riêng tư ngay lập tức",
    ],
  },
};

function ExchangeVisual() {
  return (
    <div className="lp-preview-card">
      <div className="lp-preview-top">
        <span className="lp-pill lp-pill-sage">
          <Icon name="shield" size={13} /> Đã chốt lịch học
        </span>
        <span className="lp-preview-meta">40 CR / người</span>
      </div>

      <div className="lp-swap-stack">
        <div className="lp-swap-row">
          <span className="lp-mini-icon orange">
            <Icon name="code" size={18} />
          </span>
          <div className="lp-swap-info">
            <small>Bạn hướng dẫn</small>
            <strong>React & TypeScript</strong>
          </div>
          <span className="lp-swap-sessions">4 buổi</span>
        </div>

        <div className="lp-swap-divider" aria-hidden="true">
          <span>↔</span>
        </div>

        <div className="lp-swap-row">
          <span className="lp-mini-icon sage">
            <Icon name="language" size={18} />
          </span>
          <div className="lp-swap-info">
            <small>Bạn được học</small>
            <strong>Tiếng Anh giao tiếp</strong>
          </div>
          <span className="lp-swap-sessions">4 buổi</span>
        </div>
      </div>

      <div className="lp-preview-foot">
        <span>Hoàn 96% Credit khi xong lộ trình</span>
        <b>Phí 4%</b>
      </div>
    </div>
  );
}

function GuidedVisual() {
  return (
    <div className="lp-preview-card">
      <div className="lp-preview-top">
        <div>
          <small className="lp-preview-sub">Lộ trình học 1:1</small>
          <strong className="lp-preview-title">React căn bản & Hooks</strong>
        </div>
        <span className="lp-pill lp-pill-sage">2 / 4 buổi</span>
      </div>

      <div className="lp-progress-track" aria-hidden="true">
        <span style={{ width: "50%" }} />
      </div>

      <div className="lp-session-list">
        <div className="lp-session-row done">
          <i>
            <Icon name="check" size={12} />
          </i>
          <div>
            <strong>Buổi 1 · Component & JSX</strong>
            <small>Đã hoàn thành</small>
          </div>
        </div>

        <div className="lp-session-row done">
          <i>
            <Icon name="check" size={12} />
          </i>
          <div>
            <strong>Buổi 2 · Props & State</strong>
            <small>Đã hoàn thành</small>
          </div>
        </div>

        <div className="lp-session-row next">
          <i>3</i>
          <div>
            <strong>Buổi 3 · Custom Hooks</strong>
            <small>Thứ 7 · 09:00 – 10:30</small>
          </div>
          <Link href="/login" className="lp-session-btn">
            Vào phòng
          </Link>
        </div>
      </div>
    </div>
  );
}

function MaterialsVisual() {
  const files = [
    {
      name: "Tổng hợp React Hooks thực chiến.pdf",
      meta: "Lập trình Web · 42 trang",
      price: "Miễn phí",
      free: true,
    },
    {
      name: "Bộ đề luyện nói IELTS Band 7+.pdf",
      meta: "Tiếng Anh · Kèm audio mẫu",
      price: "25 CR",
      free: false,
    },
    {
      name: "Checklist tối ưu truy vấn SQL.pdf",
      meta: "Backend · Ví dụ thực tế",
      price: "15 CR",
      free: false,
    },
  ];

  return (
    <div className="lp-preview-card">
      <div className="lp-preview-top">
        <span className="lp-preview-title">Tài liệu chọn lọc</span>
        <span className="lp-preview-meta">Đã kiểm duyệt</span>
      </div>

      <div className="lp-file-list">
        {files.map((file) => (
          <div className="lp-file-row" key={file.name}>
            <span className="lp-mini-icon sand">
              <Icon name="file" size={17} />
            </span>
            <div className="lp-file-info">
              <strong>{file.name}</strong>
              <small>{file.meta}</small>
            </div>
            <span className={file.free ? "lp-tag-free" : "lp-tag-price"}>
              {file.price}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function ModeShowcase() {
  const [active, setActive] = useState<ModeId>("exchange");
  const current = MODES[active];

  return (
    <div className="lp-showcase">
      <div className="lp-tabs" role="tablist" aria-label="Hình thức học tập">
        {MODE_ORDER.map((id) => {
          const mode = MODES[id];
          const isSelected = mode.id === active;
          return (
            <button
              key={mode.id}
              type="button"
              role="tab"
              id={`tab-${mode.id}`}
              aria-selected={isSelected}
              aria-controls={`panel-${mode.id}`}
              className={isSelected ? "lp-tab active" : "lp-tab"}
              onClick={() => setActive(mode.id)}
            >
              <Icon name={mode.icon} size={17} />
              <span>{mode.tab}</span>
            </button>
          );
        })}
      </div>

      <div
        id={`panel-${current.id}`}
        role="tabpanel"
        aria-labelledby={`tab-${current.id}`}
        className="lp-showcase-panel"
      >
        <div className="lp-showcase-copy">
          <h3>{current.title}</h3>
          <p>{current.summary}</p>
          <ul className="lp-checks">
            {current.points.map((point) => (
              <li key={point}>
                <i>
                  <Icon name="check" size={13} />
                </i>
                <span>{point}</span>
              </li>
            ))}
          </ul>
          <Link className="lp-text-link" href="/register">
            Thử ngay miễn phí <Icon name="arrow" size={16} />
          </Link>
        </div>

        <div className="lp-showcase-visual">
          {current.id === "exchange" && <ExchangeVisual />}
          {current.id === "guided" && <GuidedVisual />}
          {current.id === "materials" && <MaterialsVisual />}
        </div>
      </div>
    </div>
  );
}
