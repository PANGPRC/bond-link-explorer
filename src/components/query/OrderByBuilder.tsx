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

interface OrderByBuilderProps {
  items: OrderByItem[];
  onChange: (items: OrderByItem[]) => void;
  availableFields?: FieldDef[];
}

export default function OrderByBuilder({ items, onChange, availableFields = QUERY_FIELDS }: OrderByBuilderProps) {
  const add = () => {
    const unused = availableFields.find((f) => !items.some((it) => it.field === f.value));
    if (unused) onChange([...items, { id: uid(), field: unused.value, direction: "ASC" }]);
  };

  const remove = (idx: number) => onChange(items.filter((_, i) => i !== idx));

  const update = (idx: number, patch: Partial<OrderByItem>) => {
    const updated = [...items];
    updated[idx] = { ...updated[idx], ...patch };
    onChange(updated);
  };

  return (
    <div className="space-y-2">
      {items.map((item, i) => {
        const usedFields = items.filter((_, j) => j !== i).map((it) => it.field);
        const options = availableFields.filter((f) => f.value === item.field || !usedFields.includes(f.value));
        return (
          <div key={item.id} className="flex items-center gap-1.5">
            <Select value={item.field} onValueChange={(v) => update(i, { field: v })}>
              <SelectTrigger className="w-[160px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options.map((f) => (
                  <SelectItem key={f.value} value={f.value}>{f.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select value={item.direction} onValueChange={(v) => update(i, { direction: v as SortDir })}>
              <SelectTrigger className="w-[100px] h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="ASC">ASC ↑</SelectItem>
                <SelectItem value="DESC">DESC ↓</SelectItem>
              </SelectContent>
            </Select>
            <Button type="button" variant="ghost" size="icon" className="h-7 w-7 text-muted-foreground hover:text-destructive" onClick={() => remove(i)}>
              <X className="w-3.5 h-3.5" />
            </Button>
          </div>
        );
      })}
      {items.length < availableFields.length && (
        <Button type="button" variant="outline" size="sm" className="text-xs h-7" onClick={add}>
          <Plus className="w-3 h-3 mr-1" /> Add Sort
        </Button>
      )}
    </div>
  );
}
