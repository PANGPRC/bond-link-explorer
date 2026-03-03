import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import {
  type GroupByState,
  type AggregateItem,
  type AggFunc,
  type FieldDef,
  QUERY_FIELDS,
  NUMERIC_FIELDS,
  uid,
} from "./types";

// 1. 新增 disabled 属性到 Props 接口
interface GroupByBuilderProps {
  state: GroupByState;
  onChange: (state: GroupByState) => void;
  availableFields?: FieldDef[];
  disabled?: boolean; // 新增：可选的 disabled 属性
}

const AGG_FUNCS: { value: AggFunc; label: string; numericOnly: boolean }[] = [
  { value: "COUNT", label: "COUNT", numericOnly: false },
  { value: "SUM", label: "SUM", numericOnly: true },
  { value: "AVG", label: "AVG", numericOnly: true },
  { value: "MIN", label: "MIN", numericOnly: false },
  { value: "MAX", label: "MAX", numericOnly: false },
];

// 2. 接收 disabled 属性并设置默认值 false
export default function GroupByBuilder({
  state,
  onChange,
  availableFields = QUERY_FIELDS,
  disabled = false // 接收 disabled 属性，默认值 false
}: GroupByBuilderProps) {
  const numericFields = availableFields.filter((f) => f.type === "number");

  // ── Group By fields ──
  const addGroupField = () => {
    // 3. 禁用状态下不执行操作
    if (disabled) return;

    const unused = availableFields.find((f) => !state.fields.includes(f.value));
    if (unused) onChange({ ...state, fields: [...state.fields, unused.value] });
  };

  const removeGroupField = (idx: number) => {
    // 3. 禁用状态下不执行操作
    if (disabled) return;

    onChange({ ...state, fields: state.fields.filter((_, i) => i !== idx) });
  };

  const updateGroupField = (idx: number, val: string) => {
    // 3. 禁用状态下不执行操作
    if (disabled) return;

    const updated = [...state.fields];
    updated[idx] = val;
    onChange({ ...state, fields: updated });
  };

  // ── Aggregates ──
  const addAggregate = () => {
    // 3. 禁用状态下不执行操作
    if (disabled) return;

    const defaultField = numericFields[0]?.value || availableFields[0]?.value || "";
    onChange({
      ...state,
      aggregates: [...state.aggregates, { id: uid(), func: "COUNT", field: defaultField }],
    });
  };

  const removeAggregate = (idx: number) => {
    // 3. 禁用状态下不执行操作
    if (disabled) return;

    onChange({ ...state, aggregates: state.aggregates.filter((_, i) => i !== idx) });
  };

  const updateAggregate = (idx: number, patch: Partial<AggregateItem>) => {
    // 3. 禁用状态下不执行操作
    if (disabled) return;

    const updated = [...state.aggregates];
    const merged = { ...updated[idx], ...patch };
    // If switching to a numeric-only func, ensure field is numeric
    if (patch.func) {
      const funcDef = AGG_FUNCS.find((a) => a.value === patch.func);
      if (funcDef?.numericOnly && !numericFields.some((f) => f.value === merged.field)) {
        merged.field = numericFields[0]?.value || merged.field;
      }
    }
    updated[idx] = merged;
    onChange({ ...state, aggregates: updated });
  };

  return (
    <div className="space-y-4" style={{ opacity: disabled ? 0.7 : 1 }}> {/* 4. 禁用时添加透明度视觉反馈 */}
      {/* Group By Fields */}
      <div className="space-y-2">
        <span className="text-xs font-medium text-muted-foreground">Group By Fields</span>
        {state.fields.map((field, i) => {
          const usedFields = state.fields.filter((_, j) => j !== i);
          const options = availableFields.filter((f) => f.value === field || !usedFields.includes(f.value));
          return (
            <div key={i} className="flex items-center gap-1.5">
              {/* 5. 给 Select 添加 disabled 属性 */}
              <Select value={field} onValueChange={(v) => updateGroupField(i, v)} disabled={disabled}>
                <SelectTrigger className="w-[180px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {options.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {/* 5. 给删除按钮添加 disabled 属性 */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => removeGroupField(i)}
                disabled={disabled} // 添加 disabled
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          );
        })}
        {/* 5. 给添加按钮添加 disabled 属性 */}
        {state.fields.length < availableFields.length && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={addGroupField}
            disabled={disabled} // 添加 disabled
          >
            <Plus className="w-3 h-3 mr-1" /> Add Group Field
          </Button>
        )}
      </div>

      {/* Aggregates */}
      <div className="space-y-2">
        <span className="text-xs font-medium text-muted-foreground">Aggregate Functions</span>
        {state.aggregates.map((agg, i) => {
          const funcDef = AGG_FUNCS.find((a) => a.value === agg.func);
          const fieldOptions = funcDef?.numericOnly ? numericFields : availableFields;
          return (
            <div key={agg.id} className="flex items-center gap-1.5">
              {/* 5. 给聚合函数 Select 添加 disabled 属性 */}
              <Select
                value={agg.func}
                onValueChange={(v) => updateAggregate(i, { func: v as AggFunc })}
                disabled={disabled} // 添加 disabled
              >
                <SelectTrigger className="w-[110px] h-8 text-xs font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGG_FUNCS.map((a) => (
                    <SelectItem key={a.value} value={a.value}>
                      {a.label}{a.numericOnly ? " (num)" : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">(</span>
              {/* 5. 给字段 Select 添加 disabled 属性 */}
              <Select
                value={agg.field}
                onValueChange={(v) => updateAggregate(i, { field: v })}
                disabled={disabled} // 添加 disabled
              >
                <SelectTrigger className="w-[150px] h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {fieldOptions.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <span className="text-xs text-muted-foreground">)</span>
              {/* 5. 给删除聚合按钮添加 disabled 属性 */}
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                onClick={() => removeAggregate(i)}
                disabled={disabled} // 添加 disabled
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
          );
        })}
        {/* 5. 给添加聚合按钮添加 disabled 属性 */}
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-xs h-7"
          onClick={addAggregate}
          disabled={disabled} // 添加 disabled
        >
          <Plus className="w-3 h-3 mr-1" /> Add Aggregate
        </Button>
        {state.aggregates.some((a) => {
          const fd = AGG_FUNCS.find((af) => af.value === a.func);
          return fd?.numericOnly && !numericFields.some((f) => f.value === a.field);
        }) && (
            <p className="text-destructive text-[11px]">⚠ SUM/AVG require numeric fields</p>
          )}
      </div>
    </div>
  );
}