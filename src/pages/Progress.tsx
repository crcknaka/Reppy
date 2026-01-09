import { useState, useMemo, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { format, subDays, startOfMonth, startOfDay } from "date-fns";
import { ru } from "date-fns/locale";
import { Zap, Repeat, Plus, Trophy, Medal, Activity, Clock, Weight, TrendingUp, User, Dumbbell, Timer, LayoutGrid } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
  const [timeFilter, setTimeFilter] = useState<"today" | "7days" | "30days" | "month" | "all">("30days");
  const [leaderboardExercise, setLeaderboardExercise] = useState<string>("Штанга лёжа");
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<"all" | "month" | "today">("all");

  // Load leaderboard data
  const { data: leaderboardData } = useLeaderboard(leaderboardExercise, leaderboardPeriod);

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

    let startDate: Date;
    const today = new Date();

    switch (timeFilter) {
      case "today":
        startDate = startOfDay(today);
        break;
      case "7days":
        startDate = subDays(today, 7);
        break;
      case "30days":
        startDate = subDays(today, 30);
        break;
      case "month":
        startDate = startOfMonth(today);
        break;
      case "all":
        startDate = new Date(0); // Beginning of time
        break;
      default:
        startDate = subDays(today, 30);
    }

    const filteredWorkouts = workouts
      .filter((w) => new Date(w.date) >= startDate)
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
  }, [workouts, selectedExercise, currentWeight, timeFilter]);

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

  // Get filter period text
  const getFilterText = () => {
    switch (timeFilter) {
      case "today":
        return "за сегодня";
      case "7days":
        return "за 7 дней";
      case "30days":
        return "за 30 дней";
      case "month":
        return "за месяц";
      case "all":
        return "за всё время";
      default:
        return "за 30 дней";
    }
  };

  // Prepare body weight chart data
  const bodyWeightChartData = useMemo(() => {
    let startDate: Date;
    const today = new Date();

    switch (timeFilter) {
      case "today":
        startDate = startOfDay(today);
        break;
      case "7days":
        startDate = subDays(today, 7);
        break;
      case "30days":
        startDate = subDays(today, 30);
        break;
      case "month":
        startDate = startOfMonth(today);
        break;
      case "all":
        startDate = new Date(0);
        break;
      default:
        startDate = subDays(today, 30);
    }

    return bodyWeightHistory
      .filter((w) => new Date(w.date) >= startDate)
      .map((w) => ({
        date: format(new Date(w.date), "d MMM", { locale: ru }),
        weight: w.weight,
      }));
  }, [bodyWeightHistory, timeFilter]);

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
          <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">Прогресс</h1>
          <p className="text-muted-foreground text-base">Отслеживай достижения</p>
        </div>
      </div>

      {/* Filters */}
      <div className="space-y-3">
        {/* Exercise type and exercise selector */}
        <div className="grid grid-cols-2 gap-3">
          <Select
            value={exerciseTypeFilter}
            onValueChange={(v) => {
              setExerciseTypeFilter(v as "all" | "weighted" | "bodyweight" | "cardio" | "timed");
            }}
          >
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">
                <div className="flex items-center gap-2">
                  <LayoutGrid className="h-4 w-4" />
                  Все типы
                </div>
              </SelectItem>
              <SelectItem value="bodyweight">
                <div className="flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Собственный вес
                </div>
              </SelectItem>
              <SelectItem value="weighted">
                <div className="flex items-center gap-2">
                  <Dumbbell className="h-4 w-4" />
                  С отягощением
                </div>
              </SelectItem>
              <SelectItem value="cardio">
                <div className="flex items-center gap-2">
                  <Activity className="h-4 w-4" />
                  Кардио
                </div>
              </SelectItem>
              <SelectItem value="timed">
                <div className="flex items-center gap-2">
                  <Timer className="h-4 w-4" />
                  На время
                </div>
              </SelectItem>
            </SelectContent>
          </Select>

          <Select value={selectedExercise} onValueChange={setSelectedExercise}>
            <SelectTrigger>
              <SelectValue placeholder="Выбери упражнение" />
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
        </div>

        {/* Time filter buttons */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={timeFilter === "today" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeFilter("today")}
            className="text-xs"
          >
            Сегодня
          </Button>
          <Button
            variant={timeFilter === "7days" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeFilter("7days")}
            className="text-xs"
          >
            7 дней
          </Button>
          <Button
            variant={timeFilter === "30days" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeFilter("30days")}
            className="text-xs"
          >
            30 дней
          </Button>
          <Button
            variant={timeFilter === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeFilter("month")}
            className="text-xs"
          >
            Месяц
          </Button>
          <Button
            variant={timeFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeFilter("all")}
            className="text-xs"
          >
            Всё время
          </Button>
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
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Repeat className="h-4 w-4" />
                  <span className="text-xs"> {pluralize(stats.totalReps, "Повторение", "Повторения", "Повторений")}</span>
                </div>
                <p className="text-2xl font-bold text-foreground">{stats.totalReps}</p>
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
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Weight className="h-4 w-4" />
                  <span className="text-xs">Макс. вес</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {stats.maxWeight > 0 ? `${stats.maxWeight} кг` : "—"}
                </p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Zap className="h-4 w-4" />
                <span className="text-xs">{pluralize(stats.workoutCount, "Тренировка", "Тренировки", "Тренировок")}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{stats.workoutCount}</p>
            </CardContent>
          </Card>

          {selectedExerciseData?.type !== "bodyweight" && selectedExerciseData?.type !== "cardio" && selectedExerciseData?.type !== "timed" && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <TrendingUp className="h-4 w-4" />
                  <span className="text-xs">Объём</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {stats.totalVolume.toLocaleString()} кг
                </p>
              </CardContent>
            </Card>
          )}

          {stats.totalDistance > 0 && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Activity className="h-4 w-4" />
                  <span className="text-xs">Пробежал</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {stats.totalDistance.toFixed(1)} км
                </p>
              </CardContent>
            </Card>
          )}

          {stats.totalDurationMinutes > 0 && (selectedExerciseData?.type === "cardio" || selectedExercise === "all") && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs">Бегал</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {stats.totalDurationMinutes >= 60
                    ? `${stats.totalDurationHours.toFixed(2)} ч`
                    : `${stats.totalDurationMinutes.toFixed(0)} мин`}
                </p>
              </CardContent>
            </Card>
          )}

          {stats.totalPlankSeconds > 0 && (selectedExerciseData?.type === "timed" || selectedExercise === "all") && (
            <Card>
              <CardContent className="pt-4">
                <div className="flex items-center gap-2 text-muted-foreground mb-1">
                  <Clock className="h-4 w-4" />
                  <span className="text-xs">В планке</span>
                </div>
                <p className="text-2xl font-bold text-foreground">
                  {stats.totalPlankSeconds >= 3600
                    ? `${(stats.totalPlankSeconds / 3600).toFixed(2)} ч`
                    : `${(stats.totalPlankSeconds / 60).toFixed(2)} мин`}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Chart */}
      {selectedExercise !== "all" && chartData.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between gap-3">
              <CardTitle className="text-lg">
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
                  <SelectTrigger className="w-[140px]">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="distance">Дистанция</SelectItem>
                    <SelectItem value="duration">Время</SelectItem>
                  </SelectContent>
                </Select>
              ) : selectedExerciseData?.type === "weighted" && (
                <Select value={metric} onValueChange={(v) => setMetric(v as "reps" | "weight")}>
                  <SelectTrigger className="w-[140px]">
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
          <CardContent>
            <div className="h-64">
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
                      dot={{ fill: "hsl(var(--primary))", strokeWidth: 0 }}
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
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            ТОП-10 · {leaderboardExercise}
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Exercise selector */}
          <div className="grid grid-cols-2 gap-3">
            <Select value={leaderboardExercise} onValueChange={setLeaderboardExercise}>
              <SelectTrigger>
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
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Всё время</SelectItem>
                <SelectItem value="month">Этот месяц</SelectItem>
                <SelectItem value="today">Сегодня</SelectItem>
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
          <CardHeader className="pb-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg flex items-center gap-2">
                <Activity className="h-5 w-5 text-primary" />
                Вес Тела
              </CardTitle>
              <span className="text-2xl font-bold text-primary">{currentWeight} кг</span>
            </div>
          </CardHeader>
          <CardContent>
            {bodyWeightChartData.length > 0 ? (
              <div className="h-64">
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
