export default function Loading() {
  return (
    <div className="space-y-6 max-w-5xl animate-pulse">
      <div className="space-y-2">
        <div className="h-7 w-44 rounded-lg bg-foreground/[0.06]" />
        <div className="h-4 w-64 rounded bg-foreground/[0.04]" />
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {[0, 1, 2].map(i => (
          <div key={i} className="h-28 rounded-xl bg-foreground/[0.04] border border-foreground/[0.06]" />
        ))}
      </div>
      <div className="h-72 rounded-xl bg-foreground/[0.04] border border-foreground/[0.06]" />
    </div>
  )
}
