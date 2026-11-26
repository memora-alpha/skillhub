import Link from "next/link";
import { LoadingImage as Image } from "@/components/loading-image";
import { Icon } from "./icon";
import { skills, steps, trustPillars, faqs } from "./content";
import { LandingHeader } from "./landing-header";
import { Logo } from "./logo";
import { ModeShowcase } from "./mode-showcase";
// Photos by Julio Lopez and Chidera Faustina Okeke, used under https://unsplash.com/license.
// Sources: https://unsplash.com/photos/NLuDzsdyQ6M and https://unsplash.com/photos/2FDdgn0-W_o.
import onlineLearning from "../../../public/landing/online-learning.webp";
import peerLearning from "../../../public/landing/peer-learning.webp";

export function LandingPage() {
  return (
    <div id="top" className="skillhub-public site-shell">
      <a className="landing-skip" href="#landing-content">
        Đến nội dung chính
      </a>
      <LandingHeader />

      <main id="landing-content" tabIndex={-1}>
        {/* 1. Hero — Clean, visual-first, zero clutter */}
        <section className="hero">
          <div className="container hero-grid">
            <div className="hero-copy">
              <p className="lp-badge">
                <Icon name="spark" size={14} />
                Học & trao đổi kỹ năng trực tuyến 1:1
              </p>
              <h1>
                Chia sẻ điều bạn giỏi.
                <br />
                <em>Học điều bạn cần.</em>
              </h1>
              <p className="hero-lead">
                Kết nối trực tiếp 1:1 để trao đổi kỹ năng, học cùng người có
                kinh nghiệm hoặc khám phá kho tài liệu thực tế — rõ ràng từ lịch
                học đến Credit.
              </p>
              <div className="hero-actions">
                <Link className="button" href="/register">
                  Bắt đầu miễn phí <Icon name="arrow" size={17} />
                </Link>
                <a className="button button-ghost" href="#ways">
                  Xem cách hoạt động
                </a>
              </div>
              <p className="hero-footnote">
                Miễn phí tạo tài khoản · Học trực tuyến 1:1 · Hoàn hoặc nhận 96%
                Credit
              </p>
            </div>

            <div className="hero-media">
              <div className="hero-photo">
                <Image
                  width={1200}
                  height={1500}
                  sizes="(max-width: 592px) calc(100vw - 32px), (max-width: 960px) 560px, 480px"
                  loading="eager"
                  fetchPriority="high"
                  src="https://images.unsplash.com/photo-1621570277341-4fea9203f5e0?auto=format&fit=crop&w=1200&q=88"
                  alt="Hai người cùng trao đổi và học kỹ năng bên máy tính"
                />
              </div>

              <div className="hero-float-pill">
                <span className="hero-float-dot" aria-hidden="true" />
                <div>
                  <strong>React ↔ Tiếng Anh</strong>
                  <small>Trao đổi 1:1 · 4 buổi đã chốt</small>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* 2. Interactive Modes — One focused view at a time */}
        <section id="ways" className="lp-section lp-surface-white">
          <div className="container">
            <div className="section-head centered">
              <p className="kicker">Ba cách học linh hoạt</p>
              <h2>Một tài khoản. Chọn đúng cách bạn muốn học.</h2>
            </div>
            <ModeShowcase />
          </div>
        </section>

        {/* 3. Simple 3-Step Flow + Editorial Photo */}
        <section id="how" className="lp-section">
          <div className="container lp-split-feature">
            <div className="lp-editorial-photo lp-online-photo">
              <Image
                src={onlineLearning}
                placeholder="blur"
                sizes="(max-width: 860px) calc(100vw - 32px), (max-width: 960px) calc(100vw - 48px), 540px"
                alt="Người học đeo tai nghe và sử dụng laptop bên cửa sổ"
              />
              <span className="lp-photo-tag">
                <Icon name="video" size={14} /> Học trực tuyến theo lịch của bạn
              </span>
            </div>

            <div className="lp-split-body">
              <p className="kicker">Cách hoạt động</p>
              <h2>Bắt đầu chỉ trong 3 bước.</h2>
              <ol className="lp-steps-list">
                {steps.map((step) => (
                  <li className="lp-step-row" key={step.number}>
                    <span className="lp-step-num">{step.number}</span>
                    <div>
                      <h3>{step.title}</h3>
                      <p>{step.copy}</p>
                    </div>
                  </li>
                ))}
              </ol>
            </div>
          </div>
        </section>

        {/* 4. Skills Directory Preview */}
        <section id="skills" className="lp-section lp-surface-white">
          <div className="container">
            <div className="section-head split">
              <div>
                <p className="kicker">Danh mục kỹ năng</p>
                <h2>Bắt đầu từ kỹ năng bạn quan tâm.</h2>
              </div>
              <Link className="lp-text-link" href="/register">
                Khám phá tất cả <Icon name="arrow" size={16} />
              </Link>
            </div>
            <div className="skill-grid">
              {skills.map((skill) => (
                <Link href="/register" className="skill-card" key={skill.title}>
                  <span className={`skill-icon ${skill.tone}`}>
                    <Icon name={skill.icon} size={20} />
                  </span>
                  <span className="skill-info">
                    <strong>{skill.title}</strong>
                    <small>{skill.tags}</small>
                  </span>
                  <span className="card-arrow">
                    <Icon name="chevron" size={16} />
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>

        {/* 5. Trust & Credit Clarity + Community Photo */}
        <section id="trust" className="lp-section">
          <div className="container lp-split-feature lp-split-reverse">
            <div className="lp-split-body">
              <p className="kicker">Minh bạch & An toàn</p>
              <h2>Quy tắc rõ ràng cho cả hai phía.</h2>
              <div className="lp-trust-list">
                {trustPillars.map((pillar) => (
                  <article className="lp-trust-row" key={pillar.title}>
                    <strong>{pillar.metric}</strong>
                    <div>
                      <h3>{pillar.title}</h3>
                      <p>{pillar.copy}</p>
                    </div>
                  </article>
                ))}
              </div>
            </div>

            <div className="lp-editorial-photo lp-peer-photo">
              <Image
                src={peerLearning}
                placeholder="blur"
                sizes="(max-width: 860px) calc(100vw - 32px), (max-width: 960px) calc(100vw - 48px), 540px"
                alt="Hai người cùng học, trao đổi ghi chú và xem tài liệu trên laptop"
              />
              <span className="lp-photo-tag">
                <Icon name="users" size={14} /> Cùng học và chia sẻ kỹ năng
              </span>
            </div>
          </div>
        </section>

        {/* 6. Concise FAQ */}
        <section id="faq" className="lp-section lp-surface-white">
          <div className="container faq-grid">
            <div className="faq-intro">
              <p className="kicker">Hỏi đáp nhanh</p>
              <h2>Những điều thường hỏi trước khi bắt đầu.</h2>
              <p>
                Mọi thông tin về vai trò học/dạy, Credit và lịch học đều ngắn
                gọn tại đây.
              </p>
            </div>
            <div className="accordion">
              {faqs.map(([question, answer]) => (
                <details key={question}>
                  <summary>
                    <span>{question}</span>
                    <span className="faq-plus" aria-hidden="true">
                      +
                    </span>
                  </summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        {/* 7. Focused Final CTA */}
        <section className="final-cta">
          <div className="container">
            <div className="cta-card">
              <h2>Sẵn sàng học kỹ năng mới cùng SkillHub?</h2>
              <p>
                Tạo tài khoản miễn phí trong 1 phút và kết nối ngay với người
                đồng hành phù hợp.
              </p>
              <div className="cta-actions">
                <Link className="button" href="/register">
                  Tạo tài khoản miễn phí <Icon name="arrow" size={17} />
                </Link>
                <Link className="button button-dark-outline" href="/login">
                  Đăng nhập
                </Link>
              </div>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="container footer-top">
          <div className="footer-brand">
            <Logo />
            <p>
              Nền tảng trao đổi kỹ năng, học 1:1 trực tuyến và chia sẻ tài liệu
              số minh bạch.
            </p>
          </div>
          <div className="footer-links">
            <div>
              <h3>Khám phá</h3>
              <a href="#ways">Hình thức học</a>
              <a href="#how">Cách hoạt động</a>
              <a href="#skills">Kỹ năng</a>
              <a href="#faq">Hỏi đáp</a>
            </div>
            <div>
              <h3>Pháp lý</h3>
              <Link href="/terms">Điều khoản sử dụng</Link>
              <Link href="/privacy">Chính sách bảo mật</Link>
              <Link href="/login">Đăng nhập</Link>
              <Link href="/register">Đăng ký</Link>
            </div>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© 2026 SkillHub. Mọi quyền được bảo lưu.</span>
          <span>Trao đổi 2 chiều · Học 1 chiều · Tài liệu số</span>
        </div>
      </footer>
    </div>
  );
}
