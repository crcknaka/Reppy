import { cn } from "@/lib/utils";

function Bone({ className, delay = 0 }: { className?: string; delay?: number }) {
  return (
    <div
      className={cn("rounded-lg bg-muted/50 animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards duration-500", className)}
      style={{ animationDelay: `${delay}ms` }}
    />
  );
}

export function PageSkeleton() {
  let d = 0;
  const next = () => (d += 60);

  return (
    <div className="space-y-4">
      {/* Header skeleton */}
      <div className="flex items-center gap-3">
        <Bone className="h-8 w-8 rounded-full" delay={next()} />
        <div className="space-y-2 flex-1">
          <Bone className="h-5 w-40" delay={next()} />
          <Bone className="h-3 w-24" delay={next()} />
        </div>
      </div>

      {/* Card skeletons */}
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-border/40 p-4 space-y-3 animate-in fade-in slide-in-from-bottom-3 fill-mode-backwards duration-500"
          style={{ animationDelay: `${next()}ms` }}
        >
          <div className="flex items-center justify-between">
            <div className="space-y-2 flex-1">
              <Bone className="h-4 w-32" delay={next()} />
              <Bone className="h-3 w-20" delay={next()} />
            </div>
            <Bone className="h-12 w-12 rounded-lg" delay={next()} />
          </div>
          <div className="space-y-2">
            <Bone className="h-8 w-full rounded-md" delay={next()} />
            <Bone className="h-8 w-full rounded-md" delay={next()} />
          </div>
        </div>
      ))}
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3, 4].map((i) => (
        <div
          key={i}
          className="rounded-xl border border-border/40 p-3 flex items-center gap-3 animate-in fade-in slide-in-from-bottom-2 fill-mode-backwards duration-500"
          style={{ animationDelay: `${i * 80}ms` }}
        >
          <Bone className="h-14 w-14 rounded-lg flex-shrink-0" delay={i * 80 + 40} />
          <div className="space-y-2 flex-1">
            <Bone className="h-4 w-28" delay={i * 80 + 80} />
            <Bone className="h-3 w-40" delay={i * 80 + 120} />
          </div>
        </div>
      ))}
    </div>
  );
}
