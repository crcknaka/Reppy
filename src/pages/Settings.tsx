import { useState, useEffect } from "react";
import { User, Save, LogOut, Lock } from "lucide-react";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Checkbox } from "@/components/ui/checkbox";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const AVATARS = [
  "😎", "💪", "🔥", "🏋️", "🎯", "🚀", "⚡", "🦾",
  "🏆", "👑", "🌟", "💯", "🎖️", "🥇", "🦁", "🐯",
  "🦅", "🐺", "🤘", "✨", "💥", "🎪", "🎭", "🎨"
];

export default function Settings() {
  const { data: profile, isLoading } = useProfile();
  const updateProfile = useUpdateProfile();
  const { signOut, updatePassword } = useAuth();

  const [displayName, setDisplayName] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other" | "none">("none");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [height, setHeight] = useState("");
  const [currentWeight, setCurrentWeight] = useState("");
  const [avatar, setAvatar] = useState("");
  const [isSkuf, setIsSkuf] = useState(false);

  // Password change state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  // Load profile data when it's available
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setGender(profile.gender || "none");
      setDateOfBirth(profile.date_of_birth || "");
      setHeight(profile.height?.toString() || "");
      setCurrentWeight(profile.current_weight?.toString() || "");
      setAvatar(profile.avatar || "");
      setIsSkuf(profile.is_skuf || false);
    }
  }, [profile]);

  const handleSave = async () => {
    try {
      await updateProfile.mutateAsync({
        display_name: displayName.trim() || null,
        gender: gender === "none" ? null : gender,
        date_of_birth: dateOfBirth || null,
        height: height ? parseFloat(height) : null,
        current_weight: currentWeight ? parseFloat(currentWeight) : null,
        avatar: avatar || null,
        is_skuf: isSkuf,
      });
      toast.success("Профиль обновлен");
    } catch (error) {
      toast.error("Ошибка сохранения профиля");
    }
  };

  const handleChangePassword = async () => {
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
    setPasswordLoading(true);
    try {
      await updatePassword(newPassword);
      toast.success("Пароль успешно изменен");
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Ошибка смены пароля";
      toast.error(errorMessage);
    } finally {
      setPasswordLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
            Настройки
          </h1>
          <p className="text-muted-foreground text-base">Загрузка...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        {/* Title and subtitle */}
        <div className="flex-1 space-y-1">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
            Настройки
          </h1>
          <p className="text-muted-foreground text-base">Управление профилем</p>
        </div>

        {/* Logo - Mobile only */}
        <div className="md:hidden">
          <img
            src="/logo.jpg"
            alt="FitTrack Logo"
            className="rounded-lg object-contain"
            style={{ height: '4rem', width: '11rem' }}
          />
        </div>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center justify-between">
            <div className="flex items-center gap-2">
              <User className="h-5 w-5 text-primary" />
              Профиль
            </div>
            {/* Avatar Selection - Right Side */}
            <Popover>
              <PopoverTrigger asChild>
                <button className="flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-4xl hover:bg-primary/20 transition-colors cursor-pointer border-2 border-primary/20">
                  {avatar || "👤"}
                </button>
              </PopoverTrigger>
              <PopoverContent className="w-72" align="end">
                <div className="grid grid-cols-5 gap-2">
                  {AVATARS.map((emoji) => (
                    <button
                      key={emoji}
                      type="button"
                      onClick={() => setAvatar(emoji)}
                      className={cn(
                        "text-2xl p-3 rounded-lg transition-all hover:scale-110",
                        avatar === emoji
                          ? "bg-primary text-primary-foreground shadow-md scale-110"
                          : "bg-muted hover:bg-muted/70"
                      )}
                    >
                      {emoji}
                    </button>
                  ))}
                </div>
              </PopoverContent>
            </Popover>
          </CardTitle>
        </CardHeader>
        <CardContent>
            <div className="space-y-4">

          {/* Display Name and Gender */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="displayName">Имя</Label>
              <Input
                id="displayName"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="Введите ваше имя"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="gender">Пол (опционально)</Label>
              <Select value={gender} onValueChange={(v) => setGender(v as "male" | "female" | "other" | "none")}>
                <SelectTrigger id="gender">
                  <SelectValue placeholder="Выберите пол" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Не указано</SelectItem>
                  <SelectItem value="male">Мужской</SelectItem>
                  <SelectItem value="female">Женский</SelectItem>
                  <SelectItem value="other">Другой</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Date of Birth and Skuf */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="dateOfBirth">Дата рождения</Label>
              <Input
                id="dateOfBirth"
                type="date"
                value={dateOfBirth}
                onChange={(e) => setDateOfBirth(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="skuf">Скуф</Label>
              <div className="flex items-center h-10 px-3">
                <Checkbox
                  id="skuf"
                  checked={isSkuf}
                  onCheckedChange={(checked) => setIsSkuf(checked as boolean)}
                />
                <label
                  htmlFor="skuf"
                  className="ml-2 text-sm cursor-pointer select-none"
                >
                  {isSkuf ? "Да" : "Нет"}
                </label>
              </div>
            </div>
          </div>

          {/* Height and Weight */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="height">Рост (см)</Label>
              <Input
                id="height"
                type="number"
                step="0.1"
                value={height}
                onChange={(e) => setHeight(e.target.value)}
                placeholder="Введите рост"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="currentWeight">Вес (кг)</Label>
              <Input
                id="currentWeight"
                type="number"
                step="0.1"
                value={currentWeight}
                onChange={(e) => setCurrentWeight(e.target.value)}
                placeholder="Введите вес"
              />
            </div>
          </div>

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={updateProfile.isPending}
            className="w-full gap-2"
          >
            <Save className="h-4 w-4" />
            Сохранить
          </Button>
        </div>
        </CardContent>
      </Card>

      {/* Change Password Card */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-lg flex items-center gap-2">
            <Lock className="h-5 w-5 text-primary" />
            Сменить пароль
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="newPassword">Новый пароль</Label>
              <Input
                id="newPassword"
                type="password"
                placeholder="Минимум 6 символов"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
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
              />
            </div>
            <Button
              onClick={handleChangePassword}
              disabled={passwordLoading}
              variant="secondary"
              className="w-full gap-2"
            >
              <Lock className="h-4 w-4" />
              {passwordLoading ? "Сохранение..." : "Изменить пароль"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Logout Button */}
      <Button
        variant="outline"
        onClick={signOut}
        className="w-full gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
      >
        <LogOut className="h-4 w-4" />
        Выйти из аккаунта
      </Button>
    </div>
  );
}
