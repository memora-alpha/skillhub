import { PostFeed } from "@/features/learner/posts/post-feed";
import Link from "next/link";
import { SharersScreen } from "@/features/learner/discovery/sharers-screen";
import styles from "@/features/learner/discovery/discovery.module.css";
export default async function Page({
  searchParams,
}: Readonly<{
  searchParams: Promise<{
    q?: string | string[];
    mine?: string;
    view?: string | string[];
    skillId?: string | string[];
  }>;
}>) {
  const { q, view, mine, skillId: skillParam } = await searchParams;
  const skillId = Array.isArray(skillParam) ? skillParam[0] : skillParam;
  const keyword = (Array.isArray(q) ? q[0] : q)?.trim().slice(0, 120) ?? "";
  const sharers = (Array.isArray(view) ? view[0] : view) === "sharers";
  const selectedSkill =
    skillId &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      skillId,
    )
      ? skillId
      : "";
  return (
    <>
      <nav className={styles.tabs} aria-label="Khám phá cộng đồng">
        <Link
          className="btn"
          href="/learn/explore"
          aria-current={!sharers ? "page" : undefined}
        >
          Nhu cầu học
        </Link>
        <Link
          className="btn"
          href="/learn/explore?view=sharers"
          aria-current={sharers ? "page" : undefined}
        >
          Người chia sẻ
        </Link>
      </nav>
      {sharers ? (
        <SharersScreen key={selectedSkill} initialSkillId={selectedSkill} />
      ) : (
        <PostFeed
          key={keyword + ":" + mine}
          initialKeyword={keyword}
          initialMine={mine === "true"}
        />
      )}
    </>
  );
}
