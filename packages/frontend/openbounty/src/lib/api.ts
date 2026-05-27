import axios from "axios";

const API_URL = process.env.NEXT_PUBLIC_API_URL || "http://localhost:3000";

export const api = axios.create({
  baseURL: API_URL,
  headers: { "Content-Type": "application/json" },
});

api.interceptors.request.use((config) => {
  if (typeof window !== "undefined") {
    const stored = localStorage.getItem("openbounty-auth");
    if (stored) {
      try {
        const { state } = JSON.parse(stored);
        if (state?.token) {
          config.headers.Authorization = `Bearer ${state.token}`;
        }
      } catch { }
    }
  }
  return config;
});

// Bounties
export const fetchBounties = async (params?: { limit?: number; offset?: number }) => {
  const { data } = await api.get("/bounties", { params });
  return data;
};

export const fetchBountiesByPoster = async (username: string, status?: string) => {
  const { data } = await api.get(`/bounties/poster/${username}`, { params: { status } });
  return data;
};
export const fetchBounty = async (bounty_id: number) => {
  const { data } = await api.get(`/bounties/${bounty_id}`);
  return data;
};

export const createBounty = async (payload: any) => {
  const { data } = await api.post("/bounties", payload);
  return data;
};

export const registerForBounty = async (payload: {
  bounty_id: number;
  payout_wallet: string;
  alert_mail?: string;
}) => {
  const { data } = await api.post("/bounties/register", payload);
  return data;
};

export const claimBounty = async (bounty_id: number) => {
  const { data } = await api.post("/bounties/claim", { bounty_id });
  return data;
};

export const fetchHuntersForBounty = async (bounty_id: number) => {
  const { data } = await api.get(`/bounties/${bounty_id}/hunters`);
  return data;
};

// Auth
export const getNonce = async (wallet: string) => {
  const { data } = await api.get("/auth/nonce", { params: { wallet } });
  return data as { nonce: string; message: string };
};

// Leaderboard
export const fetchLeaderboard = async (params?: { limit?: number; offset?: number }) => {
  const { data } = await api.get("/leaderboard", { params });
  return data;
};

// Faucet
export const requestFaucet = async (wallet: string) => {
  const { data } = await api.post("/faucet", { wallet });
  return data;
};

// GitHub helpers
export const fetchUserRepos = async (_token: string) => {
  const { data } = await api.get("/github/repos");
  return data;
};

export const fetchRepoIssues = async (_token: string, full_name: string) => {
  const [owner, repo] = full_name.split("/");
  const { data } = await api.get(`/github/repos/${owner}/${repo}/issues`);
  return data;
};
