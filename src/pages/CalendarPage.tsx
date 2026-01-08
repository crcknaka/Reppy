import { useState } from "react";
import { format, startOfMonth, endOfMonth, eachDayOfInterval, isSameDay, isSameMonth, addMonths, subMonths } from "date-fns";
import { ru } from "date-fns/locale";
import { ChevronLeft, ChevronRight, User, MessageSquare, Activity, Dumbbell, Timer, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { useWorkouts } from "@/hooks/useWorkouts";
import { useNavigate } from "react-router-dom";
import { cn } from "@/lib/utils";

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
  const [openTooltipId, setOpenTooltipId] = useState<string | null>(null);
  const [isPhotoFullscreen, setIsPhotoFullscreen] = useState(false);
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
                <TooltipProvider>
                {Object.values(
                  selectedWorkout.workout_sets.reduce((acc, set) => {
                    const exerciseId = set.exercise_id;
                    if (!acc[exerciseId]) {
                      acc[exerciseId] = {
                        name: set.exercise?.name || "Упражнение",
                        type: set.exercise?.type || "weighted",
                        sets: 0,
                        totalReps: 0,
                        maxWeight: 0,
                        totalDistance: 0,
                        totalDuration: 0,
                        totalPlankSeconds: 0,
                        allSets: [],
                      };
                    }
                    acc[exerciseId].sets++;
                    acc[exerciseId].totalReps += set.reps || 0;
                    if (set.weight && set.weight > acc[exerciseId].maxWeight) {
                      acc[exerciseId].maxWeight = set.weight;
                    }
                    acc[exerciseId].totalDistance += set.distance_km || 0;
                    acc[exerciseId].totalDuration += set.duration_minutes || 0;
                    acc[exerciseId].totalPlankSeconds += set.plank_seconds || 0;
                    acc[exerciseId].allSets.push(set);
                    return acc;
                  }, {} as Record<string, {
                    name: string;
                    type: string;
                    sets: number;
                    totalReps: number;
                    maxWeight: number;
                    totalDistance: number;
                    totalDuration: number;
                    totalPlankSeconds: number;
                    allSets: any[];
                  }>)
                ).map((exercise, i) => (
                  <Tooltip
                    key={i}
                    open={openTooltipId === `exercise-${i}`}
                    onOpenChange={(open) => setOpenTooltipId(open ? `exercise-${i}` : null)}
                  >
                    <TooltipTrigger asChild>
                      <div
                        className="p-2.5 bg-muted/50 rounded-lg cursor-pointer select-none"
                        onClick={() => setOpenTooltipId(openTooltipId === `exercise-${i}` ? null : `exercise-${i}`)}
                      >
                        <div className="flex items-center gap-2">
                          {exercise.type === "cardio" ? (
                            <Activity className="h-4 w-4 text-primary flex-shrink-0" />
                          ) : exercise.type === "weighted" ? (
                            <Dumbbell className="h-4 w-4 text-primary flex-shrink-0" />
                          ) : exercise.type === "timed" ? (
                            <Timer className="h-4 w-4 text-primary flex-shrink-0" />
                          ) : (
                            <User className="h-4 w-4 text-primary flex-shrink-0" />
                          )}
                          <span className="font-medium text-sm truncate">{exercise.name}</span>
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 ml-6">
                          {exercise.type === "cardio" ? (
                            <>{exercise.sets} подх · {exercise.totalDistance.toFixed(1)} км · {exercise.totalDuration} мин</>
                          ) : exercise.type === "timed" ? (
                            <>{exercise.sets} подх · {exercise.totalPlankSeconds} сек</>
                          ) : exercise.type === "bodyweight" ? (
                            <>{exercise.sets} подх · {exercise.totalReps} повт</>
                          ) : (
                            <>{exercise.sets} подх · {exercise.totalReps} повт{exercise.maxWeight > 0 && ` · ${exercise.maxWeight} кг`}</>
                          )}
                        </div>
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Время: {format(new Date(exercise.allSets.sort((a: any, b: any) => a.set_number - b.set_number)[0].created_at), "HH:mm", { locale: ru })}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
                </TooltipProvider>

                {/* Workout notes */}
                {selectedWorkout.notes && (
                  <div className="flex items-start gap-2 p-2.5 bg-muted/30 rounded-lg mt-2">
                    <MessageSquare className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                    <p className="text-xs text-muted-foreground line-clamp-2">{selectedWorkout.notes}</p>
                  </div>
                )}

                {/* Photo */}
                {selectedWorkout.photo_url && (
                  <div className="mt-3">
                    <img
                      src={selectedWorkout.photo_url}
                      alt=""
                      className="w-full h-32 rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                      onClick={() => setIsPhotoFullscreen(true)}
                    />
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

      {/* Fullscreen Photo Viewer */}
      {isPhotoFullscreen && selectedWorkout?.photo_url && (
        <div
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4"
          onClick={() => setIsPhotoFullscreen(false)}
        >
          <button
            className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            onClick={() => setIsPhotoFullscreen(false)}
          >
            <X className="h-6 w-6 text-white" />
          </button>
          <img
            src={selectedWorkout.photo_url}
            alt=""
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
}
