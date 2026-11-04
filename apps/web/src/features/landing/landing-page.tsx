import Link from "next/link";
import Image from "next/image";
import { Icon, type IconName } from "./icon";
import { skills, steps, faqs } from "./content";
import { LandingHeader } from "./landing-header";
import { Logo } from "./logo";

export function LandingPage() {
  return (
    <div id="top" className="skillhub-public site-shell">
      <a className="landing-skip" href="#landing-content">
        Đến nội dung chính
      </a>
      <LandingHeader />

      <main id="landing-content" tabIndex={-1}>
        <section className="hero">
          <div className="container hero-grid">
            <div className="hero-copy">
              <p className="lp-eyebrow">
                <span>
                  <Icon name="spark" size={16} />
                </span>{" "}
                Học kỹ năng 1:1, cùng nhau tiến bộ
              </p>
              <h1>
                Chia sẻ điều bạn biết.
                <br />
                <em>Học điều bạn muốn.</em>
              </h1>
              <p className="hero-lead">
                Kết nối với người có kỹ năng phù hợp, cùng xây dựng lộ trình và
                học trực tiếp 1:1. Trao đổi kỹ năng bạn đang có hoặc sử dụng
                Credit để bắt đầu điều mình muốn học.
              </p>
              <div className="hero-actions">
                <Link className="button" href="/login">
                  Bắt đầu học <Icon name="arrow" size={18} />
                </Link>
                <a className="button button-secondary" href="#how">
                  <Icon name="play" size={19} /> Xem cách SkillHub hoạt động
                </a>
              </div>
              <div className="hero-points">
                {[
                  "Học trực tiếp 1:1",
                  "Lộ trình cùng thống nhất",
                  "Credit minh bạch",
                ].map((point) => (
                  <span key={point}>
                    <i>
                      <Icon name="check" size={13} />
                    </i>
                    {point}
                  </span>
                ))}
              </div>
            </div>
            <div className="hero-visual">
              <div className="hero-shape" />
              <div className="hero-image-wrap">
                <Image
                  width={1200}
                  height={1500}
                  sizes="(max-width: 760px) calc(100vw - 48px), (max-width: 1228px) 45vw, 517px"
                  loading="eager"
                  fetchPriority="high"
                  src="https://images.unsplash.com/photo-1621570277341-4fea9203f5e0?auto=format&fit=crop&w=1200&q=88"
                  alt="Hai người trẻ cùng trao đổi và học tập bên máy tính"
                />
              </div>
              <div className="skill-float float-one">
                <span className="float-icon orange">
                  <Icon name="code" size={19} />
                </span>
                <span>
                  <small>Bạn chia sẻ</small>
                  <strong>React</strong>
                </span>
              </div>
              <div className="swap-badge">
                <span>↔</span>
              </div>
              <div className="skill-float float-two">
                <span className="float-icon sage">
                  <Icon name="language" size={19} />
                </span>
                <span>
                  <small>Bạn muốn học</small>
                  <strong>Tiếng Anh giao tiếp</strong>
                </span>
              </div>
              <div className="photo-credit">Ảnh: Surface / Unsplash</div>
            </div>
          </div>
        </section>

        <section id="skills" className="lp-section skills-section">
          <div className="container">
            <div className="section-heading split-heading">
              <div>
                <p className="kicker">Khám phá kỹ năng</p>
                <h2>
                  Kỹ năng tiếp theo của bạn
                  <br />
                  bắt đầu từ đâu?
                </h2>
              </div>
              <p>
                Tìm điều bạn muốn học, hoặc khám phá kỹ năng bạn có thể chia sẻ
                với cộng đồng.
              </p>
            </div>
            <div className="skill-grid">
              {skills.map((skill) => (
                <Link href="/login" className="skill-card" key={skill.title}>
                  <span className={`skill-icon ${skill.tone}`}>
                    <Icon name={skill.icon} />
                  </span>
                  <span className="skill-info">
                    <strong>{skill.title}</strong>
                    <small>{skill.copy}</small>
                  </span>
                  <span className="card-arrow">
                    <Icon name="chevron" size={18} />
                  </span>
                </Link>
              ))}
            </div>
            <div className="center-link">
              <Link href="/login">
                Xem tất cả kỹ năng <Icon name="arrow" size={17} />
              </Link>
            </div>
          </div>
        </section>

        <section id="ways" className="lp-section ways-section">
          <div className="container">
            <div className="section-heading centered">
              <p className="kicker">Linh hoạt theo mục tiêu</p>
              <h2>Chọn cách học phù hợp với bạn.</h2>
              <p>
                Mỗi mục tiêu có một cách bắt đầu. SkillHub giúp bạn tìm đúng
                người, đúng lộ trình.
              </p>
            </div>
            <div className="ways-grid">
              <article className="way-card exchange">
                <span className="way-number" aria-hidden="true">
                  01
                </span>
                <div className="way-icon">
                  <Icon name="users" size={26} />
                </div>
                <h3>Trao đổi kỹ năng</h3>
                <p>
                  Bạn có một kỹ năng để chia sẻ và một điều muốn học? Kết nối
                  với người phù hợp để hai bên cùng tiến bộ.
                </p>
                <div className="mini-exchange">
                  <span>
                    <small>Bạn hướng dẫn</small>
                    <b>React</b>
                  </span>
                  <i>↔</i>
                  <span>
                    <small>Học từ đối phương</small>
                    <b>Tiếng Anh</b>
                  </span>
                </div>
              </article>
              <article className="way-card guided">
                <span className="way-number" aria-hidden="true">
                  02
                </span>
                <div className="way-icon">
                  <Icon name="video" size={26} />
                </div>
                <h3>Học cùng người hướng dẫn</h3>
                <p>
                  Tập trung vào mục tiêu của bạn với lộ trình 1:1 và mức Credit
                  được hai bên thống nhất trước khi bắt đầu.
                </p>
                <div className="way-line">
                  <Icon name="check" size={17} /> Lộ trình cá nhân hóa
                </div>
                <div className="way-line">
                  <Icon name="check" size={17} /> Lịch học linh hoạt
                </div>
              </article>
              <article className="way-card resources">
                <span className="way-number" aria-hidden="true">
                  03
                </span>
                <div className="way-icon">
                  <Icon name="file" size={26} />
                </div>
                <h3>Khám phá tài liệu số</h3>
                <p>
                  Tìm tài liệu theo kỹ năng, nhận tài liệu miễn phí hoặc mua
                  bằng Credit. Bạn cũng có thể chia sẻ tài liệu của mình.
                </p>
                <div className="file-stack">
                  <span>
                    <Icon name="file" size={18} /> React căn bản.pdf
                  </span>
                  <span>
                    <Icon name="file" size={18} /> Giao tiếp A1.pdf
                  </span>
                </div>
              </article>
            </div>
          </div>
        </section>

        <section id="how" className="lp-section process-section">
          <div className="container">
            <div className="section-heading centered light">
              <p className="kicker">Cách SkillHub hoạt động</p>
              <h2>Từ một kết nối đến một kỹ năng mới.</h2>
            </div>
            <div className="steps">
              {steps.map(([title, copy], index) => (
                <article className="step" key={title}>
                  <div className="step-number">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                  {index === 2 && (
                    <small>
                      Với trao đổi hai chiều, mỗi người xây dựng lộ trình cho
                      phần kỹ năng mình hướng dẫn.
                    </small>
                  )}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-section product-section">
          <div className="container product-grid">
            <div className="product-copy">
              <p className="kicker">Trải nghiệm liền mạch</p>
              <h2>Mọi thứ cần cho hành trình học, trong cùng một nơi.</h2>
              <p>
                Từ lời chào đầu tiên đến buổi học cuối cùng, mọi thỏa thuận đều
                được lưu lại rõ ràng và dễ theo dõi.
              </p>
              <div className="feature-list">
                {[
                  [
                    "chat",
                    "Trò chuyện",
                    "Trao đổi mục tiêu trước khi bắt đầu.",
                  ],
                  [
                    "book",
                    "Lộ trình rõ ràng",
                    "Biết mình sẽ học gì qua từng buổi.",
                  ],
                  [
                    "calendar",
                    "Lịch học linh hoạt",
                    "Theo dõi lịch đã được hai bên xác nhận.",
                  ],
                  [
                    "video",
                    "Phòng học 1:1",
                    "Gặp nhau trực tuyến bằng âm thanh và video.",
                  ],
                ].map(([icon, title, copy]) => (
                  <div className="feature-item" key={title}>
                    <span>
                      <Icon name={icon as IconName} size={20} />
                    </span>
                    <div>
                      <strong>{title}</strong>
                      <small>{copy}</small>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="dashboard-wrap">
              <div className="dashboard-label">Giao diện minh họa</div>
              <div className="dashboard">
                <aside>
                  <Logo />
                  <span className="active">
                    <Icon name="book" size={17} /> Lộ trình
                  </span>
                  <span>
                    <Icon name="calendar" size={17} /> Lịch học
                  </span>
                  <span>
                    <Icon name="chat" size={17} /> Tin nhắn
                  </span>
                </aside>
                <div className="dash-main">
                  <div className="dash-top">
                    <span>Chào buổi sáng, Minh</span>
                    <i>M</i>
                  </div>
                  <div className="course-card">
                    <div className="course-head">
                      <span className="course-icon">
                        <Icon name="code" />
                      </span>
                      <div>
                        <small>Lộ trình đang học</small>
                        <strong>React căn bản</strong>
                      </div>
                      <b>2/4 buổi</b>
                    </div>
                    <div className="lp-progress">
                      <span />
                    </div>
                    <div className="lesson done">
                      <i>
                        <Icon name="check" size={13} />
                      </i>
                      <span>
                        <b>Buổi 1 · Làm quen với React</b>
                        <small>Đã hoàn thành</small>
                      </span>
                    </div>
                    <div className="lesson done">
                      <i>
                        <Icon name="check" size={13} />
                      </i>
                      <span>
                        <b>Buổi 2 · Component & Props</b>
                        <small>Đã hoàn thành</small>
                      </span>
                    </div>
                    <div className="lesson next">
                      <i>3</i>
                      <span>
                        <b>Buổi 3 · State & Hooks</b>
                        <small>Thứ 7, 09:00</small>
                      </span>
                      <Link href="/login">Vào phòng học</Link>
                    </div>
                    <div className="lesson">
                      <i>4</i>
                      <span>
                        <b>Buổi 4 · Dự án thực hành</b>
                        <small>Chưa lên lịch</small>
                      </span>
                    </div>
                  </div>
                  <div className="mentor-row">
                    <span className="lp-avatar">A</span>
                    <span>
                      <small>Người hướng dẫn</small>
                      <b>Anh Nguyễn</b>
                    </span>
                    <Link href="/login">
                      <Icon name="chat" size={16} /> Nhắn tin
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section id="credit" className="lp-section credit-section">
          <div className="container">
            <div className="credit-intro">
              <div>
                <p className="kicker">Credit trên SkillHub</p>
                <h2>
                  Rõ ràng từ lúc thống nhất
                  <br />
                  đến khi hoàn thành.
                </h2>
                <p>
                  Credit là đơn vị sử dụng trong SkillHub để cam kết trao đổi,
                  thanh toán học một chiều và mua tài liệu số.
                </p>
              </div>
              <div className="wallet-card">
                <span>
                  <Icon name="wallet" size={24} />
                </span>
                <small>Giá trị quy đổi</small>
                <strong>1 Credit</strong>
                <b>= 1.000 VNĐ</b>
              </div>
            </div>
            <div className="credit-grid">
              <article>
                <div className="credit-card-head">
                  <span>
                    <Icon name="users" />
                  </span>
                  <div>
                    <small>Hình thức 01</small>
                    <h3>Trao đổi hai chiều</h3>
                  </div>
                </div>
                <p>
                  Hai người cùng có khoản Credit cam kết. Khi hoàn tất hợp lệ,
                  mỗi người nhận lại <strong>96%</strong> khoản Credit đã giữ
                  của chính mình.
                </p>
                <div className="credit-example">
                  <span>Mỗi người giữ</span>
                  <b>100 Credit</b>
                  <Icon name="arrow" />
                  <span>Mỗi người nhận lại</span>
                  <b>96 Credit</b>
                </div>
                <small className="fee">4% là phí nền tảng</small>
              </article>
              <article>
                <div className="credit-card-head">
                  <span>
                    <Icon name="book" />
                  </span>
                  <div>
                    <small>Hình thức 02</small>
                    <h3>Học một chiều</h3>
                  </div>
                </div>
                <p>
                  Người học cam kết mức Credit đã thương lượng. Khi hoàn tất hợp
                  lệ, người dạy nhận <strong>96%</strong> Credit đã thỏa thuận.
                </p>
                <div className="credit-example">
                  <span>Thỏa thuận</span>
                  <b>100 Credit</b>
                  <Icon name="arrow" />
                  <span>Người dạy nhận</span>
                  <b>96 Credit</b>
                </div>
                <small className="fee">4% là phí nền tảng</small>
              </article>
            </div>
            <p className="credit-note">
              Credit được quyết toán khi toàn bộ thỏa thuận hoàn tất và không có
              tranh chấp chặn quyết toán. Credit sử dụng trong nền tảng, không
              hỗ trợ rút thành tiền. Phí tài liệu áp dụng theo chính sách riêng.
            </p>
          </div>
        </section>

        <section className="lp-section trust-section">
          <div className="container">
            <div className="section-heading split-heading">
              <div>
                <p className="kicker">An tâm để cùng tiến bộ</p>
                <h2>
                  Kết nối có cơ sở.
                  <br />
                  Học với sự rõ ràng.
                </h2>
              </div>
              <p>
                SkillHub đặt sự minh bạch vào từng bước, để bạn tập trung vào
                điều quan trọng nhất: học và chia sẻ.
              </p>
            </div>
            <div className="trust-grid">
              {[
                [
                  "shield",
                  "Kỹ năng có thể được xác minh",
                  "Nhãn xác minh chỉ xuất hiện với kỹ năng thực sự đã được duyệt.",
                ],
                [
                  "check",
                  "Hai bên cùng xác nhận",
                  "Lộ trình và lịch học cần được thống nhất trước khi bắt đầu.",
                ],
                [
                  "spark",
                  "Đánh giá sau hành trình",
                  "Chia sẻ trải nghiệm sau khi hoàn thành toàn bộ lộ trình.",
                ],
                [
                  "chat",
                  "Báo cáo khi cần hỗ trợ",
                  "Gửi báo cáo cùng thông tin liên quan để được xem xét.",
                ],
              ].map(([icon, title, copy]) => (
                <article key={title}>
                  <span>
                    <Icon name={icon as IconName} />
                  </span>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              ))}
            </div>
            <div className="privacy-note">
              <Icon name="shield" size={20} />
              <p>
                <strong>Quyền riêng tư được tôn trọng.</strong> Hồ sơ công khai
                tập trung vào kỹ năng và trải nghiệm; thông tin đăng nhập, thanh
                toán và bằng chứng riêng tư được giới hạn quyền truy cập.
              </p>
            </div>
          </div>
        </section>

        <section id="faq" className="lp-section faq-section">
          <div className="container faq-grid">
            <div className="faq-title">
              <p className="kicker">Câu hỏi thường gặp</p>
              <h2>Bạn đang thắc mắc điều gì?</h2>
              <p>
                Những điều cần biết trước khi bắt đầu hành trình của bạn trên
                SkillHub.
              </p>
              <div className="faq-help">
                <Icon name="chat" />
                <span>
                  <small>Vẫn cần hỗ trợ?</small>
                  <a href="#faq">Xem câu hỏi thường gặp</a>
                </span>
              </div>
            </div>
            <div className="accordion">
              {faqs.map(([question, answer], index) => (
                <details key={question} open={index === 0}>
                  <summary>
                    {question}
                    <span aria-hidden="true">+</span>
                  </summary>
                  <p>{answer}</p>
                </details>
              ))}
            </div>
          </div>
        </section>

        <section className="final-cta">
          <div className="container cta-card">
            <div className="cta-spark one">✦</div>
            <div className="cta-spark two">✦</div>
            <p className="kicker">Bắt đầu hành trình của bạn</p>
            <h2>
              Điều bạn biết hôm nay
              <br />
              có thể mở ra điều bạn muốn học ngày mai.
            </h2>
            <p>
              Bắt đầu từ một kỹ năng, một mục tiêu và một người cùng bạn tiến
              bộ.
            </p>
            <Link className="button" href="/login">
              Tham gia SkillHub <Icon name="arrow" size={18} />
            </Link>
          </div>
        </section>
      </main>

      <footer>
        <div className="container footer-grid">
          <div className="footer-brand">
            <Logo />
            <p>
              Chia sẻ điều bạn biết.
              <br />
              Học điều bạn muốn.
            </p>
          </div>
          <div>
            <h3>Khám phá</h3>
            <a href="#skills">Kỹ năng</a>
            <a href="#how">Cách hoạt động</a>
            <a href="#ways">Hình thức học</a>
            <a href="#credit">Credit</a>
          </div>
          <div>
            <h3>Hỗ trợ</h3>
            <a href="#faq">Câu hỏi thường gặp</a>
            <a href="#faq">Hướng dẫn</a>
            <a href="#how">Hướng dẫn bắt đầu</a>
            <Link href="/terms">Điều khoản sử dụng</Link>
            <Link href="/privacy">Chính sách bảo mật</Link>
          </div>
          <div className="footer-callout">
            <span>
              <Icon name="users" />
            </span>
            <h3>Học tốt hơn khi có nhau.</h3>
            <p>Tham gia cộng đồng học tập 1:1 của SkillHub.</p>
            <Link href="/login">
              Bắt đầu ngay <Icon name="arrow" size={16} />
            </Link>
          </div>
        </div>
        <div className="container footer-bottom">
          <span>© 2026 SkillHub. All rights reserved.</span>
          <span>Được xây dựng cho những người luôn muốn tiến bộ.</span>
        </div>
      </footer>
    </div>
  );
}
