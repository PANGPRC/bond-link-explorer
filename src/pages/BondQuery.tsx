import { useState, useCallback, useEffect } from "react";
import { bondUnified, type BondMeta, getRateLimitInfo } from "@/lib/api";
import { debounce, generateRequestId, formatL01Conditions, formatL03DirectQuery } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Loader2, ChevronDown, ChevronUp, RotateCcw, AlertTriangle, Info } from "lucide-react";
import DynamicParams, { type ParamRow, BOND_FIELDS } from "@/components/DynamicParams";
import ConditionBuilder, { serializeConditions } from "@/components/query/ConditionBuilder";
import { type ConditionOutput, QUERY_FIELDS } from "@/components/query/types";
import { useToast } from "@/hooks/use-toast";

// ========== 核心：精确的类型定义 ==========
// 精确的链路类型
type LinkType = "L01" | "L02" | "L03" | "L04";

// 基础请求类型
interface BondBaseRequest {
  link_type: LinkType;
  op_type: "query";
  request_id: string;
  page?: number;
  page_size?: number;
}

// 自然语言查询请求类型（L02/L04）
interface BondNaturalRequest extends BondBaseRequest {
  prompt: string;
}

// L01 结构化查询请求类型
interface BondL01Request extends BondBaseRequest {
  conditions: Record<string, string>; // 确保是对象类型，而非数组
  fields: string[];
}

// L03 多表关联查询请求类型
interface BondL03Request extends BondBaseRequest {
  direct_query_params: Record<string, any>;
}

// 联合类型
type BondRequest = BondNaturalRequest | BondL01Request | BondL03Request;

// ========== 扩展 BondMeta 接口 ==========
interface ExtendedBondMeta extends BondMeta {
  sql?: string;
  timing?: {
    total: number;
    llm_sql: number;
    sql_exec: number;
    format_json: number;
  };
  timestamp?: number;
}

// ========== 其他类型定义 ==========
type BondValue = string | number | boolean | null | undefined;
interface BondData {
  [key: string]: BondValue;
}

type QueryMode = "structured" | "natural";
type StructuredLink = "L01" | "L03";
type NaturalLink = "L02" | "L04";

const DISPLAY_COLUMNS = [
  { key: "bond_code", label: "Bond Code" },
  { key: "bond_name", label: "Bond Name" },
  { key: "issue_size", label: "Issue Size" },
  { key: "credit_rating", label: "Credit Rating" },
  { key: "maturity_date", label: "Maturity Date" },
  { key: "counterparty_name", label: "Counterparty" },
];

// 类型转换函数
const convertBondData = (data: Record<string, unknown>[]): BondData[] => {
  return data.map(item => {
    const convertedItem: BondData = {};

    Object.entries(item).forEach(([key, value]) => {
      if (value === null || value === undefined) {
        convertedItem[key] = value as BondValue;
      }
      else if (typeof value === "string") {
        convertedItem[key] = value;
      }
      else if (typeof value === "number") {
        convertedItem[key] = value;
      }
      else if (typeof value === "boolean") {
        convertedItem[key] = value;
      }
      else {
        convertedItem[key] = String(value);
      }
    });

    return convertedItem;
  });
};

// ========== 修复 formatL01Conditions 可能返回数组的问题 ==========
const safeFormatL01Conditions = (conditions: Record<string, string>): Record<string, string> => {
  // 确保返回值始终是对象，而非数组
  const formatted = formatL01Conditions(conditions);

  // 如果返回的是数组，转换为对象
  if (Array.isArray(formatted)) {
    const obj: Record<string, string> = {};
    formatted.forEach((item, index) => {
      if (typeof item === "object" && item !== null) {
        Object.assign(obj, item);
      } else {
        obj[`condition_${index}`] = String(item);
      }
    });
    return obj;
  }

  // 如果是 null/undefined，返回空对象
  if (!formatted || typeof formatted !== "object") {
    return {};
  }

  return formatted as Record<string, string>;
};

