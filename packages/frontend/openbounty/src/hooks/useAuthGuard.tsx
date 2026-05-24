"use client";

import { useState, type ReactNode } from "react";
import { useAuthStore } from "@/store/auth";
import { LoginModal } from "@/components/auth/LoginModal";

export function useAuthGuard() {
  const { isAuthenticated } = useAuthStore();
  const [showLogin, setShowLogin] = useState(false);

  const requireAuth = (callback: () => void) => {
    if (!isAuthenticated) {
      setShowLogin(true);
      return;
    }
    callback();
  };

  const AuthModal = () => (
    <LoginModal open={showLogin} onClose={() => setShowLogin(false)} />
  );

  return { isAuthenticated, requireAuth, AuthModal, showLogin, setShowLogin };
}
