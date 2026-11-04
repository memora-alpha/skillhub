"use client";
import Link from "next/link";
import { useEffect } from "react";
import { useRouter } from "next/navigation";
export function SignInRedirect({ message }: Readonly<{ message?: string }>) {
  const router = useRouter();
  useEffect(() => {
    router.replace("/login");
  }, [router]);
  return (
    <main className="learner-loading">
      <p>
        {message ?? "Đang mở trang đăng nhập…"}{" "}
        <Link href="/login">Tiếp tục</Link>
      </p>
    </main>
  );
}
