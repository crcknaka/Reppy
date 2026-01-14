import { useTranslation } from "react-i18next";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { Button } from "@/components/ui/button";
import { X, Download, Smartphone } from "lucide-react";

export function PWAInstallBanner() {
  const { t } = useTranslation();
  const { canInstall, install, dismiss } = usePWAInstall();

  if (!canInstall) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50 animate-in slide-in-from-bottom-4 duration-300">
      <div className="bg-card border rounded-xl shadow-lg p-4">
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Smartphone className="h-6 w-6 text-primary" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">
              {t("pwa.installTitle", "Install Reppy")}
            </h3>
            <p className="text-xs text-muted-foreground mt-0.5">
              {t("pwa.installDescription", "Add to home screen for the best experience")}
            </p>

            <div className="flex items-center gap-2 mt-3">
              <Button
                size="sm"
                className="h-8 text-xs gap-1.5"
                onClick={install}
              >
                <Download className="h-3.5 w-3.5" />
                {t("pwa.install", "Install")}
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 text-xs text-muted-foreground"
                onClick={dismiss}
              >
                {t("pwa.notNow", "Not now")}
              </Button>
            </div>
          </div>

          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 -mt-1 -mr-1 text-muted-foreground"
            onClick={dismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </div>
  );
}
