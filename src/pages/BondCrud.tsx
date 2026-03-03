import { useState, useCallback, useEffect } from "react";
import { bondUnified, getRateLimitInfo } from "@/lib/api";
import { debounce, generateRequestId, validateAndParseJson, formatCrudFilters } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Database, Plus, Pencil, Trash2, Loader2, CheckCircle2, AlertTriangle, Info } from "lucide-react";
import DynamicParams, { type ParamRow, BOND_FIELDS } from "@/components/DynamicParams";
import { useToast } from "@/hooks/use-toast";

type OpType = "insert" | "update" | "delete";

const OP_CONFIG: Record<OpType, { label: string; icon: typeof Plus; color: string }> = {
  insert: { label: "新增", icon: Plus, color: "text-green-600" },
  update: { label: "修改", icon: Pencil, color: "text-blue-600" },
  delete: { label: "删除", icon: Trash2, color: "text-red-600" },
};

// Fields available for create/update (exclude query-only fields like sort)
const CRUD_FIELDS = BOND_FIELDS.filter(
  (f) => !["sort_field", "sort_order"].includes(f.value)
);

// 修复：组件名改为 BondCrud（匹配文件名）
export default function BondCrud() {
  const [opType, setOpType] = useState<OpType>("insert");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; msg: string } | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Dynamic params for insert/update
  const [params, setParams] = useState<ParamRow[]>([]);

  // Batch mode for insert
  const [batchMode, setBatchMode] = useState(false);
  const [batchJson, setBatchJson] = useState("");

  // Filter for update/delete - 修改：使用bond_code而非bond_id（匹配后端测试用例）
  const [filterBondCode, setFilterBondCode] = useState("");

  // Rate limit info
  const [rateLimitInfo, setRateLimitInfo] = useState(getRateLimitInfo());
  const { toast } = useToast();

  // 更新限流信息
  useEffect(() => {
    const interval = setInterval(() => {
      setRateLimitInfo(getRateLimitInfo());
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  const resetForm = () => {
    setParams([]);
    setBatchJson("");
    setFilterBondCode(""); // 修改：重置bond_code
    setResult(null);
    toast({
      title: "表单已重置",
      description: "所有输入项已清空，可重新填写",
      duration: 2000,
    });
  };

  const paramsToRecord = (rows: ParamRow[]): Record<string, unknown> => {
    const record: Record<string, unknown> = {};
    rows.forEach((r) => {
      if (r.value.trim()) {
        // Auto-convert numeric fields
        if (r.field === "issue_size" || r.field === "coupon_rate") {
          // 新增数字校验
          const numValue = Number(r.value);
          if (isNaN(numValue)) {
            throw new Error(`字段 ${r.field} 必须是数字类型`);
          }
          record[r.field] = numValue;
        } else if (r.field === "maturity_date" || r.field === "issue_date") { // 新增issue_date校验
          // 日期格式校验
          if (!/^\d{4}-\d{2}-\d{2}$/.test(r.value.trim())) {
            throw new Error(`日期字段 ${r.field} 格式错误，需为 YYYY-MM-DD`);
          }
          record[r.field] = r.value.trim();
        } else {
          record[r.field] = r.value.trim();
        }
      }
    });
    return record;
  };

  // 核心修改：构建新增参数（匹配后端L03 insert测试用例）
  const buildInsertData = () => {
    const requestId = generateRequestId();
    const table = "bond_basic";

    if (batchMode) {
      const parsed = validateAndParseJson(batchJson);
      const records = Array.isArray(parsed) ? parsed : [parsed];

      // 批量数据校验
      records.forEach((record, index) => {
        if (!record.bond_code || !record.bond_name) {
          throw new Error(`第 ${index + 1} 条数据：债券代码和债券名称为必填项`);
        }
        // 数字字段校验
        if (record.issue_size && isNaN(Number(record.issue_size))) {
          throw new Error(`第 ${index + 1} 条数据：发行规模必须是数字`);
        }
      });

      return {
        table,
        data: records.length === 1 ? records[0] : records, // 适配单条/批量
        request_id: requestId
      };
    }

    const record = paramsToRecord(params);
    if (!record.bond_code || !record.bond_name) {
      throw new Error("债券代码（bond_code）和债券名称（bond_name）为必填项");
    }

    return {
      table,
      data: record,
      request_id: requestId
    };
  };

  // 核心修改：构建修改参数（匹配后端L03 update测试用例）
  const buildUpdateData = () => {
    if (!filterBondCode.trim()) {
      throw new Error("修改操作必须指定债券代码（bond_code）作为筛选条件，禁止全表更新");
    }

    const requestId = generateRequestId();
    const table = "bond_basic";
    const updates = paramsToRecord(params);

    if (Object.keys(updates).length === 0) {
      throw new Error("修改操作必须至少指定一个要更新的字段");
    }

    return {
      table,
      data: updates,
      filters: formatCrudFilters(filterBondCode, table),
      request_id: requestId
    };
  };

  // 核心修改：构建删除参数（匹配后端L03 delete测试用例）
  const buildDeleteData = () => {
    if (!filterBondCode.trim()) {
      throw new Error("删除操作必须指定债券代码（bond_code）作为筛选条件，禁止全表删除");
    }

    const requestId = generateRequestId();
    const table = "bond_basic";

    return {
      table,
      filters: formatCrudFilters(filterBondCode, table),
      request_id: requestId
    };
  };

  // 防抖执行CRUD操作
  const debouncedExecute = useCallback(
    debounce(async () => {
      // 前置检查：限流判断
      if (rateLimitInfo.remaining <= 0) {
        toast({
          title: "请求限流",
          description: `已达到每分钟20次请求限制，请${rateLimitInfo.resetIn}秒后重试`,
          variant: "destructive",
          duration: 3000,
        });
        return;
      }

      setResult(null);
      try {
        let paramsData: Record<string, unknown>;
        if (opType === "insert") paramsData = buildInsertData();
        else if (opType === "update") paramsData = buildUpdateData();
        else paramsData = buildDeleteData();

        setLoading(true);
        // 核心修改：完全匹配后端L03 CRUD参数规范
        const res = await bondUnified({
          link_type: "L03",
          op_type: opType,
          ...paramsData // 直接展开参数（table/data/filters/request_id）
        });

        if (res.code !== 200) throw new Error(res.msg || "操作失败");

        setResult({ success: true, msg: res.msg || `${OP_CONFIG[opType].label}操作成功` });
        // 更新限流信息
        setRateLimitInfo(getRateLimitInfo());

        // 操作成功后自动重置表单（删除操作除外）
        if (opType !== "delete") {
          setTimeout(() => resetForm(), 2000);
        }

        toast({
          title: "操作成功",
          description: res.msg || `${OP_CONFIG[opType].label}操作已完成`,
          duration: 3000,
        });
      } catch (e: any) {
        setResult({ success: false, msg: e.message });
        toast({
          title: "操作失败",
          description: e.message,
          variant: "destructive",
          duration: 3000,
        });

        // 限流错误特殊提示
        if (e.message.includes("Rate limit exceeded")) {
          setRateLimitInfo(getRateLimitInfo());
        }
      } finally {
        setLoading(false);
      }
    }, 500), // 500ms防抖
    [opType, params, batchMode, batchJson, filterBondCode, rateLimitInfo, toast]
  );

  const execute = () => {
    debouncedExecute();
  };

  const handleSubmit = () => {
    if (opType === "delete") {
      setDeleteConfirmOpen(true);
    } else {
      execute();
    }
  };

  return (
    <div className="p-8 max-w-4xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-3">
          <Database className="w-6 h-6 text-primary" />
          债券数据CRUD操作
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          通过L03核心链路进行债券数据的新增、修改、删除（逻辑删除），支持单条/批量操作
        </p>
      </div>

      {/* 限流提示 */}
      <div className="mb-4 flex items-center gap-2 px-3 py-2 bg-blue-50 rounded-md text-sm">
        <Info className="w-4 h-4 text-blue-600" />
        <span className="text-blue-700">
          接口限流：{rateLimitInfo.used}/{rateLimitInfo.total} 次/分钟 | 剩余：{rateLimitInfo.remaining} 次 | 重置倒计时：{rateLimitInfo.resetIn}s
        </span>
      </div>

      {/* Operation Tabs */}
      <div className="flex flex-wrap gap-2 mb-6">
        {(Object.keys(OP_CONFIG) as OpType[]).map((op) => {
          const config = OP_CONFIG[op];
          const Icon = config.icon;
          return (
            <button
              key={op}
              onClick={() => { setOpType(op); setResult(null); setParams([]); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium border transition-colors ${opType === op
                ? "bg-primary text-primary-foreground border-primary"
                : "bg-card text-foreground border-border hover:bg-accent"
                }`}
              disabled={loading}
            >
              <Icon className={`w-4 h-4 ${config.color}`} />
              {config.label}
            </button>
          );
        })}
      </div>

      {/* Form */}
      <div className="border rounded-lg p-6 mb-6 bg-card">
        {opType === "insert" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input
                  type="checkbox"
                  checked={batchMode}
                  onChange={(e) => setBatchMode(e.target.checked)}
                  className="rounded"
                  disabled={loading}
                />
                批量导入（JSON格式）
              </label>
            </div>

            {batchMode ? (
              <div className="space-y-2">
                <Label>批量JSON数据</Label>
                <Textarea
                  value={batchJson}
                  onChange={(e) => setBatchJson(e.target.value)}
                  placeholder={`{"bond_code":"TEST_001","bond_name":"测试国债001","bond_type":"国债","issuer":"财政部","issue_date":"2026-03-02"}`}
                  rows={6}
                  className="font-mono text-sm"
                  disabled={loading}
                />
                <p className="text-xs text-muted-foreground">
                  格式说明：JSON对象（单条）或数组（多条），每个对象包含债券字段；支持批量新增多条数据
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">单条记录字段</Label>
                  <span className="text-xs text-red-600">债券代码和名称为必填项</span>
                </div>
                <DynamicParams
                  params={params}
                  onChange={setParams}
                  availableFields={CRUD_FIELDS}
                  disabled={loading}
                />
                {params.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">点击"Add Parameter"添加新增记录的字段。</p>
                )}
              </div>
            )}
          </div>
        )}

        {opType === "update" && (
          <div className="space-y-4">
            <div className="p-3 border border-yellow-200 bg-yellow-50 flex items-center gap-2 mb-2 rounded-md">
              <AlertTriangle className="w-4 h-4 text-yellow-600 flex-shrink-0" />
              <span className="text-sm text-foreground">必须指定筛选条件 – 禁止全表更新操作</span>
            </div>
            <div className="space-y-1.5">
              {/* 修改：标签改为债券代码 */}
              <Label className="text-xs">债券代码（bond_code） <span className="text-red-600">*</span></Label>
              <Input
                value={filterBondCode}
                onChange={(e) => setFilterBondCode(e.target.value)}
                placeholder="TEST_001"
                disabled={loading}
              />
            </div>
            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm">待更新字段</Label>
                <span className="text-xs text-muted-foreground">添加需要修改的字段和值</span>
              </div>
              <DynamicParams
                params={params}
                onChange={setParams}
                availableFields={CRUD_FIELDS}
                disabled={loading}
              />
              {params.length === 0 && (
                <p className="text-xs text-muted-foreground italic mt-2">点击"Add Parameter"选择要更新的字段。</p>
              )}
            </div>
          </div>
        )}

        {opType === "delete" && (
          <div className="space-y-4">
            <div className="p-3 border border-red-200 bg-red-50 flex items-center gap-2 mb-2 rounded-md">
              <AlertTriangle className="w-4 h-4 text-red-600 flex-shrink-0" />
              <span className="text-sm text-foreground">
                必须指定筛选条件 – 此操作执行逻辑删除（is_deleted=1），数据不会物理删除
              </span>
            </div>
            <div className="space-y-1.5">
              {/* 修改：标签改为债券代码 */}
              <Label className="text-xs">债券代码（bond_code） <span className="text-red-600">*</span></Label>
              <Input
                value={filterBondCode}
                onChange={(e) => setFilterBondCode(e.target.value)}
                placeholder="TEST_001"
                disabled={loading}
              />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-6 pt-4 border-t border-border">
          <Button variant="outline" size="sm" onClick={resetForm} disabled={loading}>
            重置
          </Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={loading || rateLimitInfo.remaining <= 0}
            variant={opType === "delete" ? "destructive" : "default"}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            {OP_CONFIG[opType].label}
          </Button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className={`border rounded-lg p-4 flex items-center gap-3 ${result.success
          ? "border-green-200 bg-green-50"
          : "border-red-200 bg-red-50"
          }`}>
          {result.success ? (
            <CheckCircle2 className="w-5 h-5 text-green-600 flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-red-600 flex-shrink-0" />
          )}
          <span className={`text-sm ${result.success ? "text-green-600" : "text-red-600"}`}>
            {result.msg}
          </span>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              确定要删除债券代码为 "{filterBondCode}" 的债券记录吗？此操作执行逻辑删除（is_deleted=1），数据可恢复。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)} disabled={loading}>
              取消
            </Button>
            <Button
              variant="destructive"
              onClick={() => { setDeleteConfirmOpen(false); execute(); }}
              disabled={loading}
            >
              {loading && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
              确认删除
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}