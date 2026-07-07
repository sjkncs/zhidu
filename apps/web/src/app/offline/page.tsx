'use client';

export default function OfflinePage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#0F1117] px-6">
      <div className="max-w-md text-center">
        <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1F3A5F] to-[#2E75B6] text-4xl font-bold text-white">
          知
        </div>
        <h1 className="mb-3 text-[22px] font-semibold text-[#f1f5f9]">
          当前无网络连接
        </h1>
        <p className="mb-6 text-sm leading-relaxed text-[#94a3b8]">
          请检查你的网络设置后重试。
          <br />
          知渡会在恢复连接后自动同步数据。
        </p>
        <button
          onClick={() => window.location.reload()}
          className="rounded-lg bg-[#2E75B6] px-7 py-2.5 text-sm font-medium text-white transition-colors hover:bg-[#1F3A5F]"
        >
          重新加载
        </button>
        <div className="mt-4 text-xs text-[#64748b]">
          如持续无法连接，请联系 support@zhidu.app
        </div>
      </div>
    </div>
  );
}
