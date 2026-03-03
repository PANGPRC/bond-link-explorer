import { lazy, Suspense } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { Loader2 } from "lucide-react";
import AppLayout from "@/components/AppLayout";
import NotFound from "@/pages/NotFound";

// 路由懒加载（提升首屏加载速度）
const BondQuery = lazy(() => import("@/pages/BondQuery"));
const BondCrud = lazy(() => import("@/pages/BondCrud"));
const HealthCheck = lazy(() => import("@/pages/HealthCheck"));

// React Query 兼容版配置（适配所有版本，无类型报错）
const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000, // 5分钟缓存（减少重复请求）
      gcTime: 10 * 60 * 1000, // 替代cacheTime，新版React Query标准配置
      retry: 1, // 失败重试1次（避免触发后端限流）
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000), // 指数退避重试
      refetchOnWindowFocus: false, // 窗口聚焦不重新请求
      refetchOnReconnect: false, // 网络重连不重新请求
    },
  },
});

// 加载中占位组件（懒加载时展示）
const LoadingFallback = () => (
  <div className="flex flex-col items-center justify-center min-h-[400px]">
    <Loader2 className="w-8 h-8 text-blue-500 animate-spin mb-2" />
    <p className="text-gray-500 text-sm">页面加载中...</p>
  </div>
);

// 主应用组件（添加明确的类型注解）
const App = (): JSX.Element => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      {/* 全局提示组件（保留） */}
      <Toaster />
      <Sonner />

      <BrowserRouter>
        <Routes>
          {/* 布局路由（AppLayout作为父容器） */}
          <Route path="/" element={<AppLayout />}>
            {/* 默认重定向到债券查询页 */}
            <Route index element={<Navigate to="/bond-query" replace />} />

            {/* 懒加载路由（包裹Suspense处理加载状态） */}
            <Route
              path="bond-query"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <BondQuery />
                </Suspense>
              }
            />
            <Route
              path="bond-crud"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <BondCrud />
                </Suspense>
              }
            />
            <Route
              path="health-check"
              element={
                <Suspense fallback={<LoadingFallback />}>
                  <HealthCheck />
                </Suspense>
              }
            />
          </Route>

          {/* 404页面 */}
          <Route path="*" element={<NotFound />} />
        </Routes>
      </BrowserRouter>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;