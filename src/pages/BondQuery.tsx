import { useState, useCallback } from "react";
import { bondUnified, type BondMeta } from "@/lib/api";
import { Button } from "@/components/ui/button";
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
import DynamicParams, { type ParamRow, BOND_FIELDS } from "@/components/DynamicParams";

type QueryMode = "structured" | "natural";
type StructuredLink = "L01" | "L03";
type NaturalLink = "L02" | "L04";

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
  const [queryMode, setQueryMode] = useState<QueryMode>("structured");
  const [structuredLink, setStructuredLink] = useState<StructuredLink>("L03");
  const [naturalLink, setNaturalLink] = useState<NaturalLink>("L04");

  const [loading, setLoading] = useState(false);
  const [results, setResults] = useState<Record<string, unknown>[]>([]);
  const [meta, setMeta] = useState<BondMeta | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showMeta, setShowMeta] = useState(false);

  // Dynamic params for structured query
  const [params, setParams] = useState<ParamRow[]>([]);

  // Natural language
  const [nlQuery, setNlQuery] = useState("");

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const activeLinkType = queryMode === "structured" ? structuredLink : naturalLink;

  const buildData = useCallback(() => {
    if (queryMode === "natural") {
      return { query: nlQuery, page, page_size: pageSize };
    }
    const data: Record<string, unknown> = { page, page_size: pageSize };
    params.forEach((p) => {
      if (p.value.trim()) data[p.field] = p.value.trim();
    });
    return data;
  }, [queryMode, nlQuery, params, page, pageSize]);

  const executeQuery = async (p = page) => {
    setLoading(true);
    setError(null);
    try {
      const res = await bondUnified({
        link_type: activeLinkType,
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
    setParams([]);
    setNlQuery("");
    setPage(1);
    setResults([]);
    setMeta(null);
    setError(null);
  };

  const totalPages = meta ? Math.ceil(meta.total / meta.page_size) : 0;

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

      {/* Level 1: Query Mode */}
      <div className="flex gap-2 mb-4">
        <button
          onClick={() => { setQueryMode("structured"); setResults([]); setMeta(null); setError(null); }}
          className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
            queryMode === "structured"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card text-foreground border-border hover:bg-accent"
          }`}
        >
          Direct Query
        </button>
        <button
          onClick={() => { setQueryMode("natural"); setResults([]); setMeta(null); setError(null); }}
          className={`px-4 py-2 rounded-md text-sm font-medium border transition-colors ${
            queryMode === "natural"
              ? "bg-primary text-primary-foreground border-primary"
              : "bg-card text-foreground border-border hover:bg-accent"
          }`}
        >
          Natural Language
        </button>
      </div>

      {/* Level 2: Link Selection */}
      <div className="flex gap-2 mb-6 items-center">
        <span className="text-xs text-muted-foreground mr-1">Link:</span>
        {queryMode === "structured" ? (
          <>
            {(["L01", "L03"] as StructuredLink[]).map((lt) => (
              <button
                key={lt}
                onClick={() => setStructuredLink(lt)}
                className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                  structuredLink === lt
                    ? "bg-accent text-accent-foreground border-primary/50"
                    : "bg-card text-muted-foreground border-border hover:bg-accent/50"
                }`}
              >
                {lt} {lt === "L03" && <span className="text-[10px] opacity-70">(Recommended)</span>}
              </button>
            ))}
            <span className="text-xs text-muted-foreground ml-2">
              {structuredLink === "L01" ? "Fallback – high performance, structured parameters" : "Core – production-level structured query"}
            </span>
          </>
        ) : (
          <>
            {(["L02", "L04"] as NaturalLink[]).map((lt) => (
              <button
                key={lt}
                onClick={() => setNaturalLink(lt)}
                className={`px-3 py-1.5 rounded text-xs font-medium border transition-colors ${
                  naturalLink === lt
                    ? "bg-accent text-accent-foreground border-primary/50"
                    : "bg-card text-muted-foreground border-border hover:bg-accent/50"
                } ${lt === "L02" ? "border-destructive/40" : ""}`}
              >
                {lt}
                {lt === "L02" && <span className="ml-1 text-destructive">⚠</span>}
                {lt === "L04" && <span className="text-[10px] opacity-70 ml-1">(Recommended)</span>}
              </button>
            ))}
            <span className="text-xs text-muted-foreground ml-2">
              {naturalLink === "L02" ? "Testing only – disabled in production" : "Chinese natural language to SQL"}
            </span>
          </>
        )}
      </div>

      {/* Warning for L02 */}
      {queryMode === "natural" && naturalLink === "L02" && (
        <div className="enterprise-card p-3 mb-4 border-destructive/30 bg-destructive/5 flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 text-destructive flex-shrink-0" />
          <span className="text-destructive text-sm font-medium">
            Testing Only – This link is disabled in the production environment
          </span>
        </div>
      )}

      {/* Query Form */}
      <div className="enterprise-card p-6 mb-6">
        {queryMode === "natural" ? (
          <div className="space-y-3">
            <Label>Natural Language Query</Label>
            <Textarea
              value={nlQuery}
              onChange={(e) => setNlQuery(e.target.value)}
              placeholder={naturalLink === "L04" ? "例如：查询信用评级为AAA的所有债券" : "Enter natural language query for LLM testing..."}
              rows={3}
              className="font-mono text-sm"
            />
          </div>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <Label className="text-sm">Query Parameters</Label>
              <span className="text-xs text-muted-foreground">Add parameters using the + button below</span>
            </div>
            <DynamicParams
              params={params}
              onChange={setParams}
              availableFields={BOND_FIELDS}
            />
            {params.length === 0 && (
              <p className="text-xs text-muted-foreground italic">No parameters added. Click "Add Parameter" to add query conditions, or query directly for all records.</p>
            )}
          </div>
        )}

        {/* Pagination controls */}
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
