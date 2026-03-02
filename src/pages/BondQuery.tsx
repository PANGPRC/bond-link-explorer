import { useState, useCallback } from "react";
import { bondUnified, type BondResponse, type BondMeta } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Search, Loader2, ChevronDown, ChevronUp, RotateCcw, AlertTriangle } from "lucide-react";

type LinkType = "L01" | "L02" | "L03" | "L04";

const LINK_DESCRIPTIONS: Record<LinkType, { label: string; desc: string; warning?: string }> = {
  L01: { label: "L01 – Structured Direct", desc: "High performance, structured query parameters" },
  L02: { label: "L02 – LLM Testing", desc: "Local LLM engine verification", warning: "Testing Only – Disabled in Production" },
  L03: { label: "L03 – Core Query", desc: "Production-level structured query (Recommended)" },
  L04: { label: "L04 – Natural Language", desc: "Chinese natural language to SQL (Recommended)" },
};

const DISPLAY_COLUMNS = [
  { key: "bond_id", label: "Bond ID" },
  { key: "bond_code", label: "Bond Code" },
  { key: "bond_name", label: "Bond Name" },
  { key: "issue_size", label: "Issue Size" },
  { key: "credit_rating", label: "Credit Rating" },
  { key: "maturity_date", label: "Maturity Date" },
  { key: "counterparty_name", label: "Counterparty" },
];

