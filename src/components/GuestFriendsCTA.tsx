import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Users, LogIn, Cloud, Smartphone, Shield } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/contexts/AuthContext";
import { AuthModal } from "@/components/AuthModal";
import { GoogleSignInButton } from "@/components/GoogleSignInButton";

export function GuestFriendsCTA() {
  const { t } = useTranslation();
  const { signInWithGoogle } = useAuth();
  const [authModalOpen, setAuthModalOpen] = useState(false);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithGoogle();
    } catch (error) {
      console.error("Google sign-in error:", error);
    }
  };

  return (
    <div className="space-y-6">
      <div className="space-y-1">
        <h1 className="text-2xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
          {t("friends.title")}
        </h1>
      </div>

      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <div className="p-4 bg-primary/10 rounded-full mb-4">
            <Users className="h-10 w-10 text-primary" />
          </div>

          <h3 className="font-semibold text-xl mb-2">
            {t("guest.friends.title")}
          </h3>

          <p className="text-muted-foreground text-sm mb-6 max-w-sm">
            {t("guest.friends.description")}
          </p>

          {/* Benefits */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-6 w-full max-w-md">
            <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/50">
              <Cloud className="h-5 w-5 text-primary" />
              <span className="text-xs text-muted-foreground text-center">
                {t("guest.friends.benefit1")}
              </span>
            </div>
            <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/50">
              <Smartphone className="h-5 w-5 text-primary" />
              <span className="text-xs text-muted-foreground text-center">
                {t("guest.friends.benefit2")}
              </span>
            </div>
            <div className="flex flex-col items-center gap-2 p-3 rounded-lg bg-muted/50">
              <Shield className="h-5 w-5 text-primary" />
              <span className="text-xs text-muted-foreground text-center">
                {t("guest.friends.benefit3")}
              </span>
            </div>
          </div>

          {/* CTA Buttons */}
          <div className="space-y-2 w-full max-w-xs">
            <GoogleSignInButton
              onClick={handleGoogleSignIn}
              className="w-full h-11"
            />

            <Button
              variant="outline"
              className="w-full h-11 gap-2"
              onClick={() => setAuthModalOpen(true)}
            >
              <LogIn className="h-4 w-4" />
              {t("guest.friends.loginWithEmail")}
            </Button>
          </div>

          <p className="text-xs text-muted-foreground mt-4">
            {t("guest.friends.dataPreserved")}
          </p>
        </CardContent>
      </Card>

      {/* Auth Modal */}
      <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />
    </div>
  );
}
