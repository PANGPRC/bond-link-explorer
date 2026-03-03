import { NavLink, Outlet } from "react-router-dom";
import { Activity, Search, Database, ChevronRight, Menu, X } from "lucide-react";
import { getRateLimitInfo } from "@/lib/api";
import { useEffect, useState } from "react";

// 严格定义限流信息类型（确保和 getRateLimitInfo 返回值匹配）
interface RateLimitInfo {
  remaining: number; // 剩余次数
  total: number;    // 总次数（20）
  used: number;     // 已使用次数
  resetIn: number;  // 重置倒计时（秒）
}

const navItems = [
  { to: "/bond-query", label: "债券查询", icon: Search },
  { to: "/bond-crud", label: "债券CRUD", icon: Database },
  { to: "/health-check", label: "健康检查", icon: Activity },
];

export default function AppLayout() {
  // 1. 折叠状态管理（响应式侧边栏）
  const [collapsed, setCollapsed] = useState(false);
  // 根据折叠状态动态调整侧边栏宽度
  const sidebarWidth = collapsed ? "w-16" : "w-60";

  // 2. 限流信息（严格类型 + 初始化获取真实数据）
  const [rateInfo, setRateInfo] = useState<RateLimitInfo>(() => {
    // 初始化时直接调用 getRateLimitInfo，确保类型匹配
    const initialInfo = getRateLimitInfo();
    // 兜底处理：防止返回值字段缺失
    return {
      remaining: initialInfo.remaining ?? 20,
      total: initialInfo.total ?? 20,
      used: initialInfo.used ?? 0,
      resetIn: initialInfo.resetIn ?? 0,
    };
  });

  // 3. 实时更新限流信息（1秒轮询）
  useEffect(() => {
    const interval = setInterval(() => {
      const newInfo = getRateLimitInfo();
      setRateInfo({
        remaining: newInfo.remaining ?? 20,
        total: newInfo.total ?? 20,
        used: newInfo.used ?? 0,
        resetIn: newInfo.resetIn ?? 0,
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  // 4. 动态计算进度条颜色
  const getProgressColor = () => {
    if (rateInfo.remaining > 10) return "bg-green-500"; // 剩余>10：绿色
    if (rateInfo.remaining > 5) return "bg-yellow-500"; // 剩余5-10：黄色
    return "bg-red-500"; // 剩余≤5：红色
  };

  // 5. 切换折叠状态的函数
  const toggleCollapsed = () => {
    setCollapsed(!collapsed);
  };

  return (
    <div className="flex h-screen overflow-hidden">
      {/* 侧边栏 - 支持折叠 */}
      <aside
        className={`${sidebarWidth} flex-shrink-0 bg-gray-900 text-white flex flex-col transition-all duration-300`}
      >
        {/* Logo/标题区域 + 折叠按钮 */}
        <div className="p-5 border-b border-gray-800 flex items-center justify-between">
          {!collapsed && (
            <>
              <div>
                <h1 className="font-semibold text-lg tracking-tight text-white">
                  债券数据管理系统
                </h1>
                <p className="text-xs mt-1 text-gray-400">Bond Data Management System</p>
              </div>
            </>
          )}
          {/* 折叠/展开按钮（始终显示） */}
          <button
            onClick={toggleCollapsed}
            className="p-1.5 rounded-full hover:bg-gray-800 transition-colors"
            aria-label={collapsed ? "展开侧边栏" : "折叠侧边栏"}
          >
            {collapsed ? <Menu className="w-4 h-4" /> : <X className="w-4 h-4" />}
          </button>
        </div>

        {/* 导航菜单（折叠时只显示图标） */}
        <nav className="flex-1 py-4 px-3 space-y-1">
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink
              key={to}
              to={to}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-md text-sm transition-colors ${isActive
                  ? "bg-blue-600 text-white font-medium"
                  : "text-gray-300 hover:bg-gray-800 hover:text-white"
                }`
              }
              end
            >
              <Icon className="w-4 h-4 flex-shrink-0" />
              {/* 折叠时隐藏文字 */}
              {!collapsed && <span>{label}</span>}
              {/* 折叠时隐藏箭头 */}
              {!collapsed && <ChevronRight className="w-3 h-3 ml-auto opacity-40" />}
            </NavLink>
          ))}
        </nav>

        {/* 限流指示器（折叠时隐藏） */}
        {!collapsed && (
          <div className="p-4 border-t border-gray-800">
            <div className="text-xs text-gray-400 mb-2">API接口限流</div>
            <div className="w-full bg-gray-700 rounded-full h-1.5 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${getProgressColor()}`}
                style={{
                  width: `${(rateInfo.remaining / rateInfo.total) * 100}%`,
                }}
              />
            </div>
            <div className="flex justify-between items-center text-xs mt-1">
              <span className="text-gray-400">
                剩余：{rateInfo.remaining}/{rateInfo.total} 次/分钟
              </span>
              <span className="text-gray-400">
                重置倒计时：{rateInfo.resetIn}s
              </span>
            </div>
          </div>
        )}
      </aside>

      {/* 主内容区域 */}
      <main className="flex-1 overflow-auto bg-gray-50">
        <Outlet />
      </main>
    </div>
  );
}