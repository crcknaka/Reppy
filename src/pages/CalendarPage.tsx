import { useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths } from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronLeft, ChevronRight, User, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useWorkouts } from "@/hooks/useWorkouts";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";
import { pluralizeWithCount } from "@/lib/pluralize";

export default function CalendarPage() {
  const navigate = useNavigate();
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const { data: workouts } = useWorkouts();

  const monthStart = startOfMonth(currentMonth);
  const monthEnd = endOfMonth(currentMonth);
  const days = eachDayOfInterval({ start: monthStart, end: monthEnd });

  // Get the starting day of the week (0 = Sunday, 1 = Monday, etc.)
  // Adjust for Monday start
  const startDayOfWeek = monthStart.getDay();
  const adjustedStartDay = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

  const getWorkoutForDate = (date: Date) => {
    return workouts?.find((w) => isSameDay(new Date(w.date), date));
  };

  const getIntensity = (workout: typeof workouts extends (infer T)[] | undefined ? T : never) => {
    const sets = workout?.workout_sets?.length || 0;
    if (sets === 0) return 0;
    if (sets <= 5) return 1;
    if (sets <= 10) return 2;
    if (sets <= 15) return 3;
    return 4;
  };

  const weekDays = ["Пн", "Вт", "Ср", "Чт", "Пт", "Сб", "Вс"];

  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const selectedWorkout = selectedDate ? getWorkoutForDate(selectedDate) : null;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="space-y-1">
        <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">Календарь</h1>
        <p className="text-muted-foreground text-base">Обзор твоих тренировок</p>
      </div>

      <Card>
        <CardHeader className="pb-2">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentMonth(subMonths(currentMonth, 1))}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>
            <CardTitle className="text-lg capitalize">
              {format(currentMonth, "LLLL yyyy", { locale: ru })}
            </CardTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setCurrentMonth(addMonths(currentMonth, 1))}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {/* Week days header */}
          <div className="grid grid-cols-7 gap-1 mb-2">
            {weekDays.map((day) => (
              <div
                key={day}
                className="text-center text-xs font-medium text-muted-foreground py-2"
              >
                {day}
              </div>
            ))}
          </div>

          {/* Calendar grid */}
          <div className="grid grid-cols-7 gap-1">
            {/* Empty cells for days before month start */}
            {Array.from({ length: adjustedStartDay }).map((_, i) => (
              <div key={`empty-${i}`} className="aspect-square" />
            ))}

            {/* Days of the month */}
            {days.map((day) => {
              const workout = getWorkoutForDate(day);
              const intensity = getIntensity(workout);
              const isToday = isSameDay(day, new Date());
              const isSelected = selectedDate && isSameDay(day, selectedDate);

              return (
                <button
                  key={day.toISOString()}
                  onClick={() => {
                    if (workout) {
                      setSelectedDate(day);
                    }
                  }}
                  className={cn(
                    "aspect-square rounded-lg flex flex-col items-center justify-center gap-0.5 transition-all duration-200",
                    isToday && "ring-2 ring-primary ring-offset-2 ring-offset-background",
                    isSelected && "bg-primary/20",
                    workout && "cursor-pointer hover:bg-muted",
                    !workout && "cursor-default"
                  )}
                >
                  <span
                    className={cn(
                      "text-sm",
                      isToday ? "font-bold text-primary" : "text-foreground"
                    )}
                  >
                    {format(day, "d")}
                  </span>
                  {workout && (
                    <div
                      className={cn(
                        "w-2 h-2 rounded-full",
                        intensity === 1 && "bg-primary/30",
                        intensity === 2 && "bg-primary/50",
                        intensity === 3 && "bg-primary/75",
                        intensity >= 4 && "bg-primary"
                      )}
                    />
                  )}
                </button>
              );
            })}
          </div>

          {/* Intensity legend */}
          <div className="flex items-center justify-center gap-2 mt-4 text-xs text-muted-foreground">
            <span>Меньше</span>
            <div className="flex gap-1">
              <div className="w-3 h-3 rounded bg-primary/30" />
              <div className="w-3 h-3 rounded bg-primary/50" />
              <div className="w-3 h-3 rounded bg-primary/75" />
              <div className="w-3 h-3 rounded bg-primary" />
            </div>
            <span>Больше</span>
          </div>
        </CardContent>
      </Card>

      {/* Selected workout details */}
      {selectedWorkout && (
        <Card className="animate-scale-in">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <span>{format(new Date(selectedWorkout.date), "d MMMM", { locale: ru })}</span>
              <Button size="sm" onClick={() => navigate(`/workout/${selectedWorkout.id}`)}>
                Открыть
              </Button>
            </CardTitle>
          </CardHeader>
          <CardContent>
            {selectedWorkout.workout_sets && selectedWorkout.workout_sets.length > 0 ? (
              <div className="space-y-2">
                {/* Group by exercise */}
                {Object.values(
                  selectedWorkout.workout_sets.reduce((acc, set) => {
                    const exerciseId = set.exercise_id;
                    if (!acc[exerciseId]) {
                      acc[exerciseId] = {
                        name: set.exercise?.name || "Упражнение",
                        sets: 0,
                        totalReps: 0,
                        maxWeight: 0,
                      };
                    }
                    acc[exerciseId].sets++;
                    acc[exerciseId].totalReps += set.reps;
                    if (set.weight && set.weight > acc[exerciseId].maxWeight) {
                      acc[exerciseId].maxWeight = set.weight;
                    }
                    return acc;
                  }, {} as Record<string, { name: string; sets: number; totalReps: number; maxWeight: number }>)
                ).map((exercise, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                    <div className="flex items-center gap-3">
                      <User className="h-4 w-4 text-primary" />
                      <span className="font-medium">{exercise.name}</span>
                    </div>
                    <div className="text-sm text-muted-foreground">
                      {pluralizeWithCount(exercise.sets, "подход", "подхода", "подходов")} · {pluralizeWithCount(exercise.totalReps, "повторение", "повторения", "повторений")}
                      {exercise.maxWeight > 0 && ` · ${exercise.maxWeight} кг`}
                    </div>
                  </div>
                ))}

                {/* Workout notes */}
                {selectedWorkout.notes && (
                  <div className="flex items-start gap-2 p-3 bg-muted/30 rounded-lg mt-3">
                    <MessageSquare className="h-4 w-4 text-primary flex-shrink-0 mt-0.5" />
                    <p className="text-sm text-muted-foreground line-clamp-2">{selectedWorkout.notes}</p>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-muted-foreground text-sm text-center py-4">
                Нет записей
              </p>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
}
