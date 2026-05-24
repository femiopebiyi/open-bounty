"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { toast } from "sonner";
import { useAuthStore } from "@/store/auth";

export default function AuthCallbackPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setAuth } = useAuthStore();

  useEffect(() => {
    const token = searchParams.get("token");
    const github_username = searchParams.get("github_username");
    const email = searchParams.get("email");
    const error = searchParams.get("error");

    if (error) {
      toast.error("GitHub login failed");
      router.replace("/");
      return;
    }

    if (token && github_username) {
      setAuth(token, github_username, email);
      toast.success(`Welcome back, ${github_username}`);
      router.replace("/");
    } else {
      router.replace("/");
    }
  }, [searchParams, setAuth, router]);

  return (
    <div className="min-h-[60vh] flex items-center justify-center">
      <div className="flex flex-col items-center gap-3">
        <div className="w-6 h-6 border-2 border-ink-950 border-t-transparent rounded-full animate-spin" />
        <p className="text-[13px] text-ink-500">Signing you in…</p>
      </div>
    </div>
  );
}
