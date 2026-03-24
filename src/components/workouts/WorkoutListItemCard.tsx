import { format, isToday, parseISO } from "date-fns";
import type { Locale } from "date-fns";
import { Dumbbell, Layers, MessageSquare, Route, Trash2 } from "lucide-react";
import type React from "react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Workout } from "@/hooks/useWorkouts";
import { cn } from "@/lib/utils";

interface WorkoutListItemCardProps {
  workout: Workout;
  index: number;
  dateLocale: Locale;
  isViewingOther: boolean;
  convertDistance: (distanceKm: number) => number;
  distanceUnit: string;
  todayLabel: string;
  onOpen: (workoutId: string) => void;
  onDelete: (workoutId: string, event: React.MouseEvent) => void;
}

const isWeekend = (dateStr: string) => {
  const day = parseISO(dateStr).getDay();
  return day === 0 || day === 6;
};

const getTotalSets = (workout: Workout) => workout.workout_sets?.length || 0;

const getUniqueExercises = (workout: Workout) => {
  const exerciseIds = new Set(workout.workout_sets?.map((set) => set.exercise_id));
  return exerciseIds.size;
};

const getTotalDistance = (workout: Workout) => {
  const distance = workout.workout_sets?.reduce((sum, set) => sum + (set.distance_km || 0), 0) || 0;
  return distance > 0 ? Math.round(distance * 10) / 10 : 0;
};

export function WorkoutListItemCard({
  workout,
  index,
  dateLocale,
  isViewingOther,
  convertDistance,
  distanceUnit,
  todayLabel,
  onOpen,
  onDelete,
}: WorkoutListItemCardProps) {
  const totalDistance = getTotalDistance(workout);
  const isWorkoutToday = isToday(parseISO(workout.date));
  const isWorkoutWeekend = isWeekend(workout.date);

  return (
    <Card
      className={cn(
        "cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30",
        "animate-fade-in",
        isWorkoutToday && "border-green-500/50 dark:border-green-400/50"
      )}
      style={{ animationDelay: `${index * 50}ms` }}
      onClick={() => onOpen(workout.id)}
    >
      <CardContent className="p-3 flex items-center gap-3">
        <div
          className={cn(
            "flex-shrink-0 w-14 h-14 rounded-lg flex flex-col items-center justify-center",
            isWorkoutToday
              ? "bg-green-500/15 text-green-600 dark:text-green-400"
              : isWorkoutWeekend
                ? "bg-primary/10 text-primary"
                : "bg-muted text-foreground"
          )}
        >
          <span className="text-xl font-bold leading-none">{format(new Date(workout.date), "d")}</span>
          <span className="text-[10px] font-medium uppercase mt-0.5">
            {format(new Date(workout.date), "MMM", { locale: dateLocale })}
          </span>
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <span
              className={cn(
                "text-sm font-medium capitalize",
                isWorkoutToday
                  ? "text-green-600 dark:text-green-400"
                  : isWorkoutWeekend
                    ? "text-primary"
                    : "text-foreground"
              )}
            >
              {isWorkoutToday ? todayLabel : format(new Date(workout.date), "EEEE", { locale: dateLocale })}
            </span>
          </div>
          <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <Dumbbell className="h-3.5 w-3.5" />
              {getUniqueExercises(workout)}
            </span>
            <span className="flex items-center gap-1">
              <Layers className="h-3.5 w-3.5" />
              {getTotalSets(workout)}
            </span>
            {totalDistance > 0 && (
              <span className="flex items-center gap-1">
                <Route className="h-3.5 w-3.5" />
                {convertDistance(totalDistance)} {distanceUnit}
              </span>
            )}
          </div>
          {workout.notes && (
            <div className="flex items-center gap-1 mt-1 text-xs text-muted-foreground">
              <MessageSquare className="h-3 w-3 flex-shrink-0" />
              <p className="line-clamp-1">{workout.notes}</p>
            </div>
          )}
        </div>

        {workout.photo_url && (
          <div className="flex-shrink-0">
            <img src={workout.photo_url} alt="" className="w-12 h-12 rounded-lg object-cover" />
          </div>
        )}

        {!isViewingOther && !workout.is_locked && (
          <Button
            variant="ghost"
            size="icon"
            className="h-8 w-8 text-muted-foreground hover:text-foreground flex-shrink-0"
            onClick={(event) => onDelete(workout.id, event)}
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </CardContent>
    </Card>
  );
}

