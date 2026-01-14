import { useTranslation } from "react-i18next";
import { AlertTriangle, Merge, Trash2 } from "lucide-react";
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";

interface GuestDataMigrationDialogProps {
  open: boolean;
  guestWorkoutCount: number;
  onMigrate: () => void;
  onDiscard: () => void;
}

export function GuestDataMigrationDialog({
  open,
  guestWorkoutCount,
  onMigrate,
  onDiscard,
}: GuestDataMigrationDialogProps) {
  const { t } = useTranslation();

  return (
    <AlertDialog open={open}>
      <AlertDialogContent className="max-w-md">
        <AlertDialogHeader>
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 bg-amber-500/10 rounded-full">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
            </div>
            <AlertDialogTitle className="text-lg">
              {t("guest.migration.title")}
            </AlertDialogTitle>
          </div>
          <AlertDialogDescription asChild>
            <div className="text-left space-y-3">
              <span className="block">
                {t("guest.migration.description", { count: guestWorkoutCount })}
              </span>
              <span className="block text-sm text-muted-foreground">
                {t("guest.migration.hint")}
              </span>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            variant="outline"
            onClick={onDiscard}
            className="w-full sm:w-auto gap-2"
          >
            <Trash2 className="h-4 w-4" />
            {t("guest.migration.discard")}
          </Button>
          <Button
            onClick={onMigrate}
            className="w-full sm:w-auto gap-2"
          >
            <Merge className="h-4 w-4" />
            {t("guest.migration.merge")}
          </Button>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
