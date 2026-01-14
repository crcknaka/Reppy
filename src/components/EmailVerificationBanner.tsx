import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Mail, Send, Loader2, Check, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";

export function EmailVerificationBanner() {
  const { t } = useTranslation();
  const { user, isEmailVerified, resendVerificationEmail } = useAuth();
  const [isResending, setIsResending] = useState(false);
  const [wasSent, setWasSent] = useState(false);

  // Don't show if verified or no user
  if (isEmailVerified || !user) {
    return null;
  }

  const handleResend = async () => {
    setIsResending(true);
    try {
      await resendVerificationEmail();
      setWasSent(true);
      toast.success(t("auth.verification.sent"));
      // Reset after 30 seconds to allow resending again
      setTimeout(() => setWasSent(false), 30000);
    } catch {
      toast.error(t("auth.verification.sendError"));
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="sticky top-0 z-50 bg-gradient-to-r from-amber-500 to-orange-500 text-white shadow-lg">
      <div className="container max-w-3xl py-3 px-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 p-2 bg-white/20 rounded-full animate-pulse">
            <AlertCircle className="h-5 w-5" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium">
              {t("auth.verification.banner")}
            </p>
            <p className="text-xs opacity-90 hidden sm:block">
              {user.email}
            </p>
          </div>

          <Button
            variant="secondary"
            size="sm"
            className="h-9 px-4 bg-white/20 hover:bg-white/30 text-white border-0 font-medium flex-shrink-0"
            onClick={handleResend}
            disabled={isResending || wasSent}
          >
            {isResending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : wasSent ? (
              <>
                <Check className="h-4 w-4 mr-1.5" />
                <span className="hidden sm:inline">{t("auth.verification.sentShort")}</span>
              </>
            ) : (
              <>
                <Send className="h-4 w-4 sm:mr-1.5" />
                <span className="hidden sm:inline">{t("auth.verification.resend")}</span>
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
