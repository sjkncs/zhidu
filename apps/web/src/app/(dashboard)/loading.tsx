// Dashboard loading skeleton — minimal spinner
// 注意：Turbopack dev 模式下 full page reload (F5) 时 Suspense boundary 可能不会自动解析，
// 因此使用最小化的 loading 指示器，避免全屏骨架屏卡住。
// 各页面（知识库、院校库等）使用自己的 client-side loading 状态管理。

export default function DashboardLoading() {
  return (
    <div className="flex items-center justify-center py-20">
      <div className="flex flex-col items-center gap-3">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-border border-t-blue" />
        <p className="text-sm text-text-tertiary">加载中...</p>
      </div>
    </div>
  );
}
