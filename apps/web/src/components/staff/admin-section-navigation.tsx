"use client";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Suspense } from "react";
import { LoadingSkeleton } from "@/components/loading-skeleton";
import { findAdminTab, type AdminSection } from "@/lib/staff/admin-navigation";
import styles from "./admin-section-navigation.module.css";

function SectionLinks({ section }: Readonly<{ section: AdminSection }>) {
  const pathname = usePathname();
  const search = useSearchParams();
  const selected = findAdminTab(section, pathname, search);
  return (
    <nav className={styles.tabs} aria-label={section.label}>
      {section.tabs?.map((tab) => (
        <Link
          key={tab.id}
          className={styles.tab}
          href={tab.href}
          aria-current={tab.id === selected?.id ? "page" : undefined}
        >
          {tab.label}
        </Link>
      ))}
    </nav>
  );
}

export function AdminSectionNavigation({
  section,
}: Readonly<{ section?: AdminSection }>) {
  if (!section?.tabs?.length) return null;
  return (
    <Suspense
      fallback={
        <LoadingSkeleton variant="inline" label="Đang tải điều hướng" />
      }
    >
      <SectionLinks section={section} />
    </Suspense>
  );
}
