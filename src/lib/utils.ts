import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// 原有样式合并函数（保留）
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

// 新增：时间戳转换为格式化日期（适配后端秒级时间戳）
export function formatTimestamp(timestamp: number): string {
  if (!timestamp) return "未知时间";
  const date = new Date(timestamp * 1000); // 后端返回的是秒级，需转为毫秒
  return date.toLocaleString("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

// 新增：链路状态转换为Tailwind样式类名（适配HealthCheck页面）
export function getStatusClass(status: string): string {
  switch (status) {
    case "healthy":
      return "bg-green-100 text-green-800 border-green-200";
    case "degraded":
      return "bg-yellow-100 text-yellow-800 border-yellow-200";
    case "unhealthy":
      return "bg-red-100 text-red-800 border-red-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

// 新增：防抖函数（后续BondQuery/CRUD页查询功能会用到）
export function debounce<T extends (...args: any[]) => any>(
  func: T,
  wait: number
): (...args: Parameters<T>) => void {
  let timeout: NodeJS.Timeout;
  return (...args: Parameters<T>) => {
    clearTimeout(timeout);
    timeout = setTimeout(() => func(...args), wait);
  };
}

// ===================== 新增：全链路适配核心工具函数 =====================
/**
 * 生成符合后端规范的request_id
 * 格式：req_时间戳（13位）+ 随机数（4位）
 * 适配：所有链路的request_id必填要求
 */
export const generateRequestId = () => {
  const timestamp = Date.now().toString().slice(0, 13);
  const random = Math.floor(Math.random() * 10000).toString().padStart(4, "0");
  return `req_${timestamp}${random}`;
};

/**
 * 格式化L01查询条件（适配后端数组格式）
 * @param params 前端收集的查询参数键值对
 * @param operators 自定义操作符映射（可选，默认eq）
 * @returns 符合L01规范的conditions数组
 */
export const formatL01Conditions = (
  params: Record<string, string>,
  operators: Record<string, string> = {}
) => {
  const conditions = [];
  for (const [field, value] of Object.entries(params)) {
    if (value.trim()) {
      conditions.push({
        field,
        operator: operators[field] || "eq", // 支持自定义操作符
        value: value.trim()
      });
    }
  }
  return conditions;
};

/**
 * 格式化L03直查参数（适配多表关联规范）
 * @param mainTable 主表名（默认bond_basic）
 * @param outputFields 输出字段数组
 * @param filters 筛选条件键值对
 * @param joinTables 关联表数组
 * @returns 符合L03规范的direct_query_params
 */
export const formatL03DirectQuery = (
  mainTable: string = "bond_basic",
  outputFields: string[] = [],
  filters: Record<string, string> = {},
  joinTables: string[] = []
) => {
  // 过滤空值
  const validFilters = Object.entries(filters).reduce((acc, [key, value]) => {
    if (value.trim()) acc[key] = value.trim();
    return acc;
  }, {} as Record<string, string>);

  return {
    main_table: mainTable,
    join_tables: joinTables.filter(t => t.trim()), // 过滤空表名
    output_fields: outputFields.length
      ? outputFields.filter(f => f.trim())
      : ["bond_basic.bond_code", "bond_basic.bond_name"], // 默认字段
    filters: validFilters
  };
};

/**
 * 验证JSON格式（适配CRUD批量操作）
 * @param jsonStr JSON字符串
 * @returns 解析后的对象/数组 | 抛出错误
 */
export const validateAndParseJson = (jsonStr: string) => {
  if (!jsonStr.trim()) throw new Error("JSON字符串不能为空");

  try {
    const parsed = JSON.parse(jsonStr);
    // 仅允许对象或数组（适配批量新增）
    if (typeof parsed !== "object" || parsed === null) {
      throw new Error("JSON必须是对象或数组格式");
    }
    return parsed;
  } catch (e: any) {
    throw new Error(`JSON解析失败：${e.message}`);
  }
};

/**
 * 格式化CRUD过滤器（适配L03 update/delete）
 * @param bondCode 债券代码
 * @param table 表名（默认bond_basic）
 * @returns 符合后端规范的filters对象
 */
export const formatCrudFilters = (bondCode: string, table: string = "bond_basic") => {
  if (!bondCode.trim()) throw new Error("债券代码不能为空");
  return {
    [`${table}.bond_code`]: bondCode.trim()
  };
};

/**
 * 限流信息格式化（适配前端展示）
 * @param rateLimit 原始限流信息
 * @returns 格式化后的限流对象
 */
export const formatRateLimitInfo = (rateLimit: {
  used: number;
  total: number;
  remaining: number;
  resetIn: number;
}) => {
  return {
    used: Math.max(0, rateLimit.used),
    total: Math.max(0, rateLimit.total),
    remaining: Math.max(0, rateLimit.remaining),
    resetIn: Math.max(0, rateLimit.resetIn),
    percentUsed: rateLimit.total > 0
      ? Math.round((rateLimit.used / rateLimit.total) * 100)
      : 0
  };
};