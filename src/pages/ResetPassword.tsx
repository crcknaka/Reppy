import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "@/contexts/AuthContext";
import { useTheme } from "next-themes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Lock, CheckCircle } from "lucide-react";
import { toast } from "sonner";

export default function ResetPassword() {
  const navigate = useNavigate();
  const { updatePassword, user } = useAuth();
  const { resolvedTheme } = useTheme();
  const logoSrc = resolvedTheme === "dark" ? "/logo-white.png" : "/logo-black.png";
  const [loading, setLoading] = useState(false);
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [success, setSuccess] = useState(false);

  // Supabase automatically handles the token from the URL
  // When user clicks the email link, Supabase sets up the session

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPassword || !confirmPassword) {
      toast.error("Заполните оба поля");
      return;
    }

    if (newPassword.length < 6) {
      toast.error("Пароль должен быть минимум 6 символов");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Пароли не совпадают");
      return;
    }

    setLoading(true);
    try {
      await updatePassword(newPassword);
      setSuccess(true);
      toast.success("Пароль успешно изменен!");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Ошибка смены пароля";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  // Redirect to home after success
  useEffect(() => {
    if (success) {
      const timer = setTimeout(() => {
        navigate("/", { replace: true });
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [success, navigate]);

  // Success screen
  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <div className="w-full max-w-md animate-fade-in">
          <div className="flex items-center justify-center mb-8">
            <img
              src={logoSrc}
              alt="FitTrack Logo"
              className="max-h-24 rounded-xl object-contain"
            />
          </div>

          <Card className="border-border/50 shadow-lg">
            <CardContent className="pt-6">
              <div className="flex flex-col items-center gap-4 text-center">
                <CheckCircle className="h-16 w-16 text-green-500" />
                <h2 className="text-xl font-semibold">Пароль изменен!</h2>
                <p className="text-muted-foreground">
                  Перенаправление на главную страницу...
                </p>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="w-full max-w-md animate-fade-in">
        <div className="flex items-center justify-center mb-8">
          <img
            src={logoSrc}
            alt="FitTrack Logo"
            className="max-h-24 rounded-xl object-contain"
          />
        </div>

        <Card className="border-border/50 shadow-lg">
          <CardHeader className="text-center">
            <div className="flex justify-center mb-2">
              <Lock className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-xl">Новый пароль</CardTitle>
            <CardDescription>
              Введите новый пароль для вашего аккаунта
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="newPassword">Новый пароль</Label>
                <Input
                  id="newPassword"
                  type="password"
                  placeholder="Минимум 6 символов"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                  minLength={6}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Подтвердите пароль</Label>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="Повторите пароль"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  required
                />
              </div>
              <Button type="submit" className="w-full" disabled={loading}>
                {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                Сохранить пароль
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="w-full"
                onClick={() => navigate("/auth")}
              >
                Назад к входу
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
