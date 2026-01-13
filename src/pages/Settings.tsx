import { useState, useEffect, useRef, useMemo } from "react";
import { useTheme } from "next-themes";
import { useTranslation } from "react-i18next";
import { User, LogOut, Lock, Eye, EyeOff, ChevronDown, Sun, Moon, Monitor, Download, FileJson, FileSpreadsheet, Check, Loader2, CloudOff, Palette, Globe, Ruler, Sparkles, Settings as SettingsIcon, UserCircle, Calendar, Scale, RulerIcon, Smile, Database, KeyRound, ShieldCheck } from "lucide-react";
import { useDebounce } from "@/hooks/useDebounce";
import { useOfflineProfile, useOfflineUpdateProfile, useOfflineWorkouts } from "@/offline";
import { format } from "date-fns";
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
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import { useAccentColor, ACCENT_COLORS } from "@/hooks/useAccentColor";
import { useUnits, UNIT_SYSTEMS } from "@/hooks/useUnits";
import { useAutoFillLastSet } from "@/hooks/useAutoFillLastSet";
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
  const isMetric = unitSystem === "metric";
  const { autoFillEnabled, setAutoFillEnabled } = useAutoFillLastSet();
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

  // Section states - default open based on screen size
  // Desktop (md: 768px+): profile + app open, Mobile: only app open
  const [profileOpen, setProfileOpen] = useState(() =>
    typeof window !== 'undefined' && window.innerWidth >= 768
  );
  const [appOpen, setAppOpen] = useState(true);
  const [dataOpen, setDataOpen] = useState(false);
  const [securityOpen, setSecurityOpen] = useState(false);

  // Popover states (for auto-close on select)
  const [colorPopoverOpen, setColorPopoverOpen] = useState(false);
  const [langPopoverOpen, setLangPopoverOpen] = useState(false);
  const [unitsPopoverOpen, setUnitsPopoverOpen] = useState(false);
  const [skufPopoverOpen, setSkufPopoverOpen] = useState(false);

  // Auto-save status: 'idle' | 'saving' | 'saved' | 'offline'
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'offline'>('idle');
  const saveStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // App settings save status (for theme, language, accent color, units, auto-fill)
  const [appSaveStatus, setAppSaveStatus] = useState<'idle' | 'saved'>('idle');
  const appSaveStatusTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

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
          const cm = Math.round(heightNum * 12 / 0.393701 * 10) / 10;
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
      if (appSaveStatusTimeoutRef.current) {
        clearTimeout(appSaveStatusTimeoutRef.current);
      }
    };
  }, []);

  // Helper to show app settings saved badge
  const showAppSaved = () => {
    if (appSaveStatusTimeoutRef.current) {
      clearTimeout(appSaveStatusTimeoutRef.current);
    }
    setAppSaveStatus('saved');
    appSaveStatusTimeoutRef.current = setTimeout(() => {
      setAppSaveStatus('idle');
    }, 2000);
  };

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

  const exportToXLS = async () => {
    if (!workouts || workouts.length === 0) {
      toast.error(t("settings.noDataToExport"));
      return;
    }
    setExportLoading(true);
    try {
      // Dynamically import xlsx-js-style for code splitting (~200KB)
      const XLSX = await import("xlsx-js-style");

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
          ЕДИНЫЙ БЛОК НАСТРОЕК
      ═══════════════════════════════════════════════════════════════ */}
      <Card className="overflow-hidden">
        {/* ─────────────────── СЕКЦИЯ: ПРОФИЛЬ ─────────────────── */}
        <Collapsible open={profileOpen} onOpenChange={setProfileOpen}>
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <User className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">{t("settings.profile")}</span>
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
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-1">
              {/* Avatar Row */}
              <div className="flex items-center gap-3 py-3 border-b border-border/50">
                <Dialog>
                  <DialogTrigger asChild>
                    <button className="flex-shrink-0 flex items-center justify-center w-16 h-16 rounded-full bg-primary/10 text-4xl hover:bg-primary/20 transition-colors cursor-pointer border-2 border-primary/20">
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
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{displayName || t("settings.enterName")}</p>
                  <p className="text-xs text-muted-foreground">
                    {gender !== "none" ? t(`settings.gender${gender.charAt(0).toUpperCase() + gender.slice(1)}`) : t("settings.selectGender")}
                    {dateOfBirth && (() => {
                      const birthDate = new Date(dateOfBirth);
                      const today = new Date();
                      let age = today.getFullYear() - birthDate.getFullYear();
                      const monthDiff = today.getMonth() - birthDate.getMonth();
                      if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birthDate.getDate())) age--;
                      return age >= 0 && age < 150 ? ` • ${age} ${t("plurals.year", { count: age })}` : "";
                    })()}
                  </p>
                </div>
                {profile?.is_admin && (
                  <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-gradient-to-r from-amber-500/10 to-orange-500/10 border border-amber-500/20">
                    <span className="text-sm">👑</span>
                    <span className="text-[10px] font-bold text-amber-600 dark:text-amber-400">ADMIN</span>
                  </div>
                )}
              </div>

              {/* Name */}
              <div className="flex items-center gap-3 py-3 border-b border-border/50">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-500/10">
                  <UserCircle className="h-4 w-4 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t("settings.name")}</p>
                </div>
                <Input
                  type="text"
                  value={displayName}
                  onChange={(e) => { setDisplayName(e.target.value); markChanged(); }}
                  placeholder={t("settings.enterName")}
                  className="h-8 w-32 text-xs text-right"
                />
              </div>

              {/* Gender */}
              <div className="flex items-center gap-3 py-3 border-b border-border/50">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-pink-500/10">
                  <User className="h-4 w-4 text-pink-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t("settings.gender")}</p>
                </div>
                <Select value={gender} onValueChange={(v) => { setGender(v as "male" | "female" | "other" | "none"); markChanged(); }}>
                  <SelectTrigger className="h-8 w-32 text-xs">
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

              {/* Date of Birth */}
              <div className="flex items-center gap-3 py-3 border-b border-border/50">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-purple-500/10">
                  <Calendar className="h-4 w-4 text-purple-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t("settings.dateOfBirth")}</p>
                  {dateOfBirth && (() => {
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
                          <button className="text-xs text-muted-foreground hover:text-foreground transition-colors">
                            {zodiac.sign} {t(`zodiac.${zodiac.key}`)}
                          </button>
                        </PopoverTrigger>
                        <PopoverContent className="w-72 p-3">
                          <div className="flex items-start gap-3">
                            <span className="text-3xl flex-shrink-0">{zodiac.sign}</span>
                            <div>
                              <p className="font-medium text-sm mb-1">{t(`zodiac.${zodiac.key}`)}</p>
                              <p className="text-xs text-muted-foreground leading-relaxed">{t(`zodiac.desc.${zodiac.key}`)}</p>
                            </div>
                          </div>
                        </PopoverContent>
                      </Popover>
                    );
                  })()}
                </div>
                <Input
                  type="date"
                  value={dateOfBirth}
                  onChange={(e) => { setDateOfBirth(e.target.value); markChanged(); }}
                  className="h-8 w-32 text-xs"
                />
              </div>

              {/* Height */}
              <div className="flex items-center gap-3 py-3 border-b border-border/50">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-cyan-500/10">
                  <RulerIcon className="h-4 w-4 text-cyan-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t("settings.height")}</p>
                  <p className="text-xs text-muted-foreground">{units.height}</p>
                </div>
                <Input
                  type="number"
                  step="0.1"
                  min={isMetric ? 50 : 20}
                  max={isMetric ? 300 : 120}
                  value={height}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || (parseFloat(val) >= 0 && parseFloat(val) <= (isMetric ? 300 : 120))) {
                      setHeight(val);
                      markChanged();
                    }
                  }}
                  placeholder="—"
                  className="h-8 w-20 text-xs text-right"
                />
              </div>

              {/* Weight */}
              <div className="flex items-center gap-3 py-3 border-b border-border/50">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-green-500/10">
                  <Scale className="h-4 w-4 text-green-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t("settings.weight")}</p>
                  <p className="text-xs text-muted-foreground">{units.weight}</p>
                </div>
                <Input
                  type="number"
                  step="0.1"
                  min={isMetric ? 20 : 44}
                  max={isMetric ? 500 : 1100}
                  value={currentWeight}
                  onChange={(e) => {
                    const val = e.target.value;
                    if (val === '' || (parseFloat(val) >= 0 && parseFloat(val) <= (isMetric ? 500 : 1100))) {
                      setCurrentWeight(val);
                      markChanged();
                    }
                  }}
                  placeholder="—"
                  className="h-8 w-20 text-xs text-right"
                />
              </div>

              {/* Skuf Level */}
              <div className="flex items-center gap-3 py-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-orange-500/10">
                  <Smile className="h-4 w-4 text-orange-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t("settings.skufLevels.skuf")}</p>
                  <p className={cn(
                    "text-xs transition-colors",
                    skufLevel === 0 && "text-blue-500",
                    skufLevel === 1 && "text-green-500",
                    skufLevel === 2 && "text-yellow-600 dark:text-yellow-400",
                    skufLevel === 3 && "text-orange-500",
                    skufLevel === 4 && "text-red-500"
                  )}>
                    {t(`settings.skufStatus.${skufLevel}`)}
                  </p>
                </div>
                {/* Desktop: inline skuf picker */}
                <div className="hidden sm:flex items-center gap-1 bg-muted rounded-lg p-1">
                  {[
                    { level: 0, emoji: "😊", color: "text-blue-500" },
                    { level: 1, emoji: "😏", color: "text-green-500" },
                    { level: 2, emoji: "😤", color: "text-yellow-500" },
                    { level: 3, emoji: "🔥", color: "text-orange-500" },
                    { level: 4, emoji: "🗿", color: "text-red-500" },
                  ].map((item) => (
                    <button
                      key={item.level}
                      onClick={() => { setSkufLevel(item.level); markChanged(); }}
                      className={cn(
                        "p-1.5 rounded-md transition-all text-base",
                        skufLevel === item.level
                          ? "bg-background shadow-sm scale-110"
                          : "hover:bg-background/50 opacity-50 hover:opacity-100"
                      )}
                      title={t(`settings.skufLevels.${['normie', 'bold', 'jock', 'skuf', 'alpha'][item.level]}`)}
                    >
                      {item.emoji}
                    </button>
                  ))}
                </div>
                {/* Mobile: popover skuf picker */}
                <Popover open={skufPopoverOpen} onOpenChange={setSkufPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button className="sm:hidden flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted hover:bg-muted/70 transition-colors">
                      <span className="text-base">
                        {["😊", "😏", "😤", "🔥", "🗿"][skufLevel]}
                      </span>
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-56 p-2" align="end">
                    <p className="text-xs font-medium text-muted-foreground mb-2 px-2">{t("settings.skufLevels.skuf")}</p>
                    <div className="space-y-1">
                      {[
                        { level: 0, emoji: "😊", key: "normie", color: "text-blue-500" },
                        { level: 1, emoji: "😏", key: "bold", color: "text-green-500" },
                        { level: 2, emoji: "😤", key: "jock", color: "text-yellow-500" },
                        { level: 3, emoji: "🔥", key: "skuf", color: "text-orange-500" },
                        { level: 4, emoji: "🗿", key: "alpha", color: "text-red-500" },
                      ].map((item) => (
                        <button
                          key={item.level}
                          onClick={() => { setSkufLevel(item.level); markChanged(); setSkufPopoverOpen(false); }}
                          className={cn(
                            "w-full flex items-center gap-2 px-2 py-2 rounded-md transition-all text-sm",
                            skufLevel === item.level
                              ? "bg-primary/10 text-primary font-medium"
                              : "hover:bg-muted"
                          )}
                        >
                          <span className="text-base">{item.emoji}</span>
                          <span className={skufLevel === item.level ? "" : item.color}>
                            {t(`settings.skufLevels.${item.key}`)}
                          </span>
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Разделитель между секциями */}
        <div className="border-t border-border" />

        {/* ─────────────────── СЕКЦИЯ: ПРИЛОЖЕНИЕ ─────────────────── */}
        <Collapsible open={appOpen} onOpenChange={setAppOpen}>
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <SettingsIcon className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">{t("settings.application")}</span>
              </div>
              <div className="flex items-center gap-3">
                {/* App settings save status indicator */}
                {appSaveStatus === 'saved' && (
                  <div className="flex items-center gap-1 text-xs px-2 py-0.5 rounded-full bg-green-500/10 text-green-600 dark:text-green-400 transition-all">
                    <Check className="h-3 w-3" />
                    <span>{t("settings.saved")}</span>
                  </div>
                )}
                <ChevronDown className={cn(
                  "h-4 w-4 text-muted-foreground transition-transform duration-200",
                  appOpen && "rotate-180"
                )} />
              </div>
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-1">
              {/* Тема / Theme */}
              <div className="flex items-center gap-3 py-3 border-b border-border/50">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-amber-500/10">
                  <Sun className="h-4 w-4 text-amber-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t("settings.theme")}</p>
                </div>
                <div className="flex items-center gap-1 bg-muted rounded-lg p-1">
                  <button
                    onClick={() => { setTheme("light"); showAppSaved(); }}
                    className={cn(
                      "p-2 rounded-md transition-all",
                      theme === "light"
                        ? "bg-background shadow-sm"
                        : "hover:bg-background/50"
                    )}
                    title={t("settings.themeLight")}
                  >
                    <Sun className={cn("h-4 w-4", theme === "light" ? "text-amber-500" : "text-muted-foreground")} />
                  </button>
                  <button
                    onClick={() => { setTheme("dark"); showAppSaved(); }}
                    className={cn(
                      "p-2 rounded-md transition-all",
                      theme === "dark"
                        ? "bg-background shadow-sm"
                        : "hover:bg-background/50"
                    )}
                    title={t("settings.themeDark")}
                  >
                    <Moon className={cn("h-4 w-4", theme === "dark" ? "text-blue-500" : "text-muted-foreground")} />
                  </button>
                  <button
                    onClick={() => { setTheme("system"); showAppSaved(); }}
                    className={cn(
                      "p-2 rounded-md transition-all",
                      theme === "system"
                        ? "bg-background shadow-sm"
                        : "hover:bg-background/50"
                    )}
                    title={t("settings.themeAuto")}
                  >
                    <Monitor className={cn("h-4 w-4", theme === "system" ? "text-primary" : "text-muted-foreground")} />
                  </button>
                </div>
              </div>

              {/* Цвет акцента / Accent Color */}
              <div className="flex items-center gap-3 py-3 border-b border-border/50">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-pink-500/10">
                  <Palette className="h-4 w-4 text-pink-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t("settings.accentColor")}</p>
                </div>
                {/* Desktop: inline color picker */}
                <div className="hidden sm:flex items-center gap-1.5">
                  {ACCENT_COLORS.map((color) => (
                    <button
                      key={color.value}
                      onClick={() => { setAccentColor(color.value); showAppSaved(); }}
                      className={cn(
                        "w-6 h-6 rounded-full transition-all",
                        accentColor === color.value
                          ? "ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110"
                          : "hover:scale-110"
                      )}
                      style={{ backgroundColor: color.color }}
                      title={color.label}
                    />
                  ))}
                </div>
                {/* Mobile: popover color picker */}
                <Popover open={colorPopoverOpen} onOpenChange={setColorPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button className="sm:hidden flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted hover:bg-muted/70 transition-colors">
                      <div
                        className="w-5 h-5 rounded-full ring-2 ring-offset-1 ring-offset-background ring-foreground/20"
                        style={{ backgroundColor: ACCENT_COLORS.find(c => c.value === accentColor)?.color }}
                      />
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-3" align="end">
                    <p className="text-xs font-medium text-muted-foreground mb-2">{t("settings.accentColor")}</p>
                    <div className="grid grid-cols-4 gap-2">
                      {ACCENT_COLORS.map((color) => (
                        <button
                          key={color.value}
                          onClick={() => { setAccentColor(color.value); showAppSaved(); setColorPopoverOpen(false); }}
                          className={cn(
                            "w-8 h-8 rounded-full transition-all",
                            accentColor === color.value
                              ? "ring-2 ring-offset-2 ring-offset-background ring-foreground scale-110"
                              : "hover:scale-110"
                          )}
                          style={{ backgroundColor: color.color }}
                          title={color.label}
                        />
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Язык / Language */}
              <div className="flex items-center gap-3 py-3 border-b border-border/50">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-500/10">
                  <Globe className="h-4 w-4 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t("settings.language")}</p>
                </div>
                {/* Desktop: inline language picker */}
                <div className="hidden sm:flex items-center gap-1 bg-muted rounded-lg p-1">
                  {LANGUAGES.map((lang) => (
                    <button
                      key={lang.code}
                      onClick={() => { i18n.changeLanguage(lang.code); showAppSaved(); }}
                      className={cn(
                        "px-2 py-1.5 rounded-md transition-all text-base",
                        i18n.language === lang.code || (i18n.language.startsWith(lang.code.split('-')[0]) && lang.code.includes('-'))
                          ? "bg-background shadow-sm"
                          : "hover:bg-background/50 opacity-60 hover:opacity-100"
                      )}
                      title={lang.native}
                    >
                      {lang.flag}
                    </button>
                  ))}
                </div>
                {/* Mobile: popover language picker */}
                <Popover open={langPopoverOpen} onOpenChange={setLangPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button className="sm:hidden flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted hover:bg-muted/70 transition-colors">
                      <span className="text-base">
                        {LANGUAGES.find(l => l.code === i18n.language || i18n.language.startsWith(l.code.split('-')[0]))?.flag || "🌐"}
                      </span>
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-2" align="end">
                    <p className="text-xs font-medium text-muted-foreground mb-2 px-2">{t("settings.language")}</p>
                    <div className="space-y-1">
                      {LANGUAGES.map((lang) => (
                        <button
                          key={lang.code}
                          onClick={() => { i18n.changeLanguage(lang.code); showAppSaved(); setLangPopoverOpen(false); }}
                          className={cn(
                            "w-full flex items-center gap-2 px-2 py-2 rounded-md transition-all text-sm",
                            i18n.language === lang.code || (i18n.language.startsWith(lang.code.split('-')[0]) && lang.code.includes('-'))
                              ? "bg-primary/10 text-primary font-medium"
                              : "hover:bg-muted"
                          )}
                        >
                          <span className="text-base">{lang.flag}</span>
                          <span>{lang.native}</span>
                        </button>
                      ))}
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Единицы измерения / Units */}
              <div className="flex items-center gap-3 py-3 border-b border-border/50">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-green-500/10">
                  <Ruler className="h-4 w-4 text-green-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t("settings.units.title")}</p>
                  <p className="text-xs text-muted-foreground">
                    {unitSystem === "metric" ? t("settings.units.metricDesc") : t("settings.units.imperialDesc")}
                  </p>
                </div>
                <Popover open={unitsPopoverOpen} onOpenChange={setUnitsPopoverOpen}>
                  <PopoverTrigger asChild>
                    <button className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-muted hover:bg-muted/70 transition-colors">
                      <span className="text-xs font-medium">
                        {unitSystem === "metric" ? t("settings.units.metric") : t("settings.units.imperial")}
                      </span>
                      <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
                    </button>
                  </PopoverTrigger>
                  <PopoverContent className="w-48 p-2" align="end">
                    <p className="text-xs font-medium text-muted-foreground mb-2 px-2">{t("settings.units.title")}</p>
                    <div className="space-y-1">
                      <button
                        onClick={() => { setUnitSystem("metric"); showAppSaved(); setUnitsPopoverOpen(false); }}
                        className={cn(
                          "w-full flex items-center justify-between px-2 py-2 rounded-md transition-all text-sm",
                          unitSystem === "metric"
                            ? "bg-primary/10 text-primary font-medium"
                            : "hover:bg-muted"
                        )}
                      >
                        <div>
                          <p className="font-medium">{t("settings.units.metric")}</p>
                          <p className="text-xs text-muted-foreground">{t("settings.units.metricDesc")}</p>
                        </div>
                        {unitSystem === "metric" && <Check className="h-4 w-4" />}
                      </button>
                      <button
                        onClick={() => { setUnitSystem("imperial"); showAppSaved(); setUnitsPopoverOpen(false); }}
                        className={cn(
                          "w-full flex items-center justify-between px-2 py-2 rounded-md transition-all text-sm",
                          unitSystem === "imperial"
                            ? "bg-primary/10 text-primary font-medium"
                            : "hover:bg-muted"
                        )}
                      >
                        <div>
                          <p className="font-medium">{t("settings.units.imperial")}</p>
                          <p className="text-xs text-muted-foreground">{t("settings.units.imperialDesc")}</p>
                        </div>
                        {unitSystem === "imperial" && <Check className="h-4 w-4" />}
                      </button>
                    </div>
                  </PopoverContent>
                </Popover>
              </div>

              {/* Автозаполнение / Auto-fill */}
              <div className="flex items-center gap-3 py-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-purple-500/10">
                  <Sparkles className="h-4 w-4 text-purple-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t("settings.autoFill.title")}</p>
                  {/* Desktop: full description */}
                  <p className="hidden sm:block text-xs text-muted-foreground">
                    {t("settings.autoFill.description")}
                  </p>
                  {/* Mobile: expandable description */}
                  <Popover>
                    <PopoverTrigger asChild>
                      <p className="sm:hidden text-xs text-muted-foreground line-clamp-1 cursor-pointer hover:text-foreground transition-colors">
                        {t("settings.autoFill.description")}
                      </p>
                    </PopoverTrigger>
                    <PopoverContent className="w-64 p-3" align="start">
                      <p className="text-xs text-muted-foreground">
                        {t("settings.autoFill.description")}
                      </p>
                    </PopoverContent>
                  </Popover>
                </div>
                <Checkbox
                  checked={autoFillEnabled}
                  onCheckedChange={(checked) => { setAutoFillEnabled(checked === true); showAppSaved(); }}
                  className="h-5 w-5"
                />
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Разделитель между секциями */}
        <div className="border-t border-border" />

        {/* ─────────────────── СЕКЦИЯ: ДАННЫЕ ─────────────────── */}
        <Collapsible open={dataOpen} onOpenChange={setDataOpen}>
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <Database className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">{t("settings.data")}</span>
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
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-3">
              {/* Export Row - Desktop */}
              <div className="hidden sm:flex items-center gap-3 py-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-500/10">
                  <Download className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t("settings.export")}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("settings.exportDescription")}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    onClick={exportToXLS}
                    disabled={exportLoading || !workouts?.length}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                      exportLoading || !workouts?.length
                        ? "opacity-50 cursor-not-allowed bg-muted text-muted-foreground"
                        : "bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20"
                    )}
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    XLS
                  </button>
                  <button
                    onClick={exportToCSV}
                    disabled={exportLoading || !workouts?.length}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                      exportLoading || !workouts?.length
                        ? "opacity-50 cursor-not-allowed bg-muted text-muted-foreground"
                        : "bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20"
                    )}
                  >
                    <FileSpreadsheet className="h-3.5 w-3.5" />
                    CSV
                  </button>
                  <button
                    onClick={exportToJSON}
                    disabled={exportLoading || !workouts?.length}
                    className={cn(
                      "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-medium transition-all",
                      exportLoading || !workouts?.length
                        ? "opacity-50 cursor-not-allowed bg-muted text-muted-foreground"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
                    )}
                  >
                    <FileJson className="h-3.5 w-3.5" />
                    JSON
                  </button>
                </div>
              </div>

              {/* Export - Mobile */}
              <div className="sm:hidden space-y-3">
                <div className="flex items-center gap-3">
                  <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-emerald-500/10">
                    <Download className="h-4 w-4 text-emerald-500" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{t("settings.export")}</p>
                    <p className="text-xs text-muted-foreground">
                      {t("settings.exportDescription")}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-2 pl-12">
                  <button
                    onClick={exportToXLS}
                    disabled={exportLoading || !workouts?.length}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                      exportLoading || !workouts?.length
                        ? "opacity-50 cursor-not-allowed bg-muted text-muted-foreground"
                        : "bg-green-500/10 text-green-600 dark:text-green-400 hover:bg-green-500/20"
                    )}
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    Excel
                  </button>
                  <button
                    onClick={exportToCSV}
                    disabled={exportLoading || !workouts?.length}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                      exportLoading || !workouts?.length
                        ? "opacity-50 cursor-not-allowed bg-muted text-muted-foreground"
                        : "bg-blue-500/10 text-blue-600 dark:text-blue-400 hover:bg-blue-500/20"
                    )}
                  >
                    <FileSpreadsheet className="h-4 w-4" />
                    CSV
                  </button>
                  <button
                    onClick={exportToJSON}
                    disabled={exportLoading || !workouts?.length}
                    className={cn(
                      "flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-medium transition-all",
                      exportLoading || !workouts?.length
                        ? "opacity-50 cursor-not-allowed bg-muted text-muted-foreground"
                        : "bg-amber-500/10 text-amber-600 dark:text-amber-400 hover:bg-amber-500/20"
                    )}
                  >
                    <FileJson className="h-4 w-4" />
                    JSON
                  </button>
                </div>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* Разделитель между секциями */}
        <div className="border-t border-border" />

        {/* ─────────────────── СЕКЦИЯ: БЕЗОПАСНОСТЬ ─────────────────── */}
        <Collapsible open={securityOpen} onOpenChange={setSecurityOpen}>
          <CollapsibleTrigger asChild>
            <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors">
              <div className="flex items-center gap-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span className="text-sm font-semibold">{t("settings.security")}</span>
              </div>
              <ChevronDown className={cn(
                "h-4 w-4 text-muted-foreground transition-transform duration-200",
                securityOpen && "rotate-180"
              )} />
            </div>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="px-4 pb-4 space-y-1">
              {/* New Password Row */}
              <div className="flex items-center gap-3 py-3 border-b border-border/50">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-blue-500/10">
                  <KeyRound className="h-4 w-4 text-blue-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t("settings.newPassword")}</p>
                  <p className="text-xs text-muted-foreground">{t("auth.minPassword")}</p>
                </div>
                <div className="relative">
                  <Input
                    id="newPassword"
                    type={showNewPassword ? "text" : "password"}
                    placeholder="••••••••"
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    className="pr-9 h-8 w-36 text-xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  >
                    {showNewPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                  </button>
                </div>
              </div>

              {/* Confirm Password Row */}
              <div className="flex items-center gap-3 py-3 border-b border-border/50">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-purple-500/10">
                  <Lock className="h-4 w-4 text-purple-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t("settings.confirmPassword")}</p>
                  <p className="text-xs text-muted-foreground">{t("settings.repeatPassword")}</p>
                </div>
                <Input
                  id="confirmPassword"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className="h-8 w-36 text-xs"
                />
              </div>

              {/* Change Password Button Row */}
              <div className="flex items-center gap-3 py-3">
                <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-green-500/10">
                  <ShieldCheck className="h-4 w-4 text-green-500" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t("settings.changePassword")}</p>
                </div>
                <button
                  onClick={handleChangePassword}
                  disabled={passwordLoading || !newPassword || !confirmPassword}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all",
                    passwordLoading || !newPassword || !confirmPassword
                      ? "opacity-50 cursor-not-allowed bg-muted text-muted-foreground"
                      : "bg-primary text-primary-foreground hover:bg-primary/90"
                  )}
                >
                  {passwordLoading ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      {t("settings.saving")}
                    </>
                  ) : (
                    <>
                      <Lock className="h-3.5 w-3.5" />
                      {t("settings.changePasswordButton")}
                    </>
                  )}
                </button>
              </div>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </Card>

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
