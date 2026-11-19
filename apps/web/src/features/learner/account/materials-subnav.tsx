import Link from "next/link";

const items = [
  ["/learn/materials", "Khám phá tài liệu"],
  ["/learn/materials/library", "Thư viện của tôi"],
  ["/learn/materials/orders", "Đơn đã mua"],
  ["/learn/materials/mine", "Tài liệu tôi chia sẻ"],
] as const;

export function MaterialsSubnav({
  current,
}: Readonly<{ current: (typeof items)[number][0] }>) {
  return (
    <nav className="learner-subnav" aria-label="Điều hướng kho tài liệu">
      {items.map(([href, label]) => (
        <Link
          key={href}
          href={href}
          aria-current={current === href ? "page" : undefined}
        >
          {label}
        </Link>
      ))}
    </nav>
  );
}
