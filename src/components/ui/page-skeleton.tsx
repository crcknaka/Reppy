import { motion } from "@/components/ui/motion";
import { cn } from "@/lib/utils";

function Bone({ className, delay = 0 }: { className?: string; delay?: number }) {
  return (
    <motion.div
      className={cn("rounded-lg bg-muted/50", className)}
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: delay / 1000 }}
    />
  );
}

export function PageSkeleton() {
  let d = 0;
  const next = () => (d += 60);

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Bone className="h-8 w-8 rounded-full" delay={next()} />
        <div className="space-y-2 flex-1">
          <Bone className="h-5 w-40" delay={next()} />
          <Bone className="h-3 w-24" delay={next()} />
        </div>
      </div>

      {[0, 1, 2].map((i) => (
        <motion.div
          key={i}
          className="rounded-xl border border-border/40 p-4 space-y-3"
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35, delay: (next()) / 1000 }}
        >
          <div className="flex items-center justify-between">
            <div className="space-y-2 flex-1">
              <Bone className="h-4 w-32" delay={d + 30} />
              <Bone className="h-3 w-20" delay={d + 60} />
            </div>
            <Bone className="h-12 w-12 rounded-lg" delay={d + 40} />
          </div>
          <div className="space-y-2">
            <Bone className="h-8 w-full rounded-md" delay={d + 80} />
            <Bone className="h-8 w-full rounded-md" delay={d + 100} />
          </div>
        </motion.div>
      ))}
    </div>
  );
}

export function ListSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2, 3, 4].map((i) => (
        <motion.div
          key={i}
          className="rounded-xl border border-border/40 p-3 flex items-center gap-3"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3, delay: i * 0.06 }}
        >
          <Bone className="h-14 w-14 rounded-lg flex-shrink-0" delay={i * 60 + 30} />
          <div className="space-y-2 flex-1">
            <Bone className="h-4 w-28" delay={i * 60 + 60} />
            <Bone className="h-3 w-40" delay={i * 60 + 90} />
          </div>
        </motion.div>
      ))}
    </div>
  );
}
