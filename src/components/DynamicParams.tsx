import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, X } from "lucide-react";

export interface ParamField {
  value: string;
  label: string;
}

export interface ParamRow {
  field: string;
  value: string;
}

// All available bond fields
export const BOND_FIELDS: ParamField[] = [
  { value: "bond_code", label: "Bond Code" },
  { value: "bond_name", label: "Bond Name" },
  { value: "issue_size", label: "Issue Size" },
  { value: "credit_rating", label: "Credit Rating" },
  { value: "maturity_date", label: "Maturity Date" },
  { value: "counterparty_name", label: "Counterparty Name" },
  { value: "issue_year", label: "Issuance Year" },
  { value: "coupon_rate", label: "Coupon Rate" },
  { value: "bond_type", label: "Bond Type" },
  { value: "issue_date", label: "Issue Date" },
  { value: "issuer_name", label: "Issuer Name" },
  { value: "currency", label: "Currency" },
  { value: "market", label: "Market" },
  { value: "sort_field", label: "Sort Field" },
  { value: "sort_order", label: "Sort Order" },
];

interface DynamicParamsProps {
  params: ParamRow[];
  onChange: (params: ParamRow[]) => void;
  /** Fields that are always shown and cannot be removed */
  requiredFields?: string[];
  /** Subset of fields to show in dropdown; defaults to all */
  availableFields?: ParamField[];
  /** Whether the component is disabled (新增 disabled 属性) */
  disabled?: boolean;
  /** 模式：select-仅选择字段（输出字段），input-字段+值（筛选条件） */
  mode?: "select" | "input";
}

export default function DynamicParams({
  params,
  onChange,
  requiredFields = [],
  availableFields = BOND_FIELDS,
  disabled = false,
  mode = "input", // 默认保持原有input模式
}: DynamicParamsProps) {
  const usedFields = params.map((p) => p.field);

  const addRow = () => {
    if (disabled) return;

    const next = availableFields.find((f) => !usedFields.includes(f.value));
    if (next) {
      // select模式下，value直接等于field
      onChange([...params, { field: next.value, value: mode === "select" ? next.value : "" }]);
    }
  };

  const removeRow = (index: number) => {
    if (disabled) return;
    onChange(params.filter((_, i) => i !== index));
  };

  const updateField = (index: number, field: string) => {
    if (disabled) return;

    const updated = [...params];
    // select模式下，value同步更新为field
    updated[index] = {
      ...updated[index],
      field,
      value: mode === "select" ? field : updated[index].value
    };
    onChange(updated);
  };

  const updateValue = (index: number, value: string) => {
    // select模式下不允许修改value
    if (disabled || mode === "select") return;

    const updated = [...params];
    updated[index] = { ...updated[index], value };
    onChange(updated);
  };

  const canAdd = usedFields.length < availableFields.length;

  return (
    <div className="space-y-2">
      {params.map((row, i) => {
        const isRequired = requiredFields.includes(row.field);
        const options = availableFields.filter(
          (f) => f.value === row.field || !usedFields.includes(f.value)
        );
        return (
          <div key={i} className="flex items-center gap-2">
            <Select
              value={row.field}
              onValueChange={(v) => updateField(i, v)}
              disabled={disabled}
            >
              <SelectTrigger className="w-[180px] h-9 text-xs">
                <SelectValue placeholder="Select field" />
              </SelectTrigger>
              <SelectContent>
                {options.map((f) => (
                  <SelectItem key={f.value} value={f.value}>
                    {f.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {/* select模式下隐藏输入框 */}
            {mode === "input" && (
              <Input
                className="flex-1 h-9 text-sm"
                value={row.value}
                onChange={(e) => updateValue(i, e.target.value)}
                placeholder={`Enter ${availableFields.find((f) => f.value === row.field)?.label ?? "value"}`}
                disabled={disabled}
              />
            )}

            {!isRequired && (
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-9 w-9 shrink-0 text-muted-foreground hover:text-destructive"
                onClick={() => removeRow(i)}
                disabled={disabled}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
            {isRequired && <div className="w-9 shrink-0" />}
          </div>
        );
      })}
      {canAdd && (
        <Button
          type="button"
          variant="outline"
          size="sm"
          className="mt-1"
          onClick={addRow}
          disabled={disabled}
        >
          <Plus className="w-3.5 h-3.5 mr-1.5" />
          {mode === "select" ? "Add Output Field" : "Add Parameter"}
        </Button>
      )}
    </div>
  );
}