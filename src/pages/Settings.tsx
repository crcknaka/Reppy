import { useState, useEffect, useRef, useMemo } from "react";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import { User, LogOut, Lock, Eye, EyeOff, ChevronDown, Sun, Moon, Monitor, Download, FileJson, FileSpreadsheet, Check, Loader2, CloudOff } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { useOfflineProfile, useOfflineUpdateProfile, useOfflineWorkouts } from "@/offline";
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
import { useAccentColor, ACCENT_COLORS } from "@/hooks/useAccentColor";
import { useUnits, UNIT_SYSTEMS } from "@/hooks/useUnits";
import { LANGUAGES } from "@/lib/i18n";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

const AVATAR_CATEGORIES = [
  {
    key: "sport",
    emojis: ["💪", "🏋️", "🏃", "🚴", "🏊", "🧘", "🤸", "🏆", "🥇", "🎯", "⚽", "🏀", "🎾", "🥊", "🏈"]
  },
  {
    key: "cool",
    emojis: ["😎", "🔥", "⚡", "🚀", "💥", "✨", "👑", "🌟", "💯", "🦾", "🎖️", "💎", "🏅", "⭐", "🔱"]
  },
  {
    key: "animals",
    emojis: ["🦁", "🐯", "🐺", "🦅", "🦊", "🐻", "🦍", "🐉", "🦈", "🐸", "🦖", "🦏", "🐘", "🦬", "🐗"]
  },
  {
    key: "funny",
    emojis: ["🤪", "😜", "🤓", "🥸", "🤡", "👻", "💀", "🎃", "👽", "🤖", "🥴", "😵‍💫", "🫠", "🤯", "🫡"]
  },
  {
    key: "memes",
    emojis: ["🗿", "💅", "🤌", "😤", "🙃", "😏", "🫣", "🤭", "😈", "👀", "🤷", "🙈", "🤦", "😬", "🥶"]
  },
  {
    key: "food",
    emojis: ["🍕", "🍔", "🌮", "🍣", "🍩", "🍪", "🥑", "🍗", "🥩", "🍺", "🍟", "🌭", "🍦", "🧁", "🍿"]
  },
  {
    key: "nature",
    emojis: ["🌴", "🌵", "🍀", "🌸", "🌺", "🌻", "🍁", "🌊", "⛰️", "🌙", "☀️", "🌈", "❄️", "🔥", "💧"]
  },
  {
    key: "tech",
    emojis: ["🎮", "🕹️", "💻", "📱", "🎧", "🎬", "📸", "🔧", "⚙️", "🔌", "💡", "🔋", "📡", "🛸", "🚗"]
  },
  {
    key: "music",
    emojis: ["🎸", "🎹", "🥁", "🎺", "🎻", "🎤", "🎵", "🎶", "🎼", "🪗", "🎷", "📯", "🪕", "🪘", "🎚️"]
  },
  {
    key: "magic",
    emojis: ["🧙", "🧚", "🧛", "🧜", "🧝", "🦸", "🦹", "🥷", "🧞", "🧟", "🪄", "🔮", "⚗️", "🪬", "🧿"]
  },
  {
    key: "misc",
    emojis: ["🎭", "🎪", "🎨", "🤘", "🖖", "🦄", "☯️", "♾️", "🎲", "🃏", "🀄", "🧩", "🪅", "🎁", "🧸"]
  }
];

