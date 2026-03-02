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

type OpType = "insert" | "update" | "delete";

const OP_CONFIG: Record<OpType, { label: string; icon: typeof Plus; color: string }> = {
  insert: { label: "Create", icon: Plus, color: "text-success" },
  update: { label: "Update", icon: Pencil, color: "text-primary" },
  delete: { label: "Delete", icon: Trash2, color: "text-destructive" },
};

export default function BondCrudPage() {
  const [opType, setOpType] = useState<OpType>("insert");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ success: boolean; msg: string } | null>(null);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);

  // Insert fields
  const [bondCode, setBondCode] = useState("");
  const [bondName, setBondName] = useState("");
  const [issueSize, setIssueSize] = useState("");
  const [creditRating, setCreditRating] = useState("");
  const [maturityDate, setMaturityDate] = useState("");
  const [counterpartyName, setCounterpartyName] = useState("");
  const [batchMode, setBatchMode] = useState(false);
  const [batchJson, setBatchJson] = useState("");

  // Update/Delete filter
  const [filterBondId, setFilterBondId] = useState("");

  // Update fields
  const [updateBondName, setUpdateBondName] = useState("");
  const [updateCreditRating, setUpdateCreditRating] = useState("");
  const [updateCounterparty, setUpdateCounterparty] = useState("");

  const resetForm = () => {
    setBondCode(""); setBondName(""); setIssueSize("");
    setCreditRating(""); setMaturityDate(""); setCounterpartyName("");
    setBatchJson(""); setFilterBondId("");
    setUpdateBondName(""); setUpdateCreditRating(""); setUpdateCounterparty("");
    setResult(null);
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
    if (!bondCode || !bondName) throw new Error("Bond Code and Bond Name are required");
    const record: Record<string, unknown> = { bond_code: bondCode, bond_name: bondName };
    if (issueSize) record.issue_size = Number(issueSize);
    if (creditRating) record.credit_rating = creditRating;
    if (maturityDate) record.maturity_date = maturityDate;
    if (counterpartyName) record.counterparty_name = counterpartyName;
    return { records: [record] };
  };

  const buildUpdateData = () => {
    if (!filterBondId.trim()) throw new Error("Filter condition (Bond ID) is required for update");
    const updates: Record<string, unknown> = {};
    if (updateBondName) updates.bond_name = updateBondName;
    if (updateCreditRating) updates.credit_rating = updateCreditRating;
    if (updateCounterparty) updates.counterparty_name = updateCounterparty;
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
              onClick={() => { setOpType(op); setResult(null); }}
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
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Bond Code <span className="text-destructive">*</span></Label>
                  <Input value={bondCode} onChange={(e) => setBondCode(e.target.value)} placeholder="e.g. 019673" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Bond Name <span className="text-destructive">*</span></Label>
                  <Input value={bondName} onChange={(e) => setBondName(e.target.value)} placeholder="e.g. 国债2024" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Issue Size</Label>
                  <Input type="number" value={issueSize} onChange={(e) => setIssueSize(e.target.value)} placeholder="e.g. 1000000" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Credit Rating</Label>
                  <Input value={creditRating} onChange={(e) => setCreditRating(e.target.value)} placeholder="e.g. AAA" />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Maturity Date</Label>
                  <Input type="date" value={maturityDate} onChange={(e) => setMaturityDate(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Counterparty Name</Label>
                  <Input value={counterpartyName} onChange={(e) => setCounterpartyName(e.target.value)} placeholder="e.g. 中国银行" />
                </div>
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
              <p className="text-xs text-muted-foreground mb-3">Fields to update (fill only fields you want to change):</p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <Label className="text-xs">Bond Name</Label>
                  <Input value={updateBondName} onChange={(e) => setUpdateBondName(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Credit Rating</Label>
                  <Input value={updateCreditRating} onChange={(e) => setUpdateCreditRating(e.target.value)} />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs">Counterparty Name</Label>
                  <Input value={updateCounterparty} onChange={(e) => setUpdateCounterparty(e.target.value)} />
                </div>
              </div>
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
