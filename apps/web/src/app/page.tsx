import Link from "next/link";

export default function HomePage() {
  return (
    <main className="landing">
      <title>SkillHub</title>
      <p className="eyebrow">SKILLHUB</p>
      <h1>
        Chia sẻ điều bạn biết.
        <br />
        Học điều bạn muốn.
      </h1>
      <p>Kết nối những người cùng mong muốn phát triển kỹ năng.</p>
      <div className="portal-links">
        <Link className="btn btn-primary" href="/admin">
          Cổng Admin
        </Link>
        <Link className="btn" href="/staff">
          Cổng Staff
        </Link>
      </div>
    </main>
  );
}
