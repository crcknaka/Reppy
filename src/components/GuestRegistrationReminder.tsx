import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { Trophy, Cloud, Smartphone, Users, Shield } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { useGuestWorkoutReminder } from "@/hooks/useGuestWorkoutReminder";

export function GuestRegistrationReminder() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { shouldShowReminder, workoutCount, dismissReminder } = useGuestWorkoutReminder();

  const handleCreateAccount = () => {
    dismissReminder();
    navigate("/auth?tab=signup");
  };

  if (!shouldShowReminder) {
    return null;
  }

  return (
    <Dialog open={shouldShowReminder} onOpenChange={(open) => !open && dismissReminder()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <div className="flex justify-center mb-2">
            <div className="p-3 bg-primary/10 rounded-full">
              <Trophy className="h-8 w-8 text-primary" />
            </div>
          </div>
          <DialogTitle className="text-center">
            {t("guest.reminder.title")}
          </DialogTitle>
          <DialogDescription className="text-center">
            {t("guest.reminder.message", { count: workoutCount })}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3 py-4">
          <p className="text-sm font-medium text-center">
            {t("guest.reminder.benefits")}
          </p>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
              <Cloud className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-xs">{t("guest.reminder.benefit1")}</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
              <Smartphone className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-xs">{t("guest.reminder.benefit2")}</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
              <Users className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-xs">{t("guest.reminder.benefit3")}</span>
            </div>
            <div className="flex items-center gap-2 p-2 rounded-lg bg-muted/50">
              <Shield className="h-4 w-4 text-primary flex-shrink-0" />
              <span className="text-xs">{t("guest.reminder.benefit4")}</span>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col gap-2 sm:flex-col">
          <Button
            className="w-full bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
            onClick={handleCreateAccount}
          >
            {t("guest.reminder.createAccount")}
          </Button>
          <Button
            variant="ghost"
            className="w-full"
            onClick={dismissReminder}
          >
            {t("guest.reminder.later")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