export default function BondQueryPage() {
  const [linkType, setLinkType] = useState<LinkType>("L04");
  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Record<string, unknown>[]>([]);
  const [meta, setMeta] = useState<BondMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showMeta, setShowMeta] = useState(false);

  // Structured form fields (L01/L03)
  const [bondCode, setBondCode] = useState("");
  const [bondName, setBondName] = useState("");
  const [issueYear, setIssueYear] = useState("");
  const [creditRating, setCreditRating] = useState("");
  const [maturityDate, setMaturityDate] = useState("");
  const [sortField, setSortField] = useState("");
  const [sortOrder, setSortOrder] = useState("asc");
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  // Natural language (L02/L04)
  const [nlQuery, setNlQuery] = useState("");

  const isNLLink = linkType === "L02" || linkType === "L04";

  const buildData = useCallback(() => {
    if (isNLLink) {
      return { query: nlQuery, page, page_size: pageSize };
    }
    const data: Record<string, unknown> = { page, page_size: pageSize };
    if (bondCode) data.bond_code = bondCode;
    if (bondName) data.bond_name = bondName;
    if (issueYear) data.issue_year = issueYear;
    if (creditRating) data.credit_rating = creditRating;
    if (maturityDate) data.maturity_date = maturityDate;
    if (sortField) {
      data.sort_field = sortField;
      data.sort_order = sortOrder;
    }
    return data;
  }, [isNLLink, nlQuery, bondCode, bondName, issueYear, creditRating, maturityDate, sortField, sortOrder, page, pageSize]);

  const executeQuery = async (p = page) => {
    setLoading(true);
    setError(null);
    try {
      const res = await bondUnified({
        link_type: linkType,
        op_type: "query",
        data: { ...buildData(), page: p },
      });
      if (res.code !== 200) throw new Error(res.msg);
      setResults(res.data || []);
      setMeta(res.meta);
      setPage(p);
    } catch (e: any) {
      setError(e.message);
      setResults([]);
      setMeta(null);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setBondCode("");
    setBondName("");
    setIssueYear("");
    setCreditRating("");
    setMaturityDate("");
    setSortField("");
    setSortOrder("asc");
    setNlQuery("");
    setPage(1);
    setResults([]);
    setMeta(null);
    setError(null);
  };

  const totalPages = meta ? Math.ceil(meta.total / meta.page_size) : 0;

  // Detect all column keys from results
  const columnKeys = results.length > 0
    ? DISPLAY_COLUMNS.filter((c) => results.some((r) => r[c.key] !== undefined))
    : DISPLAY_COLUMNS;

  return (
    <div className="p-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-3">
          <Search className="w-6 h-6 text-primary" />
          Bond Query
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Query bond data across all link types
        </p>
      </div>

      {/* Link Type Tabs */}
      <div className="flex gap-2 mb-6 flex-wrap">
        {(Object.keys(LINK_DESCRIPTIONS) as LinkType[]).map((lt) => {
          const info = LINK_DESCRIPTIONS[lt];
          return (
            <button
              key={lt}
              onClick={() => { setLinkType(lt); setResults([]); setMeta(null); setError(null); }}
              className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
                linkType === lt
                  ? "bg-primary text-primary-foreground border-primary"
                  : "bg-card text-foreground border-border hover:bg-accent"
              } ${lt === "L02" ? "border-destructive/40" : ""}`}
            >
              {info.label}
              {lt === "L02" && <span className="ml-1.5 text-xs text-destructive">⚠</span>}
            </button>
          );
        })}
      </div>

      {/* Warning for L02 */}
      {linkType === "L02" && (
        <div className="enterprise-card p-3 mb-4 border-destructive/30 bg-destructive/5 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
          <span className="text-destructive text-sm font-medium">
            Testing Only – This link is disabled in the production environment
          </span>
        </div>
      )}

      {/* Query Form */}
      <div className="enterprise-card p-6 mb-6">
        <div className="text-sm font-medium text-muted-foreground mb-4">
          {LINK_DESCRIPTIONS[linkType].desc}
        </div>

        {isNLLink ? (
          <div className="space-y-3">
            <Label>Natural Language Query</Label>
            <Textarea
              value={nlQuery}
              onChange={(e) => setNlQuery(e.target.value)}
              placeholder={linkType === "L04" ? "例如：查询信用评级为AAA的所有债券" : "Enter natural language query for LLM testing..."}
              rows={3}
              className="font-mono text-sm"
            />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="space-y-1.5">
              <Label className="text-xs">Bond Code</Label>
              <Input value={bondCode} onChange={(e) => setBondCode(e.target.value)} placeholder="e.g. 019673" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Bond Name</Label>
              <Input value={bondName} onChange={(e) => setBondName(e.target.value)} placeholder="e.g. 国债" />
            </div>
            <div className="space-y-1.5">
              <Label className="text-xs">Issuance Year</Label>
              <Input value={issueYear} onChange={(e) => setIssueYear(e.target.value)} placeholder="e.g. 2024" />
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
              <Label className="text-xs">Sort Field</Label>
              <div className="flex gap-2">
                <Input value={sortField} onChange={(e) => setSortField(e.target.value)} placeholder="e.g. issue_size" className="flex-1" />
                <Select value={sortOrder} onValueChange={setSortOrder}>
                  <SelectTrigger className="w-24">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="asc">ASC</SelectItem>
                    <SelectItem value="desc">DESC</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>
        )}

        {/* Pagination controls in form */}
        <div className="flex items-center gap-4 mt-4 pt-4 border-t border-border">
          <div className="flex items-center gap-2">
            <Label className="text-xs text-muted-foreground">Page Size</Label>
            <Select value={String(pageSize)} onValueChange={(v) => setPageSize(Number(v))}>
              <SelectTrigger className="w-20 h-8 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {[10, 20, 50, 100].map((s) => (
                  <SelectItem key={s} value={String(s)}>{s}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="flex gap-2 ml-auto">
            <Button variant="outline" size="sm" onClick={resetForm}>
              <RotateCcw className="w-3.5 h-3.5 mr-1.5" /> Reset
            </Button>
            <Button size="sm" onClick={() => executeQuery(1)} disabled={loading}>
              {loading ? <Loader2 className="w-3.5 h-3.5 mr-1.5 animate-spin" /> : <Search className="w-3.5 h-3.5 mr-1.5" />}
              Query
            </Button>
          </div>
        </div>
      </div>

      {/* Error */}
      {error && (
        <div className="enterprise-card p-4 mb-4 border-destructive/30 bg-destructive/5">
          <p className="text-destructive text-sm">{error}</p>
        </div>
      )}

      {/* Results Table */}
      {results.length > 0 && (
        <div className="enterprise-card overflow-hidden mb-4">
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow className="bg-muted/50">
                  {columnKeys.map((col) => (
                    <TableHead key={col.key} className="text-xs font-semibold whitespace-nowrap">
                      {col.label}
                    </TableHead>
                  ))}
                </TableRow>
              </TableHeader>
              <TableBody>
                {results.map((row, i) => (
                  <TableRow key={i} className="hover:bg-muted/30">
                    {columnKeys.map((col) => (
                      <TableCell key={col.key} className="text-sm font-mono whitespace-nowrap">
                        {row[col.key] != null ? String(row[col.key]) : "—"}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>

          {/* Pagination */}
          {meta && totalPages > 1 && (
            <div className="flex items-center justify-between p-4 border-t border-border">
              <span className="text-xs text-muted-foreground">
                Total: {meta.total} records | Page {meta.page} of {totalPages}
              </span>
              <div className="flex gap-1">
                <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => executeQuery(page - 1)}>
                  Prev
                </Button>
                <Button variant="outline" size="sm" disabled={page >= totalPages} onClick={() => executeQuery(page + 1)}>
                  Next
                </Button>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Meta Panel */}
      {meta && (
        <div className="enterprise-card overflow-hidden">
          <button
            onClick={() => setShowMeta(!showMeta)}
            className="w-full flex items-center justify-between p-4 text-sm font-medium text-muted-foreground hover:bg-muted/30 transition-colors"
          >
            <span>Operation & Maintenance Info</span>
            {showMeta ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          {showMeta && (
            <div className="meta-panel mx-4 mb-4">
              <div className="space-y-2 text-xs">
                <div><span className="text-muted-foreground">Response Time:</span> {meta.cost?.toFixed(3)}s</div>
                <div><span className="text-muted-foreground">Total Records:</span> {meta.total}</div>
                <div><span className="text-muted-foreground">Pagination:</span> Page {meta.page}, Size {meta.page_size}</div>
                {meta.sql && (
                  <div>
                    <span className="text-muted-foreground">SQL:</span>
                    <pre className="mt-1 p-2 bg-background rounded text-xs overflow-x-auto whitespace-pre-wrap break-all">
                      {meta.sql}
                    </pre>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Empty state */}
      {results.length === 0 && !error && !loading && (
        <div className="enterprise-card p-12 text-center">
          <Search className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground text-sm">Configure your query parameters and click Query</p>
        </div>
      )}
    </div>
  );
}
