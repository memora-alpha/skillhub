import Link from "next/link";
import { LoadingImage as Image } from "@/components/loading-image";
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
                  <Icon name="spark" size={15} />
                </span>
                Nền tảng học & trao đổi kỹ năng trực tuyến 1:1
              </p>
              <h1>
                Chia sẻ điều bạn giỏi.
                <br />
                <em>Học điều bạn cần.</em>
              </h1>
              <p className="hero-lead">
                Kết nối trực tiếp 1:1 với người có kỹ năng thực tế. Tự do chọn{" "}
                <strong>trao đổi kỹ năng 2 chiều</strong>,{" "}
                <strong>học 1 chiều bằng Credit</strong> hoặc khám phá{" "}
                <strong>kho tài liệu số</strong> — mọi lộ trình, lịch học và
                quyết toán đều được hai bên xác nhận minh bạch.
              </p>
              <div className="hero-actions">
                <Link className="button" href="/register">
                  Tạo tài khoản miễn phí <Icon name="arrow" size={18} />
                </Link>
                <a className="button button-secondary" href="#how">
                  <Icon name="play" size={18} /> Xem quy trình 5 bước
                </a>
              </div>
              <div className="hero-points">
                {[
                  "Phòng học LiveKit 1:1 (60–180 phút)",
                  "Xác nhận lộ trình & lịch song phương",
                  "Quyết toán minh bạch 96% / 4%",
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
              <div className="hero-shape" aria-hidden="true" />
              <div className="hero-image-wrap">
                <Image
                  width={1200}
                  height={1500}
                  sizes="(max-width: 760px) calc(100vw - 48px), (max-width: 1228px) 45vw, 520px"
                  loading="eager"
                  fetchPriority="high"
                  src="https://images.unsplash.com/photo-1621570277341-4fea9203f5e0?auto=format&fit=crop&w=1200&q=88"
                  alt="Hai người cùng học tập và trao đổi kỹ năng trực tuyến"
                />
              </div>

              <div className="hero-agreement-card">
                <div className="agreement-card-top">
                  <span className="pill-sage">
                    <Icon name="shield" size={13} /> Trao đổi 2 chiều · Đã chốt
                  </span>
                  <span className="pill-mono">Cam kết 40 CR/người</span>
                </div>
                <div className="agreement-pair">
                  <div className="pair-side">
                    <span className="pair-icon orange">
                      <Icon name="code" size={17} />
                    </span>
                    <div>
                      <small>Kế hoạch A → B</small>
                      <strong>React & TypeScript</strong>
                      <span>4 buổi · Đã xác minh</span>
                    </div>
                  </div>
                  <div className="pair-swap" aria-hidden="true">
                    ↔
                  </div>
                  <div className="pair-side">
                    <span className="pair-icon sage">
                      <Icon name="language" size={17} />
                    </span>
                    <div>
                      <small>Kế hoạch B → A</small>
                      <strong>Tiếng Anh giao tiếp</strong>
                      <span>4 buổi · Đã xác nhận</span>
                    </div>
                  </div>
                </div>
                <div className="agreement-card-foot">
                  <span>Hoàn 96% Credit khi xong toàn lộ trình</span>
                  <b>Phí 4%</b>
                </div>
              </div>

              <div className="photo-credit">Ảnh: Surface / Unsplash</div>
            </div>
          </div>
        </section>

        <section className="lp-metrics-strip" aria-label="Nguyên tắc cốt lõi">
          <div className="container metrics-grid">
            <div>
              <strong>1.000 VNĐ = 1 CR</strong>
              <span>Tỷ lệ quy đổi chuẩn, không phí ẩn</span>
            </div>
            <div>
              <strong>96% / 4%</strong>
              <span>Hoàn hoặc trả 96% sau khi xong toàn lộ trình</span>
            </div>
            <div>
              <strong>60 – 180 phút</strong>
              <span>Mỗi buổi học 1:1 · Đổi lịch trước 60 phút</span>
            </div>
            <div>
              <strong>50 / 100</strong>
              <span>Điểm uy tín khởi điểm minh bạch</span>
            </div>
          </div>
        </section>

        <section id="ways" className="lp-section ways-section">
          <div className="container">
            <div className="section-heading centered">
              <p className="kicker">Ba trụ cột học tập</p>
              <h2>Chọn đúng hình thức cho mục tiêu của bạn.</h2>
              <p>
                Một tài khoản SkillHub cho phép bạn vừa là người học vừa là
                người chia sẻ — linh hoạt theo từng thỏa thuận.
              </p>
            </div>
            <div className="ways-grid">
              <article className="way-card exchange">
                <div className="way-head">
                  <div className="way-icon">
                    <Icon name="users" size={24} />
                  </div>
                  <span className="way-tag">TWO_WAY</span>
                </div>
                <h3>Trao đổi kỹ năng 2 chiều</h3>
                <p>
                  Bạn dạy kỹ năng mình giỏi và học kỹ năng từ đối tác. Bắt buộc
                  có <strong>hai kế hoạch đối ứng</strong> (A→B và B→A) để cả
                  hai đều rõ mục tiêu trước khi xếp lịch.
                </p>
                <div className="mini-exchange">
                  <span>
                    <small>A hướng dẫn B</small>
                    <b>React · 4 buổi</b>
                  </span>
                  <i aria-hidden="true">↔</i>
                  <span>
                    <small>B hướng dẫn A</small>
                    <b>IELTS · 4 buổi</b>
                  </span>
                </div>
                <ul className="way-checks">
                  <li>
                    <Icon name="check" size={15} /> Cam kết tối thiểu 20
                    Credit/người cho toàn thỏa thuận
                  </li>
                  <li>
                    <Icon name="check" size={15} /> Hoàn lại 96% Credit của
                    chính mỗi người khi hoàn tất
                  </li>
                </ul>
              </article>

              <article className="way-card guided">
                <div className="way-head">
                  <div className="way-icon">
                    <Icon name="video" size={24} />
                  </div>
                  <span className="way-tag">ONE_WAY</span>
                </div>
                <h3>Học & dạy 1 chiều</h3>
                <p>
                  Chưa có kỹ năng để trao đổi hoặc muốn chia sẻ để tích lũy
                  Credit? Hai bên thương lượng tổng Credit toàn lộ trình ngay
                  trong Chat.
                </p>
                <ul className="way-checks">
                  <li>
                    <Icon name="check" size={15} /> Người dạy lập 1 kế hoạch và
                    lịch học, người học xác nhận
                  </li>
                  <li>
                    <Icon name="check" size={15} /> Chỉ người học tạm giữ Credit
                    — người dạy không cần đặt cọc
                  </li>
                  <li>
                    <Icon name="check" size={15} /> Người dạy nhận 96% Credit
                    khi toàn bộ buổi học hoàn tất
                  </li>
                </ul>
              </article>

              <article className="way-card resources">
                <div className="way-head">
                  <div className="way-icon">
                    <Icon name="file" size={24} />
                  </div>
                  <span className="way-tag">MATERIALS</span>
                </div>
                <h3>Kho tài liệu số</h3>
                <p>
                  Tìm kiếm tài liệu theo từng kỹ năng, tải tài liệu miễn phí
                  hoặc mua bằng Credit khả dụng — không cần chờ lộ trình học.
                </p>
                <div className="file-stack">
                  <div>
                    <Icon name="file" size={17} />
                    <span>Tổng hợp React Hooks thực chiến.pdf</span>
                    <b>Miễn phí</b>
                  </div>
                  <div>
                    <Icon name="file" size={17} />
                    <span>Bộ đề luyện nói IELTS Band 7+.pdf</span>
                    <b>25 CR</b>
                  </div>
                </div>
                <ul className="way-checks">
                  <li>
                    <Icon name="check" size={15} /> Tệp qua kiểm tra an toàn &
                    cấp quyền tải riêng tư
                  </li>
                </ul>
              </article>
            </div>
          </div>
        </section>

        <section id="skills" className="lp-section skills-section">
          <div className="container">
            <div className="section-heading split-heading">
              <div>
                <p className="kicker">Danh mục kỹ năng chuẩn hóa</p>
                <h2>
                  Bắt đầu từ kỹ năng bạn muốn học
                  <br />
                  hoặc kỹ năng bạn sẵn sàng chia sẻ.
                </h2>
              </div>
              <p>
                Tìm kiếm theo kỹ năng & tag chuẩn để gặp đúng người chia sẻ (có
                thể lọc kỹ năng đã được nhân sự xác minh).
              </p>
            </div>
            <div className="skill-grid">
              {skills.map((skill) => (
                <Link href="/register" className="skill-card" key={skill.title}>
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
              <Link href="/register">
                Tham gia để khám phá toàn bộ danh mục kỹ năng{" "}
                <Icon name="arrow" size={16} />
              </Link>
            </div>
          </div>
        </section>

        <section id="how" className="lp-section process-section">
          <div className="container">
            <div className="section-heading centered light">
              <p className="kicker">Quy trình khép kín chuẩn nghiệp vụ</p>
              <h2>Từ lời chào đầu tiên đến kỹ năng mới.</h2>
              <p>
                Chấp nhận đề nghị chỉ mở Chat thương lượng — Credit chỉ được tạm
                giữ sau khi cả hai xác nhận cùng phiên bản kế hoạch và lịch học.
              </p>
            </div>
            <div className="steps">
              {steps.map(([title, copy, note], index) => (
                <article className="step" key={title}>
                  <div className="step-number">
                    {String(index + 1).padStart(2, "0")}
                  </div>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                  {note && <small>{note}</small>}
                </article>
              ))}
            </div>
          </div>
        </section>

        <section className="lp-section product-section">
          <div className="container product-grid">
            <div className="product-copy">
              <p className="kicker">Không gian học tập thống nhất</p>
              <h2>Mọi thỏa thuận, lịch học và buổi LiveKit ở cùng một nơi.</h2>
              <p>
                Theo dõi đồng thời cả chiều bạn học và chiều bạn hướng dẫn. Hệ
                thống tự nhắc xác nhận phiên bản, hạn đổi lịch 60 phút và điều
                kiện quyết toán.
              </p>
              <div className="feature-list">
                {[
                  [
                    "chat",
                    "Chat & thương lượng",
                    "Trao đổi mục tiêu, gửi tệp tới 15 MB trước và trong khi học.",
                  ],
                  [
                    "book",
                    "Lộ trình theo phiên bản",
                    "Chỉ người dạy sửa kế hoạch của mình; sửa đổi sẽ tăng version để người học xác nhận lại.",
                  ],
                  [
                    "calendar",
                    "Lịch học & đổi lịch 60 phút",
                    "Kiểm tra trùng lịch tự động; đổi lịch cần cả hai xác nhận trước giờ học 60 phút.",
                  ],
                  [
                    "video",
                    "Phòng học LiveKit 1:1",
                    "Cấp token riêng theo từng buổi cho đúng 2 thành viên tham gia.",
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
              <div className="dashboard-label">Mô phỏng không gian học</div>
              <div className="dashboard">
                <aside aria-hidden="true">
                  <div className="mock-brand">
                    <span>S</span> SkillHub
                  </div>
                  <span className="active">
                    <Icon name="book" size={16} /> Lộ trình
                  </span>
                  <span>
                    <Icon name="calendar" size={16} /> Lịch học
                  </span>
                  <span>
                    <Icon name="chat" size={16} /> Tin nhắn
                  </span>
                  <span>
                    <Icon name="wallet" size={16} /> Ví Credit
                  </span>
                </aside>
                <div className="dash-main">
                  <div className="dash-top">
                    <div>
                      <small>Thỏa thuận trao đổi 2 chiều</small>
                      <strong>Minh ↔ Anh Nguyễn</strong>
                    </div>
                    <span className="mock-badge">Đang học · 2/4 buổi</span>
                  </div>
                  <div className="course-card">
                    <div className="course-head">
                      <span className="course-icon">
                        <Icon name="code" size={18} />
                      </span>
                      <div>
                        <small>Chiều bạn học · Phiên bản 1</small>
                        <strong>React căn bản & Hooks</strong>
                      </div>
                      <b>50%</b>
                    </div>
                    <div className="lp-progress">
                      <span />
                    </div>
                    <div className="lesson done">
                      <i>
                        <Icon name="check" size={12} />
                      </i>
                      <span>
                        <b>Buổi 1 · Tư duy Component & JSX</b>
                        <small>Cả hai đã xác nhận hoàn thành</small>
                      </span>
                    </div>
                    <div className="lesson done">
                      <i>
                        <Icon name="check" size={12} />
                      </i>
                      <span>
                        <b>Buổi 2 · Props & Quản lý State</b>
                        <small>Cả hai đã xác nhận hoàn thành</small>
                      </span>
                    </div>
                    <div className="lesson next">
                      <i>3</i>
                      <span>
                        <b>Buổi 3 · Custom Hooks & API</b>
                        <small>Thứ 7 · 09:00 – 10:30 (90 phút)</small>
                      </span>
                      <Link href="/login">Vào phòng 1:1</Link>
                    </div>
                  </div>
                  <div className="mentor-row">
                    <span className="lp-avatar">A</span>
                    <span>
                      <small>
                        Credit đang tạm giữ · Quyết toán cuối lộ trình
                      </small>
                      <b>40 CR đã giữ · Hoàn 38,4 CR khi hoàn tất</b>
                    </span>
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
                <p className="kicker">Cơ chế Credit & Quyết toán</p>
                <h2>
                  Tạm giữ khi chốt lịch.
                  <br />
                  Quyết toán một lần khi hoàn tất.
                </h2>
                <p>
                  Mọi biến động Credit đều được ghi sổ cái bất biến. Hoàn thành
                  từng buổi chỉ cập nhật tiến độ — Credit chỉ giải quyết khi
                  toàn bộ lộ trình hoàn tất và không có tranh chấp đang giữ lại.
                </p>
              </div>
              <div className="wallet-card">
                <span className="wallet-card-icon">
                  <Icon name="wallet" size={22} />
                </span>
                <small>Tỷ lệ nạp chuẩn</small>
                <strong>1 Credit</strong>
                <b>= 1.000 VNĐ</b>
                <p>Không hỗ trợ rút ra tiền mặt</p>
              </div>
            </div>
            <div className="credit-grid">
              <article>
                <div className="credit-card-head">
                  <span>
                    <Icon name="users" size={20} />
                  </span>
                  <div>
                    <small>Hình thức 01 · Tối thiểu 20 CR/người</small>
                    <h3>Trao đổi hai chiều (TWO_WAY)</h3>
                  </div>
                </div>
                <p>
                  Cả hai người dùng cùng tạm giữ khoản Credit cam kết cho toàn
                  bộ thỏa thuận. Khi toàn bộ buổi của cả hai chiều hoàn tất hợp
                  lệ, mỗi bên nhận lại <strong>96%</strong> khoản đã giữ của
                  chính mình.
                </p>
                <div className="credit-example">
                  <div>
                    <span>Mỗi người giữ</span>
                    <b>100 Credit</b>
                  </div>
                  <Icon name="arrow" size={18} />
                  <div>
                    <span>Mỗi người nhận lại</span>
                    <b>96 Credit</b>
                  </div>
                </div>
                <small className="fee">
                  4% là phí duy trì nền tảng · Ghi nhận PATH_RETURN &
                  PLATFORM_FEE
                </small>
              </article>

              <article>
                <div className="credit-card-head">
                  <span>
                    <Icon name="book" size={20} />
                  </span>
                  <div>
                    <small>Hình thức 02 · Thương lượng &gt; 0 CR</small>
                    <h3>Dạy & học một chiều (ONE_WAY)</h3>
                  </div>
                </div>
                <p>
                  Chỉ người học tạm giữ tổng mức Credit đã thương lượng; người
                  dạy không phải đặt cọc. Sau khi toàn bộ buổi học hoàn tất hợp
                  lệ, người dạy nhận <strong>96%</strong> và nền tảng nhận{" "}
                  <strong>4%</strong>.
                </p>
                <div className="credit-example">
                  <div>
                    <span>Người học tạm giữ</span>
                    <b>100 Credit</b>
                  </div>
                  <Icon name="arrow" size={18} />
                  <div>
                    <span>Người dạy nhận</span>
                    <b>96 Credit</b>
                  </div>
                </div>
                <small className="fee">
                  4% là phí nền tảng · Ghi nhận TEACHING_EARNING & PLATFORM_FEE
                </small>
              </article>
            </div>
            <p className="credit-note">
              Credit chỉ dùng cho hoạt động trên SkillHub (trao đổi 2 chiều, học
              1 chiều, mua tài liệu số) và không hỗ trợ rút tiền mặt. Mua tài
              liệu trả phí sử dụng trực tiếp Credit khả dụng với chính sách phí
              riêng.
            </p>
          </div>
        </section>

        <section id="trust" className="lp-section trust-section">
          <div className="container">
            <div className="section-heading split-heading">
              <div>
                <p className="kicker">Uy tín & Bảo vệ quyền lợi</p>
                <h2>
                  Xây dựng niềm tin bằng
                  <br />
                  quy tắc rõ ràng và minh bạch.
                </h2>
              </div>
              <p>
                Từ điểm uy tín khởi điểm 50/100 đến cơ chế báo cáo theo từng
                buổi học và nhiệm vụ phục hồi uy tín — mọi thành viên đều biết
                rõ quyền lợi và trách nhiệm của mình.
              </p>
            </div>
            <div className="trust-grid">
              {[
                [
                  "shield",
                  "Kỹ năng xác minh bởi nhân sự",
                  "Nộp chứng chỉ/bằng cấp để nhân sự duyệt nhãn Đã xác minh (không tự hết hạn). Tệp bằng chứng luôn lưu riêng tư.",
                ],
                [
                  "spark",
                  "Thang điểm Uy tín 0–100",
                  "Khởi điểm 50 điểm. Tăng qua hoàn thành lộ trình và đánh giá tốt; hỗ trợ Nhiệm vụ phục hồi nếu điểm dưới 40.",
                ],
                [
                  "check",
                  "Xác nhận song phương từng bước",
                  "Kế hoạch học, lịch học, đổi lịch trước 60 phút và xác nhận hoàn thành buổi đều yêu cầu đủ hai bên.",
                ],
                [
                  "chat",
                  "Báo cáo & xử lý tranh chấp",
                  "Có thể báo cáo gắn chính xác buổi học hoặc tài liệu. Khi có tranh chấp ảnh hưởng Credit, hệ thống tạm giữ quyết toán để xử lý.",
                ],
              ].map(([icon, title, copy]) => (
                <article key={title}>
                  <span>
                    <Icon name={icon as IconName} size={20} />
                  </span>
                  <h3>{title}</h3>
                  <p>{copy}</p>
                </article>
              ))}
            </div>
            <div className="privacy-note">
              <Icon name="shield" size={20} />
              <p>
                <strong>Quyền riêng tư được bảo vệ mặc định.</strong> Hồ sơ công
                khai chỉ hiển thị tên, ảnh đại diện, giới thiệu, điểm uy tín,
                danh hiệu và kỹ năng chia sẻ. Email, thông tin thanh toán và tệp
                chứng chỉ không bao giờ hiển thị công khai.
              </p>
            </div>
          </div>
        </section>

        <section id="faq" className="lp-section faq-section">
          <div className="container faq-grid">
            <div className="faq-title">
              <p className="kicker">Câu hỏi thường gặp</p>
              <h2>Những điều cần biết trước khi bắt đầu.</h2>
              <p>
                Giải đáp ngắn gọn về trao đổi 2 chiều, học 1 chiều, Credit, lịch
                học và điểm uy tín trên SkillHub.
              </p>
              <div className="faq-help">
                <Icon name="book" size={20} />
                <span>
                  <small>Sẵn sàng trải nghiệm?</small>
                  <Link href="/register">Tạo tài khoản và khám phá ngay →</Link>
                </span>
              </div>
            </div>
            <div className="accordion">
              {faqs.map(([question, answer], index) => (
                <details key={question} open={index === 0}>
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

        <section className="final-cta">
          <div className="container cta-card">
            <p className="kicker">Bắt đầu hành trình học 1:1</p>
            <h2>
              Kỹ năng bạn có hôm nay là chìa khóa
              <br />
              cho kỹ năng bạn muốn học ngày mai.
            </h2>
            <p>
              Đăng ký miễn phí, khai báo kỹ năng của bạn và kết nối người đồng
              hành phù hợp ngay hôm nay.
            </p>
            <div className="cta-actions">
              <Link className="button" href="/register">
                Tạo tài khoản miễn phí <Icon name="arrow" size={18} />
              </Link>
              <Link className="button button-secondary" href="/login">
                Đã có tài khoản? Đăng nhập
              </Link>
            </div>
          </div>
        </section>
      </main>

      <footer>
        <div className="container footer-grid">
          <div className="footer-brand">
            <Logo />
            <p>
              Nền tảng trao đổi kỹ năng, học trực tuyến 1:1 và chia sẻ tài liệu
              số minh bạch.
            </p>
          </div>
          <div>
            <h3>Khám phá</h3>
            <a href="#ways">Hình thức học</a>
            <a href="#skills">Danh mục kỹ năng</a>
            <a href="#how">Quy trình 5 bước</a>
            <a href="#credit">Cơ chế Credit</a>
          </div>
          <div>
            <h3>Tin cậy & Pháp lý</h3>
            <a href="#trust">Uy tín & xác minh</a>
            <a href="#faq">Câu hỏi thường gặp</a>
            <Link href="/terms">Điều khoản sử dụng</Link>
            <Link href="/privacy">Chính sách bảo mật</Link>
          </div>
          <div className="footer-callout">
            <span>
              <Icon name="users" size={20} />
            </span>
            <h3>Học tốt hơn khi có nhau.</h3>
            <p>
              Tham gia cộng đồng chia sẻ kỹ năng 1:1 minh bạch của SkillHub.
            </p>
            <Link href="/register">
              Bắt đầu miễn phí <Icon name="arrow" size={16} />
            </Link>
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
