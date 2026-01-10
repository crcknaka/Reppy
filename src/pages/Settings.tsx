import { useState, useEffect } from "react";
import { useTheme } from "next-themes";
import { User, Save, LogOut, Lock, Eye, EyeOff, ChevronDown, Sun, Moon, Monitor, Download, FileJson, FileSpreadsheet } from "lucide-react";
import { useWorkouts } from "@/hooks/useWorkouts";
import { format } from "date-fns";
import * as XLSX from "xlsx-js-style";
import { useAuth } from "@/contexts/AuthContext";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog";
import { useProfile, useUpdateProfile } from "@/hooks/useProfile";
import { useAccentColor, ACCENT_COLORS } from "@/hooks/useAccentColor";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const AVATAR_CATEGORIES = [
  {
    name: "Спорт",
    emojis: ["💪", "🏋️", "🏃", "🚴", "🏊", "🧘", "🤸", "🏆", "🥇", "🎯", "⚽", "🏀", "🎾", "🥊", "🏈"]
  },
  {
    name: "Крутые",
    emojis: ["😎", "🔥", "⚡", "🚀", "💥", "✨", "👑", "🌟", "💯", "🦾", "🎖️", "💎", "🏅", "⭐", "🔱"]
  },
  {
    name: "Животные",
    emojis: ["🦁", "🐯", "🐺", "🦅", "🦊", "🐻", "🦍", "🐉", "🦈", "🐸", "🦖", "🦏", "🐘", "🦬", "🐗"]
  },
  {
    name: "Смешные",
    emojis: ["🤪", "😜", "🤓", "🥸", "🤡", "👻", "💀", "🎃", "👽", "🤖", "🥴", "😵‍💫", "🫠", "🤯", "🫡"]
  },
  {
    name: "Мемы",
    emojis: ["🗿", "💅", "🤌", "😤", "🙃", "😏", "🫣", "🤭", "😈", "👀", "🤷", "🙈", "🤦", "😬", "🥶"]
  },
  {
    name: "Еда",
    emojis: ["🍕", "🍔", "🌮", "🍣", "🍩", "🍪", "🥑", "🍗", "🥩", "🍺", "🍟", "🌭", "🍦", "🧁", "🍿"]
  },
  {
    name: "Природа",
    emojis: ["🌴", "🌵", "🍀", "🌸", "🌺", "🌻", "🍁", "🌊", "⛰️", "🌙", "☀️", "🌈", "❄️", "🔥", "💧"]
  },
  {
    name: "Техника",
    emojis: ["🎮", "🕹️", "💻", "📱", "🎧", "🎬", "📸", "🔧", "⚙️", "🔌", "💡", "🔋", "📡", "🛸", "🚗"]
  },
  {
    name: "Музыка",
    emojis: ["🎸", "🎹", "🥁", "🎺", "🎻", "🎤", "🎵", "🎶", "🎼", "🪗", "🎷", "📯", "🪕", "🪘", "🎚️"]
  },
  {
    name: "Магия",
    emojis: ["🧙", "🧚", "🧛", "🧜", "🧝", "🦸", "🦹", "🥷", "🧞", "🧟", "🪄", "🔮", "⚗️", "🪬", "🧿"]
  },
  {
    name: "Разное",
    emojis: ["🎭", "🎪", "🎨", "🤘", "🖖", "🦄", "☯️", "♾️", "🎲", "🃏", "🀄", "🧩", "🪅", "🎁", "🧸"]
  }
];

