import { useState } from "react";
import { unifiedHealthCheck, type UnifiedHealthResponse, type L03Status, type L04Status } from "@/lib/api";
import { formatTimestamp, getStatusClass } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Activity, CheckCircle2, AlertTriangle, XCircle, Loader2, Copy } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useToast } from "@/hooks/use-toast";

export default function HealthCheckPage() {
  const [healthData, setHealthData] = useState<UnifiedHealthResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // 执行统一健康检查
  const runUnifiedCheck = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await unifiedHealthCheck();
      setHealthData(res);
    } catch (e: any) {
      setError(e.message);
      setHealthData(null);
    } finally {
      setLoading(false);
    }
  };

  // 复制SQL到剪贴板
  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text);
    toast({
      title: "复制成功",
      description: `${label}已复制到剪贴板`,
      duration: 2000,
    });
  };

  // 状态图标映射
  const getStatusIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle2 className="w-5 h-5 text-green-600" />;
      case "degraded":
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case "unhealthy":
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return <Activity className="w-5 h-5 text-gray-600" />;
    }
  };

  return (
    <div className="p-8 max-w-6xl mx-auto">
      {/* 页面标题 */}
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground flex items-center gap-3">
          <Activity className="w-6 h-6 text-primary" />
          统一链路健康检查
        </h1>
        <p className="text-muted-foreground text-sm mt-1">
          监控L01/L02/L03/L04各链路的运行状态（数据库/LLM/CRUD生成器）
        </p>
      </div>

      {/* 检查按钮 */}
      <Button onClick={runUnifiedCheck} disabled={loading} className="mb-6">
        {loading ? <Loader2 className="w-4 h-4 mr-2 animate-spin" /> : <Activity className="w-4 h-4 mr-2" />}
        执行统一健康检查
      </Button>

      {/* 错误提示 */}
      {error && (
        <div className="p-4 mb-6 border border-red-200 bg-red-50 rounded-lg">
          <p className="text-red-600 text-sm font-medium flex items-center gap-2">
            <XCircle className="w-4 h-4" />
            {error}
          </p>
        </div>
      )}

      {/* 无数据状态 */}
      {!healthData && !error && !loading && (
        <div className="border rounded-lg p-12 text-center">
          <Activity className="w-10 h-10 text-muted-foreground mx-auto mb-3 opacity-40" />
          <p className="text-muted-foreground text-sm">
            点击上方按钮执行统一健康检查，查看各链路详细状态
          </p>
        </div>
      )}

      {/* 健康检查结果展示 */}
      {healthData && (
        <div className="space-y-6">
          {/* 整体状态卡片 */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center justify-between">
                <span>整体链路状态</span>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${getStatusClass(healthData.status)}`}>
                  {healthData.status.toUpperCase()}
                </span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <p className="text-sm text-muted-foreground">状态描述：</p>
                  <p className="text-sm font-medium">{healthData.message}</p>
                </div>
                <div>
                  <p className="text-sm text-muted-foreground">检查时间：</p>
                  <p className="text-sm font-medium">{formatTimestamp(healthData.timestamp)}</p>
                </div>
              </div>
            </CardContent>
          </Card>

          {/* 各链路详情Tabs */}
          <Tabs defaultValue="all" className="w-full">
            <TabsList className="mb-4">
              <TabsTrigger value="all">全部链路</TabsTrigger>
              <TabsTrigger value="L01">L01（结构化直查）</TabsTrigger>
              <TabsTrigger value="L02">L02（本地LLM查询）</TabsTrigger>
              <TabsTrigger value="L03">L03（CRUD生成器）</TabsTrigger>
              <TabsTrigger value="L04">L04（MCP查询）</TabsTrigger>
            </TabsList>

            {/* 全部链路概览 */}
            <TabsContent value="all" className="space-y-4">
              {Object.entries(healthData.link_status).map(([link, status]) => (
                <Card key={link}>
                  <CardHeader className="pb-2">
                    <CardTitle className="flex items-center gap-3">
                      {getStatusIcon(status.status)}
                      <span>链路 {link}</span>
                      <span className={`ml-auto px-2 py-0.5 rounded-full text-xs ${getStatusClass(status.status)}`}>
                        {status.status.toUpperCase()}
                      </span>
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="space-y-2 text-sm">
                      <p><span className="text-muted-foreground">状态描述：</span> {status.message}</p>
                      <p><span className="text-muted-foreground">最后检查时间：</span> {formatTimestamp(status.timestamp)}</p>

                      {/* L03 专属：SQL模板（类型守卫+断言） */}
                      {link === "L03" && (
                        <div className="mt-3 space-y-3">
                          <p className="font-medium text-sm">CRUD SQL模板：</p>
                          {Object.entries((status as L03Status).sql).map(([type, sql]) => (
                            <div key={type} className="relative">
                              <pre className="p-2 bg-gray-50 rounded text-xs overflow-x-auto">
                                {sql}
                              </pre>
                              <Button
                                variant="ghost"
                                size="sm"
                                className="absolute top-1 right-1 h-6 w-6 p-0"
                                onClick={() => copyToClipboard(sql, `${link} ${type} SQL`)}
                              >
                                <Copy className="h-3 w-3" />
                              </Button>
                            </div>
                          ))}
                        </div>
                      )}

                      {/* L04 专属：测试SQL+数据量（类型守卫+断言） */}
                      {link === "L04" && (
                        <div className="mt-3 space-y-3">
                          <p className="font-medium text-sm">测试SQL：</p>
                          <div className="relative">
                            <pre className="p-2 bg-gray-50 rounded text-xs overflow-x-auto">
                              {(status as L04Status).test_sql}
                            </pre>
                            <Button
                              variant="ghost"
                              size="sm"
                              className="absolute top-1 right-1 h-6 w-6 p-0"
                              onClick={() => copyToClipboard((status as L04Status).test_sql, `${link} 测试SQL`)}
                            >
                              <Copy className="h-3 w-3" />
                            </Button>
                          </div>
                          <p><span className="text-muted-foreground">测试数据量：</span> {(status as L04Status).data_count} 条</p>
                          <p><span className="text-muted-foreground">测试参数：</span>
                            <pre className="mt-1 p-2 bg-gray-50 rounded text-xs overflow-x-auto">
                              {JSON.stringify((status as L04Status).test_params, null, 2)}
                            </pre>
                          </p>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </TabsContent>

            {/* L01 详情 */}
            <TabsContent value="L01">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    {getStatusIcon(healthData.link_status.L01.status)}
                    <span>L01 链路（结构化直查）</span>
                    <span className={`ml-auto px-2 py-0.5 rounded-full text-xs ${getStatusClass(healthData.link_status.L01.status)}`}>
                      {healthData.link_status.L01.status.toUpperCase()}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p><span className="text-muted-foreground">状态描述：</span> {healthData.link_status.L01.message}</p>
                  <p><span className="text-muted-foreground">最后检查时间：</span> {formatTimestamp(healthData.link_status.L01.timestamp)}</p>
                  <p className="text-xs text-muted-foreground">备注：L01为非LLM结构化直查链路，性能最优，作为L04的兜底方案</p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* L02 详情 */}
            <TabsContent value="L02">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    {getStatusIcon(healthData.link_status.L02.status)}
                    <span>L02 链路（本地LLM查询）</span>
                    <span className={`ml-auto px-2 py-0.5 rounded-full text-xs ${getStatusClass(healthData.link_status.L02.status)}`}>
                      {healthData.link_status.L02.status.toUpperCase()}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p><span className="text-muted-foreground">状态描述：</span> {healthData.link_status.L02.message}</p>
                  <p><span className="text-muted-foreground">最后检查时间：</span> {formatTimestamp(healthData.link_status.L02.timestamp)}</p>
                  <p className="text-xs text-amber-600 bg-amber-50 p-2 rounded">
                    ⚠️ 注意：L02为测试专用链路，生产环境禁用，仅用于LLM能力验证和调试
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* L03 详情（直接用L03Status类型） */}
            <TabsContent value="L03">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    {getStatusIcon(healthData.link_status.L03.status)}
                    <span>L03 链路（CRUD生成器）</span>
                    <span className={`ml-auto px-2 py-0.5 rounded-full text-xs ${getStatusClass(healthData.link_status.L03.status)}`}>
                      {healthData.link_status.L03.status.toUpperCase()}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p><span className="text-muted-foreground">状态描述：</span> {healthData.link_status.L03.message}</p>
                  <p><span className="text-muted-foreground">最后检查时间：</span> {formatTimestamp(healthData.link_status.L03.timestamp)}</p>

                  <div className="mt-3 space-y-3">
                    <p className="font-medium text-sm">CRUD SQL模板（生产级）：</p>
                    {Object.entries(healthData.link_status.L03.sql).map(([type, sql]) => (
                      <div key={type} className="relative">
                        <p className="text-xs text-muted-foreground mb-1">{type.toUpperCase()}：</p>
                        <pre className="p-2 bg-gray-50 rounded text-xs overflow-x-auto">
                          {sql}
                        </pre>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="absolute top-1 right-1 h-6 w-6 p-0"
                          onClick={() => copyToClipboard(sql, `L03 ${type} SQL`)}
                        >
                          <Copy className="h-3 w-3" />
                        </Button>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-green-600 bg-green-50 p-2 rounded mt-3">
                    ✅ 推荐：L03为核心CRUD链路，支持严格参数校验，适合生产级新增/修改/删除操作
                  </p>
                </CardContent>
              </Card>
            </TabsContent>

            {/* L04 详情（直接用L04Status类型） */}
            <TabsContent value="L04">
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-3">
                    {getStatusIcon(healthData.link_status.L04.status)}
                    <span>L04 链路（MCP查询）</span>
                    <span className={`ml-auto px-2 py-0.5 rounded-full text-xs ${getStatusClass(healthData.link_status.L04.status)}`}>
                      {healthData.link_status.L04.status.toUpperCase()}
                    </span>
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3 text-sm">
                  <p><span className="text-muted-foreground">状态描述：</span> {healthData.link_status.L04.message}</p>
                  <p><span className="text-muted-foreground">最后检查时间：</span> {formatTimestamp(healthData.link_status.L04.timestamp)}</p>
                  <p><span className="text-muted-foreground">测试数据量：</span> {healthData.link_status.L04.data_count} 条</p>

                  <div className="mt-3 space-y-3">
                    <p className="font-medium text-sm">测试SQL（自然语言转SQL）：</p>
                    <div className="relative">
                      <pre className="p-2 bg-gray-50 rounded text-xs overflow-x-auto">
                        {healthData.link_status.L04.test_sql}
                      </pre>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="absolute top-1 right-1 h-6 w-6 p-0"
                        onClick={() => copyToClipboard(healthData.link_status.L04.test_sql, "L04 测试SQL")}
                      >
                        <Copy className="h-3 w-3" />
                      </Button>
                    </div>

                    <p className="font-medium text-sm mt-3">测试参数：</p>
                    <pre className="p-2 bg-gray-50 rounded text-xs overflow-x-auto">
                      {JSON.stringify(healthData.link_status.L04.test_params, null, 2)}
                    </pre>
                  </div>

                  <p className="text-xs text-green-600 bg-green-50 p-2 rounded mt-3">
                    ✅ 推荐：L04为核心查询链路，支持中文自然语言转SQL，降低使用门槛
                  </p>
                </CardContent>
              </Card>
            </TabsContent>
          </Tabs>
        </div>
      )}
    </div>
  );
}