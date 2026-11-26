import { PostFeed } from "@/features/learner/posts/post-feed";
import Link from "next/link";
import { SharersScreen } from "@/features/learner/discovery/sharers-screen";
import { ProductIcon } from "@/features/learner/components/product-icon";

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
      <nav className="learner-subnav" aria-label="Khám phá cộng đồng">
        <Link
          href="/learn/explore"
          aria-current={!sharers ? "page" : undefined}
        >
          <ProductIcon name="book" size={16} />
          Nhu cầu học
        </Link>
        <Link
          href="/learn/explore?view=sharers"
          aria-current={sharers ? "page" : undefined}
        >
          <ProductIcon name="users" size={16} />
          Người chia sẻ kỹ năng
        </Link>
      </nav>
      {sharers ? (
        <SharersScreen key={selectedSkill} initialSkillId={selectedSkill} />
      ) : (
        <PostFeed
          key={keyword + ":" + mine + ":" + selectedSkill}
          initialKeyword={keyword}
          initialMine={mine === "true"}
          initialSkillId={selectedSkill}
        />
      )}
    </>
  );
}