export default function BondQuery() {
  const [queryMode, setQueryMode] = useState<QueryMode>("structured");
  const [structuredLink, setStructuredLink] = useState<StructuredLink>("L03");
  const [naturalLink, setNaturalLink] = useState<NaturalLink>("L02");

  // 状态定义
  const [mainTable, setMainTable] = useState("bond_basic");
  const [joinTables, setJoinTables] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<BondData[]>([]);
  const [meta, setMeta] = useState<ExtendedBondMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showMeta, setShowMeta] = useState(false);

  const [params, setParams] = useState<ParamRow[]>([
    { field: "bond_code", value: "bond_code" },
    { field: "bond_name", value: "bond_name" }
  ]);
  const [conditions, setConditions] = useState<ConditionOutput>({});
  const [nlQuery, setNlQuery] = useState("查询bond_basic表中所有未删除的债券数据");

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [rateLimitInfo, setRateLimitInfo] = useState(getRateLimitInfo());

  const { toast } = useToast();
  // 修复：明确类型转换为 LinkType
  const activeLinkType = (queryMode === "structured" ? structuredLink : naturalLink) as LinkType;

  // 更新限流信息
  useEffect(() => {
    const interval = setInterval(() => {
      setRateLimitInfo(getRateLimitInfo());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  // ========== 核心修复：类型安全的参数构建 ==========
  const buildData = useCallback((): BondRequest => {
    // 生成符合后端要求的 request_id
    const requestId = `req_${Date.now()}`;

    // 基础参数（所有请求都包含）
    const baseRequest: BondBaseRequest = {
      link_type: activeLinkType, // 现在是精确的 LinkType 类型
      op_type: "query",
      request_id: requestId
    };

    // 1. 自然语言查询（L02/L04）- 类型安全
    if (queryMode === "natural") {
      const naturalRequest: BondNaturalRequest = {
        ...baseRequest,
        prompt: nlQuery.trim()
      };

      // 可选参数：只在有值时添加
      if (page > 1) naturalRequest.page = page;
      if (pageSize !== 20) naturalRequest.page_size = pageSize;

      return naturalRequest;
    }

    // 2. L01结构化查询 - 类型安全（修复 conditions 类型）
    if (structuredLink === "L01") {
      const condData = serializeConditions(conditions, QUERY_FIELDS);
      const stringCondData: Record<string, string> = {};

      // 确保条件值都是字符串
      Object.entries(condData).forEach(([key, value]) => {
        if (value !== undefined && value !== null) {
          stringCondData[key] = String(value);
        }
      });

      const outputFields = params.map(p => p.field);

      const l01Request: BondL01Request = {
        ...baseRequest,
        // 修复：使用安全格式化函数，确保返回 Record<string, string>
        conditions: safeFormatL01Conditions(stringCondData),
        fields: outputFields.length > 0 ? outputFields : ["bond_code", "bond_name"],
        page: page,
        page_size: pageSize
      };

      return l01Request;
    }

    // 3. L03多表关联查询 - 类型安全
    const condData = serializeConditions(conditions, QUERY_FIELDS);
    const stringCondData: Record<string, string> = {};

    Object.entries(condData).forEach(([key, value]) => {
      if (value !== undefined && value !== null) {
        stringCondData[key] = String(value);
      }
    });

    const outputFields = params.map(p => `${mainTable}.${p.field}`);

    const l03Request: BondL03Request = {
      ...baseRequest,
      direct_query_params: formatL03DirectQuery(
        mainTable,
        outputFields,
        stringCondData,
        joinTables
      ),
      page: page,
      page_size: pageSize
    };

    return l03Request;
  }, [
    queryMode,
    nlQuery,
    activeLinkType,
    page,
    pageSize,
    conditions,
    structuredLink,
    mainTable,
    joinTables,
    params
  ]);

  // ========== API 调用逻辑 ==========
  const debouncedExecuteQuery = useCallback(
    debounce(async (p = page) => {
      if (rateLimitInfo.remaining <= 0) {
        toast({
          title: "请求限流",
          description: `已达到每分钟20次请求限制，请${rateLimitInfo.resetIn}秒后重试`,
          variant: "destructive",
          duration: 3000,
        });
        return;
      }

      if (queryMode === "natural" && !nlQuery.trim()) {
        toast({
          title: "输入不能为空",
          description: "请输入自然语言查询文本后再执行查询",
          variant: "destructive",
          duration: 3000,
        });
        return;
      }

      setLoading(true);
      setError(null);

      try {
        // 构建类型安全的请求参数
        const requestParams = buildData();

        console.log("=== 类型安全的请求参数 ===");
        console.log(JSON.stringify(requestParams, null, 2));

        // 现在 requestParams 是精确的 BondRequest 类型
        const res = await bondUnified(requestParams);

        console.log("=== 后端返回结果 ===");
        console.log(JSON.stringify(res, null, 2));

        if (res.code !== 200) {
          throw new Error(`[${res.code}] ${res.msg || "查询失败"}`);
        }

        // 处理返回数据
        setResults(res.data ? convertBondData(res.data) : []);
        setMeta(res.meta as ExtendedBondMeta);
        setPage(p);
        setRateLimitInfo(getRateLimitInfo());

        toast({
          title: "查询成功",
          description: `共返回 ${res.data?.length || 0} 条数据`,
          duration: 2000,
        });
      } catch (e: any) {
        console.error("查询错误详情:", {
          message: e.message,
          stack: e.stack,
          response: e.response || "无响应数据"
        });

        setError(e.message);
        setResults([]);
        setMeta(null);

        let errorMsg = e.message;
        if (errorMsg.includes("400")) {
          errorMsg = "400 Bad Request - 请求参数格式错误\n请检查：1. link_type/op_type 是否正确 2. prompt 是否为空";
        } else if (errorMsg.includes("401")) {
          errorMsg = "401 Unauthorized - 未授权，请检查接口权限";
        } else if (errorMsg.includes("403")) {
          errorMsg = "403 Forbidden - 禁止访问，该链路可能未开通";
        }

        toast({
          title: "查询失败",
          description: errorMsg,
          variant: "destructive",
          duration: 8000,
        });
      } finally {
        setLoading(false);
      }
    }, 500),
    [activeLinkType, buildData, page, pageSize, rateLimitInfo, toast, queryMode, nlQuery]
  );

  // 测试用：完全类型安全的 L02 查询
  const testCurlQuery = async () => {
    setLoading(true);
    try {
      // 精确类型的测试参数
      const testParams: BondNaturalRequest = {
        link_type: "L02", // 精确的 LinkType 类型
        op_type: "query",
        prompt: "查询bond_basic表中所有未删除的债券数据",
        request_id: `req_${Date.now()}`
      };

      console.log("=== 测试 CURL 参数 ===");
      console.log(JSON.stringify(testParams, null, 2));

      const res = await bondUnified(testParams);

      if (res.code === 200) {
        setResults(res.data ? convertBondData(res.data) : []);
        setMeta(res.meta as ExtendedBondMeta);
        toast({
          title: "测试查询成功",
          description: `返回 ${res.data?.length || 0} 条数据`,
        });
      } else {
        throw new Error(res.msg || "测试查询失败");
      }
    } catch (e: any) {
      console.error("测试查询失败:", e);
      toast({
        title: "测试查询失败",
        description: e.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const executeQuery = (p = page) => {
    debouncedExecuteQuery(p);
  };

  const resetForm = () => {
    setParams([
      { field: "bond_code", value: "bond_code" },
      { field: "bond_name", value: "bond_name" }
    ]);
    setConditions({});
    setNlQuery("查询bond_basic表中所有未删除的债券数据");
    setPage(1);
    setResults([]);
    setMeta(null);
    setError(null);
    setMainTable("bond_basic");
    setJoinTables([]);
    toast({
      title: "表单已重置",
      description: "所有查询条件已清空",
      duration: 2000,
    });
  };

  const totalPages = meta ? Math.ceil((results.length || 0) / pageSize) : 0;

  const columnKeys = results.length > 0
    ? DISPLAY_COLUMNS.filter((c) => results.some((r) => r[c.key] !== undefined))
    : DISPLAY_COLUMNS;

  const getResponseTime = () => {
    if (!meta || !meta.timing) return "—";
    return `${meta.timing.total.toFixed(3)}s`;
  };

  // ========== 渲染部分 ==========
  return (
    <div className="p-8 max-w-7xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-3">
          <Search className="w-6 h-6 text-primary" />
          债券数据查询
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          支持结构化查询（L01/L03）和自然语言查询（L02/L04）
        </p>
      </div>

      {/* 限流提示 */}
      <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-md text-sm">
        <Info className="w-4 h-4 text-blue-600" />
        <span className="text-blue-700">
          接口限流：{rateLimitInfo.used}/{rateLimitInfo.total} 次/分钟 | 剩余：{rateLimitInfo.remaining} 次 | 重置倒计时：{rateLimitInfo.resetIn}s
        </span>
      </div>

      {/* Query Mode Selection */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => { setQueryMode("structured"); setResults([]); setMeta(null); setError(null); }}
          className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${queryMode === "structured"
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-card text-foreground border-border hover:bg-accent"
            }`}
        >
          结构化查询
        </button>
        <button
          onClick={() => { setQueryMode("natural"); setResults([]); setMeta(null); setError(null); }}
          className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${queryMode === "natural"
            ? "bg-primary text-primary-foreground border-primary"
            : "bg-card text-foreground border-border hover:bg-accent"
            }`}
        >
          自然语言查询
        </button>
      </div>

      {/* Link Selection */}
      <div className="flex flex-wrap gap-2 mb-6 items-center">
        <span className="text-xs text-muted-foreground mr-1">链路类型：</span>
        {queryMode === "structured" ? (
          <>
            {(["L01", "L03"] as const).map((lt) => (
              <button
                key={lt}
                onClick={() => {
                  setStructuredLink(lt);
                  setResults([]);
                  setMeta(null);
                  setError(null);
                }}
                disabled={loading}
                className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${structuredLink === lt
                  ? "bg-accent text-accent-foreground border-primary/50"
                  : "bg-card text-muted-foreground border-border hover:bg-accent/50"
                  }`}
              >
                {lt} {lt === "L03" && <span className="text-[10px] opacity-70">(推荐)</span>}
              </button>
            ))}
          </>
        ) : (
          <>
            {(["L02", "L04"] as const).map((lt) => (
              <button
                key={lt}
                onClick={() => {
                  setNaturalLink(lt);
                  setResults([]);
                  setMeta(null);
                  setError(null);
                }}
                disabled={loading}
                className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${naturalLink === lt
                  ? "bg-accent text-accent-foreground border-primary/50"
                  : "bg-card text-muted-foreground border-border hover:bg-accent/50"
                  }`}
              >
                {lt}{lt === "L04" && <span className="text-[10px] opacity-70">(推荐)</span>}
              </button>
            ))}
          </>
        )}
      </div>

      {/* Query Form */}
      <div className="border rounded-lg p-6 mb-6 bg-card">
        {queryMode === "natural" ? (
          <div className="space-y-3">
            <Label>自然语言查询</Label>
            <Textarea
              value={nlQuery}
              onChange={(e) => setNlQuery(e.target.value)}
              placeholder="查询bond_basic表中所有未删除的债券数据"
              rows={4}
              className="font-mono text-sm"
              disabled={loading}
            />
            <div className="bg-green-50 p-2 rounded text-xs text-green-700 border border-green-200">
              <strong>提示：</strong> L04 链路已通过后端测试，建议优先使用 L04 进行自然语言查询
            </div>
          </div>
        ) : (
          <div className="space-y-3">
            {/* L03 Table Configuration */}
            {structuredLink === "L03" && (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                <div>
                  <Label className="text-xs">主表名称</Label>
                  <Input
                    value={mainTable}
                    onChange={(e) => setMainTable(e.target.value)}
                    className="text-sm h-8"
                    disabled={loading}
                    placeholder="bond_basic"
                  />
                </div>
                <div>
                  <Label className="text-xs">关联表（逗号分隔）</Label>
                  <Input
                    value={joinTables.join(",")}
                    onChange={(e) => setJoinTables(e.target.value.split(",").map(t => t.trim()).filter(t => t))}
                    className="text-sm h-8"
                    disabled={loading}
                    placeholder="bond_trade,bond_rating"
                  />
                </div>
              </div>
            )}

            {/* Output Fields */}
            <div className="flex items-center justify-between">
              <Label className="text-sm">输出字段</Label>
              <span className="text-xs text-muted-foreground">点击"+"添加字段</span>
            </div>
            <DynamicParams
              params={params}
              onChange={setParams}
              availableFields={BOND_FIELDS}
              disabled={loading}
              mode="select"
            />

            {/* Condition Builder */}
            <div className="mt-4 pt-4 border-t border-border">
              <Label className="text-sm mb-2">筛选条件</Label>
              <ConditionBuilder
                value={conditions}
                onChange={setConditions}
                availableFields={QUERY_FIELDS}
                disabled={loading}
              />
            </div>
          </div>
        )}

        {/* Pagination Controls */}
        <div className="flex flex-wrap items-center gap-4 mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">每页条数</Label>
            <Select
              value={String(pageSize)}
              onValueChange={(v) => setPageSize(Number(v))}
              disabled={loading}
            >
              <SelectTrigger className="w-20 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50, 100].map((s) => (
                  <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={resetForm} disabled={loading}>
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> 重置
            </Button>
            <Button size="sm" onClick={() => executeQuery(1)} disabled={loading || rateLimitInfo.remaining <= 0}>
              {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Search className="w-3.5 h-3.5 mr-1.5" />}
              查询
            </Button>
          </div>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="p-4 mb-4 border border-red-200 bg-red-50 rounded-md">
          <p className="text-red-600 text-sm flex items-center gap-2">
            <AlertTriangle className="w-4 h-4" />
            {error.split('\n').map((line, i) => (
              <span key={i}>{line}<br /></span>
            ))}
          </p>
        </div>
      )}

      {/* Results Table */}
      {results.length > 0 && (
        <div className="border rounded-lg overflow-hidden mb-4 bg-card">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  {columnKeys.map((col) => (
                    <TableHead key={col.key} className="text-xs font-semibold">
                      {col.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((row, i) => (
                  <TableRow key={i} className="hover:bg-muted/30">
                    {columnKeys.map((col) => (
                      <TableCell key={col.key} className="text-sm font-mono">
                        {row[col.key] != null ? String(row[col.key]) : "—"}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex flex-wrap items-center justify-between p-4 border-t border-border">
              <span className="text-xs text-muted-foreground">
                总计：{results.length} 条 | 第 {page} 页 / 共 {totalPages} 页
              </span>
              <div className="flex gap-1 mt-2 sm:mt-0">
                <Button variant="outline" size="sm" disabled={page <= 1 || loading} onClick={() => executeQuery(page - 1)}>
                  上一页
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages || loading} onClick={() => executeQuery(page + 1)}>
                  下一页
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Meta Info Panel */}
      {meta && (
        <div className="border rounded-lg overflow-hidden bg-card">
          <button
            onClick={() => setShowMeta(!showMeta)}
            className="w-full flex items-center justify-between p-4 text-sm font-medium text-muted-foreground hover:bg-muted/30"
            disabled={loading}
          >
            <span>运维信息（SQL/耗时）</span>
            {showMeta ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showMeta && (
            <div className="mx-4 mb-4">
              <div className="space-y-2 text-xs">
                <div><span className="text-muted-foreground">响应耗时：</span> {getResponseTime()}</div>
                {meta.timing && (
                  <>
                    <div><span className="text-muted-foreground">LLM 生成SQL耗时：</span> {meta.timing.llm_sql.toFixed(3)}s</div>
                    <div><span className="text-muted-foreground">SQL执行耗时：</span> {meta.timing.sql_exec.toFixed(3)}s</div>
                  </>
                )}
                <div><span className="text-muted-foreground">时间戳：</span> {meta.timestamp ? new Date(meta.timestamp * 1000).toLocaleString() : "—"}</div>
                {meta.sql && (
                  <div className="mt-2">
                    <span className="text-muted-foreground block mb-1">生成的SQL：</span>
                    <pre className="mt-1 p-2 bg-muted rounded text-xs overflow-x-auto font-mono">
                      {meta.sql}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty State */}
      {results.length === 0 && !error && !loading && (
        <div className="border rounded-lg p-12 text-center bg-card">
          <Search className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground text-sm">请输入查询条件后点击"查询"按钮</p>
        </div>
      )}
    </div>
  );
}