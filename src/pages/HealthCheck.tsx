import { useState } from "react";
import { healthCheck, type HealthStatus } from "@/lib/api";
import { Button } from "@/components/ui/button";
import { Activity, CheckCircle2, XCircle, Loader2 } from "lucide-react";

export default function HealthCheckPage() {
  const [status, setStatus] = useState<HealthStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const runCheck = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await healthCheck();
      setStatus(res);
    } catch (e: any) {
      setError(e.message);
      setStatus(null);
    } finally {
      setLoading(false);
    }
  };

  const isHealthy = (val: string) =>
    ["healthy", "ok", "running", "available", "true"].includes(val?.toLowerCase?.());

  return (
    <div className="p-8 max-w-3xl mx-auto">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-3">
          <Activity className="w-6 h-6 text-primary" />
          Health Check
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          Monitor the status of backend services
        </p>
      </div>

      <Button onClick={runCheck} disabled={loading} className="mb-6">
        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Activity className="w-4 h-4 mr-2" />}
        Execute Health Check
      </Button>

      {error && (
        <div className="enterprise-card p-4 mb-6 border-destructive/30 bg-destructive/5">
          <p className="text-destructive text-sm font-medium">{error}</p>
        </div>
      )}

      {status && (
        <div className="space-y-3">
          {Object.entries(status).map(([key, val]) => {
            const healthy = isHealthy(String(val));
            return (
              <div
                key={key}
                className={`enterprise-card p-4 flex items-center justify-between ${
                  healthy ? "border-success/20" : "border-destructive/20"
                }`}
              >
                <div className="flex items-center gap-3">
                  {healthy ? (
                    <CheckCircle2 className="w-5 h-5 text-success" />
                  ) : (
                    <XCircle className="w-5 h-5 text-destructive" />
                  )}
                  <div>
                    <p className="text-sm font-medium text-foreground capitalize">
                      {key.replace(/_/g, " ")}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">{String(val)}</p>
                  </div>
                </div>
                <span
                  className={`text-xs font-medium px-2.5 py-1 rounded-full border ${
                    healthy ? "status-healthy" : "status-unhealthy"
                  }`}
                >
                  {healthy ? "Healthy" : "Unhealthy"}
                </span>
              </div>
            );
          })}
        </div>
      )}

      {!status && !error && !loading && (
        <div className="enterprise-card p-12 text-center">
          <Activity className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground text-sm">
            Click the button above to check service health
          </p>
        </div>
      )}
    </div>
  );
}
