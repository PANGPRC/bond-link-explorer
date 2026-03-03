import { useState, useCallback, useMemo } from "react";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import { ChevronDown, ChevronRight, AlertCircle, Code2, Eye } from "lucide-react";
import WhereBuilder from "./WhereBuilder";
import OrderByBuilder from "./OrderByBuilder";
import GroupByBuilder from "./GroupByBuilder";
import {
  type ConditionOutput,
  type WhereGroup,
  type OrderByItem,
  type GroupByState,
  type ValidationError,
  type FieldDef,
  QUERY_FIELDS,
  UNARY_OPS,
  newGroup,
} from "./types";

interface ConditionBuilderProps {
  value: ConditionOutput;
  onChange: (value: ConditionOutput) => void;
  availableFields?: FieldDef[];
}

// ── Validation ──

function validateWhereGroup(group: WhereGroup, fields: FieldDef[]): ValidationError[] {
  const errors: ValidationError[] = [];
  for (const cond of group.conditions) {
    const fieldDef = fields.find((f) => f.value === cond.field);
    if (!fieldDef) {
      errors.push({ path: cond.id, message: `Unknown field "${cond.field}"` });
      continue;
    }
    if (!UNARY_OPS.includes(cond.operator)) {
      if (!cond.value.trim()) {
        errors.push({ path: cond.id, message: `Value is required for "${fieldDef.label} ${cond.operator}"` });
      }
      if (cond.operator === "BETWEEN" && !cond.value2?.trim()) {
        errors.push({ path: cond.id, message: `Second value required for BETWEEN` });
      }
      if (fieldDef.type === "number" && cond.value.trim() && isNaN(Number(cond.value))) {
        errors.push({ path: cond.id, message: `"${fieldDef.label}" expects a numeric value` });
      }
    }
  }
  for (const nested of group.groups) {
    errors.push(...validateWhereGroup(nested, fields));
  }
  return errors;
}

function hasContent(group: WhereGroup): boolean {
  return group.conditions.some((c) => c.value.trim() || UNARY_OPS.includes(c.operator)) || group.groups.some(hasContent);
}

// ── Component ──

