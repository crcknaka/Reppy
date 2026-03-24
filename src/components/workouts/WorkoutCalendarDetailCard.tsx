import { format } from "date-fns";
import type { Locale } from "date-fns";
import { Activity, Dumbbell, MessageSquare, Timer, User } from "lucide-react";

import { getExerciseName } from "@/lib/i18n";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import type { Workout } from "@/hooks/useWorkouts";

interface WorkoutCalendarDetailCardProps {
  workout: Workout;
  workoutIndex: number;
  selectedWorkoutsCount: number;
  dateLocale: Locale;
  convertDistance: (distanceKm: number) => number;
  distanceUnit: string;
  onOpen: (workoutId: string) => void;
  labels: {
    open: string;
    sets: string;
    min: string;
    sec: string;
    reps: string;
    kg: string;
    noEntries: string;
    exerciseFallback: string;
  };
}

interface ExerciseSummary {
  name: string;
  type: "cardio" | "weighted" | "timed" | "bodyweight";
  name_translations?: unknown;
  sets: number;
  totalReps: number;
  maxWeight: number;
  totalDistance: number;
  totalDuration: number;
  totalPlankSeconds: number;
}

const getExerciseSummaries = (workout: Workout, exerciseFallback: string): ExerciseSummary[] => {
  if (!workout.workout_sets || workout.workout_sets.length === 0) return [];

  return Object.values(
    workout.workout_sets.reduce((acc, set) => {
      const exerciseId = set.exercise_id;
      if (!acc[exerciseId]) {
        acc[exerciseId] = {
          name: set.exercise?.name || exerciseFallback,
          type: set.exercise?.type || "weighted",
          name_translations: set.exercise?.name_translations,
          sets: 0,
          totalReps: 0,
          maxWeight: 0,
          totalDistance: 0,
          totalDuration: 0,
          totalPlankSeconds: 0,
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

      return acc;
    }, {} as Record<string, ExerciseSummary>)
  );
};

export function WorkoutCalendarDetailCard({
  workout,
  workoutIndex,
  selectedWorkoutsCount,
  dateLocale,
  convertDistance,
  distanceUnit,
  onOpen,
  labels,
}: WorkoutCalendarDetailCardProps) {
  const exerciseSummaries = getExerciseSummaries(workout, labels.exerciseFallback);

  return (
    <Card className="animate-scale-in">
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-3">
          <span className="font-semibold">
            {format(new Date(workout.date), "d MMMM", { locale: dateLocale })}
            {selectedWorkoutsCount > 1 && (
              <span className="text-muted-foreground ml-1">#{workoutIndex + 1}</span>
            )}
          </span>
          <Button size="sm" onClick={() => onOpen(workout.id)}>
            {labels.open}
          </Button>
        </div>

        {exerciseSummaries.length > 0 ? (
          <div className="space-y-2">
            {exerciseSummaries.map((exercise, index) => (
              <div key={index} className="p-2.5 bg-muted/50 rounded-lg">
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
                  <span className="font-medium text-sm truncate">
                    {getExerciseName(exercise.name, exercise.name_translations)}
                  </span>
                </div>
                <div className="text-xs text-muted-foreground mt-1 ml-6">
                  {exercise.type === "cardio" ? (
                    <>
                      {exercise.sets} {labels.sets} · {convertDistance(exercise.totalDistance).toFixed(1)} {distanceUnit} · {exercise.totalDuration} {labels.min}
                    </>
                  ) : exercise.type === "timed" ? (
                    <>
                      {exercise.sets} {labels.sets} · {exercise.totalPlankSeconds} {labels.sec}
                    </>
                  ) : exercise.type === "bodyweight" ? (
                    <>
                      {exercise.sets} {labels.sets} · {exercise.totalReps} {labels.reps}
                    </>
                  ) : (
                    <>
                      {exercise.sets} {labels.sets} · {exercise.totalReps} {labels.reps}
                      {exercise.maxWeight > 0 && ` · ${exercise.maxWeight} ${labels.kg}`}
                    </>
                  )}
                </div>
              </div>
            ))}

            {workout.notes && (
              <div className="flex items-start gap-2 p-2.5 bg-muted/30 rounded-lg mt-2">
                <MessageSquare className="h-3.5 w-3.5 text-primary flex-shrink-0 mt-0.5" />
                <p className="text-xs text-muted-foreground line-clamp-2">{workout.notes}</p>
              </div>
            )}

            {workout.photo_url && (
              <div className="mt-3">
                <img
                  src={workout.photo_url}
                  alt=""
                  className="w-full h-32 lg:h-48 rounded-lg object-cover cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => onOpen(workout.id)}
                />
              </div>
            )}
          </div>
        ) : (
          <p className="text-muted-foreground text-sm text-center py-4">{labels.noEntries}</p>
        )}
      </CardContent>
    </Card>
  );
}

