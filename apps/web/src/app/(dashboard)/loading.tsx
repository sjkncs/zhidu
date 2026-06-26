export default function DashboardLoading() {
  return (
    <div className="flex h-full animate-pulse gap-6">
      {/* Sidebar placeholder */}
      <div className="hidden w-60 shrink-0 flex-col gap-3 lg:flex">
        <div className="h-10 w-full rounded-lg bg-border" />
        <div className="mt-4 h-8 w-4/5 rounded-lg bg-border-subtle" />
        <div className="h-8 w-3/4 rounded-lg bg-border-subtle" />
        <div className="h-8 w-4/5 rounded-lg bg-border-subtle" />
        <div className="h-8 w-2/3 rounded-lg bg-border-subtle" />
        <div className="h-8 w-3/4 rounded-lg bg-border-subtle" />
        <div className="h-8 w-4/5 rounded-lg bg-border-subtle" />
      </div>

      {/* Main content placeholder */}
      <div className="flex flex-1 flex-col gap-6">
        {/* Header bar */}
        <div className="h-10 w-48 rounded-lg bg-border" />

        {/* Skeleton cards */}
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <div
              key={i}
              className="rounded-2xl border border-border bg-surface p-6"
            >
              <div className="mb-4 h-6 w-2/3 rounded-md bg-border" />
              <div className="mb-2 h-4 w-full rounded-md bg-border-subtle" />
              <div className="mb-2 h-4 w-4/5 rounded-md bg-border-subtle" />
              <div className="h-4 w-3/5 rounded-md bg-border-subtle" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