export default function ConditionBuilder({
  value,
  onChange,
  availableFields = QUERY_FIELDS,
}: ConditionBuilderProps) {
  const [mode, setMode] = useState<"visual" | "manual">("visual");
  const [whereOpen, setWhereOpen] = useState(true);
  const [orderByOpen, setOrderByOpen] = useState(false);
  const [groupByOpen, setGroupByOpen] = useState(false);

  const whereGroup = value.where || newGroup();
  const orderByItems = value.orderBy || [];
  const groupByState = value.groupBy || { fields: [], aggregates: [] };

  const validationErrors = useMemo(
    () => (mode === "visual" && value.where ? validateWhereGroup(value.where, availableFields) : []),
    [mode, value.where, availableFields]
  );

  const setWhere = useCallback(
    (g: WhereGroup) => onChange({ ...value, where: g }),
    [value, onChange]
  );
  const setOrderBy = useCallback(
    (items: OrderByItem[]) => onChange({ ...value, orderBy: items }),
    [value, onChange]
  );
  const setGroupBy = useCallback(
    (state: GroupByState) => onChange({ ...value, groupBy: state }),
    [value, onChange]
  );
  const setRawSql = useCallback(
    (rawSql: string) => onChange({ ...value, rawSql }),
    [value, onChange]
  );

  const whereCount = value.where ? countConditions(value.where) : 0;

  return (
    <div className="space-y-3">
      {/* Mode toggle */}
      <div className="flex items-center gap-3">
        <Label className="text-sm font-medium">Conditions</Label>
        <div className="flex items-center gap-2 ml-auto">
          <Eye className="w-3.5 h-3.5 text-muted-foreground" />
          <Switch
            checked={mode === "manual"}
            onCheckedChange={(v) => setMode(v ? "manual" : "visual")}
          />
          <Code2 className="w-3.5 h-3.5 text-muted-foreground" />
          <span className="text-xs text-muted-foreground">{mode === "visual" ? "Visual" : "Manual SQL"}</span>
        </div>
      </div>

      {/* Validation summary */}
      {mode === "visual" && validationErrors.length > 0 && (
        <div className="flex items-center gap-2 p-2 rounded-md border border-destructive/30 bg-destructive/5">
          <AlertCircle className="w-3.5 h-3.5 text-destructive shrink-0" />
          <span className="text-destructive text-xs">{validationErrors.length} validation error(s)</span>
        </div>
      )}

      {mode === "manual" ? (
        /* ── Manual mode ── */
        <div className="space-y-2">
          <Textarea
            value={value.rawSql || ""}
            onChange={(e) => setRawSql(e.target.value)}
            placeholder={`Enter SQL condition fragments, e.g.:\nWHERE credit_rating = 'AAA' AND issue_size > 1000000\nORDER BY maturity_date DESC\nGROUP BY bond_type`}
            rows={5}
            className="font-mono text-xs"
          />
          <p className="text-[11px] text-muted-foreground">
            Enter raw WHERE, ORDER BY, GROUP BY clauses. Fields: {availableFields.map((f) => f.value).join(", ")}
          </p>
        </div>
      ) : (
        /* ── Visual mode ── */
        <div className="space-y-2">
          {/* WHERE */}
          <Collapsible open={whereOpen} onOpenChange={setWhereOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-1.5 px-2 rounded hover:bg-muted/50 transition-colors">
              {whereOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              <span className="text-xs font-semibold">WHERE</span>
              {whereCount > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{whereCount}</Badge>}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <WhereBuilder
                group={whereGroup}
                onChange={setWhere}
                errors={validationErrors}
                availableFields={availableFields}
              />
            </CollapsibleContent>
          </Collapsible>

          {/* ORDER BY */}
          <Collapsible open={orderByOpen} onOpenChange={setOrderByOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-1.5 px-2 rounded hover:bg-muted/50 transition-colors">
              {orderByOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              <span className="text-xs font-semibold">ORDER BY</span>
              {orderByItems.length > 0 && <Badge variant="secondary" className="text-[10px] h-4 px-1.5">{orderByItems.length}</Badge>}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <OrderByBuilder items={orderByItems} onChange={setOrderBy} availableFields={availableFields} />
            </CollapsibleContent>
          </Collapsible>

          {/* GROUP BY */}
          <Collapsible open={groupByOpen} onOpenChange={setGroupByOpen}>
            <CollapsibleTrigger className="flex items-center gap-2 w-full text-left py-1.5 px-2 rounded hover:bg-muted/50 transition-colors">
              {groupByOpen ? <ChevronDown className="w-3.5 h-3.5" /> : <ChevronRight className="w-3.5 h-3.5" />}
              <span className="text-xs font-semibold">GROUP BY</span>
              {groupByState.fields.length > 0 && (
                <Badge variant="secondary" className="text-[10px] h-4 px-1.5">
                  {groupByState.fields.length} + {groupByState.aggregates.length} agg
                </Badge>
              )}
            </CollapsibleTrigger>
            <CollapsibleContent className="pt-2">
              <GroupByBuilder state={groupByState} onChange={setGroupBy} availableFields={availableFields} />
            </CollapsibleContent>
          </Collapsible>
        </div>
      )}
    </div>
  );
}

function countConditions(group: WhereGroup): number {
  return group.conditions.length + group.groups.reduce((sum, g) => sum + countConditions(g), 0);
}

/** Exported for use in BondQuery to serialize conditions into the request data */
export function serializeConditions(output: ConditionOutput, fields: FieldDef[] = QUERY_FIELDS): Record<string, unknown> {
  if (output.rawSql?.trim()) {
    return { conditions_raw: output.rawSql.trim() };
  }

  const result: Record<string, unknown> = {};

  if (output.where && hasContent(output.where)) {
    result.where = serializeWhereGroup(output.where);
  }

  if (output.orderBy && output.orderBy.length > 0) {
    result.order_by = output.orderBy.map((o) => ({
      field: o.field,
      direction: o.direction,
    }));
  }

  if (output.groupBy) {
    if (output.groupBy.fields.length > 0) {
      result.group_by = output.groupBy.fields;
    }
    if (output.groupBy.aggregates.length > 0) {
      result.aggregates = output.groupBy.aggregates.map((a) => ({
        func: a.func,
        field: a.field,
      }));
    }
  }

  return result;
}

function serializeWhereGroup(group: WhereGroup): Record<string, unknown> {
  const conditions = group.conditions
    .filter((c) => c.value.trim() || UNARY_OPS.includes(c.operator))
    .map((c) => {
      const base: Record<string, unknown> = { field: c.field, op: c.operator };
      if (!UNARY_OPS.includes(c.operator)) {
        base.value = c.value.trim();
        if (c.operator === "BETWEEN" && c.value2) base.value2 = c.value2.trim();
      }
      return base;
    });

  const nestedGroups = group.groups
    .filter(hasContent)
    .map(serializeWhereGroup);

  return {
    logic: group.logic,
    conditions,
    groups: nestedGroups,
  };
}
