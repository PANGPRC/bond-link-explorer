import axios, { type AxiosInstance, type AxiosRequestConfig } from "axios";

// Rate limiting: max 20 calls per minute
const RATE_LIMIT = 20;
const RATE_WINDOW = 60_000;
let callTimestamps: number[] = [];

export function getRateLimitInfo() {
  const now = Date.now();
  callTimestamps = callTimestamps.filter((t) => now - t < RATE_WINDOW);
  return {
    remaining: Math.max(0, RATE_LIMIT - callTimestamps.length),
    total: RATE_LIMIT,
    used: callTimestamps.length,
    resetIn: callTimestamps.length > 0 ? Math.ceil((callTimestamps[0] + RATE_WINDOW - now) / 1000) : 0,
  };
}

function checkRateLimit(): boolean {
  const now = Date.now();
  callTimestamps = callTimestamps.filter((t) => now - t < RATE_WINDOW);
  if (callTimestamps.length >= RATE_LIMIT) return false;
  callTimestamps.push(now);
  return true;
}

// API base URL - configurable
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";
const API_KEY = import.meta.env.VITE_API_KEY || "";

const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 30_000,
  headers: { "Content-Type": "application/json" },
});

// Request interceptor: attach API key
apiClient.interceptors.request.use((config) => {
  if (API_KEY) {
    config.headers["X-API-Key"] = API_KEY;
  }
  return config;
});

// Response interceptor: unified error handling
apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const msg = error.response?.data?.msg || error.message;
    if (status === 401) throw new Error("Authentication failed. Check your API Key.");
    if (status === 400) throw new Error(`Parameter error: ${msg}`);
    if (status === 500) throw new Error(`Server error: ${msg}`);
    throw new Error(msg || "Network error");
  }
);

// Unified bond API call
export interface BondRequest {
  link_type: "L01" | "L02" | "L03" | "L04";
  op_type: "query" | "insert" | "update" | "delete";
  data: Record<string, unknown>;
}

export interface BondMeta {
  page: number;
  page_size: number;
  total: number;
  sql?: string;
  cost?: number;
}

export interface BondResponse {
  code: number;
  msg: string;
  data: Record<string, unknown>[];
  meta: BondMeta;
}

export async function bondUnified(req: BondRequest): Promise<BondResponse> {
  if (!checkRateLimit()) {
    const info = getRateLimitInfo();
    throw new Error(`Rate limit exceeded (${RATE_LIMIT}/min). Try again in ${info.resetIn}s.`);
  }
  const res = await apiClient.post<BondResponse>("/api/bond/unified", req);
  return res.data;
}

export interface HealthStatus {
  database: string;
  llm_engine: string;
  core_service: string;
  [key: string]: string;
}

export async function healthCheck(): Promise<HealthStatus> {
  if (!checkRateLimit()) {
    throw new Error("Rate limit exceeded.");
  }
  const res = await apiClient.get("/api/health");
  return res.data;
}

export default apiClient;
