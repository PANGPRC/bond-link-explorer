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
const BASE_URL = import.meta.env.VITE_API_BASE_URL || "http://47.129.38.149:8000";
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

// ============================
// 新增：统一健康接口类型定义（匹配后端返回格式）
// ============================
export interface L01Status {
  status: "healthy" | "degraded" | "unhealthy";
  message: string;
  timestamp: number;
}

export interface L02Status {
  status: "healthy" | "degraded" | "unhealthy";
  message: string;
  timestamp: number;
}

export interface L03Status {
  status: "healthy" | "degraded" | "unhealthy";
  message: string;
  sql: {
    insert: string;
    update: string;
    delete: string;
  };
  timestamp: number;
}

export interface L04Status {
  status: "healthy" | "degraded" | "unhealthy";
  message: string;
  test_sql: string;
  test_params: {
    main_table: string;
    join_tables: string[];
    output_fields: string[];
    filters: Record<string, unknown>;
  };
  data_count: number;
  timestamp: number;
}

export interface UnifiedHealthResponse {
  status: "healthy" | "degraded" | "unhealthy";
  message: string;
  link_status: {
    L01: L01Status;
    L02: L02Status;
    L03: L03Status;
    L04: L04Status;
  };
  timestamp: number;
  link_type: "UNIFIED";
}

// ============================
// 核心修改：债券接口类型完全匹配前端组件 + 后端API
// ============================
// 基础请求类型
interface BondBaseRequest {
  link_type: "L01" | "L02" | "L03" | "L04";
  op_type: "query" | "insert" | "update" | "delete";
  request_id: string; // 新增：必填的请求ID
  page?: number;      // 新增：分页参数
  page_size?: number; // 新增：分页参数
}

// 自然语言查询请求（L02/L04）
export interface BondNaturalRequest extends BondBaseRequest {
  prompt: string; // 自然语言查询语句
}

// L01 结构化查询请求
export interface BondL01Request extends BondBaseRequest {
  conditions: Record<string, string>; // 筛选条件（对象类型）
  fields: string[]; // 输出字段
}

// L03 多表关联查询请求
export interface BondL03Request extends BondBaseRequest {
  direct_query_params: Record<string, any>; // L03专用参数
}

// 联合类型：覆盖所有请求类型
export type BondRequest = BondNaturalRequest | BondL01Request | BondL03Request;

// 扩展 BondMeta 接口，匹配后端实际返回
export interface BondMeta {
  // 分页相关
  page?: number;
  page_size?: number;
  total?: number;

  // 性能相关（匹配后端返回）
  sql?: string;
  cost?: number;
  耗时?: string;
  timing?: { // 新增：后端返回的timing字段
    total: number;
    llm_sql: number;
    sql_exec: number;
    format_json: number;
  };

  // 请求标识
  request_id?: string | null;
  requestId?: string;
  timestamp?: number; // 新增：后端返回的时间戳
}

// 修改 BondResponse：meta 改为可选，匹配后端实际返回
export interface BondResponse {
  code: number;
  msg: string;
  data: Record<string, unknown>[];
  meta?: BondMeta; // 改为可选（后端可能不返回）
  request_id?: string | null; // 新增：后端返回的request_id
  link_type?: "L01" | "L02" | "L03" | "L04"; // 新增：返回的链路类型
}

// ============================
// 接口请求函数（无需修改，类型已自动匹配）
// ============================
// 债券统一操作接口
export async function bondUnified(req: BondRequest): Promise<BondResponse> {
  if (!checkRateLimit()) {
    const info = getRateLimitInfo();
    throw new Error(`Rate limit exceeded (${RATE_LIMIT}/min). Try again in ${info.resetIn}s.`);
  }
  const res = await apiClient.post<BondResponse>("/api/bond/unified", req);
  return res.data;
}

// 原有：旧健康检查接口（保留，如需兼容可继续用）
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

// 新增：统一健康检查接口（核心）
export async function unifiedHealthCheck(): Promise<UnifiedHealthResponse> {
  if (!checkRateLimit()) {
    const info = getRateLimitInfo();
    throw new Error(`Rate limit exceeded (${RATE_LIMIT}/min). Try again in ${info.resetIn}s.`);
  }
  const res = await apiClient.get<UnifiedHealthResponse>("/api/bond/unified-health");
  return res.data;
}

export default apiClient;