export default function GlobalLoading() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <div
        className="mb-4 h-10 w-10 animate-spin rounded-full border-4 border-border border-t-blue"
        aria-label="加载中"
      />
      <p className="text-sm text-text-secondary">加载中...</p>
    </div>
  );
}
