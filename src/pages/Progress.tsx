import { useState, useMemo, useEffect, memo } from "react";
import { useNavigate } from "react-router-dom";
import { format, subDays, startOfMonth, endOfMonth, startOfDay, endOfDay, parseISO, subMonths, isWithinInterval } from "date-fns";
import { getDateLocale } from "@/lib/dateLocales";
import { useTranslation } from "react-i18next";
import { getExerciseName } from "@/lib/i18n";
import { Zap, Repeat, Plus, Trophy, Medal, Activity, Clock, Weight, TrendingUp, User, Dumbbell, Timer, LayoutGrid, ChevronDown, Calendar as CalendarIcon, X, Users, FileText, LogIn } from "lucide-react";
import { PdfExportButton } from "@/components/PdfExportButton";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import { DateRange } from "react-day-picker";
import { useOfflineWorkouts, useOfflineExercises, useOfflineProfile } from "@/offline";
import { useOffline } from "@/contexts/OfflineContext";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { calculateTotalVolume } from "@/lib/volumeUtils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { cn } from "@/lib/utils";
import { useFriends } from "@/hooks/useFriends";
import { useUnits } from "@/hooks/useUnits";
import { AuthModal } from "@/components/AuthModal";

// Leaderboard entry type
interface LeaderboardEntry {
  user_id: string;
  display_name: string | null;
  username: string | null;
  avatar: string | null;
  current_weight: number | null;
  height: number | null;
  max_reps: number;
  total_reps: number;
  max_weight: number;
  max_distance: number;
  total_distance: number;
  max_plank_seconds: number;
  total_plank_seconds: number;
}

// Memoized Leaderboard Row component
interface LeaderboardRowProps {
  entry: LeaderboardEntry;
  index: number;
  isCurrentUser: boolean;
  isFriend: boolean;
  onNavigate: (userId: string) => void;
  convertWeight: (val: number) => number;
  convertDistance: (val: number) => number;
  convertHeight: (val: number) => number | { feet: number; inches: number };
  units: { weight: string; distance: string };
}

const LeaderboardRow = memo(function LeaderboardRow({
  entry,
  index,
  isCurrentUser,
  isFriend,
  onNavigate,
  convertWeight,
  convertDistance,
  convertHeight,
  units,
}: LeaderboardRowProps) {
  const { t } = useTranslation();
  const canViewWorkouts = isCurrentUser || isFriend;

  return (
    <div
      className={cn(
        "flex items-center gap-2 p-2.5 rounded-lg transition-colors",
        canViewWorkouts && "cursor-pointer hover:bg-muted/50",
        !canViewWorkouts && "cursor-default",
        index === 0 && "bg-yellow-500/10 border border-yellow-500/20",
        index === 0 && canViewWorkouts && "hover:bg-yellow-500/20",
        index === 1 && "bg-gray-400/10 border border-gray-400/20",
        index === 1 && canViewWorkouts && "hover:bg-gray-400/20",
        index === 2 && "bg-orange-600/10 border border-orange-600/20",
        index === 2 && canViewWorkouts && "hover:bg-orange-600/20",
        index > 2 && "bg-muted/30"
      )}
      onClick={() => canViewWorkouts && onNavigate(entry.user_id)}
    >
      {/* Rank */}
      <div className="flex items-center justify-center w-6 h-6 rounded-full bg-muted font-bold text-xs shrink-0">
        {index === 0 && <Medal className="h-4 w-4 text-yellow-500" />}
        {index === 1 && <Medal className="h-4 w-4 text-gray-400" />}
        {index === 2 && <Medal className="h-4 w-4 text-orange-600" />}
        {index > 2 && <span>{index + 1}</span>}
      </div>

      {/* Avatar */}
      <div className="flex items-center justify-center w-8 h-8 rounded-full bg-primary/10 text-xl shrink-0">
        {entry.avatar || "👤"}
      </div>

      {/* User info */}
      <div className="flex-1 min-w-0">
        <div className="font-semibold text-foreground truncate">
          {entry.display_name || t("common.anonymous")}
        </div>
        {entry.username && (
          <div className="text-xs text-muted-foreground truncate">
            @{entry.username}
          </div>
        )}
        <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2 gap-y-0.5">
          {entry.current_weight && (
            <span className="whitespace-nowrap">
              {t("progress.weightTotal")}: {convertWeight(entry.current_weight)} {units.weight}
            </span>
          )}
          {entry.height && (
            <span className="whitespace-nowrap">
              {t("progress.heightLabel")}: {(() => {
                const h = convertHeight(entry.height);
                if (typeof h === "object") {
                  return `${h.feet}'${h.inches}"`;
                }
                return `${h} ${t("units.cm")}`;
              })()}
            </span>
          )}
        </div>
      </div>

      {/* Stats */}
      <div className="text-right shrink-0 ml-2">
        <div className="font-bold text-base sm:text-lg text-foreground whitespace-nowrap">
          {entry.max_plank_seconds > 0 ? `${(entry.max_plank_seconds / 60).toFixed(2)} ${t("units.min")}` :
           entry.max_distance > 0 ? `${convertDistance(entry.max_distance)} ${units.distance}` :
           entry.max_weight > 0 ? `${convertWeight(entry.max_weight)} ${units.weight}` :
           `${entry.max_reps} ${t("units.times")}`}
        </div>
        <div className="text-xs text-muted-foreground whitespace-nowrap">
          {entry.max_plank_seconds > 0 ? `${t("progress.totalLabel")}: ${(entry.total_plank_seconds / 60).toFixed(2)} ${t("units.min")}` :
           entry.max_distance > 0 ? `${t("progress.totalLabel")}: ${convertDistance(entry.total_distance).toFixed(1)} ${units.distance}` :
           `${t("progress.totalLabel")}: ${entry.total_reps} ${t("units.times")}`}
        </div>
      </div>
    </div>
  );
});

