import { useState, useMemo } from "react";
import { format, isWithinInterval, startOfDay, endOfDay, subDays, startOfMonth, endOfMonth, subMonths } from "date-fns";
import { ru } from "date-fns/locale";
import { Plus, Calendar as CalendarIcon, Trash2, ChevronRight, MessageSquare, Filter, X, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useWorkouts, useCreateWorkout, useDeleteWorkout } from "@/hooks/useWorkouts";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { pluralizeWithCount } from "@/lib/pluralize";
import { DateRange } from "react-day-picker";

export default function Workouts() {
  const navigate = useNavigate();
  const { data: workouts, isLoading } = useWorkouts();
  const createWorkout = useCreateWorkout();
  const deleteWorkout = useDeleteWorkout();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [open, setOpen] = useState(false);
  const [filterOpen, setFilterOpen] = useState(false);
  const [dateRange, setDateRange] = useState<DateRange | undefined>();

  const handleCreateWorkout = async () => {
    if (!date) return;
    
    try {
      const workout = await createWorkout.mutateAsync(
        format(date, "yyyy-MM-dd")
      );
      toast.success("Тренировка создана!");
      setOpen(false);
      navigate(`/workout/${workout.id}`);
    } catch (error) {
      toast.error("Ошибка создания тренировки");
    }
  };

  const handleDeleteWorkout = async (workoutId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteWorkout.mutateAsync(workoutId);
      toast.success("Тренировка удалена");
    } catch (error) {
      toast.error("Ошибка удаления");
    }
  };

  const getTotalSets = (workout: typeof workouts extends (infer T)[] | undefined ? T : never) => {
    return workout?.workout_sets?.length || 0;
  };

  const getUniqueExercises = (workout: typeof workouts extends (infer T)[] | undefined ? T : never) => {
    const exerciseIds = new Set(workout?.workout_sets?.map(s => s.exercise_id));
    return exerciseIds.size;
  };

  // Filter workouts by date range
  const filteredWorkouts = useMemo(() => {
    if (!workouts) return [];
    if (!dateRange?.from) return workouts;

    return workouts.filter((workout) => {
      const workoutDate = new Date(workout.date);

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
  }, [workouts, dateRange]);

  const handleClearFilter = () => {
    setDateRange(undefined);
  };

  const handleQuickFilter = (days: number | "current-month" | "last-month") => {
    const today = new Date();

    if (days === "current-month") {
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

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">Тренировки</h1>
          <p className="text-muted-foreground text-base">История твоих тренировок</p>
        </div>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button className="gap-2 shadow-lg">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Новая тренировка</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              locale={ru}
              className="rounded-md border-0"
            />
            <div className="p-3 border-t border-border">
              <Button 
                className="w-full" 
                onClick={handleCreateWorkout}
                disabled={createWorkout.isPending}
              >
                Создать на {date && format(date, "d MMM", { locale: ru })}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {/* Date Filter */}
      <div className="space-y-3">
        {/* Quick filter buttons */}
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickFilter(7)}
            className={cn(
              "text-xs",
              dateRange?.from &&
                dateRange?.to &&
                format(dateRange.from, "yyyy-MM-dd") === format(subDays(new Date(), 6), "yyyy-MM-dd") &&
                format(dateRange.to, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") &&
                "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            За 7 дней
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickFilter(30)}
            className={cn(
              "text-xs",
              dateRange?.from &&
                dateRange?.to &&
                format(dateRange.from, "yyyy-MM-dd") === format(subDays(new Date(), 29), "yyyy-MM-dd") &&
                format(dateRange.to, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd") &&
                "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            За 30 дней
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickFilter("current-month")}
            className={cn(
              "text-xs",
              dateRange?.from &&
                dateRange?.to &&
                format(dateRange.from, "yyyy-MM-dd") === format(startOfMonth(new Date()), "yyyy-MM-dd") &&
                format(dateRange.to, "yyyy-MM-dd") === format(endOfMonth(new Date()), "yyyy-MM-dd") &&
                "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            Этот месяц
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => handleQuickFilter("last-month")}
            className={cn(
              "text-xs",
              dateRange?.from &&
                dateRange?.to &&
                format(dateRange.from, "yyyy-MM-dd") === format(startOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd") &&
                format(dateRange.to, "yyyy-MM-dd") === format(endOfMonth(subMonths(new Date(), 1)), "yyyy-MM-dd") &&
                "bg-primary text-primary-foreground hover:bg-primary/90"
            )}
          >
            Прошлый месяц
          </Button>

          <Popover open={filterOpen} onOpenChange={setFilterOpen}>
            <PopoverTrigger asChild>
              <Button
                variant="outline"
                size="sm"
                className="gap-2 text-xs"
              >
                <CalendarIcon className="h-3.5 w-3.5" />
                Выбрать период
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
              <div className="p-3 border-t border-border flex gap-2">
                <Button
                  variant="outline"
                  className="flex-1"
                  onClick={() => {
                    setDateRange(undefined);
                    setFilterOpen(false);
                  }}
                >
                  Сбросить
                </Button>
                <Button
                  className="flex-1"
                  onClick={() => setFilterOpen(false)}
                  disabled={!dateRange?.from}
                >
                  Применить
                </Button>
              </div>
            </PopoverContent>
          </Popover>

          {dateRange?.from && (
            <Button
              variant="ghost"
              size="sm"
              onClick={handleClearFilter}
              className="h-8 gap-1 text-xs"
            >
              <X className="h-3.5 w-3.5" />
              Сбросить
            </Button>
          )}
        </div>

        {/* Active filter info */}
        {dateRange?.from && (
          <div className="flex items-center gap-2 text-sm">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <span className="text-muted-foreground">
              {dateRange.to ? (
                <>
                  {format(dateRange.from, "d MMM", { locale: ru })} - {format(dateRange.to, "d MMM", { locale: ru })}
                </>
              ) : (
                <>С {format(dateRange.from, "d MMM", { locale: ru })}</>
              )}
              {" · "}
              <span className="font-medium text-foreground">
                {pluralizeWithCount(filteredWorkouts.length, "тренировка", "тренировки", "тренировок")}
              </span>
            </span>
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-6 bg-muted rounded w-1/3 mb-2" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : filteredWorkouts.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 bg-muted rounded-full mb-4">
              <CalendarIcon className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">
              {dateRange?.from ? "Нет тренировок в выбранном периоде" : "Нет тренировок"}
            </h3>
            <p className="text-muted-foreground text-sm mb-4">
              {dateRange?.from
                ? "Попробуй изменить диапазон дат"
                : "Создай первую тренировку, чтобы начать отслеживать прогресс"}
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filteredWorkouts.map((workout, index) => (
            <Card
              key={workout.id}
              className={cn(
                "cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30",
                "animate-fade-in"
              )}
              style={{ animationDelay: `${index * 50}ms` }}
              onClick={() => navigate(`/workout/${workout.id}`)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-semibold text-foreground">
                      {format(new Date(workout.date), "d MMMM yyyy", { locale: ru })}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium">
                      {format(new Date(workout.date), "EEEE", { locale: ru })}
                    </span>
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3.5 w-3.5" />
                      {format(new Date(workout.updated_at), "HH:mm")}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {pluralizeWithCount(getUniqueExercises(workout), "упражнение", "упражнения", "упражнений")} · {pluralizeWithCount(getTotalSets(workout), "подход", "подхода", "подходов")}
                  </p>
                  {workout.notes && (
                    <div className="flex items-start gap-2 mt-2 text-sm text-muted-foreground">
                      <MessageSquare className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <p className="line-clamp-2">{workout.notes}</p>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={(e) => handleDeleteWorkout(workout.id, e)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
