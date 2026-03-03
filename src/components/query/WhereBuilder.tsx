import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X, FolderPlus } from "lucide-react";
import {
  type WhereGroup,
  type WhereCondition,
  type LogicOp,
  type WhereOperator,
  QUERY_FIELDS,
  getOpsForType,
  UNARY_OPS,
  newCondition,
  newGroup,
  uid,
  type FieldDef,
  type ValidationError,
} from "./types";

// 1. 新增 disabled 属性到 Props 接口
interface WhereBuilderProps {
  group: WhereGroup;
  onChange: (group: WhereGroup) => void;
  errors: ValidationError[];
  depth?: number;
  onRemoveGroup?: () => void;
  availableFields?: FieldDef[];
  disabled?: boolean; // 新增：可选的 disabled 属性
}

// 2. 接收 disabled 属性并设置默认值 false
export default function WhereBuilder({
  group,
  onChange,
  errors,
  depth = 0,
  onRemoveGroup,
  availableFields = QUERY_FIELDS,
  disabled = false // 接收 disabled 属性，默认值 false
}: WhereBuilderProps) {
  // 3. 所有操作函数添加 disabled 判断
  const updateLogic = (logic: LogicOp) => {
    if (disabled) return; // 禁用状态下不执行
    onChange({ ...group, logic });
  };

  const updateCondition = (idx: number, cond: WhereCondition) => {
    if (disabled) return; // 禁用状态下不执行
    const updated = [...group.conditions];
    updated[idx] = cond;
    onChange({ ...group, conditions: updated });
  };

  const removeCondition = (idx: number) => {
    if (disabled) return; // 禁用状态下不执行
    const updated = group.conditions.filter((_, i) => i !== idx);
    onChange({ ...group, conditions: updated });
  };

  const addCondition = () => {
    if (disabled) return; // 禁用状态下不执行
    onChange({ ...group, conditions: [...group.conditions, newCondition()] });
  };

  const addNestedGroup = () => {
    if (disabled) return; // 禁用状态下不执行
    onChange({ ...group, groups: [...group.groups, newGroup(group.logic === "AND" ? "OR" : "AND")] });
  };

  const updateNestedGroup = (idx: number, g: WhereGroup) => {
    if (disabled) return; // 禁用状态下不执行
    const updated = [...group.groups];
    updated[idx] = g;
    onChange({ ...group, groups: updated });
  };

  const removeNestedGroup = (idx: number) => {
    if (disabled) return; // 禁用状态下不执行
    onChange({ ...group, groups: group.groups.filter((_, i) => i !== idx) });
  };

  const borderColor = depth === 0 ? "border-primary/20" : depth === 1 ? "border-accent" : "border-muted";

  return (
    // 4. 禁用时添加透明度视觉反馈
    <div className={`rounded-md border ${borderColor} p-3 space-y-2 ${depth > 0 ? "ml-4 bg-muted/20" : ""}`} style={{ opacity: disabled ? 0.7 : 1 }}>
      {/* Group header */}
      <div className="flex items-center gap-2">
        <span className="text-xs text-muted-foreground font-medium">Combine with:</span>
        <div className="flex rounded-md border border-border overflow-hidden">
          {(["AND", "OR"] as LogicOp[]).map((op) => (
            <button
              key={op}
              type="button"
              onClick={() => updateLogic(op)}
              // 5. 给逻辑运算符按钮添加禁用状态
              disabled={disabled}
              className={`px-3 py-1 text-xs font-semibold transition-colors ${group.logic === op
                  ? "bg-primary text-primary-foreground"
                  : "bg-card text-muted-foreground hover:bg-accent"
                } ${disabled ? "opacity-50 cursor-not-allowed" : ""}`}
            >
              {op}
            </button>
          ))}
        </div>
        {depth > 0 && onRemoveGroup && (
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-7 w-7 ml-auto text-muted-foreground hover:text-destructive"
            onClick={onRemoveGroup}
            disabled={disabled} // 5. 给删除分组按钮添加 disabled
          >
            <X className="w-3.5 h-3.5" />
          </Button>
        )}
      </div>

      {/* Conditions */}
      {group.conditions.map((cond, i) => {
        const fieldDef = availableFields.find((f) => f.value === cond.field);
        const ops = fieldDef ? getOpsForType(fieldDef.type) : getOpsForType("string");
        const isUnary = UNARY_OPS.includes(cond.operator);
        const isBetween = cond.operator === "BETWEEN";
        const condErrors = errors.filter((e) => e.path === cond.id);

        return (
          <div key={cond.id} className="space-y-1">
            <div className="flex items-center gap-1.5 flex-wrap">
              {/* Field */}
              <Select
                value={cond.field}
                onValueChange={(v) => {
                  const newField = availableFields.find((f) => f.value === v);
                  const newOps = newField ? getOpsForType(newField.type) : ops;
                  const newOp = newOps.includes(cond.operator) ? cond.operator : newOps[0];
                  updateCondition(i, { ...cond, field: v, operator: newOp });
                }}
                disabled={disabled} // 5. 给字段选择器添加 disabled
              >
                <SelectTrigger className="w-[150px] h-8 text-xs">
                  <SelectValue placeholder="Field" />
                </SelectTrigger>
                <SelectContent>
                  {availableFields.map((f) => (
                    <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Operator */}
              <Select
                value={cond.operator}
                onValueChange={(v) => updateCondition(i, { ...cond, operator: v as WhereOperator, ...(UNARY_OPS.includes(v as WhereOperator) ? { value: "", value2: undefined } : {}) })}
                disabled={disabled} // 5. 给操作符选择器添加 disabled
              >
                <SelectTrigger className="w-[120px] h-8 text-xs font-mono">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ops.map((op) => (
                    <SelectItem key={op} value={op}>{op}</SelectItem>
                  ))}
                </SelectContent>
              </Select>

              {/* Value */}
              {!isUnary && (
                <Input
                  className="w-[140px] h-8 text-xs"
                  value={cond.value}
                  onChange={(e) => updateCondition(i, { ...cond, value: e.target.value })}
                  placeholder={isBetween ? "From" : cond.operator === "IN" || cond.operator === "NOT IN" ? "val1, val2, ..." : "Value"}
                  disabled={disabled} // 5. 给值输入框添加 disabled
                />
              )}

              {isBetween && (
                <>
                  <span className="text-xs text-muted-foreground">~</span>
                  <Input
                    className="w-[140px] h-8 text-xs"
                    value={cond.value2 || ""}
                    onChange={(e) => updateCondition(i, { ...cond, value2: e.target.value })}
                    placeholder="To"
                    disabled={disabled} // 5. 给 BETWEEN 的第二个值输入框添加 disabled
                  />
                </>
              )}

              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeCondition(i)}
                // 5. 合并原有 disabled 逻辑和新的 disabled 属性
                disabled={disabled || (group.conditions.length === 1 && group.groups.length === 0)}
              >
                <X className="w-3.5 h-3.5" />
              </Button>
            </div>
            {condErrors.map((e) => (
              <p key={e.message} className="text-destructive text-[11px] ml-1">{e.message}</p>
            ))}
          </div>
        );
      })}

      {/* Nested groups - 传递 disabled 属性给子级 WhereBuilder */}
      {group.groups.map((g, i) => (
        <WhereBuilder
          key={g.id}
          group={g}
          onChange={(updated) => updateNestedGroup(i, updated)}
          errors={errors}
          depth={depth + 1}
          onRemoveGroup={() => removeNestedGroup(i)}
          availableFields={availableFields}
          disabled={disabled} // 6. 关键：将 disabled 传递给嵌套的 WhereBuilder
        />
      ))}

      {/* Add buttons */}
      <div className="flex gap-2 pt-1">
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-xs h-7"
          onClick={addCondition}
          disabled={disabled} // 5. 给添加条件按钮添加 disabled
        >
          <Plus className="w-3 h-3 mr-1" /> Condition
        </Button>
        {depth < 2 && (
          <Button
            type="button"
            variant="outline"
            size="sm"
            className="text-xs h-7"
            onClick={addNestedGroup}
            disabled={disabled} // 5. 给添加嵌套分组按钮添加 disabled
          >
            <FolderPlus className="w-3 h-3 mr-1" /> Nested Group
          </Button>
        )}
      </div>
    </div>
  );
}