export default function Progress() {
  const { t, i18n } = useTranslation();
  const dateLocale = getDateLocale(i18n.language);
  const navigate = useNavigate();
  // Use offline hooks for workouts and exercises (can view progress offline)
  const { data: workouts } = useOfflineWorkouts();
  const { data: exercises } = useOfflineExercises();
  const { data: profile } = useOfflineProfile();
  const { isOnline } = useOffline();
  const { user, effectiveUserId, isGuest, signInWithGoogle } = useAuth();
  const { toast } = useToast();
  const { units, convertWeight, convertDistance, convertHeight, toMetricWeight } = useUnits();
  const [selectedExercise, setSelectedExercise] = useState<string>("all");
  const [exerciseTypeFilter, setExerciseTypeFilter] = useState<"all" | "weighted" | "bodyweight" | "cardio" | "timed">("all");
  const [metric, setMetric] = useState<"reps" | "weight">("reps");
  const [cardioMetric, setCardioMetric] = useState<"distance" | "duration">("distance");
  const [isWeightDialogOpen, setIsWeightDialogOpen] = useState(false);
  const [newWeight, setNewWeight] = useState("");
  const [weightDate, setWeightDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [bodyWeightHistory, setBodyWeightHistory] = useState<Array<{ date: string; weight: number }>>([]);
  const [currentWeight, setCurrentWeight] = useState<number | null>(null);
  const [dateRange, setDateRange] = useState<DateRange | undefined>(undefined);
  const [filterOpen, setFilterOpen] = useState(false);
  const [leaderboardExercise, setLeaderboardExercise] = useState<string>("");
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<"all" | "month" | "today">("all");
  const [leaderboardFriendsOnly, setLeaderboardFriendsOnly] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  // State for fallback preset exercises (when offline cache is empty)
  const [fallbackPresetExercises, setFallbackPresetExercises] = useState<typeof exercises>([]);

  // Load friends data
  const { data: friends } = useFriends();
  const friendIds = useMemo(() => friends?.map(f => f.friend.user_id) || [], [friends]);

  // Load leaderboard data
  const { data: leaderboardData } = useLeaderboard(
    leaderboardExercise,
    leaderboardPeriod,
    leaderboardFriendsOnly,
    friendIds
  );

  // Get all preset exercises for leaderboard (sorted by translated name)
  const leaderboardExercises = useMemo(() => {
    const exerciseList = exercises && exercises.length > 0 ? exercises : fallbackPresetExercises;
    if (!exerciseList || exerciseList.length === 0) return [];
    return exerciseList
      .filter(e => e.is_preset)
      .sort((a, b) => {
        const nameA = getExerciseName(a.name, a.name_translations);
        const nameB = getExerciseName(b.name, b.name_translations);
        return nameA.localeCompare(nameB);
      });
  }, [exercises, fallbackPresetExercises, i18n.language]);

  // Fallback: load preset exercises directly if main exercises list is empty
  useEffect(() => {
    if (exercises && exercises.length > 0) return;
    if (fallbackPresetExercises.length > 0) return;
    if (!isOnline) return;

    const loadPresets = async () => {
      try {
        const { data, error } = await supabase
          .from("exercises")
          .select("*")
          .eq("is_preset", true)
          .order("name");

        if (!error && data) {
          setFallbackPresetExercises(data as typeof exercises);
        }
      } catch {
        // Ignore errors
      }
    };

    loadPresets();
  }, [exercises, fallbackPresetExercises.length, isOnline]);

  // Set default leaderboard exercise when exercises load
  useEffect(() => {
    if (leaderboardExercises.length > 0 && !leaderboardExercise) {
      // Try to find "Штанга лёжа" (Bench Press) as default, otherwise use first
      const benchPress = leaderboardExercises.find(e => e.name === "Штанга лёжа");
      setLeaderboardExercise(benchPress?.name || leaderboardExercises[0].name);
    }
  }, [leaderboardExercises, leaderboardExercise]);

  // Load body weight history (only when online, as it's not cached)
  useEffect(() => {
    if (!user || !isOnline) return;

    const loadWeightHistory = async () => {
      try {
        const { data, error } = await supabase
          .from("body_weight_history")
          .select("*")
          .eq("user_id", user.id)
          .order("date", { ascending: true });

        if (!error) {
          setBodyWeightHistory(data || []);
        }
      } catch {
        // Silently fail when offline
      }
    };

    loadWeightHistory();
  }, [user, isOnline]);

  // Get current weight from offline profile
  useEffect(() => {
    if (profile?.current_weight !== undefined) {
      setCurrentWeight(profile.current_weight);
    }
  }, [profile]);

  // Get all exercises that have been used
  const usedExercises = useMemo(() => {
    if (!workouts) return [];
    const exerciseIds = new Set<string>();
    workouts.forEach((w) => {
      w.workout_sets?.forEach((s) => {
        exerciseIds.add(s.exercise_id);
      });
    });
    let filtered = exercises?.filter((e) => exerciseIds.has(e.id)) || [];

    // Filter by exercise type
    if (exerciseTypeFilter !== "all") {
      filtered = filtered.filter((e) => e.type === exerciseTypeFilter);
    }

    return filtered;
  }, [workouts, exercises, exerciseTypeFilter]);

  // Auto-select first exercise when type filter changes
  useEffect(() => {
    if (exerciseTypeFilter !== "all" && usedExercises.length > 0) {
      // When specific type selected, auto-select first exercise of that type
      const exerciseExists = usedExercises.some((e) => e.id === selectedExercise);
      if (!exerciseExists || selectedExercise === "all") {
        setSelectedExercise(usedExercises[0].id);
      }
    } else if (exerciseTypeFilter === "all" && selectedExercise !== "all") {
      // When "all types" selected, check if current exercise still exists
      const exerciseExists = usedExercises.some((e) => e.id === selectedExercise);
      if (!exerciseExists) {
        setSelectedExercise("all");
      }
    }
  }, [usedExercises, exerciseTypeFilter]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!workouts) return [];

    const filteredWorkouts = workouts
      .filter((w) => {
        if (!dateRange?.from) return true;
        const workoutDate = new Date(w.date);
        if (dateRange.from && dateRange.to) {
          return isWithinInterval(workoutDate, {
            start: startOfDay(dateRange.from),
            end: endOfDay(dateRange.to),
          });
        } else if (dateRange.from) {
          return startOfDay(workoutDate).getTime() >= startOfDay(dateRange.from).getTime();
        }
        return true;
      })
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    return filteredWorkouts.map((workout) => {
      let relevantSets = workout.workout_sets || [];

      if (selectedExercise !== "all") {
        relevantSets = relevantSets.filter((s) => s.exercise_id === selectedExercise);
      }

      const totalReps = relevantSets.reduce((sum, s) => sum + (s.reps || 0), 0);
      const maxWeight = relevantSets.reduce((max, s) => Math.max(max, s.weight || 0), 0);
      const totalVolume = calculateTotalVolume(relevantSets, currentWeight);
      const totalDistance = relevantSets.reduce((sum, s) => sum + (s.distance_km || 0), 0);
      const totalDuration = relevantSets.reduce((sum, s) => sum + (s.duration_minutes || 0), 0);
      const totalPlankTime = relevantSets.reduce((sum, s) => sum + (s.plank_seconds || 0), 0);

      return {
        date: format(new Date(workout.date), "d MMM", { locale: dateLocale }),
        fullDate: workout.date,
        reps: totalReps,
        weight: maxWeight,
        volume: totalVolume,
        sets: relevantSets.length,
        distance: totalDistance,
        duration: totalDuration,
        plankTime: totalPlankTime,
      };
    });
  }, [workouts, selectedExercise, currentWeight, dateRange]);

  // Calculate stats
  const stats = useMemo(() => {
    if (!chartData.length) return null;

    const totalReps = chartData.reduce((sum, d) => sum + d.reps, 0);
    const totalSets = chartData.reduce((sum, d) => sum + d.sets, 0);
    const maxWeight = Math.max(...chartData.map((d) => d.weight));
    const totalVolume = chartData.reduce((sum, d) => sum + d.volume, 0);
    // Count only workouts where the exercise was actually performed (has sets)
    const workoutCount = selectedExercise === "all"
      ? chartData.length
      : chartData.filter(d => d.sets > 0).length;

    // Calculate trend (last 7 vs previous 7)
    const last7 = chartData.slice(-7);
    const prev7 = chartData.slice(-14, -7);

    const last7Reps = last7.reduce((sum, d) => sum + d.reps, 0);
    const prev7Reps = prev7.reduce((sum, d) => sum + d.reps, 0);
    const repsTrend = prev7Reps > 0 ? ((last7Reps - prev7Reps) / prev7Reps) * 100 : 0;

    // Кардио статистика - используем chartData который уже отфильтрован по времени
    const totalDistance = chartData.reduce((sum, d) => sum + d.distance, 0);
    const totalDurationMinutes = chartData.reduce((sum, d) => sum + d.duration, 0);
    const totalDurationHours = totalDurationMinutes / 60;

    // Для timed упражнений (планка) - подсчитать секунды из chartData
    const totalPlankSeconds = chartData.reduce((sum, d) => sum + d.plankTime, 0);

    return {
      totalReps,
      totalSets,
      maxWeight,
      totalVolume,
      workoutCount,
      repsTrend,
      totalDistance,
      totalDurationHours,
      totalDurationMinutes,
      totalPlankSeconds,
    };
  }, [chartData, selectedExercise]);

  const selectedExerciseData = exercises?.find((e) => e.id === selectedExercise);

  // Exercise history for collapsible
  const exerciseHistory = useMemo(() => {
    if (selectedExercise === "all" || !workouts) return [];

    // Use same dateRange filter as chartData
    const filteredWorkouts = workouts.filter(w => {
      if (!dateRange?.from) return true;
      const workoutDate = new Date(w.date);
      if (dateRange.from && dateRange.to) {
        return isWithinInterval(workoutDate, {
          start: startOfDay(dateRange.from),
          end: endOfDay(dateRange.to),
        });
      } else if (dateRange.from) {
        return startOfDay(workoutDate).getTime() >= startOfDay(dateRange.from).getTime();
      }
      return true;
    });

    const sets: Array<{
      date: string;
      workoutId: string;
      reps: number | null;
      weight: number | null;
      distance_km: number | null;
      duration_minutes: number | null;
      plank_seconds: number | null;
    }> = [];

    filteredWorkouts.forEach(workout => {
      workout.workout_sets
        ?.filter(set => set.exercise_id === selectedExercise)
        .forEach(set => {
          sets.push({
            date: workout.date,
            workoutId: workout.id,
            reps: set.reps,
            weight: set.weight,
            distance_km: set.distance_km,
            duration_minutes: set.duration_minutes,
            plank_seconds: set.plank_seconds,
          });
        });
    });

    return sets;
  }, [workouts, selectedExercise, dateRange]);

  // Format set data based on exercise type (without date - date shown in group header)
  const formatSetData = (set: typeof exerciseHistory[0], exerciseType: string | undefined) => {
    switch (exerciseType) {
      case "weighted":
        return `${set.reps} ${t("units.times")} × ${set.weight ? convertWeight(set.weight) : 0} ${units.weight}`;
      case "bodyweight":
        return `${set.reps} ${t("units.times")}`;
      case "cardio": {
        const displayDistance = set.distance_km ? convertDistance(set.distance_km) : null;
        if (displayDistance && set.duration_minutes) {
          return `${displayDistance} ${units.distance} / ${set.duration_minutes} ${t("units.min")}`;
        } else if (displayDistance) {
          return `${displayDistance} ${units.distance}`;
        } else if (set.duration_minutes) {
          return `${set.duration_minutes} ${t("units.min")}`;
        }
        return "";
      }
      case "timed": {
        const seconds = set.plank_seconds || 0;
        const minutes = (seconds / 60).toFixed(2);
        return `${seconds} ${t("units.sec")} (${minutes} ${t("units.min")})`;
      }
      default:
        return "";
    }
  };

  // Find the LAST record set index (newest date with max value, last set on that date)
  const recordSetIndex = useMemo(() => {
    if (!exerciseHistory.length || !selectedExerciseData) return -1;

    const exerciseType = selectedExerciseData.type;
    let maxValue = 0;
    let recordIndex = -1;

    // exerciseHistory is sorted by date descending (newest first)
    // We want the LAST occurrence of max value (oldest), so we iterate from end
    exerciseHistory.forEach((set, index) => {
      let value = 0;
      switch (exerciseType) {
        case "weighted":
          value = set.weight || 0;
          break;
        case "bodyweight":
          value = set.reps || 0;
          break;
        case "cardio":
          value = set.distance_km || 0;
          break;
        case "timed":
          value = set.plank_seconds || 0;
          break;
      }

      if (value > 0 && value >= maxValue) {
        maxValue = value;
        recordIndex = index;
      }
    });

    return recordIndex;
  }, [exerciseHistory, selectedExerciseData]);

  // Group exercise history by date with global index preserved
  const groupedHistory = useMemo(() => {
    const groups: Map<string, Array<{ set: typeof exerciseHistory[0]; globalIndex: number }>> = new Map();

    exerciseHistory.forEach((set, globalIndex) => {
      const dateKey = set.date;
      if (!groups.has(dateKey)) {
        groups.set(dateKey, []);
      }
      groups.get(dateKey)!.push({ set, globalIndex });
    });

    // Convert to array and format headers
    return Array.from(groups.entries()).map(([dateKey, setsWithIndex]) => {
      const parsedDate = parseISO(dateKey);
      // Full day name with capital letter
      const dayOfWeek = format(parsedDate, "EEEE", { locale: dateLocale });
      const capitalizedDay = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);
      // Full month name with capital letter
      const day = format(parsedDate, "d", { locale: dateLocale });
      const month = format(parsedDate, "MMMM", { locale: dateLocale });
      const capitalizedMonth = month.charAt(0).toUpperCase() + month.slice(1);

      return {
        dateKey,
        header: `${capitalizedDay}, ${day} ${capitalizedMonth}`,
        setsWithIndex,
      };
    });
  }, [exerciseHistory, dateLocale]);

  // Check if single day is selected (from === to)
  const isSingleDaySelected = dateRange?.from && dateRange?.to &&
    format(dateRange.from, "yyyy-MM-dd") === format(dateRange.to, "yyyy-MM-dd");

  // Get filter period text
  const getFilterText = () => {
    if (!dateRange?.from) return t("progress.forAllTime");
    if (isSingleDaySelected) {
      return format(dateRange.from!, "d MMMM", { locale: dateLocale });
    }
    if (dateRange.from && dateRange.to) {
      return `${format(dateRange.from, "d MMM", { locale: dateLocale })} — ${format(dateRange.to, "d MMM", { locale: dateLocale })}`;
    }
    return `${format(dateRange.from, "d MMM", { locale: dateLocale })}`;
  };

  // Quick filter handlers
  const handleQuickFilter = (days: number | "current-month" | "last-month" | "all") => {
    const today = new Date();

    if (days === "all") {
      setDateRange(undefined);
    } else if (days === "current-month") {
      setDateRange({
        from: startOfMonth(today),
        to: endOfMonth(today),
      });
    } else if (days === "last-month") {
      const lastMonth = subMonths(today, 1);
      setDateRange({
        from: startOfMonth(lastMonth),
        to: endOfMonth(lastMonth),
      });
    } else {
      setDateRange({
        from: subDays(today, days - 1),
        to: today,
      });
    }
    setFilterOpen(false);
  };

  // Select single day (from chart click)
  const handleSelectDay = (dateStr: string) => {
    const date = parseISO(dateStr);
    setDateRange({
      from: date,
      to: date,
    });
    setHistoryOpen(true);
  };

  // Check if filter matches preset
  const isFilterActive = (days: number | "current-month" | "last-month" | "all") => {
    const today = new Date();
    if (days === "all") return !dateRange?.from;
    if (!dateRange?.from || !dateRange?.to) return false;
    // Single day selection doesn't match any preset
    if (isSingleDaySelected) return false;

    if (days === "current-month") {
      return format(dateRange.from, "yyyy-MM-dd") === format(startOfMonth(today), "yyyy-MM-dd") &&
        format(dateRange.to, "yyyy-MM-dd") === format(endOfMonth(today), "yyyy-MM-dd");
    }
    if (days === "last-month") {
      const lastMonth = subMonths(today, 1);
      return format(dateRange.from, "yyyy-MM-dd") === format(startOfMonth(lastMonth), "yyyy-MM-dd") &&
        format(dateRange.to, "yyyy-MM-dd") === format(endOfMonth(lastMonth), "yyyy-MM-dd");
    }
    return format(dateRange.from, "yyyy-MM-dd") === format(subDays(today, days - 1), "yyyy-MM-dd") &&
      format(dateRange.to, "yyyy-MM-dd") === format(today, "yyyy-MM-dd");
  };

  // Prepare body weight chart data
  const bodyWeightChartData = useMemo(() => {
    return bodyWeightHistory
      .filter((w) => {
        if (!dateRange?.from) return true;
        const weightDate = new Date(w.date);
        if (dateRange.from && dateRange.to) {
          return isWithinInterval(weightDate, {
            start: startOfDay(dateRange.from),
            end: endOfDay(dateRange.to),
          });
        } else if (dateRange.from) {
          return startOfDay(weightDate).getTime() >= startOfDay(dateRange.from).getTime();
        }
        return true;
      })
      .map((w) => ({
        date: format(new Date(w.date), "d MMM", { locale: dateLocale }),
        weight: convertWeight(w.weight),
      }));
  }, [bodyWeightHistory, dateRange, convertWeight]);

  const handleSaveWeight = async () => {
    if (!user || !newWeight) return;

    const inputWeight = parseFloat(newWeight);
    if (isNaN(inputWeight) || inputWeight <= 0) {
      toast({
        title: t("common.error"),
        description: t("progress.invalidWeight"),
        variant: "destructive",
      });
      return;
    }

    // Convert from user's unit system to metric for storage
    const weight = toMetricWeight(inputWeight);

    // Save to history
    const { error: historyError } = await supabase
      .from("body_weight_history")
      .upsert(
        {
          user_id: user.id,
          weight,
          date: weightDate,
        },
        {
          onConflict: "user_id,date",
        }
      );

    if (historyError) {
      toast({
        title: t("common.error"),
        description: t("progress.weightSaveError"),
        variant: "destructive",
      });
      return;
    }

    // Update current weight in profile
    const { error: profileError } = await supabase
      .from("profiles")
      .update({ current_weight: weight })
      .eq("user_id", user.id);

    if (profileError) {
      console.error("Error updating profile:", profileError);
    }

    // Reload data
    const { data } = await supabase
      .from("body_weight_history")
      .select("*")
      .eq("user_id", user.id)
      .order("date", { ascending: true });

    setBodyWeightHistory(data || []);
    setCurrentWeight(weight);
    setIsWeightDialogOpen(false);
    setNewWeight("");
    setWeightDate(format(new Date(), "yyyy-MM-dd"));

    toast({
      title: t("common.success"),
      description: t("progress.weightSaved"),
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">{t("progress.title")}</h1>
          <p className="text-muted-foreground text-sm">{t("progress.subtitle")}</p>
        </div>
        <PdfExportButton />
      </div>

      {/* Filters */}
      <div className="space-y-2">
        {/* All filters in one row */}
        <div className="flex items-center gap-2 flex-wrap">
          <Select
            value={exerciseTypeFilter}
            onValueChange={(v) => {
              setExerciseTypeFilter(v as "all" | "weighted" | "bodyweight" | "cardio" | "timed");
            }}
          >
            <SelectTrigger className="h-9 w-auto min-w-[120px] text-xs px-3">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="h-3.5 w-3.5" />
                  {t("progress.allTypes")}
                </div>
              </SelectItem>
              <SelectItem value="bodyweight">
                <div className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5" />
                  {t("progress.bodyweight")}
                </div>
              </SelectItem>
              <SelectItem value="weighted">
                <div className="flex items-center gap-2">
                  <Dumbbell className="h-3.5 w-3.5" />
                  {t("progress.weighted")}
                </div>
              </SelectItem>
              <SelectItem value="cardio">
                <div className="flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5" />
                  {t("progress.cardio")}
                </div>
              </SelectItem>
              <SelectItem value="timed">
                <div className="flex items-center gap-2">
                  <Timer className="h-3.5 w-3.5" />
                  {t("progress.timed")}
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedExercise} onValueChange={setSelectedExercise}>
            <SelectTrigger className="h-9 w-auto min-w-[140px] max-w-[180px] text-xs px-3">
              <SelectValue placeholder={t("exercises.exercise")} />
            </SelectTrigger>
            <SelectContent>
              {exerciseTypeFilter === "all" && (
                <SelectItem value="all">{t("progress.allExercises")}</SelectItem>
              )}
              {usedExercises.map((exercise) => (
                <SelectItem key={exercise.id} value={exercise.id}>
                  {getExerciseName(exercise.name, exercise.name_translations)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          {/* Time filter */}
          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-xs"
              >
                <TrendingUp className="h-3.5 w-3.5" />
                {dateRange?.from ? (
                  isSingleDaySelected ? (
                    format(dateRange.from, "d MMM", { locale: dateLocale })
                  ) : dateRange.to ? (
                    `${format(dateRange.from, "d MMM", { locale: dateLocale })} – ${format(dateRange.to, "d MMM", { locale: dateLocale })}`
                  ) : (
                    format(dateRange.from, "d MMM", { locale: dateLocale })
                  )
                ) : (
                  t("progress.allTime")
                )}
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-2" align="start">
              <div className="space-y-1">
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs h-8"
                  onClick={() => handleQuickFilter("all")}
                >
                  {t("progress.allTime")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs h-8"
                  onClick={() => handleQuickFilter(7)}
                >
                  {t("workouts.filter.last7days")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs h-8"
                  onClick={() => handleQuickFilter(30)}
                >
                  {t("workouts.filter.last30days")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs h-8"
                  onClick={() => handleQuickFilter("current-month")}
                >
                  {t("workouts.filter.thisMonth")}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs h-8"
                  onClick={() => handleQuickFilter("last-month")}
                >
                  {t("workouts.filter.lastMonth")}
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {/* Custom date range picker */}
          <Popover>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 shrink-0"
              >
                <CalendarIcon className="h-3.5 w-3.5" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0" align="start">
              <Calendar
                mode="range"
                selected={dateRange}
                onSelect={setDateRange}
                locale={dateLocale}
                className="rounded-md border-0"
                numberOfMonths={1}
              />
              <div className="p-2 border-t border-border flex gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  className="flex-1"
                  onClick={() => setDateRange(undefined)}
                >
                  {t("common.reset")}
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {dateRange?.from && (
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setDateRange(undefined)}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          )}
        </div>
      </div>

      {/* No data message */}
      {!stats && (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 bg-muted rounded-full mb-4">
              <TrendingUp className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">{t("progress.noDataForPeriod")} {getFilterText()}</h3>
            <p className="text-muted-foreground text-sm">
              {selectedExercise === "all"
                ? t("progress.noDataMessage")
                : t("progress.doExerciseToSeeStats")}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-3">
          {selectedExerciseData?.type !== "cardio" && selectedExerciseData?.type !== "timed" && (
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Repeat className="h-3.5 w-3.5" />
                  <span className="text-xs">{t("progress.repetitions")}</span>
                </div>
                <p className="text-xl font-bold text-foreground">{stats.totalReps}</p>
                {stats.repsTrend !== 0 && (
                  <p className={`text-xs ${stats.repsTrend > 0 ? "text-success" : "text-destructive"}`}>
                    {stats.repsTrend > 0 ? "+" : ""}{stats.repsTrend.toFixed(0)}% {t("progress.perWeek")}
                  </p>
                )}
              </CardContent>
            </Card>
          )}

          {selectedExerciseData?.type !== "bodyweight" && selectedExerciseData?.type !== "cardio" && selectedExerciseData?.type !== "timed" && (
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Weight className="h-3.5 w-3.5" />
                  <span className="text-xs">{t("progress.maxWeight")}</span>
                </div>
                <p className="text-xl font-bold text-foreground">
                  {stats.maxWeight > 0 ? `${convertWeight(stats.maxWeight)} ${units.weight}` : "—"}
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Zap className="h-3.5 w-3.5" />
                <span className="text-xs">{t("progress.workoutsCount")}</span>
              </div>
              <p className="text-xl font-bold text-foreground">{stats.workoutCount}</p>
            </CardContent>
          </Card>

          {selectedExerciseData?.type !== "bodyweight" && selectedExerciseData?.type !== "cardio" && selectedExerciseData?.type !== "timed" && (
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span className="text-xs">{t("progress.volume")}</span>
                </div>
                <p className="text-xl font-bold text-foreground">
                  {convertWeight(stats.totalVolume).toLocaleString()} {units.weight}
                </p>
              </CardContent>
            </Card>
          )}

          {stats.totalDistance > 0 && (
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Activity className="h-3.5 w-3.5" />
                  <span className="text-xs">{t("progress.ranDistance")}</span>
                </div>
                <p className="text-xl font-bold text-foreground">
                  {convertDistance(stats.totalDistance).toFixed(1)} {units.distance}
                </p>
              </CardContent>
            </Card>
          )}

          {stats.totalDurationMinutes > 0 && (selectedExerciseData?.type === "cardio" || selectedExercise === "all") && (
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="text-xs">{t("progress.timeRunning")}</span>
                </div>
                <p className="text-xl font-bold text-foreground">
                  {stats.totalDurationMinutes >= 60
                    ? `${stats.totalDurationHours.toFixed(2)} ${t("units.h")}`
                    : `${stats.totalDurationMinutes.toFixed(0)} ${t("units.min")}`}
                </p>
              </CardContent>
            </Card>
          )}

          {stats.totalPlankSeconds > 0 && (selectedExerciseData?.type === "timed" || selectedExercise === "all") && (
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="text-xs">{t("progress.inPlank")}</span>
                </div>
                <p className="text-xl font-bold text-foreground">
                  {stats.totalPlankSeconds >= 3600
                    ? `${(stats.totalPlankSeconds / 3600).toFixed(2)} ${t("units.h")}`
                    : `${(stats.totalPlankSeconds / 60).toFixed(2)} ${t("units.min")}`}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Exercise history collapsible */}
      {selectedExercise !== "all" && exerciseHistory.length > 0 && (
        <Collapsible open={historyOpen} onOpenChange={setHistoryOpen}>
          <Card className="overflow-hidden">
            <CollapsibleTrigger asChild>
              <div className="flex items-center justify-between px-4 py-3 cursor-pointer hover:bg-muted/50 transition-colors">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 rounded-md bg-primary/10">
                    <Repeat className="h-4 w-4 text-primary" />
                  </div>
                  <span className="font-medium text-foreground">{t("progress.setHistory")}</span>
                  <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">
                    {exerciseHistory.length}
                  </span>
                </div>
                <ChevronDown className={cn(
                  "h-5 w-5 text-muted-foreground transition-transform duration-200",
                  historyOpen && "rotate-180"
                )} />
              </div>
            </CollapsibleTrigger>
            <CollapsibleContent>
              <div className="border-t border-border">
                <div className="max-h-[320px] overflow-y-auto">
                  {groupedHistory.map((group, groupIndex) => (
                    <div key={group.dateKey}>
                      {/* Date header */}
                      <div className={cn(
                        "px-4 py-2.5 text-sm font-semibold text-foreground bg-muted/50 flex items-center gap-2",
                        groupIndex !== 0 && "border-t border-border"
                      )}>
                        <CalendarIcon className="h-3.5 w-3.5 text-primary" />
                        {group.header}
                      </div>
                      {/* Sets for this date */}
                      {group.setsWithIndex.map(({ set, globalIndex }, setIndex) => {
                        const isRecord = globalIndex === recordSetIndex;
                        return (
                          <div
                            key={setIndex}
                            className={cn(
                              "px-4 py-2.5 pl-10 cursor-pointer transition-colors text-sm flex items-center justify-between",
                              "hover:bg-primary/5",
                              setIndex !== group.setsWithIndex.length - 1 && "border-b border-border/30",
                              isRecord && "bg-yellow-500/5"
                            )}
                            onClick={() => navigate(`/workout/${set.workoutId}`)}
                          >
                            <span className={cn(
                              isRecord ? "text-yellow-600 dark:text-yellow-400 font-semibold" : "text-foreground/80"
                            )}>
                              {formatSetData(set, selectedExerciseData?.type)}
                            </span>
                            {isRecord && (
                              <Trophy className="h-4 w-4 text-yellow-500 shrink-0" />
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              </div>
            </CollapsibleContent>
          </Card>
        </Collapsible>
      )}

      {/* Chart */}
      {selectedExercise !== "all" && chartData.length > 0 && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-sm font-semibold">
                {selectedExerciseData?.type === "cardio"
                  ? cardioMetric === "distance"
                    ? t("progress.distanceKm")
                    : t("progress.timeMin")
                  : selectedExerciseData?.type === "timed"
                    ? t("progress.timeSec")
                    : metric === "reps"
                      ? t("progress.repetitions")
                      : t("progress.maxWeight")} {getFilterText()}
                {selectedExercise !== "all" && selectedExerciseData && (
                  <span className="text-muted-foreground font-normal ml-2">
                    · {getExerciseName(selectedExerciseData.name, selectedExerciseData.name_translations)}
                  </span>
                )}
              </CardTitle>

              {selectedExerciseData?.type === "cardio" ? (
                <Select value={cardioMetric} onValueChange={(v) => setCardioMetric(v as "distance" | "duration")}>
                  <SelectTrigger className="h-9 w-auto min-w-[100px] text-xs px-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="distance">{t("progress.distance")}</SelectItem>
                    <SelectItem value="duration">{t("progress.time")}</SelectItem>
                  </SelectContent>
                </Select>
              ) : selectedExerciseData?.type === "weighted" && (
                <Select value={metric} onValueChange={(v) => setMetric(v as "reps" | "weight")}>
                  <SelectTrigger className="h-9 w-auto min-w-[100px] text-xs px-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reps">{t("progress.repetitions")}</SelectItem>
                    <SelectItem value="weight">{t("progress.weightTotal")}</SelectItem>
                  </SelectContent>
                </Select>
              )}
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                {selectedExerciseData?.type === "cardio" ? (
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar
                      dataKey={cardioMetric === "distance" ? "distance" : "duration"}
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                      name={cardioMetric === "distance" ? t("progress.distanceKm") : t("progress.timeMin")}
                      cursor="pointer"
                      onClick={(data) => {
                        if (data?.fullDate) handleSelectDay(data.fullDate);
                      }}
                    />
                  </BarChart>
                ) : selectedExerciseData?.type === "timed" ? (
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar
                      dataKey="plankTime"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                      name={t("progress.timeSec")}
                      cursor="pointer"
                      onClick={(data) => {
                        if (data?.fullDate) handleSelectDay(data.fullDate);
                      }}
                    />
                  </BarChart>
                ) : metric === "reps" ? (
                  <BarChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Bar
                      dataKey="reps"
                      fill="hsl(var(--primary))"
                      radius={[4, 4, 0, 0]}
                      name={t("progress.repetitions")}
                      cursor="pointer"
                      onClick={(data) => {
                        if (data?.fullDate) handleSelectDay(data.fullDate);
                      }}
                    />
                  </BarChart>
                ) : (
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
                    <XAxis
                      dataKey="date"
                      tick={{ fontSize: 12 }}
                      className="text-muted-foreground"
                    />
                    <YAxis tick={{ fontSize: 12 }} className="text-muted-foreground" />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--card))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "8px",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="weight"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--primary))", strokeWidth: 0, cursor: "pointer" }}
                      activeDot={{
                        r: 6,
                        cursor: "pointer",
                        onClick: (_, payload) => {
                          const data = payload?.payload;
                          if (data?.fullDate) handleSelectDay(data.fullDate);
                        }
                      }}
                      name={`${t("progress.weightTotal")} (${units.weight})`}
                    />
                  </LineChart>
                )}
              </ResponsiveContainer>
            </div>
          </CardContent>
      </Card>
      )}

      {/* Leaderboard */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            {t("progress.top10")} {!isGuest && leaderboardExercise && `· ${(() => {
              const ex = exercises?.find(e => e.name === leaderboardExercise);
              return ex ? getExerciseName(ex.name, ex.name_translations) : leaderboardExercise;
            })()}`}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          {/* Guest CTA */}
          {isGuest ? (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <div className="p-4 bg-primary/10 rounded-full mb-4">
                <Trophy className="h-8 w-8 text-primary" />
              </div>
              <h3 className="font-semibold text-foreground mb-2">{t("guest.leaderboard.title")}</h3>
              <p className="text-muted-foreground text-sm mb-4 max-w-[280px]">
                {t("guest.leaderboard.description")}
              </p>
              <div className="space-y-2 w-full max-w-[200px]">
                <Button
                  className="w-full gap-2 bg-gradient-to-r from-primary to-primary/80 hover:from-primary/90 hover:to-primary/70"
                  onClick={() => signInWithGoogle().catch(() => {})}
                >
                  <svg className="h-4 w-4" viewBox="0 0 24 24">
                    <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                    <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                    <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/>
                    <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
                  </svg>
                  {t("auth.continueWithGoogle")}
                </Button>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => setAuthModalOpen(true)}
                >
                  <LogIn className="h-4 w-4" />
                  {t("guest.friends.loginWithEmail")}
                </Button>
              </div>
              <AuthModal open={authModalOpen} onOpenChange={setAuthModalOpen} />
            </div>
          ) : (
          <>
          {/* Friends filter toggle */}
          {friends && friends.length > 0 && (
            <div className="flex rounded-lg bg-muted p-1 gap-1">
              <button
                onClick={() => setLeaderboardFriendsOnly(false)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium transition-all",
                  !leaderboardFriendsOnly
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Trophy className="h-3.5 w-3.5" />
                {t("progress.everyone")}
              </button>
              <button
                onClick={() => setLeaderboardFriendsOnly(true)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-1.5 py-1.5 px-3 rounded-md text-xs font-medium transition-all",
                  leaderboardFriendsOnly
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                )}
              >
                <Users className="h-3.5 w-3.5" />
                {t("progress.friendsOnly")}
              </button>
            </div>
          )}

          {/* Exercise selector */}
          <div className="flex gap-2">
            <Select value={leaderboardExercise} onValueChange={setLeaderboardExercise}>
              <SelectTrigger className="h-9 text-xs px-3 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {leaderboardExercises.map((ex) => (
                  <SelectItem key={ex.id} value={ex.name}>
                    {getExerciseName(ex.name, ex.name_translations)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={leaderboardPeriod} onValueChange={(v) => setLeaderboardPeriod(v as "all" | "month" | "today")}>
              <SelectTrigger className="h-9 w-auto min-w-[100px] text-xs px-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("progress.allTime")}</SelectItem>
                <SelectItem value="month">{t("workouts.filter.thisMonth")}</SelectItem>
                <SelectItem value="today">{t("workouts.today")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Exercise image */}
          {(() => {
            const selectedEx = exercises?.find(e => e.name === leaderboardExercise);
            if (selectedEx?.image_url) {
              return (
                <div className="w-full aspect-[4/3] rounded-lg overflow-hidden bg-muted">
                  <img
                    src={selectedEx.image_url}
                    alt={getExerciseName(selectedEx.name, selectedEx.name_translations)}
                    className="w-full h-full object-cover"
                  />
                </div>
              );
            }
            return null;
          })()}

          {/* Leaderboard table */}
          {leaderboardData && leaderboardData.length > 0 ? (
            <div className="space-y-2">
              {leaderboardData.map((entry, index) => (
                <LeaderboardRow
                  key={entry.user_id}
                  entry={entry}
                  index={index}
                  isCurrentUser={entry.user_id === effectiveUserId}
                  isFriend={friendIds.includes(entry.user_id)}
                  onNavigate={(userId) => navigate(`/?user=${userId}`)}
                  convertWeight={convertWeight}
                  convertDistance={convertDistance}
                  convertHeight={convertHeight}
                  units={units}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 bg-muted rounded-full mb-4">
                <Trophy className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">{t("common.noData")}</h3>
              <p className="text-muted-foreground text-sm">
                {t("progress.noOneDidExercise")}
              </p>
            </div>
          )}
          </>
          )}
        </CardContent>
      </Card>

      {/* Body Weight Chart (hidden for guests - requires server storage) */}
      {currentWeight !== null && !isGuest && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                {t("progress.bodyWeight")}
              </CardTitle>
              <span className="text-xl font-bold text-primary">{convertWeight(currentWeight)} {units.weight}</span>
            </div>
          </CardHeader>
          <CardContent className="px-4 pb-4">
            {bodyWeightChartData.length > 0 ? (
              <div className="h-56">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={bodyWeightChartData}>
                    <CartesianGrid strokeDasharray="3 3" className="stroke-muted" />
                    <XAxis
                      dataKey="date"
                      className="text-xs"
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                    />
                    <YAxis
                      className="text-xs"
                      tick={{ fill: "hsl(var(--muted-foreground))" }}
                      domain={["dataMin - 2", "dataMax + 2"]}
                    />
                    <Tooltip
                      contentStyle={{
                        backgroundColor: "hsl(var(--background))",
                        border: "1px solid hsl(var(--border))",
                        borderRadius: "0.5rem",
                      }}
                      labelStyle={{ color: "hsl(var(--foreground))" }}
                    />
                    <Line
                      type="monotone"
                      dataKey="weight"
                      stroke="hsl(var(--primary))"
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--primary))", r: 4 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 bg-muted rounded-full mb-4">
                  <Activity className="h-8 w-8 text-muted-foreground" />
                </div>
                <h3 className="font-semibold text-foreground mb-1">{t("common.noData")}</h3>
                <p className="text-muted-foreground text-sm">
                  {t("progress.addWeightToTrack")}
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Body Weight Button (hidden for guests - requires server storage) */}
      {!isGuest && (
      <Dialog open={isWeightDialogOpen} onOpenChange={setIsWeightDialogOpen}>
        <DialogTrigger asChild>
          <Button className="w-full gap-2">
            <Plus className="h-4 w-4" />
            {t("progress.bodyWeight")}
          </Button>
        </DialogTrigger>
        <DialogContent aria-describedby="weight-dialog-description">
          <DialogHeader>
            <DialogTitle>{t("progress.addBodyWeight")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4" id="weight-dialog-description">
            <div className="space-y-2">
              <Label htmlFor="weight">{t("workout.weight")} ({units.weight})</Label>
              <Input
                id="weight"
                type="number"
                step="0.1"
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                placeholder={t("progress.enterWeight")}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">{t("progress.date")}</Label>
              <Input
                id="date"
                type="date"
                value={weightDate}
                onChange={(e) => setWeightDate(e.target.value)}
              />
            </div>
            <Button onClick={handleSaveWeight} className="w-full">
              {t("common.save")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      )}
    </div>
  );
}
