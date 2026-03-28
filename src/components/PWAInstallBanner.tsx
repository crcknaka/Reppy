import { useTranslation } from "react-i18next";
import { usePWAInstall } from "@/hooks/usePWAInstall";
import { Button } from "@/components/ui/button";
import { X, Download, Smartphone, Share, PlusSquare } from "lucide-react";

export function PWAInstallBanner() {
  const { t } = useTranslation();
  const { canInstall, isIOSSafari, install, dismiss } = usePWAInstall();

  if (!canInstall) return null;

  return (
    <div className="fixed bottom-20 left-4 right-4 z-50">
      <div className="bg-card border rounded-xl shadow-lg p-4">
        <div className="flex items-start gap-3">
          <div className="h-12 w-12 rounded-xl bg-primary/10 flex items-center justify-center flex-shrink-0">
            <Smartphone className="h-6 w-6 text-primary" />
          </div>

          <div className="flex-1 min-w-0">
            <h3 className="font-semibold text-sm">
              {t("pwa.installTitle", "Install Reppy")}
            </h3>

            {isIOSSafari ? (
              <div className="mt-1.5 space-y-1.5">
                <p className="text-xs text-muted-foreground">
                  {t("pwa.iosInstallDescription", "To install, use Safari's share menu:")}
                </p>
                <div className="flex items-center gap-2 text-xs text-foreground">
                  <span className="flex items-center justify-center h-5 w-5 rounded bg-muted">
                    <Share className="h-3 w-3" />
                  </span>
                  <span>{t("pwa.iosStep1", "Tap Share button")}</span>
                </div>
                <div className="flex items-center gap-2 text-xs text-foreground">
                  <span className="flex items-center justify-center h-5 w-5 rounded bg-muted">
                    <PlusSquare className="h-3 w-3" />
                  </span>
                  <span>{t("pwa.iosStep2", "Tap \"Add to Home Screen\"")}</span>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground mt-1"
                  onClick={dismiss}
                >
                  {t("pwa.understood", "Got it")}
                </Button>
              </div>
            ) : (
              <>
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
              </>
            )}
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
