import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Mail, Send, Loader2, Check } from "lucide-react";
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
    } catch (error) {
      toast.error(t("auth.verification.sendError"));
    } finally {
      setIsResending(false);
    }
  };

  return (
    <div className="bg-amber-500/10 border-b border-amber-500/20">
      <div className="container max-w-3xl py-2.5 px-4">
        <div className="flex items-center gap-3">
          <div className="flex-shrink-0 p-1.5 bg-amber-500/20 rounded-full">
            <Mail className="h-4 w-4 text-amber-600 dark:text-amber-400" />
          </div>

          <div className="flex-1 min-w-0">
            <p className="text-sm text-amber-800 dark:text-amber-200">
              {t("auth.verification.banner")}
            </p>
          </div>

          <Button
            variant="ghost"
            size="sm"
            className="h-8 px-3 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20 hover:text-amber-800 dark:hover:text-amber-200 flex-shrink-0"
            onClick={handleResend}
            disabled={isResending || wasSent}
          >
            {isResending ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : wasSent ? (
              <>
                <Check className="h-3.5 w-3.5 mr-1.5" />
                {t("auth.verification.sentShort")}
              </>
            ) : (
              <>
                <Send className="h-3.5 w-3.5 mr-1.5" />
                {t("auth.verification.resend")}
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
