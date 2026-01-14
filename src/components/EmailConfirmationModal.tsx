import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Mail, Send, Loader2, Check, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface EmailConfirmationModalProps {
  email: string;
  open: boolean;
  onClose: () => void;
}

export function EmailConfirmationModal({ email, open, onClose }: EmailConfirmationModalProps) {
  const { t } = useTranslation();
  const [isResending, setIsResending] = useState(false);
  const [wasSent, setWasSent] = useState(false);

  if (!open) return null;

  const handleResend = async () => {
    setIsResending(true);
    try {
      const { error } = await supabase.auth.resend({
        type: "signup",
        email: email,
      });
      if (error) throw error;
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Modal */}
      <div className="relative bg-background border border-border rounded-2xl shadow-2xl max-w-md w-full p-6 animate-in fade-in zoom-in-95 duration-200">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
        >
          <X className="h-5 w-5" />
        </button>

        {/* Icon */}
        <div className="flex justify-center mb-4">
          <div className="p-4 bg-gradient-to-br from-primary/20 to-primary/10 rounded-full">
            <Mail className="h-10 w-10 text-primary" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-xl font-bold text-center mb-2">
          {t("auth.verification.modalTitle")}
        </h2>

        {/* Description */}
        <p className="text-center text-muted-foreground mb-2">
          {t("auth.verification.modalDescription")}
        </p>

        {/* Email */}
        <p className="text-center font-medium text-primary mb-6">
          {email}
        </p>

        {/* Instructions */}
        <div className="bg-muted/50 rounded-lg p-4 mb-6">
          <p className="text-sm text-muted-foreground text-center">
            {t("auth.verification.modalInstructions")}
          </p>
        </div>

        {/* Resend button */}
        <Button
          variant="outline"
          className="w-full gap-2"
          onClick={handleResend}
          disabled={isResending || wasSent}
        >
          {isResending ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              {t("common.loading")}
            </>
          ) : wasSent ? (
            <>
              <Check className="h-4 w-4 text-green-500" />
              {t("auth.verification.sentShort")}
            </>
          ) : (
            <>
              <Send className="h-4 w-4" />
              {t("auth.verification.resendFull")}
            </>
          )}
        </Button>

        {/* Close hint */}
        <p className="text-xs text-center text-muted-foreground mt-4">
          {t("auth.verification.closeHint")}
        </p>
      </div>
    </div>
  );
}
