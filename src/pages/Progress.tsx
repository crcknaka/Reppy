import { useState, useMemo, useEffect } from "react";
import { format, subDays, startOfMonth } from "date-fns";
import { ru } from "date-fns/locale";
import { Zap, BarChart3, Repeat, Plus, User, Trophy, Medal } from "lucide-react";
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
  const { data: workouts } = useWorkouts();
  const { data: exercises } = useExercises();
  const { user } = useAuth();
  const { toast } = useToast();
  const [selectedExercise, setSelectedExercise] = useState<string>("all");
  const [metric, setMetric] = useState<"reps" | "weight">("reps");
  const [isWeightDialogOpen, setIsWeightDialogOpen] = useState(false);
  const [newWeight, setNewWeight] = useState("");
  const [weightDate, setWeightDate] = useState(format(new Date(), "yyyy-MM-dd"));
  const [bodyWeightHistory, setBodyWeightHistory] = useState<Array<{ date: string; weight: number }>>([]);
  const [currentWeight, setCurrentWeight] = useState<number | null>(null);
  const [timeFilter, setTimeFilter] = useState<"7days" | "30days" | "month" | "all">("30days");
  const [leaderboardExercise, setLeaderboardExercise] = useState<string>("Штанга лёжа");
  const [leaderboardPeriod, setLeaderboardPeriod] = useState<"all" | "month">("all");

  // Load leaderboard data
  const { data: leaderboardData } = useLeaderboard(leaderboardExercise, leaderboardPeriod);

  // Base exercises for leaderboard
  const baseExercises = ["Штанга лёжа", "Приседания", "Подтягивания", "Отжимания"];

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
    return exercises?.filter((e) => exerciseIds.has(e.id)) || [];
  }, [workouts, exercises]);

  // Prepare chart data
  const chartData = useMemo(() => {
    if (!workouts) return [];

    let startDate: Date;
    const today = new Date();

    switch (timeFilter) {
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

      const totalReps = relevantSets.reduce((sum, s) => sum + s.reps, 0);
      const maxWeight = relevantSets.reduce((max, s) => Math.max(max, s.weight || 0), 0);
      const totalVolume = calculateTotalVolume(relevantSets, currentWeight);

      return {
        date: format(new Date(workout.date), "d MMM", { locale: ru }),
        fullDate: workout.date,
        reps: totalReps,
        weight: maxWeight,
        volume: totalVolume,
        sets: relevantSets.length,
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
    const workoutCount = chartData.length;

    // Calculate trend (last 7 vs previous 7)
    const last7 = chartData.slice(-7);
    const prev7 = chartData.slice(-14, -7);

    const last7Reps = last7.reduce((sum, d) => sum + d.reps, 0);
    const prev7Reps = prev7.reduce((sum, d) => sum + d.reps, 0);
    const repsTrend = prev7Reps > 0 ? ((last7Reps - prev7Reps) / prev7Reps) * 100 : 0;

    return {
      totalReps,
      totalSets,
      maxWeight,
      totalVolume,
      workoutCount,
      repsTrend,
    };
  }, [chartData]);

  const selectedExerciseData = exercises?.find((e) => e.id === selectedExercise);

  // Get filter period text
  const getFilterText = () => {
    switch (timeFilter) {
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
        <div className="flex gap-3">
          <Select value={selectedExercise} onValueChange={setSelectedExercise}>
            <SelectTrigger className="flex-1">
              <SelectValue placeholder="Все упражнения" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Все упражнения</SelectItem>
              {usedExercises.map((exercise) => (
                <SelectItem key={exercise.id} value={exercise.id}>
                  {exercise.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select value={metric} onValueChange={(v) => setMetric(v as "reps" | "weight")}>
            <SelectTrigger className="w-[140px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="reps">Повторения</SelectItem>
              <SelectItem value="weight">Вес</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Time filter buttons */}
        <div className="flex gap-2 flex-wrap">
          <Button
            variant={timeFilter === "7days" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeFilter("7days")}
            className="text-xs"
          >
            За 7 дней
          </Button>
          <Button
            variant={timeFilter === "30days" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeFilter("30days")}
            className="text-xs"
          >
            За 30 дней
          </Button>
          <Button
            variant={timeFilter === "month" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeFilter("month")}
            className="text-xs"
          >
            Этот месяц
          </Button>
          <Button
            variant={timeFilter === "all" ? "default" : "outline"}
            size="sm"
            onClick={() => setTimeFilter("all")}
            className="text-xs"
          >
            За всё время
          </Button>
        </div>
      </div>

      {/* Stats cards */}
      {stats && (
        <div className="grid grid-cols-2 gap-3">
          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Repeat className="h-4 w-4" />
                <span className="text-xs">Всего {pluralize(stats.totalReps, "повторение", "повторения", "повторений")}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{stats.totalReps}</p>
              {stats.repsTrend !== 0 && (
                <p className={`text-xs ${stats.repsTrend > 0 ? "text-success" : "text-destructive"}`}>
                  {stats.repsTrend > 0 ? "+" : ""}{stats.repsTrend.toFixed(0)}% за неделю
                </p>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <User className="h-4 w-4" />
                <span className="text-xs">Макс. вес</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {stats.maxWeight > 0 ? `${stats.maxWeight} кг` : "—"}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <Zap className="h-4 w-4" />
                <span className="text-xs">{pluralize(stats.workoutCount, "Тренировка", "Тренировки", "Тренировок")}</span>
              </div>
              <p className="text-2xl font-bold text-foreground">{stats.workoutCount}</p>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="pt-4">
              <div className="flex items-center gap-2 text-muted-foreground mb-1">
                <BarChart3 className="h-4 w-4" />
                <span className="text-xs">Объём</span>
              </div>
              <p className="text-2xl font-bold text-foreground">
                {stats.totalVolume.toLocaleString()}
              </p>
              <p className="text-xs text-muted-foreground">кг × повт.</p>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Chart */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg">
            {metric === "reps" ? "Повторения" : "Максимальный вес"} {getFilterText()}
            {selectedExercise !== "all" && selectedExerciseData && (
              <span className="text-muted-foreground font-normal ml-2">
                · {selectedExerciseData.name}
              </span>
            )}
          </CardTitle>
        </CardHeader>
        <CardContent>
          {chartData.length > 0 ? (
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                {metric === "reps" ? (
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
          ) : (
            <div className="h-64 flex items-center justify-center text-muted-foreground">
              Нет данных {getFilterText()}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Body Weight Button */}
      <Dialog open={isWeightDialogOpen} onOpenChange={setIsWeightDialogOpen}>
        <DialogTrigger asChild>
          <Button className="w-full gap-2">
            <Plus className="h-4 w-4" />
            Вес Тела
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Записать вес</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 pt-4">
            <div className="space-y-2">
              <Label htmlFor="weight">Вес тела (кг)</Label>
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

      {/* Body Weight Chart */}
      {currentWeight !== null && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg flex items-center justify-between">
              <span>Изменение веса тела</span>
              <span className="text-2xl font-bold">{currentWeight} кг</span>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {bodyWeightChartData.length > 0 ? (
              <div className="h-64">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={bodyWeightChartData}>
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
                      stroke="hsl(var(--chart-2))"
                      strokeWidth={2}
                      dot={{ fill: "hsl(var(--chart-2))", strokeWidth: 0 }}
                      name="Вес (кг)"
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            ) : (
              <div className="h-64 flex items-center justify-center text-muted-foreground">
                Нет данных {getFilterText()}. Добавьте свой первый замер веса!
              </div>
            )}
          </CardContent>
        </Card>
      )}

      {/* Leaderboard */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg flex items-center gap-2">
            <Trophy className="h-5 w-5 text-primary" />
            ТОП-10 Пользователей
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          {/* Exercise selector */}
          <div className="flex gap-3">
            <Select value={leaderboardExercise} onValueChange={setLeaderboardExercise}>
              <SelectTrigger className="flex-1">
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

            <Select value={leaderboardPeriod} onValueChange={(v) => setLeaderboardPeriod(v as "all" | "month")}>
              <SelectTrigger className="w-[160px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">За всё время</SelectItem>
                <SelectItem value="month">За этот месяц</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Leaderboard table */}
          {leaderboardData && leaderboardData.length > 0 ? (
            <div className="space-y-2">
              {leaderboardData.map((entry, index) => (
                <div
                  key={entry.user_id}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-lg",
                    index === 0 && "bg-yellow-500/10 border border-yellow-500/20",
                    index === 1 && "bg-gray-400/10 border border-gray-400/20",
                    index === 2 && "bg-orange-600/10 border border-orange-600/20",
                    index > 2 && "bg-muted/30"
                  )}
                >
                  {/* Rank */}
                  <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted font-bold text-sm">
                    {index === 0 && <Medal className="h-5 w-5 text-yellow-500" />}
                    {index === 1 && <Medal className="h-5 w-5 text-gray-400" />}
                    {index === 2 && <Medal className="h-5 w-5 text-orange-600" />}
                    {index > 2 && <span>{index + 1}</span>}
                  </div>

                  {/* Avatar */}
                  <div className="flex items-center justify-center w-10 h-10 rounded-full bg-primary/10 text-2xl">
                    {entry.avatar || "👤"}
                  </div>

                  {/* User info */}
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-foreground truncate">
                      {entry.display_name || "Аноним"}
                    </div>
                    <div className="text-xs text-muted-foreground flex gap-2">
                      {entry.current_weight && <span>Вес: {entry.current_weight} кг</span>}
                      {entry.height && <span>Рост: {entry.height} см</span>}
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="text-right">
                    <div className="font-bold text-lg text-foreground">
                      {entry.max_weight > 0 ? `${entry.max_weight} кг` : `${entry.max_reps} повт.`}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      Всего: {entry.total_reps} {pluralize(entry.total_reps, "повторение", "повторения", "повторений")}
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
    </div>
  );
}
