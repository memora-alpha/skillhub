"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { LoadingSkeleton } from "@/components/loading-skeleton";
export function SignInRedirect({ message }: Readonly<{ message?: string }>) {
  const router = useRouter();
  useEffect(() => {
    router.replace("/login");
  }, [router]);
  return (
    <main className="learner-loading">
      <LoadingSkeleton variant="page" label="Đang mở trang đăng nhập" />
      <p>
        {message} <Link href="/login">Tiếp tục</Link>
      </p>
    </main>
  );
}
