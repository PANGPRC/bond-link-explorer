import { useState } from "react";
import { bondUnified } from "@/lib/api";
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
import { Database, Plus, Pencil, Trash2, Loader2, CheckCircle2, AlertTriangle } from "lucide-react";
import DynamicParams, { type ParamRow, BOND_FIELDS } from "@/components/DynamicParams";

type OpType = "insert" | "update" | "delete";

const OP_CONFIG: Record<OpType, { label: string; icon: typeof Plus; color: string }> = {
  insert: { label: "Create", icon: Plus, color: "text-success" },
  update: { label: "Update", icon: Pencil, color: "text-primary" },
  delete: { label: "Delete", icon: Trash2, color: "text-destructive" },
};

// Fields available for create/update (exclude query-only fields like sort)
const CRUD_FIELDS = BOND_FIELDS.filter(
  (f) => !["sort_field", "sort_order"].includes(f.value)
);

export default function BondCrudPage() {
  const [opType, setOpType] = useState<OpType>("insert");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; msg: string } | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Dynamic params for insert/update
  const [params, setParams] = useState<ParamRow[]>([]);

  // Batch mode for insert
  const [batchMode, setBatchMode] = useState(false);
  const [batchJson, setBatchJson] = useState("");

  // Filter for update/delete
  const [filterBondId, setFilterBondId] = useState("");

  const resetForm = () => {
    setParams([]);
    setBatchJson("");
    setFilterBondId("");
    setResult(null);
  };

  const paramsToRecord = (rows: ParamRow[]): Record<string, unknown> => {
    const record: Record<string, unknown> = {};
    rows.forEach((r) => {
      if (r.value.trim()) {
        // Auto-convert numeric fields
        if (r.field === "issue_size" || r.field === "coupon_rate") {
          record[r.field] = Number(r.value);
        } else {
          record[r.field] = r.value.trim();
        }
      }
    });
    return record;
  };

  const buildInsertData = () => {
    if (batchMode) {
      try {
        const parsed = JSON.parse(batchJson);
        return { records: Array.isArray(parsed) ? parsed : [parsed] };
      } catch {
        throw new Error("Invalid JSON format for batch import");
      }
    }
    const record = paramsToRecord(params);
    if (!record.bond_code || !record.bond_name) {
      throw new Error("Bond Code and Bond Name are required");
    }
    return { records: [record] };
  };

  const buildUpdateData = () => {
    if (!filterBondId.trim()) throw new Error("Filter condition (Bond ID) is required for update");
    const updates = paramsToRecord(params);
    if (Object.keys(updates).length === 0) throw new Error("At least one field must be specified for update");
    return { filter: { bond_id: filterBondId.trim() }, updates };
  };

  const buildDeleteData = () => {
    if (!filterBondId.trim()) throw new Error("Filter condition (Bond ID) is required for deletion");
    return { filter: { bond_id: filterBondId.trim() } };
  };

  const execute = async () => {
    setResult(null);
    try {
      let data: Record<string, unknown>;
      if (opType === "insert") data = buildInsertData();
      else if (opType === "update") data = buildUpdateData();
      else data = buildDeleteData();

      setLoading(true);
      const res = await bondUnified({ link_type: "L03", op_type: opType, data });
      if (res.code !== 200) throw new Error(res.msg);
      setResult({ success: true, msg: res.msg || "Operation successful" });
    } catch (e: any) {
      setResult({ success: false, msg: e.message });
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = () => {
    if (opType === "delete") {
      setDeleteConfirmOpen(true);
    } else {
      execute();
    }
  };

  return (
    <div className="p-8 max-w-4xl">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-3">
          <Database className="w-6 h-6 text-primary" />
          Bond CRUD Operations
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Create, update, and delete bond records via L03 link
        </p>
      </div>

      {/* Operation Tabs */}
      <div className="flex gap-2 mb-6">
        {(Object.keys(OP_CONFIG) as OpType[]).map((op) => {
          const config = OP_CONFIG[op];
          const Icon = config.icon;
          return (
            <button
              key={op}
              onClick={() => { setOpType(op); setResult(null); setParams([]); }}
              className={`flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
                opType === op
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-foreground border-border hover:bg-accent"
              }`}
            >
              <Icon className="w-4 h-4" />
              {config.label}
            </button>
          );
        })}
      </div>

      {/* Form */}
      <div className="enterprise-card p-6 mb-6">
        {opType === "insert" && (
          <div className="space-y-4">
            <div className="flex items-center gap-3 mb-2">
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={batchMode} onChange={(e) => setBatchMode(e.target.checked)} className="rounded" />
                Batch Import (JSON)
              </label>
            </div>

            {batchMode ? (
              <div className="space-y-2">
                <Label>Batch JSON Data</Label>
                <Textarea
                  value={batchJson}
                  onChange={(e) => setBatchJson(e.target.value)}
                  placeholder={`[{"bond_code": "019673", "bond_name": "国债", "issue_size": 1000000}]`}
                  rows={6}
                  className="font-mono text-sm"
                />
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <Label className="text-sm">Record Fields</Label>
                  <span className="text-xs text-muted-foreground">Bond Code and Bond Name are required</span>
                </div>
                <DynamicParams
                  params={params}
                  onChange={setParams}
                  availableFields={CRUD_FIELDS}
                />
                {params.length === 0 && (
                  <p className="text-xs text-muted-foreground italic">Click "Add Parameter" to add fields for the new record.</p>
                )}
              </div>
            )}
          </div>
        )}

        {opType === "update" && (
          <div className="space-y-4">
            <div className="enterprise-card p-3 border-warning/30 bg-warning/5 flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-warning flex-shrink-0" />
              <span className="text-sm text-foreground">Filter condition is <strong>required</strong> – full-table update is prohibited</span>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Bond ID (Filter) <span className="text-destructive">*</span></Label>
              <Input value={filterBondId} onChange={(e) => setFilterBondId(e.target.value)} placeholder="e.g. 1" />
            </div>
            <div className="border-t border-border pt-4">
              <div className="flex items-center justify-between mb-3">
                <Label className="text-sm">Fields to Update</Label>
                <span className="text-xs text-muted-foreground">Add fields you want to change</span>
              </div>
              <DynamicParams
                params={params}
                onChange={setParams}
                availableFields={CRUD_FIELDS}
              />
              {params.length === 0 && (
                <p className="text-xs text-muted-foreground italic mt-2">Click "Add Parameter" to select fields to update.</p>
              )}
            </div>
          </div>
        )}

        {opType === "delete" && (
          <div className="space-y-4">
            <div className="enterprise-card p-3 border-destructive/30 bg-destructive/5 flex items-center gap-2 mb-2">
              <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
              <span className="text-sm text-foreground">
                Filter condition is <strong>required</strong> – this performs logical deletion (is_deleted=1)
              </span>
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Bond ID (Filter) <span className="text-destructive">*</span></Label>
              <Input value={filterBondId} onChange={(e) => setFilterBondId(e.target.value)} placeholder="e.g. 1" />
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-2 mt-6 pt-4 border-t border-border">
          <Button variant="outline" size="sm" onClick={resetForm}>Reset</Button>
          <Button
            size="sm"
            onClick={handleSubmit}
            disabled={loading}
            variant={opType === "delete" ? "destructive" : "default"}
          >
            {loading && <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" />}
            {OP_CONFIG[opType].label}
          </Button>
        </div>
      </div>

      {/* Result */}
      {result && (
        <div className={`enterprise-card p-4 flex items-center gap-3 ${
          result.success ? "border-success/30 bg-success/5" : "border-destructive/30 bg-destructive/5"
        }`}>
          {result.success ? (
            <CheckCircle2 className="w-5 h-5 text-success flex-shrink-0" />
          ) : (
            <AlertTriangle className="w-5 h-5 text-destructive flex-shrink-0" />
          )}
          <span className={`text-sm ${result.success ? "text-success" : "text-destructive"}`}>
            {result.msg}
          </span>
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Deletion</DialogTitle>
            <DialogDescription>
              Are you sure you want to delete the bond record with ID "{filterBondId}"? This will perform a logical deletion (is_deleted=1).
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmOpen(false)}>Cancel</Button>
            <Button variant="destructive" onClick={() => { setDeleteConfirmOpen(false); execute(); }}>
              Confirm Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
