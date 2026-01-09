import { X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface ViewingUserBannerProps {
  avatar: string | null;
  displayName: string | null;
  onClose: () => void;
}

export function ViewingUserBanner({ avatar, displayName, onClose }: ViewingUserBannerProps) {
  return (
    <div className={cn(
      "flex items-center gap-3 p-3 rounded-lg mb-4",
      "bg-gradient-to-r from-blue-500/10 to-purple-500/10",
      "border border-blue-500/20"
    )}>
      <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-xl shrink-0">
        {avatar || "👤"}
      </div>

      <div className="flex-1 min-w-0">
        <p className="text-sm text-muted-foreground">Просмотр тренировок</p>
        <p className="font-semibold text-foreground truncate">
          {displayName || "Аноним"}
        </p>
      </div>

      <Button
        variant="ghost"
        size="sm"
        onClick={onClose}
        className="gap-2 shrink-0"
      >
        <X className="h-4 w-4" />
        <span className="hidden sm:inline">Мои тренировки</span>
      </Button>
    </div>
  );
}
