import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { AuthState } from "@/types";

interface AuthStore extends AuthState {
  setAuth: (token: string, github_username: string, email: string | null) => void;
  clearAuth: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      token: null,
      github_username: null,
      email: null,
      isAuthenticated: false,
      setAuth: (token, github_username, email) =>
        set({ token, github_username, email, isAuthenticated: true }),
      clearAuth: () =>
        set({ token: null, github_username: null, email: null, isAuthenticated: false }),
    }),
    { name: "openbounty-auth" }
  )
);
