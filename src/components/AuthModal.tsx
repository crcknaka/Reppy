import { useState, useEffect, useCallback } from "react";
import { useTranslation } from "react-i18next";
import { Loader2, Mail, Lock, User, Check, X, AtSign } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useAuth } from "@/contexts/AuthContext";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { EmailConfirmationModal } from "@/components/EmailConfirmationModal";

interface AuthModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  defaultTab?: "login" | "signup";
}

export function AuthModal({ open, onOpenChange, defaultTab = "login" }: AuthModalProps) {
  const { t } = useTranslation();
  const { signIn, signUp, signInWithGoogle } = useAuth();

  const [loading, setLoading] = useState(false);
  const [activeTab, setActiveTab] = useState(defaultTab);

  // Email confirmation modal state
  const [showEmailConfirmation, setShowEmailConfirmation] = useState(false);
  const [pendingEmail, setPendingEmail] = useState("");

  // Login form
  const [loginEmail, setLoginEmail] = useState("");
  const [loginPassword, setLoginPassword] = useState("");

  // Signup form
  const [signupEmail, setSignupEmail] = useState("");
  const [signupPassword, setSignupPassword] = useState("");
  const [signupName, setSignupName] = useState("");
  const [signupUsername, setSignupUsername] = useState("");
  const [usernameStatus, setUsernameStatus] = useState<"idle" | "checking" | "available" | "taken" | "invalid">("idle");
  const [usernameError, setUsernameError] = useState<string | null>(null);

  // Check username availability with debounce
  const checkUsernameAvailability = useCallback(async (username: string) => {
    // Validate format first
    const usernameRegex = /^[a-z0-9_]{3,20}$/;
    if (!usernameRegex.test(username)) {
      setUsernameStatus("invalid");
      setUsernameError(t("auth.usernameInvalid"));
      return;
    }

    setUsernameStatus("checking");
    setUsernameError(null);

    try {
      const { data, error } = await supabase
        .from("profiles")
        .select("username")
        .eq("username", username)
        .maybeSingle();

      if (error) throw error;

      if (data) {
        setUsernameStatus("taken");
        setUsernameError(t("auth.usernameTaken"));
      } else {
        setUsernameStatus("available");
        setUsernameError(null);
      }
    } catch (error) {
      console.error("Username check error:", error);
      setUsernameStatus("idle");
    }
  }, [t]);

  // Debounced username check
  useEffect(() => {
    if (!signupUsername || signupUsername.length < 3) {
      setUsernameStatus("idle");
      setUsernameError(null);
      return;
    }

    const timer = setTimeout(() => {
      checkUsernameAvailability(signupUsername.toLowerCase());
    }, 500);

    return () => clearTimeout(timer);
  }, [signupUsername, checkUsernameAvailability]);

  const resetForms = () => {
    setLoginEmail("");
    setLoginPassword("");
    setSignupEmail("");
    setSignupPassword("");
    setSignupName("");
    setSignupUsername("");
    setUsernameStatus("idle");
    setUsernameError(null);
    setShowEmailConfirmation(false);
    setPendingEmail("");
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(loginEmail, loginPassword);
      toast.success(t("auth.welcome"));
      resetForms();
      onOpenChange(false);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t("auth.loginError");
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();

    // Validate username is provided and available
    if (!signupUsername) {
      toast.error(t("auth.usernameRequired"));
      return;
    }
    if (usernameStatus === "taken") {
      toast.error(t("auth.usernameTaken"));
      return;
    }
    if (usernameStatus === "invalid") {
      toast.error(t("auth.usernameInvalid"));
      return;
    }
    if (usernameStatus === "checking") {
      toast.error(t("auth.usernameChecking"));
      return;
    }

    setLoading(true);
    try {
      await signUp(signupEmail, signupPassword, signupName, signupUsername.toLowerCase());
      toast.success(t("auth.accountCreated"));
      // Show email confirmation modal instead of closing
      setPendingEmail(signupEmail);
      setShowEmailConfirmation(true);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t("auth.registerError");
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setLoading(true);
    try {
      await signInWithGoogle();
      // Google redirects, so we don't need to close modal
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t("auth.googleError");
      toast.error(errorMessage);
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">{t("auth.title")}</DialogTitle>
        </DialogHeader>

        <Tabs value={activeTab} onValueChange={(v) => setActiveTab(v as "login" | "signup")} className="w-full">
          <TabsList className="grid w-full grid-cols-2 mb-4">
            <TabsTrigger value="login">{t("auth.login")}</TabsTrigger>
            <TabsTrigger value="signup">{t("auth.register")}</TabsTrigger>
          </TabsList>

          <TabsContent value="login" className="space-y-4">
            <form onSubmit={handleLogin} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="login-email">{t("auth.email")}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="login-email"
                    type="email"
                    placeholder="your@email.com"
                    className="pl-10"
                    value={loginEmail}
                    onChange={(e) => setLoginEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="login-password">{t("auth.password")}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="login-password"
                    type="password"
                    placeholder="••••••••"
                    className="pl-10"
                    value={loginPassword}
                    onChange={(e) => setLoginPassword(e.target.value)}
                    required
                    autoComplete="current-password"
                  />
                </div>
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("auth.loginButton")}
              </Button>
            </form>
          </TabsContent>

          <TabsContent value="signup" className="space-y-4">
            <form onSubmit={handleSignup} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="signup-name">{t("auth.name")}</Label>
                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-name"
                    type="text"
                    placeholder={t("auth.yourName")}
                    className="pl-10"
                    value={signupName}
                    onChange={(e) => setSignupName(e.target.value)}
                    required
                    autoComplete="name"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-username">{t("auth.username")}</Label>
                <div className="relative">
                  <AtSign className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-username"
                    type="text"
                    placeholder={t("auth.usernamePlaceholder")}
                    className="pl-10 pr-10"
                    value={signupUsername}
                    onChange={(e) => setSignupUsername(e.target.value.toLowerCase().replace(/[^a-z0-9_]/g, ""))}
                    required
                    minLength={3}
                    maxLength={20}
                    autoComplete="username"
                  />
                  {signupUsername.length >= 3 && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      {usernameStatus === "checking" && (
                        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
                      )}
                      {usernameStatus === "available" && (
                        <Check className="h-4 w-4 text-green-500" />
                      )}
                      {(usernameStatus === "taken" || usernameStatus === "invalid") && (
                        <X className="h-4 w-4 text-destructive" />
                      )}
                    </div>
                  )}
                </div>
                {usernameError && (
                  <p className="text-xs text-destructive">{usernameError}</p>
                )}
                <p className="text-xs text-muted-foreground">{t("auth.usernameHint")}</p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-email">{t("auth.email")}</Label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-email"
                    type="email"
                    placeholder="your@email.com"
                    className="pl-10"
                    value={signupEmail}
                    onChange={(e) => setSignupEmail(e.target.value)}
                    required
                    autoComplete="email"
                  />
                </div>
              </div>
              <div className="space-y-2">
                <Label htmlFor="signup-password">{t("auth.password")}</Label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                  <Input
                    id="signup-password"
                    type="password"
                    placeholder={t("auth.minPassword")}
                    className="pl-10"
                    value={signupPassword}
                    onChange={(e) => setSignupPassword(e.target.value)}
                    required
                    minLength={6}
                    autoComplete="new-password"
                  />
                </div>
              </div>
              <Button
                type="submit"
                className="w-full"
                disabled={loading || usernameStatus === "taken" || usernameStatus === "invalid" || usernameStatus === "checking"}
              >
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("auth.createAccount")}
              </Button>
            </form>
          </TabsContent>
        </Tabs>

        <div className="relative my-2">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t" />
          </div>
          <div className="relative flex justify-center text-xs uppercase">
            <span className="bg-background px-2 text-muted-foreground">
              {t("auth.orContinueWith")}
            </span>
          </div>
        </div>

        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleGoogleSignIn}
          disabled={loading}
        >
          {loading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <svg className="mr-2 h-4 w-4" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
            </svg>
          )}
          {t("auth.continueWithGoogle")}
        </Button>
      </DialogContent>

      {/* Email Confirmation Modal - shown after signup */}
      <EmailConfirmationModal
        email={pendingEmail}
        open={showEmailConfirmation}
        onClose={() => {
          setShowEmailConfirmation(false);
          resetForms();
          onOpenChange(false);
        }}
      />
    </Dialog>
  );
}