export default function Settings() {
  const { data: profile, isLoading } = useProfile();
  const { data: workouts } = useWorkouts();
  const updateProfile = useUpdateProfile();
  const { signOut, updatePassword } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { accentColor, setAccentColor } = useAccentColor();
  const logoSrc = resolvedTheme === "dark" ? "/logo-white.png" : "/logo-black.png";
  const [exportLoading, setExportLoading] = useState(false);

  const [displayName, setDisplayName] = useState("");
  const [gender, setGender] = useState<"male" | "female" | "other" | "none">("none");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [height, setHeight] = useState("");
  const [currentWeight, setCurrentWeight] = useState("");
  const [avatar, setAvatar] = useState("");
  const [skufLevel, setSkufLevel] = useState(0); // 0-4: Нормис -> Альфа-Скуф

  // Password change state
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);

  // Section states
  const [profileOpen, setProfileOpen] = useState(false);
  const [appOpen, setAppOpen] = useState(false);
  const [dataOpen, setDataOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);

  // Load profile data when it's available
  useEffect(() => {
    if (profile) {
      setDisplayName(profile.display_name || "");
      setGender(profile.gender || "none");
      setDateOfBirth(profile.date_of_birth || "");
      setHeight(profile.height?.toString() || "");
      setCurrentWeight(profile.current_weight?.toString() || "");
      setAvatar(profile.avatar || "");
      // Загружаем уровень скуфа напрямую (0-4), если null - устанавливаем 0 (Нормис)
      setSkufLevel(profile.is_skuf !== null && profile.is_skuf !== undefined ? profile.is_skuf : 0);
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
        // Сохраняем уровень скуфа напрямую (0-4)
        is_skuf: skufLevel,
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

  const exportToJSON = () => {
    if (!workouts || workouts.length === 0) {
      toast.error("Нет данных для экспорта");
      return;
    }
    setExportLoading(true);
    try {
      const exportData = {
        exportDate: new Date().toISOString(),
        profile: profile ? {
          displayName: profile.display_name,
          gender: profile.gender,
          dateOfBirth: profile.date_of_birth,
          height: profile.height,
          weight: profile.current_weight,
        } : null,
        workouts: workouts.map(w => ({
          date: w.date,
          notes: w.notes,
          sets: w.workout_sets?.map(s => ({
            exercise: s.exercise?.name,
            exerciseType: s.exercise?.type,
            setNumber: s.set_number,
            reps: s.reps,
            weight: s.weight,
            distanceKm: s.distance_km,
            durationMinutes: s.duration_minutes,
            plankSeconds: s.plank_seconds,
          })) || []
        }))
      };

      const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fittrack-export-${format(new Date(), "yyyy-MM-dd")}.json`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Данные экспортированы в JSON");
    } catch {
      toast.error("Ошибка экспорта");
    } finally {
      setExportLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!workouts || workouts.length === 0) {
      toast.error("Нет данных для экспорта");
      return;
    }
    setExportLoading(true);
    try {
      const rows: string[] = [];
      rows.push("Дата,Упражнение,Тип,Подход,Повторения,Вес (кг),Дистанция (км),Время (мин),Планка (сек),Заметки");

      workouts.forEach(w => {
        const notes = w.notes?.replace(/"/g, '""') || "";
        if (w.workout_sets && w.workout_sets.length > 0) {
          w.workout_sets.forEach(s => {
            const exerciseName = s.exercise?.name?.replace(/"/g, '""') || "";
            rows.push([
              w.date,
              `"${exerciseName}"`,
              s.exercise?.type || "",
              s.set_number,
              s.reps ?? "",
              s.weight ?? "",
              s.distance_km ?? "",
              s.duration_minutes ?? "",
              s.plank_seconds ?? "",
              `"${notes}"`
            ].join(","));
          });
        } else {
          rows.push([w.date, "", "", "", "", "", "", "", "", `"${notes}"`].join(","));
        }
      });

      const csvContent = "\uFEFF" + rows.join("\n"); // BOM for Excel
      const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `fittrack-export-${format(new Date(), "yyyy-MM-dd")}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Данные экспортированы в CSV");
    } catch {
      toast.error("Ошибка экспорта");
    } finally {
      setExportLoading(false);
    }
  };

  const exportToXLS = () => {
    if (!workouts || workouts.length === 0) {
      toast.error("Нет данных для экспорта");
      return;
    }
    setExportLoading(true);
    try {
      const headers = ["Дата", "Упражнение", "Тип", "Подход", "Повторения", "Вес (кг)", "Дистанция (км)", "Время (мин)", "Планка (сек)", "Заметки"];
      const data: (string | number | null)[][] = [headers];

      workouts.forEach(w => {
        if (w.workout_sets && w.workout_sets.length > 0) {
          w.workout_sets.forEach(s => {
            data.push([
              w.date,
              s.exercise?.name || "",
              s.exercise?.type || "",
              s.set_number,
              s.reps,
              s.weight,
              s.distance_km,
              s.duration_minutes,
              s.plank_seconds,
              w.notes || ""
            ]);
          });
        } else {
          data.push([w.date, "", "", null, null, null, null, null, null, w.notes || ""]);
        }
      });

      const worksheet = XLSX.utils.aoa_to_sheet(data);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "Тренировки");

      // Column widths
      const colWidths = [
        { wch: 12 }, // Дата
        { wch: 25 }, // Упражнение
        { wch: 12 }, // Тип
        { wch: 8 },  // Подход
        { wch: 12 }, // Повторения
        { wch: 10 }, // Вес
        { wch: 14 }, // Дистанция
        { wch: 12 }, // Время
        { wch: 12 }, // Планка
        { wch: 30 }, // Заметки
      ];
      worksheet["!cols"] = colWidths;

      // Style headers (bold) and center numeric columns
      const centerCols = [3, 4, 5, 6, 7, 8]; // Подход, Повторения, Вес, Дистанция, Время, Планка (0-indexed)
      const range = XLSX.utils.decode_range(worksheet["!ref"] || "A1");

      for (let C = range.s.c; C <= range.e.c; C++) {
        // Header row - bold
        const headerCell = worksheet[XLSX.utils.encode_cell({ r: 0, c: C })];
        if (headerCell) {
          headerCell.s = {
            font: { bold: true },
            alignment: { horizontal: "center", vertical: "center" }
          };
        }

        // Data rows - center numeric columns
        if (centerCols.includes(C)) {
          for (let R = 1; R <= range.e.r; R++) {
            const cell = worksheet[XLSX.utils.encode_cell({ r: R, c: C })];
            if (cell) {
              cell.s = { alignment: { horizontal: "center", vertical: "center" } };
            }
          }
        }
      }

      XLSX.writeFile(workbook, `fittrack-export-${format(new Date(), "yyyy-MM-dd")}.xlsx`);
      toast.success("Данные экспортированы в Excel");
    } catch {
      toast.error("Ошибка экспорта");
    } finally {
      setExportLoading(false);
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
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-4">
        {/* Title and subtitle */}
        <div className="flex-1 space-y-1">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
            Настройки
          </h1>
        </div>

        {/* Logo - Mobile only */}
        <div className="md:hidden">
          <img
            src={logoSrc}
            alt="FitTrack Logo"
            className="rounded-lg object-contain"
            style={{ height: '5rem', width: '13rem' }}
          />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          СЕКЦИЯ: ПРОФИЛЬ
      ═══════════════════════════════════════════════════════════════ */}
      <Collapsible open={profileOpen} onOpenChange={setProfileOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-4 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg">
              <CardTitle className="text-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-primary" />
                  Профиль
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-3xl">{avatar || "👤"}</span>
                  <ChevronDown className={cn(
                    "h-5 w-5 text-muted-foreground transition-transform duration-200",
                    profileOpen && "rotate-180"
                  )} />
                </div>
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-4 pb-6">
              <div className="space-y-4">
                {/* Avatar + Age */}
                <div className="flex items-center gap-4">
                  {/* Avatar Selection */}
                  <Dialog>
                    <DialogTrigger asChild>
                      <button className="flex-shrink-0 flex items-center justify-center w-20 h-20 rounded-full bg-primary/10 text-5xl hover:bg-primary/20 transition-colors cursor-pointer border-2 border-primary/20">
                        {avatar || "👤"}
                      </button>
                    </DialogTrigger>
                    <DialogContent className="max-w-sm max-h-[80vh] overflow-y-auto">
                      <DialogHeader>
                        <DialogTitle>Выбери аватар</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-2">
                        {AVATAR_CATEGORIES.map((category) => (
                          <div key={category.name}>
                            <p className="text-xs font-medium text-muted-foreground mb-2">{category.name}</p>
                            <div className="grid grid-cols-5 gap-2">
                              {category.emojis.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => setAvatar(emoji)}
                                  className={cn(
                                    "text-2xl p-2.5 rounded-lg transition-all active:scale-95",
                                    avatar === emoji
                                      ? "bg-primary text-primary-foreground shadow-md ring-2 ring-primary ring-offset-2"
                                      : "bg-muted hover:bg-muted/70"
                                  )}
                                >
                                  {emoji}
                                </button>
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    </DialogContent>
                  </Dialog>

                  {/* Age display */}
                  {dateOfBirth && (() => {
                    const birthDate = new Date(dateOfBirth);
                    const today = new Date();
                    let age = today.getFullYear() - birthDate.getFullYear();
                    const monthDiff = today.getMonth() - birthDate.getMonth();
                    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) {
                      age--;
                    }
                    if (age >= 0 && age < 150) {
                      const lastDigit = age % 10;
                      const lastTwoDigits = age % 100;
                      let suffix = "лет";
                      if (lastTwoDigits >= 11 && lastTwoDigits <= 14) {
                        suffix = "лет";
                      } else if (lastDigit === 1) {
                        suffix = "год";
                      } else if (lastDigit >= 2 && lastDigit <= 4) {
                        suffix = "года";
                      }
                      return (
                        <div className="text-center">
                          <div className="text-3xl font-bold text-primary">{age}</div>
                          <div className="text-sm text-muted-foreground">{suffix}</div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                </div>

                {/* Display Name and Gender */}
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label htmlFor="displayName">Имя</Label>
                    <Input
                      id="displayName"
                      type="text"
                      value={displayName}
                      onChange={(e) => setDisplayName(e.target.value)}
                      placeholder="Введите имя"
                    />
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="gender">Пол</Label>
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

                {/* Date of Birth and Zodiac */}
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
                    <Label>Знак зодиака</Label>
                    {dateOfBirth ? (() => {
                      const birthDate = new Date(dateOfBirth);
                      const month = birthDate.getMonth() + 1;
                      const day = birthDate.getDate();
                      const zodiacSigns = [
                        { sign: "♑", name: "Козерог", end: [1, 19], desc: "Работает даже в зале. Цель — стать CEO фитнеса" },
                        { sign: "♒", name: "Водолей", end: [2, 18], desc: "Изобретает новые упражнения. Никто не понимает технику" },
                        { sign: "♓", name: "Рыбы", end: [3, 20], desc: "Мечтает о кубиках, лёжа на диване" },
                        { sign: "♈", name: "Овен", end: [4, 19], desc: "Первый у штанги, первый в травмпункте" },
                        { sign: "♉", name: "Телец", end: [5, 20], desc: "Тренируется ради еды после тренировки" },
                        { sign: "♊", name: "Близнецы", end: [6, 20], desc: "Полтренировки — селфи, полтренировки — сплетни" },
                        { sign: "♋", name: "Рак", end: [7, 22], desc: "Тренируется дома. Люди — это слишком" },
                        { sign: "♌", name: "Лев", end: [8, 22], desc: "Зеркало в зале — главный тренажёр" },
                        { sign: "♍", name: "Дева", end: [9, 22], desc: "Идеальная техника. Поправляет всех вокруг" },
                        { sign: "♎", name: "Весы", end: [10, 22], desc: "40 минут выбирает программу тренировок" },
                        { sign: "♏", name: "Скорпион", end: [11, 21], desc: "Тренируется в чёрном. Смотрит исподлобья" },
                        { sign: "♐", name: "Стрелец", end: [12, 21], desc: "Сегодня йога, завтра кроссфит, послезавтра бокс" },
                        { sign: "♑", name: "Козерог", end: [12, 31], desc: "Работает даже в зале. Цель — стать CEO фитнеса" },
                      ];
                      const zodiac = zodiacSigns.find(z =>
                        month < z.end[0] || (month === z.end[0] && day <= z.end[1])
                      ) || zodiacSigns[0];
                      return (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="flex items-center gap-2 h-10 px-3 rounded-md border border-input bg-background hover:bg-muted/50 transition-colors w-full">
                              <span className="text-xl">{zodiac.sign}</span>
                              <span className="text-sm">{zodiac.name}</span>
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-3">
                            <div className="flex items-start gap-2">
                              <span className="text-2xl">{zodiac.sign}</span>
                              <div>
                                <p className="font-medium">{zodiac.name}</p>
                                <p className="text-sm text-muted-foreground">{zodiac.desc}</p>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      );
                    })() : (
                      <div className="flex items-center h-10 px-3 rounded-md border border-input bg-background text-muted-foreground text-sm">
                        —
                      </div>
                    )}
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

                {/* Skuf Level Slider - Easter Egg */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>Нормис</span>
                    <span>Альфа-Скуф</span>
                  </div>

                  {/* Level buttons */}
                  <div className="grid grid-cols-5 gap-1">
                    {[
                      { level: 0, emoji: "😊", label: "Нормис", color: "from-blue-400 to-cyan-500" },
                      { level: 1, emoji: "😏", label: "Дерзкий", color: "from-green-400 to-emerald-500" },
                      { level: 2, emoji: "😤", label: "Качок", color: "from-yellow-400 to-orange-500" },
                      { level: 3, emoji: "🔥", label: "Скуф", color: "from-orange-400 to-red-500" },
                      { level: 4, emoji: "🗿", label: "Альфа", color: "from-red-500 to-rose-600" },
                    ].map((item) => (
                      <button
                        key={item.level}
                        onClick={() => setSkufLevel(item.level)}
                        className={cn(
                          "flex flex-col items-center gap-1 p-2 rounded-lg transition-all duration-200",
                          skufLevel === item.level
                            ? `bg-gradient-to-br ${item.color} text-white shadow-lg scale-105`
                            : "bg-muted hover:bg-muted/70 hover:scale-102"
                        )}
                      >
                        <span className="text-xl">{item.emoji}</span>
                        <span className="text-[10px] font-medium leading-tight">{item.label}</span>
                      </button>
                    ))}
                  </div>

                  {/* Status message */}
                  <div className={cn(
                    "text-center text-xs py-1.5 rounded-full transition-all duration-300",
                    skufLevel === 0 && "bg-blue-500/10 text-blue-500",
                    skufLevel === 1 && "bg-green-500/10 text-green-500",
                    skufLevel === 2 && "bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
                    skufLevel === 3 && "bg-orange-500/10 text-orange-500",
                    skufLevel === 4 && "bg-red-500/10 text-red-500"
                  )}>
                    {skufLevel === 0 && "Обычный пользователь"}
                    {skufLevel === 1 && "Начинающий качок"}
                    {skufLevel === 2 && "Опытный качок"}
                    {skufLevel === 3 && "Режим скуфа активен!"}
                    {skufLevel === 4 && "АЛЬФА-СКУФ ДЕТЕКТЕД 🗿🗿🗿"}
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
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* ═══════════════════════════════════════════════════════════════
          СЕКЦИЯ: ПРИЛОЖЕНИЕ
      ═══════════════════════════════════════════════════════════════ */}
      <Collapsible open={appOpen} onOpenChange={setAppOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-4 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg">
              <CardTitle className="text-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {theme === "dark" ? <Moon className="h-5 w-5 text-primary" /> :
                   theme === "light" ? <Sun className="h-5 w-5 text-primary" /> :
                   <Monitor className="h-5 w-5 text-primary" />}
                  Приложение
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {theme === "dark" ? "Тёмная" : theme === "light" ? "Светлая" : "Авто"}
                  </span>
                  <ChevronDown className={cn(
                    "h-5 w-5 text-muted-foreground transition-transform duration-200",
                    appOpen && "rotate-180"
                  )} />
                </div>
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-4 pb-6 space-y-6">
              {/* Тема */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Тема</p>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setTheme("light")}
                    className={cn(
                      "flex flex-col items-center gap-2 p-3 rounded-lg transition-all",
                      theme === "light"
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "bg-muted hover:bg-muted/70"
                    )}
                  >
                    <Sun className="h-5 w-5" />
                    <span className="text-sm font-medium">Светлая</span>
                  </button>
                  <button
                    onClick={() => setTheme("dark")}
                    className={cn(
                      "flex flex-col items-center gap-2 p-3 rounded-lg transition-all",
                      theme === "dark"
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "bg-muted hover:bg-muted/70"
                    )}
                  >
                    <Moon className="h-5 w-5" />
                    <span className="text-sm font-medium">Тёмная</span>
                  </button>
                  <button
                    onClick={() => setTheme("system")}
                    className={cn(
                      "flex flex-col items-center gap-2 p-3 rounded-lg transition-all",
                      theme === "system"
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "bg-muted hover:bg-muted/70"
                    )}
                  >
                    <Monitor className="h-5 w-5" />
                    <span className="text-sm font-medium">Авто</span>
                  </button>
                </div>
              </div>

              {/* Цвет акцента */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">Цвет акцента</p>
                <div className="grid grid-cols-6 gap-2">
                  {ACCENT_COLORS.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => setAccentColor(color.value)}
                      className={cn(
                        "flex items-center justify-center w-full aspect-square rounded-lg transition-all",
                        accentColor === color.value
                          ? "ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110"
                          : "hover:scale-105"
                      )}
                      style={{ backgroundColor: color.color }}
                      title={color.label}
                    />
                  ))}
                </div>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* ═══════════════════════════════════════════════════════════════
          СЕКЦИЯ: ДАННЫЕ
      ═══════════════════════════════════════════════════════════════ */}
      <Collapsible open={dataOpen} onOpenChange={setDataOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-4 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg">
              <CardTitle className="text-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Download className="h-5 w-5 text-primary" />
                  Данные
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-muted-foreground">
                    {workouts?.length || 0} тренировок
                  </span>
                  <ChevronDown className={cn(
                    "h-5 w-5 text-muted-foreground transition-transform duration-200",
                    dataOpen && "rotate-180"
                  )} />
                </div>
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-4 pb-6">
              <p className="text-sm text-muted-foreground mb-4">
                Скачайте все ваши тренировки для резервного копирования или анализа
              </p>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  onClick={exportToXLS}
                  disabled={exportLoading || !workouts?.length}
                  className="gap-2"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  Excel
                </Button>
                <Button
                  variant="outline"
                  onClick={exportToCSV}
                  disabled={exportLoading || !workouts?.length}
                  className="gap-2"
                >
                  <FileSpreadsheet className="h-4 w-4" />
                  CSV
                </Button>
                <Button
                  variant="outline"
                  onClick={exportToJSON}
                  disabled={exportLoading || !workouts?.length}
                  className="gap-2"
                >
                  <FileJson className="h-4 w-4" />
                  JSON
                </Button>
              </div>
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* ═══════════════════════════════════════════════════════════════
          СЕКЦИЯ: СМЕНА ПАРОЛЯ
      ═══════════════════════════════════════════════════════════════ */}
      <Collapsible open={securityOpen} onOpenChange={setSecurityOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-4 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg">
              <CardTitle className="text-lg flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="h-5 w-5 text-primary" />
                  Смена пароля
                </div>
                <ChevronDown className={cn(
                  "h-5 w-5 text-muted-foreground transition-transform duration-200",
                  securityOpen && "rotate-180"
                )} />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="pt-4 pb-6">
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="newPassword">Новый пароль</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      placeholder="Минимум 6 символов"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showNewPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                    </button>
                  </div>
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
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* ═══════════════════════════════════════════════════════════════
          ВЫХОД ИЗ АККАУНТА
      ═══════════════════════════════════════════════════════════════ */}
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            variant="outline"
            className="w-full gap-2 text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
          >
            <LogOut className="h-4 w-4" />
            Выйти из аккаунта
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Выйти из аккаунта?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите выйти из аккаунта?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction
              onClick={signOut}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Выйти
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
