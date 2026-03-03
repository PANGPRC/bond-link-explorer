import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X } from "lucide-react";
import { type OrderByItem, type SortDir, type FieldDef, QUERY_FIELDS, uid } from "./types";

// 1. 新增 disabled 属性到 Props 接口
interface OrderByBuilderProps {
  items: OrderByItem[];
  onChange: (items: OrderByItem[]) => void;
  availableFields?: FieldDef[];
  disabled?: boolean; // 新增：可选的 disabled 属性
}

// 2. 接收 disabled 属性并设置默认值 false
export default function OrderByBuilder({
  items,
  onChange,
  availableFields = QUERY_FIELDS,
  disabled = false // 接收 disabled 属性，默认值 false
}: OrderByBuilderProps) {
  // 3. 所有操作函数添加 disabled 判断
  const add = () => {
    if (disabled) return; // 禁用状态下不执行

    const unused = availableFields.find((f) => !items.some((it) => it.field === f.value));
    if (unused) onChange([...items, { id: uid(), field: unused.value, direction: "ASC" }]);
  };

  const remove = (idx: number) => {
    if (disabled) return; // 禁用状态下不执行

    onChange(items.filter((_, i) => i !== idx));
  };

  const update = (idx: number, patch: Partial<OrderByItem>) => {
    if (disabled) return; // 禁用状态下不执行

    const updated = [...items];
    updated[idx] = { ...updated[idx], ...patch };
    onChange(updated);
  };

  return (
    // 4. 禁用时添加透明度视觉反馈
    <div className="space-y-2" style={{ opacity: disabled ? 0.7 : 1 }}>
      {items.map((item, i) => {
        const usedFields = items.filter((_, j) => j !== i).map((it) => it.field);
        const options = availableFields.filter((f) => f.value === item.field || !usedFields.includes(f.value));
        return (
          <div key={item.id} className="flex items-center gap-1.5">
            {/* 5. 给字段选择器添加 disabled 属性 */}
            <Select
              value={item.field}
              onValueChange={(v) => update(i, { field: v })}
              disabled={disabled}
            >
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            {/* 5. 给排序方向选择器添加 disabled 属性 */}
            <Select
              value={item.direction}
              onValueChange={(v) => update(i, { direction: v as SortDir })}
              disabled={disabled}
            >
              <SelectTrigger className="w-[100px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ASC">ASC ↑</SelectItem>
                <SelectItem value="DESC">DESC ↓</SelectItem>
              </SelectContent>
            </Select>
            {/* 5. 给删除按钮添加 disabled 属性 */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => remove(i)}
              disabled={disabled}
            >
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        );
      })}
      {/* 5. 给添加按钮添加 disabled 属性 */}
      {items.length < availableFields.length && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="text-xs h-7"
          onClick={add}
          disabled={disabled}
        >
          <Plus className="w-3 h-3 mr-1" /> Add Sort
        </Button>
      )}
    </div>
  );
}