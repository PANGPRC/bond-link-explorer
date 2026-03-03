// ── Shared types for the condition builder ──

export interface FieldDef {
  value: string;
  label: string;
  type: "string" | "number" | "date";
}

/** All bond fields with type metadata */
export const QUERY_FIELDS: FieldDef[] = [
  { value: "bond_id", label: "Bond ID", type: "number" },
  { value: "bond_code", label: "Bond Code", type: "string" },
  { value: "bond_name", label: "Bond Name", type: "string" },
  { value: "issue_size", label: "Issue Size", type: "number" },
  { value: "credit_rating", label: "Credit Rating", type: "string" },
  { value: "maturity_date", label: "Maturity Date", type: "date" },
  { value: "counterparty_name", label: "Counterparty Name", type: "string" },
  { value: "issue_year", label: "Issuance Year", type: "number" },
  { value: "coupon_rate", label: "Coupon Rate", type: "number" },
  { value: "bond_type", label: "Bond Type", type: "string" },
  { value: "issue_date", label: "Issue Date", type: "date" },
  { value: "issuer_name", label: "Issuer Name", type: "string" },
  { value: "currency", label: "Currency", type: "string" },
  { value: "market", label: "Market", type: "string" },
];

export const NUMERIC_FIELDS = QUERY_FIELDS.filter((f) => f.type === "number");

// ── WHERE ──

export type WhereOperator =
  | "="
  | "!="
  | ">"
  | ">="
  | "<"
  | "<="
  | "LIKE"
  | "NOT LIKE"
  | "IN"
  | "NOT IN"
  | "IS NULL"
  | "IS NOT NULL"
  | "BETWEEN";

export const STRING_OPS: WhereOperator[] = ["=", "!=", "LIKE", "NOT LIKE", "IN", "NOT IN", "IS NULL", "IS NOT NULL"];
export const NUMBER_OPS: WhereOperator[] = ["=", "!=", ">", ">=", "<", "<=", "IN", "NOT IN", "BETWEEN", "IS NULL", "IS NOT NULL"];
export const DATE_OPS: WhereOperator[] = ["=", "!=", ">", ">=", "<", "<=", "BETWEEN", "IS NULL", "IS NOT NULL"];

export function getOpsForType(type: FieldDef["type"]): WhereOperator[] {
  switch (type) {
    case "number": return NUMBER_OPS;
    case "date": return DATE_OPS;
    default: return STRING_OPS;
  }
}

export const UNARY_OPS: WhereOperator[] = ["IS NULL", "IS NOT NULL"];

export interface WhereCondition {
  id: string;
  field: string;
  operator: WhereOperator;
  value: string;
  value2?: string; // for BETWEEN
}

export type LogicOp = "AND" | "OR";

export interface WhereGroup {
  id: string;
  logic: LogicOp;
  conditions: WhereCondition[];
  groups: WhereGroup[]; // nested groups
}

// ── ORDER BY ──

export type SortDir = "ASC" | "DESC";

export interface OrderByItem {
  id: string;
  field: string;
  direction: SortDir;
}

// ── GROUP BY ──

export type AggFunc = "COUNT" | "SUM" | "AVG" | "MIN" | "MAX";

export interface AggregateItem {
  id: string;
  func: AggFunc;
  field: string;
}

export interface GroupByState {
  fields: string[];
  aggregates: AggregateItem[];
}

// ── Condition builder output ──

export interface ConditionOutput {
  where?: WhereGroup;
  orderBy?: OrderByItem[];
  groupBy?: GroupByState;
  rawSql?: string; // manual mode
}

// ── Validation ──

export interface ValidationError {
  path: string;
  message: string;
}

// ── Helpers ──

let _uid = 0;
export const uid = () => `cond_${++_uid}_${Date.now()}`;

export function newCondition(): WhereCondition {
  return { id: uid(), field: QUERY_FIELDS[0].value, operator: "=", value: "" };
}

export function newGroup(logic: LogicOp = "AND"): WhereGroup {
  return { id: uid(), logic, conditions: [newCondition()], groups: [] };
}