export default function Settings() {
  const { t, i18n } = useTranslation();
  const { data: profile, isLoading } = useOfflineProfile();
  const { data: workouts } = useOfflineWorkouts();
  const updateProfile = useOfflineUpdateProfile();
  const { signOut, updatePassword } = useAuth();
  const { theme, setTheme, resolvedTheme } = useTheme();
  const { accentColor, setAccentColor } = useAccentColor();
  const { unitSystem, setUnitSystem, units, convertWeight, convertHeight, toMetricWeight, toMetricHeight } = useUnits();
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

  // Auto-save status: 'idle' | 'saving' | 'saved' | 'offline'
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'offline'>('idle');
  const saveStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Track if form has been initialized to prevent overwriting user edits
  const formInitializedRef = useRef(false);

  // Track if user has made changes (to trigger auto-save)
  const hasUserChangesRef = useRef(false);

  // Load profile data only on initial load (not on every profile update)
  useEffect(() => {
    if (profile && !formInitializedRef.current) {
      formInitializedRef.current = true;
      setDisplayName(profile.display_name || "");
      setGender(profile.gender || "none");
      setDateOfBirth(profile.date_of_birth || "");
      // Convert from metric (stored) to user's unit system for display
      if (profile.height) {
        const converted = convertHeight(profile.height);
        if (typeof converted === "object") {
          // Imperial: show as feet (will handle inches separately if needed)
          setHeight(converted.feet.toString());
        } else {
          setHeight(converted.toString());
        }
      } else {
        setHeight("");
      }
      setCurrentWeight(profile.current_weight ? convertWeight(profile.current_weight).toString() : "");
      setAvatar(profile.avatar || "");
      // Загружаем уровень скуфа напрямую (0-4), если null - устанавливаем 0 (Нормис)
      setSkufLevel(profile.is_skuf !== null && profile.is_skuf !== undefined ? profile.is_skuf : 0);
    }
  }, [profile, convertHeight, convertWeight]);

  // Track previous unit system to detect changes
  const prevUnitSystemRef = useRef(unitSystem);

  // Store current values in refs for conversion
  const heightRef = useRef(height);
  const currentWeightRef = useRef(currentWeight);
  heightRef.current = height;
  currentWeightRef.current = currentWeight;

  // Convert height/weight when unit system changes
  useEffect(() => {
    // Skip on initial render or if unit system hasn't changed
    if (prevUnitSystemRef.current === unitSystem) return;

    const prevSystem = prevUnitSystemRef.current;
    prevUnitSystemRef.current = unitSystem;

    // Convert height
    if (heightRef.current) {
      const heightNum = parseFloat(heightRef.current);
      if (!isNaN(heightNum)) {
        if (prevSystem === "metric" && unitSystem === "imperial") {
          // cm -> ft (approximate, just feet)
          const totalInches = heightNum * 0.393701;
          const feet = Math.round(totalInches / 12 * 10) / 10;
          setHeight(feet.toString());
        } else if (prevSystem === "imperial" && unitSystem === "metric") {
          // ft -> cm
          const cm = Math.round(heightNum * 12 / 0.393701);
          setHeight(cm.toString());
        }
      }
    }

    // Convert weight
    if (currentWeightRef.current) {
      const weightNum = parseFloat(currentWeightRef.current);
      if (!isNaN(weightNum)) {
        if (prevSystem === "metric" && unitSystem === "imperial") {
          // kg -> lb
          const lb = Math.round(weightNum * 2.20462 * 10) / 10;
          setCurrentWeight(lb.toString());
        } else if (prevSystem === "imperial" && unitSystem === "metric") {
          // lb -> kg
          const kg = Math.round(weightNum / 2.20462 * 10) / 10;
          setCurrentWeight(kg.toString());
        }
      }
    }
  }, [unitSystem]);

  // Create a stable string representation of profile data for debouncing
  const profileDataString = useMemo(() =>
    JSON.stringify({ displayName, gender, dateOfBirth, height, currentWeight, avatar, skufLevel }),
    [displayName, gender, dateOfBirth, height, currentWeight, avatar, skufLevel]
  );

  // Debounce the string with 1.5 second delay
  const debouncedProfileDataString = useDebounce(profileDataString, 1500);

  // Track last saved data to prevent duplicate saves
  const lastSavedDataRef = useRef<string>("");

  // Store refs to avoid dependency issues
  const updateProfileRef = useRef(updateProfile);
  const toMetricHeightRef = useRef(toMetricHeight);
  const toMetricWeightRef = useRef(toMetricWeight);

  // Keep refs updated
  useEffect(() => {
    updateProfileRef.current = updateProfile;
    toMetricHeightRef.current = toMetricHeight;
    toMetricWeightRef.current = toMetricWeight;
  });

  // Auto-save when debounced profile data changes
  useEffect(() => {
    // Skip if form not initialized or no user changes
    if (!formInitializedRef.current || !hasUserChangesRef.current) return;

    // Skip if data hasn't actually changed
    if (debouncedProfileDataString === lastSavedDataRef.current) return;

    // Mark as saved immediately to prevent re-runs
    lastSavedDataRef.current = debouncedProfileDataString;

    const saveProfile = async () => {
      // Clear any existing timeout
      if (saveStatusTimeoutRef.current) {
        clearTimeout(saveStatusTimeoutRef.current);
      }

      setSaveStatus('saving');

      try {
        const data = JSON.parse(debouncedProfileDataString);

        // Convert from user's unit system to metric for storage
        const heightInCm = data.height ? toMetricHeightRef.current(parseFloat(data.height)) : null;
        const weightInKg = data.currentWeight ? toMetricWeightRef.current(parseFloat(data.currentWeight)) : null;

        await updateProfileRef.current.mutateAsync({
          display_name: data.displayName.trim() || null,
          gender: data.gender === "none" ? null : data.gender,
          date_of_birth: data.dateOfBirth || null,
          height: heightInCm,
          current_weight: weightInKg,
          avatar: data.avatar || null,
          is_skuf: data.skufLevel,
        });

        // Check if we're online or offline
        setSaveStatus(navigator.onLine ? 'saved' : 'offline');

        // Reset to idle after 2 seconds
        saveStatusTimeoutRef.current = setTimeout(() => {
          setSaveStatus('idle');
        }, 2000);

      } catch {
        // On error, show offline status (data is saved locally)
        setSaveStatus('offline');
        saveStatusTimeoutRef.current = setTimeout(() => {
          setSaveStatus('idle');
        }, 2000);
      }
    };

    saveProfile();
  }, [debouncedProfileDataString]); // Only depend on the debounced string

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (saveStatusTimeoutRef.current) {
        clearTimeout(saveStatusTimeoutRef.current);
      }
    };
  }, []);

  // Helper to mark that user has made changes
  const markChanged = () => {
    hasUserChangesRef.current = true;
  };

  const handleChangePassword = async () => {
    if (!newPassword || !confirmPassword) {
      toast.error(t("settings.fillBothFields"));
      return;
    }
    if (newPassword.length < 6) {
      toast.error(t("settings.passwordMinLength"));
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error(t("settings.passwordsNoMatch"));
      return;
    }
    setPasswordLoading(true);
    try {
      await updatePassword(newPassword);
      toast.success(t("settings.passwordChanged"));
      setNewPassword("");
      setConfirmPassword("");
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : t("settings.passwordChangeError");
      toast.error(errorMessage);
    } finally {
      setPasswordLoading(false);
    }
  };

  const exportToJSON = () => {
    if (!workouts || workouts.length === 0) {
      toast.error(t("settings.noDataToExport"));
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
      toast.success(t("settings.exportedToJson"));
    } catch {
      toast.error(t("settings.exportError"));
    } finally {
      setExportLoading(false);
    }
  };

  const exportToCSV = () => {
    if (!workouts || workouts.length === 0) {
      toast.error(t("settings.noDataToExport"));
      return;
    }
    setExportLoading(true);
    try {
      const rows: string[] = [];
      rows.push("Date,Exercise,Type,Set,Reps,Weight (kg),Distance (km),Time (min),Plank (sec),Notes");

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
      toast.success(t("settings.exportedToCsv"));
    } catch {
      toast.error(t("settings.exportError"));
    } finally {
      setExportLoading(false);
    }
  };

  const exportToXLS = () => {
    if (!workouts || workouts.length === 0) {
      toast.error(t("settings.noDataToExport"));
      return;
    }
    setExportLoading(true);
    try {
      const headers = ["Date", "Exercise", "Type", "Set", "Reps", "Weight (kg)", "Distance (km)", "Time (min)", "Plank (sec)", "Notes"];
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
      XLSX.utils.book_append_sheet(workbook, worksheet, "Workouts");

      // Column widths
      const colWidths = [
        { wch: 12 }, // Date
        { wch: 25 }, // Exercise
        { wch: 12 }, // Type
        { wch: 8 },  // Set
        { wch: 12 }, // Reps
        { wch: 10 }, // Weight
        { wch: 14 }, // Distance
        { wch: 12 }, // Time
        { wch: 12 }, // Plank
        { wch: 30 }, // Notes
      ];
      worksheet["!cols"] = colWidths;

      // Style headers (bold) and center numeric columns
      const centerCols = [3, 4, 5, 6, 7, 8]; // Set, Reps, Weight, Distance, Time, Plank (0-indexed)
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
      toast.success(t("settings.exportedToExcel"));
    } catch {
      toast.error(t("settings.exportError"));
    } finally {
      setExportLoading(false);
    }
  };

  if (isLoading) {
    return (
      <div className="space-y-6 animate-fade-in">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
            {t("settings.title")}
          </h1>
          <p className="text-muted-foreground text-sm">{t("common.loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 animate-fade-in">
      <div className="flex items-center gap-4">
        {/* Title and subtitle */}
        <div className="flex-1 space-y-1">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
            {t("settings.title")}
          </h1>
        </div>

        {/* Logo - Mobile only */}
        <div className="md:hidden">
          <img
            src={logoSrc}
            alt="FitTrack Logo"
            className="rounded-lg object-contain"
            style={{ height: '4rem', width: '10.5rem' }}
          />
        </div>
      </div>

      {/* ═══════════════════════════════════════════════════════════════
          СЕКЦИЯ: ПРОФИЛЬ
      ═══════════════════════════════════════════════════════════════ */}
      <Collapsible open={profileOpen} onOpenChange={setProfileOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="pb-2 pt-4 px-4 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4 text-primary" />
                  {t("settings.profile")}
                </div>
                <div className="flex items-center gap-3">
                  {/* Auto-save status indicator */}
                  {saveStatus !== 'idle' && (
                    <div className={cn(
                      "flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-all",
                      saveStatus === 'saving' && "bg-muted text-muted-foreground",
                      saveStatus === 'saved' && "bg-green-500/10 text-green-600 dark:text-green-400",
                      saveStatus === 'offline' && "bg-amber-500/10 text-amber-600 dark:text-amber-400"
                    )}>
                      {saveStatus === 'saving' && (
                        <>
                          <Loader2 className="h-3 w-3 animate-spin" />
                          <span>{t("settings.saving")}</span>
                        </>
                      )}
                      {saveStatus === 'saved' && (
                        <>
                          <Check className="h-3 w-3" />
                          <span>{t("settings.saved")}</span>
                        </>
                      )}
                      {saveStatus === 'offline' && (
                        <>
                          <CloudOff className="h-3 w-3" />
                          <span>{t("settings.savedOffline")}</span>
                        </>
                      )}
                    </div>
                  )}
                  <span className="text-2xl">{avatar || "👤"}</span>
                  <ChevronDown className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform duration-200",
                    profileOpen && "rotate-180"
                  )} />
                </div>
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="px-4 pb-4">
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
                        <DialogTitle>{t("settings.selectAvatar")}</DialogTitle>
                      </DialogHeader>
                      <div className="space-y-4 pt-2">
                        {AVATAR_CATEGORIES.map((category) => (
                          <div key={category.key}>
                            <p className="text-xs font-medium text-muted-foreground mb-2">{t(`settings.avatarCategories.${category.key}`)}</p>
                            <div className="grid grid-cols-5 gap-2">
                              {category.emojis.map((emoji) => (
                                <button
                                  key={emoji}
                                  type="button"
                                  onClick={() => { setAvatar(emoji); markChanged(); }}
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
                      return (
                        <div className="text-center">
                          <div className="text-3xl font-bold text-primary">{age}</div>
                          <div className="text-sm text-muted-foreground">
                            {t("plurals.year", { count: age })}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  {/* Admin badge - aligned to the right */}
                  {profile?.is_admin && (
                    <div className="ml-auto flex items-center gap-2 px-3 py-2 rounded-lg bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
                      <span className="text-2xl">👑</span>
                      <div className="text-center">
                        <div className="text-xs font-bold text-amber-600 dark:text-amber-400">ADMIN</div>
                        <div className="text-[10px] text-muted-foreground">{t("settings.admin")}</div>
                      </div>
                    </div>
                  )}
                </div>

                {/* Display Name and Gender */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="displayName" className="text-xs">{t("settings.name")}</Label>
                    <Input
                      id="displayName"
                      type="text"
                      value={displayName}
                      onChange={(e) => { setDisplayName(e.target.value); markChanged(); }}
                      placeholder={t("settings.enterName")}
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="gender" className="text-xs">{t("settings.gender")}</Label>
                    <Select value={gender} onValueChange={(v) => { setGender(v as "male" | "female" | "other" | "none"); markChanged(); }}>
                      <SelectTrigger id="gender" className="h-9 text-xs">
                        <SelectValue placeholder={t("settings.selectGender")} />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">{t("settings.genderNone")}</SelectItem>
                        <SelectItem value="male">{t("settings.genderMale")}</SelectItem>
                        <SelectItem value="female">{t("settings.genderFemale")}</SelectItem>
                        <SelectItem value="other">{t("settings.genderOther")}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                {/* Date of Birth and Zodiac */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="dateOfBirth" className="text-xs">{t("settings.dateOfBirth")}</Label>
                    <Input
                      id="dateOfBirth"
                      type="date"
                      value={dateOfBirth}
                      onChange={(e) => { setDateOfBirth(e.target.value); markChanged(); }}
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs">{t("settings.zodiacSign")}</Label>
                    {dateOfBirth ? (() => {
                      const birthDate = new Date(dateOfBirth);
                      const month = birthDate.getMonth() + 1;
                      const day = birthDate.getDate();
                      const zodiacSigns = [
                        { sign: "♑", key: "capricorn", end: [1, 19] },
                        { sign: "♒", key: "aquarius", end: [2, 18] },
                        { sign: "♓", key: "pisces", end: [3, 20] },
                        { sign: "♈", key: "aries", end: [4, 19] },
                        { sign: "♉", key: "taurus", end: [5, 20] },
                        { sign: "♊", key: "gemini", end: [6, 20] },
                        { sign: "♋", key: "cancer", end: [7, 22] },
                        { sign: "♌", key: "leo", end: [8, 22] },
                        { sign: "♍", key: "virgo", end: [9, 22] },
                        { sign: "♎", key: "libra", end: [10, 22] },
                        { sign: "♏", key: "scorpio", end: [11, 21] },
                        { sign: "♐", key: "sagittarius", end: [12, 21] },
                        { sign: "♑", key: "capricorn", end: [12, 31] },
                      ];
                      const zodiac = zodiacSigns.find(z =>
                        month < z.end[0] || (month === z.end[0] && day <= z.end[1])
                      ) || zodiacSigns[0];
                      return (
                        <Popover>
                          <PopoverTrigger asChild>
                            <button className="flex items-center gap-2 h-9 px-3 rounded-md border border-input bg-background hover:bg-muted/50 transition-colors w-full text-xs">
                              <span className="text-base">{zodiac.sign}</span>
                              <span>{t(`zodiac.${zodiac.key}`)}</span>
                            </button>
                          </PopoverTrigger>
                          <PopoverContent className="w-64 p-3">
                            <div className="flex items-start gap-2">
                              <span className="text-2xl">{zodiac.sign}</span>
                              <div>
                                <p className="font-medium">{t(`zodiac.${zodiac.key}`)}</p>
                              </div>
                            </div>
                          </PopoverContent>
                        </Popover>
                      );
                    })() : (
                      <div className="flex items-center h-9 px-3 rounded-md border border-input bg-background text-muted-foreground text-xs">
                        —
                      </div>
                    )}
                  </div>
                </div>

                {/* Height and Weight */}
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1.5">
                    <Label htmlFor="height" className="text-xs">{t("settings.height")} ({units.height})</Label>
                    <Input
                      id="height"
                      type="number"
                      step="0.1"
                      value={height}
                      onChange={(e) => { setHeight(e.target.value); markChanged(); }}
                      placeholder={t("settings.enterHeight")}
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="currentWeight" className="text-xs">{t("settings.weight")} ({units.weight})</Label>
                    <Input
                      id="currentWeight"
                      type="number"
                      step="0.1"
                      value={currentWeight}
                      onChange={(e) => { setCurrentWeight(e.target.value); markChanged(); }}
                      placeholder={t("settings.enterWeight")}
                      className="h-9 text-xs"
                    />
                  </div>
                </div>

                {/* Skuf Level Slider - Easter Egg */}
                <div className="space-y-3 pt-2">
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{t("settings.skufLevels.normie")}</span>
                    <span>{t("settings.skufLevels.alpha")}-{t("settings.skufLevels.skuf")}</span>
                  </div>

                  {/* Level buttons */}
                  <div className="grid grid-cols-5 gap-1">
                    {[
                      { level: 0, emoji: "😊", labelKey: "settings.skufLevels.normie", color: "from-blue-400 to-cyan-500" },
                      { level: 1, emoji: "😏", labelKey: "settings.skufLevels.bold", color: "from-green-400 to-emerald-500" },
                      { level: 2, emoji: "😤", labelKey: "settings.skufLevels.jock", color: "from-yellow-400 to-orange-500" },
                      { level: 3, emoji: "🔥", labelKey: "settings.skufLevels.skuf", color: "from-orange-400 to-red-500" },
                      { level: 4, emoji: "🗿", labelKey: "settings.skufLevels.alpha", color: "from-red-500 to-rose-600" },
                    ].map((item) => (
                      <button
                        key={item.level}
                        onClick={() => { setSkufLevel(item.level); markChanged(); }}
                        className={cn(
                          "flex flex-col items-center gap-1 p-2 rounded-lg transition-all duration-200",
                          skufLevel === item.level
                            ? `bg-gradient-to-br ${item.color} text-white shadow-lg scale-105`
                            : "bg-muted hover:bg-muted/70 hover:scale-102"
                        )}
                      >
                        <span className="text-xl">{item.emoji}</span>
                        <span className="text-[10px] font-medium leading-tight">{t(item.labelKey)}</span>
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
                    {t(`settings.skufStatus.${skufLevel}`)}
                    {skufLevel === 4 && " 🗿🗿🗿"}
                  </div>
                </div>

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
            <CardHeader className="pb-2 pt-4 px-4 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <div className="flex items-center gap-2">
                  {theme === "dark" ? <Moon className="h-4 w-4 text-primary" /> :
                   theme === "light" ? <Sun className="h-4 w-4 text-primary" /> :
                   <Monitor className="h-4 w-4 text-primary" />}
                  {t("settings.application")}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {theme === "dark" ? t("settings.themeDark") : theme === "light" ? t("settings.themeLight") : t("settings.themeAuto")}
                  </span>
                  <ChevronDown className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform duration-200",
                    appOpen && "rotate-180"
                  )} />
                </div>
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="px-4 pb-4 space-y-4">
              {/* Тема */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">{t("settings.theme")}</p>
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
                    <span className="text-sm font-medium">{t("settings.themeLight")}</span>
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
                    <span className="text-sm font-medium">{t("settings.themeDark")}</span>
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
                    <span className="text-sm font-medium">{t("settings.themeAuto")}</span>
                  </button>
                </div>
              </div>

              {/* Цвет акцента */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">{t("settings.accentColor")}</p>
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

              {/* Язык / Language */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">{t("settings.language")}</p>
                <div className="grid grid-cols-3 gap-2">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => i18n.changeLanguage(lang.code)}
                      className={cn(
                        "flex items-center justify-center gap-2 p-3 rounded-lg transition-all",
                        i18n.language === lang.code || (i18n.language.startsWith(lang.code.split('-')[0]) && lang.code.includes('-'))
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "bg-muted hover:bg-muted/70"
                      )}
                    >
                      <span className="text-lg">{lang.flag}</span>
                      <span className="text-sm font-medium">{lang.native}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Единицы измерения / Units */}
              <div className="space-y-2">
                <p className="text-sm font-medium text-muted-foreground">{t("settings.units.title")}</p>
                <div className="grid grid-cols-2 gap-2">
                  {UNIT_SYSTEMS.map((system) => (
                    <button
                      key={system.value}
                      onClick={() => setUnitSystem(system.value)}
                      className={cn(
                        "flex items-center justify-center gap-2 p-3 rounded-lg transition-all",
                        unitSystem === system.value
                          ? "bg-primary text-primary-foreground shadow-md"
                          : "bg-muted hover:bg-muted/70"
                      )}
                    >
                      <span className="text-lg">{system.value === "metric" ? "🌍" : "🇺🇸"}</span>
                      <span className="text-sm font-medium">{t(system.labelKey)}</span>
                    </button>
                  ))}
                </div>
                <p className="text-xs text-muted-foreground">
                  {unitSystem === "metric"
                    ? t("settings.units.metricDesc")
                    : t("settings.units.imperialDesc")}
                </p>
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
            <CardHeader className="pb-2 pt-4 px-4 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Download className="h-4 w-4 text-primary" />
                  {t("settings.data")}
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-xs text-muted-foreground">
                    {workouts?.length || 0} {t("plurals.workout", { count: workouts?.length || 0 })}
                  </span>
                  <ChevronDown className={cn(
                    "h-4 w-4 text-muted-foreground transition-transform duration-200",
                    dataOpen && "rotate-180"
                  )} />
                </div>
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="px-4 pb-4">
              <p className="text-xs text-muted-foreground mb-3">
                {t("settings.exportDescription")}
              </p>
              <div className="grid grid-cols-3 gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportToXLS}
                  disabled={exportLoading || !workouts?.length}
                  className="gap-2 text-xs"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  Excel
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportToCSV}
                  disabled={exportLoading || !workouts?.length}
                  className="gap-2 text-xs"
                >
                  <FileSpreadsheet className="h-3.5 w-3.5" />
                  CSV
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={exportToJSON}
                  disabled={exportLoading || !workouts?.length}
                  className="gap-2 text-xs"
                >
                  <FileJson className="h-3.5 w-3.5" />
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
            <CardHeader className="pb-2 pt-4 px-4 cursor-pointer hover:bg-muted/50 transition-colors rounded-t-lg">
              <CardTitle className="text-sm font-semibold flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Lock className="h-4 w-4 text-primary" />
                  {t("settings.changePassword")}
                </div>
                <ChevronDown className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform duration-200",
                  securityOpen && "rotate-180"
                )} />
              </CardTitle>
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent className="px-4 pb-4">
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label htmlFor="newPassword" className="text-xs">{t("settings.newPassword")}</Label>
                  <div className="relative">
                    <Input
                      id="newPassword"
                      type={showNewPassword ? "text" : "password"}
                      placeholder={t("auth.minPassword")}
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      className="pr-10 h-9 text-xs"
                    />
                    <button
                      type="button"
                      onClick={() => setShowNewPassword(!showNewPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    >
                      {showNewPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                    </button>
                  </div>
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="confirmPassword" className="text-xs">{t("settings.confirmPassword")}</Label>
                  <Input
                    id="confirmPassword"
                    type="password"
                    placeholder={t("settings.repeatPassword")}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="h-9 text-xs"
                  />
                </div>
                <Button
                  onClick={handleChangePassword}
                  disabled={passwordLoading}
                  variant="secondary"
                  size="sm"
                  className="w-full gap-2 text-xs"
                >
                  <Lock className="h-3.5 w-3.5" />
                  {passwordLoading ? t("settings.saving") : t("settings.changePasswordButton")}
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
            size="sm"
            className="w-full gap-2 text-xs text-destructive hover:text-destructive hover:bg-destructive/10 border-destructive/30"
          >
            <LogOut className="h-3.5 w-3.5" />
            {t("settings.logoutButton")}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("settings.logoutConfirmTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("settings.logoutConfirmDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={signOut}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("nav.logout")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
