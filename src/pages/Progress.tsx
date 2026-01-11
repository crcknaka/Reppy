import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format, subDays, startOfMonth, endOfMonth, startOfDay, endOfDay, parseISO, subMonths, isWithinInterval } from "date-fns";
import { ru } from "date-fns/locale";
import { Zap, Repeat, Plus, Trophy, Medal, Activity, Clock, Weight, TrendingUp, User, Dumbbell, Timer, LayoutGrid, ChevronDown, Calendar as CalendarIcon, X, Users } from "lucide-react";
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
import { useWorkouts } from "@/hooks/useWorkouts";
import { useExercises } from "@/hooks/useExercises";
import { useLeaderboard } from "@/hooks/useLeaderboard";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/contexts/AuthContext";
import { useToast } from "@/hooks/use-toast";
import { calculateTotalVolume } from "@/lib/volumeUtils";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, BarChart, Bar } from "recharts";
import { pluralize } from "@/lib/pluralize";
import { cn } from "@/lib/utils";
import { useFriends } from "@/hooks/useFriends";

export default function Progress() {
  const navigate = useNavigate();
  const { data: workouts } = useWorkouts();
  const { data: exercises } = useExercises();
  const { user } = useAuth();
  const { toast } = useToast();
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
  const [leaderboardExercise, setLeaderboardExercise] = useState<string>("Штанга лёжа");
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<"all" | "month" | "today">("all");
  const [leaderboardFriendsOnly, setLeaderboardFriendsOnly] = useState(false);
  const [historyOpen, setHistoryOpen] = useState(false);

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

  // Base exercises for leaderboard
  const baseExercises = [
    "Штанга лёжа",
    "Приседания",
    "Подтягивания",
    "Отжимания",
    "Отжимания на брусьях",
    "Бег",
    "Гантели Бицепс",
    "Тяга на себя",
    "Пресс",
    "Планка",
    "Тяга верхнего блока"
  ];

  // Load body weight history
  useEffect(() => {
    if (!user) return;

    const loadWeightHistory = async () => {
      const { data, error } = await supabase
        .from("body_weight_history")
        .select("*")
        .eq("user_id", user.id)
        .order("date", { ascending: true });

      if (error) {
        console.error("Error loading weight history:", error);
        return;
      }

      setBodyWeightHistory(data || []);
    };

    const loadCurrentWeight = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("current_weight")
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.error("Error loading current weight:", error);
        return;
      }

      setCurrentWeight(data?.current_weight || null);
    };

    loadWeightHistory();
    loadCurrentWeight();
  }, [user]);

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
        date: format(new Date(workout.date), "d MMM", { locale: ru }),
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
        return `${set.reps} ${pluralize(set.reps || 0, "раз", "раза", "раз")} по ${set.weight} кг`;
      case "bodyweight":
        return `${set.reps} ${pluralize(set.reps || 0, "раз", "раза", "раз")}`;
      case "cardio": {
        if (set.distance_km && set.duration_minutes) {
          return `${set.distance_km} км за ${set.duration_minutes} мин`;
        } else if (set.distance_km) {
          return `${set.distance_km} км`;
        } else if (set.duration_minutes) {
          return `${set.duration_minutes} мин`;
        }
        return "";
      }
      case "timed": {
        const seconds = set.plank_seconds || 0;
        const minutes = (seconds / 60).toFixed(2);
        return `${seconds} сек (${minutes} мин)`;
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
      const dayOfWeek = format(parsedDate, "EEEE", { locale: ru });
      const capitalizedDay = dayOfWeek.charAt(0).toUpperCase() + dayOfWeek.slice(1);
      // Full month name with capital letter
      const day = format(parsedDate, "d", { locale: ru });
      const month = format(parsedDate, "MMMM", { locale: ru });
      const capitalizedMonth = month.charAt(0).toUpperCase() + month.slice(1);

      return {
        dateKey,
        header: `${capitalizedDay}, ${day} ${capitalizedMonth}`,
        setsWithIndex,
      };
    });
  }, [exerciseHistory]);

  // Check if single day is selected (from === to)
  const isSingleDaySelected = dateRange?.from && dateRange?.to &&
    format(dateRange.from, "yyyy-MM-dd") === format(dateRange.to, "yyyy-MM-dd");

  // Get filter period text
  const getFilterText = () => {
    if (!dateRange?.from) return "за всё время";
    if (isSingleDaySelected) {
      return format(dateRange.from!, "d MMMM", { locale: ru });
    }
    if (dateRange.from && dateRange.to) {
      return `${format(dateRange.from, "d MMM", { locale: ru })} — ${format(dateRange.to, "d MMM", { locale: ru })}`;
    }
    return `с ${format(dateRange.from, "d MMM", { locale: ru })}`;
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
        date: format(new Date(w.date), "d MMM", { locale: ru }),
        weight: w.weight,
      }));
  }, [bodyWeightHistory, dateRange]);

  const handleSaveWeight = async () => {
    if (!user || !newWeight) return;

    const weight = parseFloat(newWeight);
    if (isNaN(weight) || weight <= 0) {
      toast({
        title: "Ошибка",
        description: "Введите корректный вес",
        variant: "destructive",
      });
      return;
    }

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
        title: "Ошибка",
        description: "Не удалось сохранить вес",
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
      title: "Успешно",
      description: "Вес сохранён",
    });
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">Прогресс</h1>
          <p className="text-muted-foreground text-sm">Отслеживай достижения</p>
        </div>
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
                  Все типы
                </div>
              </SelectItem>
              <SelectItem value="bodyweight">
                <div className="flex items-center gap-2">
                  <User className="h-3.5 w-3.5" />
                  Собственный вес
                </div>
              </SelectItem>
              <SelectItem value="weighted">
                <div className="flex items-center gap-2">
                  <Dumbbell className="h-3.5 w-3.5" />
                  С отягощением
                </div>
              </SelectItem>
              <SelectItem value="cardio">
                <div className="flex items-center gap-2">
                  <Activity className="h-3.5 w-3.5" />
                  Кардио
                </div>
              </SelectItem>
              <SelectItem value="timed">
                <div className="flex items-center gap-2">
                  <Timer className="h-3.5 w-3.5" />
                  На время
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedExercise} onValueChange={setSelectedExercise}>
            <SelectTrigger className="h-9 w-auto min-w-[140px] max-w-[180px] text-xs px-3">
              <SelectValue placeholder="Упражнение" />
            </SelectTrigger>
            <SelectContent>
              {exerciseTypeFilter === "all" && (
                <SelectItem value="all">Все упражнения</SelectItem>
              )}
              {usedExercises.map((exercise) => (
                <SelectItem key={exercise.id} value={exercise.id}>
                  {exercise.name}
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
                    format(dateRange.from, "d MMM", { locale: ru })
                  ) : dateRange.to ? (
                    `${format(dateRange.from, "d MMM", { locale: ru })} – ${format(dateRange.to, "d MMM", { locale: ru })}`
                  ) : (
                    `С ${format(dateRange.from, "d MMM", { locale: ru })}`
                  )
                ) : (
                  "Всё время"
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
                  Всё время
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs h-8"
                  onClick={() => handleQuickFilter(7)}
                >
                  Последние 7 дней
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs h-8"
                  onClick={() => handleQuickFilter(30)}
                >
                  Последние 30 дней
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs h-8"
                  onClick={() => handleQuickFilter("current-month")}
                >
                  Этот месяц
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="w-full justify-start text-xs h-8"
                  onClick={() => handleQuickFilter("last-month")}
                >
                  Прошлый месяц
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
                locale={ru}
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
                  Сбросить
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
            <h3 className="font-semibold text-foreground mb-1">Нет данных {getFilterText()}</h3>
            <p className="text-muted-foreground text-sm">
              {selectedExercise === "all"
                ? "Не будь ленивым скуфом, давай заниматься!"
                : "Выполни это упражнение, чтобы увидеть статистику"}
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
                  <span className="text-xs"> {pluralize(stats.totalReps, "Повторение", "Повторения", "Повторений")}</span>
                </div>
                <p className="text-xl font-bold text-foreground">{stats.totalReps}</p>
                {stats.repsTrend !== 0 && (
                  <p className={`text-xs ${stats.repsTrend > 0 ? "text-success" : "text-destructive"}`}>
                    {stats.repsTrend > 0 ? "+" : ""}{stats.repsTrend.toFixed(0)}% за неделю
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
                  <span className="text-xs">Макс. вес</span>
                </div>
                <p className="text-xl font-bold text-foreground">
                  {stats.maxWeight > 0 ? `${stats.maxWeight} кг` : "—"}
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="p-3">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Zap className="h-3.5 w-3.5" />
                <span className="text-xs">{pluralize(stats.workoutCount, "Тренировка", "Тренировки", "Тренировок")}</span>
              </div>
              <p className="text-xl font-bold text-foreground">{stats.workoutCount}</p>
            </CardContent>
          </Card>

          {selectedExerciseData?.type !== "bodyweight" && selectedExerciseData?.type !== "cardio" && selectedExerciseData?.type !== "timed" && (
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <TrendingUp className="h-3.5 w-3.5" />
                  <span className="text-xs">Объём</span>
                </div>
                <p className="text-xl font-bold text-foreground">
                  {stats.totalVolume.toLocaleString()} кг
                </p>
              </CardContent>
            </Card>
          )}

          {stats.totalDistance > 0 && (
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Activity className="h-3.5 w-3.5" />
                  <span className="text-xs">Пробежал</span>
                </div>
                <p className="text-xl font-bold text-foreground">
                  {stats.totalDistance.toFixed(1)} км
                </p>
              </CardContent>
            </Card>
          )}

          {stats.totalDurationMinutes > 0 && (selectedExerciseData?.type === "cardio" || selectedExercise === "all") && (
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="text-xs">Бегал</span>
                </div>
                <p className="text-xl font-bold text-foreground">
                  {stats.totalDurationMinutes >= 60
                    ? `${stats.totalDurationHours.toFixed(2)} ч`
                    : `${stats.totalDurationMinutes.toFixed(0)} мин`}
                </p>
              </CardContent>
            </Card>
          )}

          {stats.totalPlankSeconds > 0 && (selectedExerciseData?.type === "timed" || selectedExercise === "all") && (
            <Card>
              <CardContent className="p-3">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Clock className="h-3.5 w-3.5" />
                  <span className="text-xs">В планке</span>
                </div>
                <p className="text-xl font-bold text-foreground">
                  {stats.totalPlankSeconds >= 3600
                    ? `${(stats.totalPlankSeconds / 3600).toFixed(2)} ч`
                    : `${(stats.totalPlankSeconds / 60).toFixed(2)} мин`}
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
                  <span className="font-medium text-foreground">История подходов</span>
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
                    ? "Дистанция (км)"
                    : "Время (мин)"
                  : selectedExerciseData?.type === "timed"
                    ? "Время (сек)"
                    : metric === "reps"
                      ? "Повторения"
                      : "Максимальный вес"} {getFilterText()}
                {selectedExercise !== "all" && selectedExerciseData && (
                  <span className="text-muted-foreground font-normal ml-2">
                    · {selectedExerciseData.name}
                  </span>
                )}
              </CardTitle>

              {selectedExerciseData?.type === "cardio" ? (
                <Select value={cardioMetric} onValueChange={(v) => setCardioMetric(v as "distance" | "duration")}>
                  <SelectTrigger className="h-9 w-auto min-w-[100px] text-xs px-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="distance">Дистанция</SelectItem>
                    <SelectItem value="duration">Время</SelectItem>
                  </SelectContent>
                </Select>
              ) : selectedExerciseData?.type === "weighted" && (
                <Select value={metric} onValueChange={(v) => setMetric(v as "reps" | "weight")}>
                  <SelectTrigger className="h-9 w-auto min-w-[100px] text-xs px-3">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="reps">Повторения</SelectItem>
                    <SelectItem value="weight">Вес</SelectItem>
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
                      name={cardioMetric === "distance" ? "Дистанция (км)" : "Время (мин)"}
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
                      name="Время (сек)"
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
                      name="Повторения"
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
                      name="Вес (кг)"
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
            ТОП-10 · {leaderboardExercise}
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-3">
          {/* Exercise selector */}
          <div className="flex gap-2">
            <Select value={leaderboardExercise} onValueChange={setLeaderboardExercise}>
              <SelectTrigger className="h-9 text-xs px-3 flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {baseExercises.map((exercise) => (
                  <SelectItem key={exercise} value={exercise}>
                    {exercise}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={leaderboardPeriod} onValueChange={(v) => setLeaderboardPeriod(v as "all" | "month" | "today")}>
              <SelectTrigger className="h-9 w-auto min-w-[100px] text-xs px-3">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Всё время</SelectItem>
                <SelectItem value="month">Этот месяц</SelectItem>
                <SelectItem value="today">Сегодня</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Friends filter toggle */}
          {friends && friends.length > 0 && (
            <Button
              variant={leaderboardFriendsOnly ? "default" : "outline"}
              size="sm"
              className="w-full gap-2 text-xs"
              onClick={() => setLeaderboardFriendsOnly(!leaderboardFriendsOnly)}
            >
              <Users className="h-3.5 w-3.5" />
              {leaderboardFriendsOnly ? "Только друзья" : "Все пользователи"}
            </Button>
          )}

          {/* Exercise image */}
          {(() => {
            const selectedEx = exercises?.find(e => e.name === leaderboardExercise);
            if (selectedEx?.image_url) {
              return (
                <div className="w-full aspect-[4/3] rounded-lg overflow-hidden bg-muted">
                  <img
                    src={selectedEx.image_url}
                    alt={leaderboardExercise}
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
                <div
                  key={entry.user_id}
                  className={cn(
                    "flex items-center gap-2 p-2.5 rounded-lg cursor-pointer transition-colors",
                    "hover:bg-muted/50",
                    index === 0 && "bg-yellow-500/10 border border-yellow-500/20 hover:bg-yellow-500/20",
                    index === 1 && "bg-gray-400/10 border border-gray-400/20 hover:bg-gray-400/20",
                    index === 2 && "bg-orange-600/10 border border-orange-600/20 hover:bg-orange-600/20",
                    index > 2 && "bg-muted/30"
                  )}
                  onClick={() => navigate(`/?user=${entry.user_id}`)}
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
                      {entry.display_name || "Аноним"}
                    </div>
                    <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2 gap-y-0.5">
                      {entry.current_weight && <span className="whitespace-nowrap">Вес: {entry.current_weight} кг</span>}
                      {entry.height && <span className="whitespace-nowrap">Рост: {entry.height} см</span>}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="text-right shrink-0 ml-2">
                    <div className="font-bold text-base sm:text-lg text-foreground whitespace-nowrap">
                      {entry.max_plank_seconds > 0 ? `${(entry.max_plank_seconds / 60).toFixed(2)} мин` :
                       entry.max_distance > 0 ? `${entry.max_distance} км` :
                       entry.max_weight > 0 ? `${entry.max_weight} кг` :
                       `${entry.max_reps} раз.`}
                    </div>
                    <div className="text-xs text-muted-foreground whitespace-nowrap">
                      {entry.max_plank_seconds > 0 ? `Всего: ${(entry.total_plank_seconds / 60).toFixed(2)} мин` :
                       entry.max_distance > 0 ? `Всего: ${entry.total_distance.toFixed(1)} км` :
                       `Всего: ${entry.total_reps} ${pluralize(entry.total_reps, "раз", "раза", "раз")}`}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-12 text-center">
              <div className="p-4 bg-muted rounded-full mb-4">
                <Trophy className="h-8 w-8 text-muted-foreground" />
              </div>
              <h3 className="font-semibold text-foreground mb-1">Нет данных</h3>
              <p className="text-muted-foreground text-sm">
                Пока никто не выполнял это упражнение
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Body Weight Chart */}
      {currentWeight !== null && (
        <Card>
          <CardHeader className="pb-2 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Activity className="h-4 w-4 text-primary" />
                Вес Тела
              </CardTitle>
              <span className="text-xl font-bold text-primary">{currentWeight} кг</span>
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
                <h3 className="font-semibold text-foreground mb-1">Нет данных</h3>
                <p className="text-muted-foreground text-sm">
                  Добавьте свой вес, чтобы отслеживать прогресс
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Body Weight Button */}
      <Dialog open={isWeightDialogOpen} onOpenChange={setIsWeightDialogOpen}>
        <DialogTrigger asChild>
          <Button className="w-full gap-2">
            <Plus className="h-4 w-4" />
            Вес Тела
          </Button>
        </DialogTrigger>
        <DialogContent aria-describedby="weight-dialog-description">
          <DialogHeader>
            <DialogTitle>Добавить вес тела</DialogTitle>
          </DialogHeader>
          <div className="space-y-4" id="weight-dialog-description">
            <div className="space-y-2">
              <Label htmlFor="weight">Вес (кг)</Label>
              <Input
                id="weight"
                type="number"
                step="0.1"
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                placeholder="Введите вес"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="date">Дата</Label>
              <Input
                id="date"
                type="date"
                value={weightDate}
                onChange={(e) => setWeightDate(e.target.value)}
              />
            </div>
            <Button onClick={handleSaveWeight} className="w-full">
              Сохранить
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
