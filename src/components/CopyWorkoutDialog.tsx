import { useMemo, useState } from "react";
import { format, type Locale } from "date-fns";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { ArrowLeft, Copy } from "lucide-react";

import { getExerciseName } from "@/lib/i18n";
import { LIMITS } from "@/lib/limits";
import { WorkoutExerciseCard } from "@/components/WorkoutExerciseCard";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import type { Workout, WorkoutSet } from "@/hooks/useWorkouts";

type SetPayload = {
  exerciseId: string;
  setNumber: number;
  reps?: number;
  weight?: number;
  distance_km?: number;
  duration_minutes?: number;
  plank_seconds?: number;
  is_completed?: boolean;
};

interface CopyWorkoutDialogProps {
  enabled: boolean;
  currentWorkout: Workout | null | undefined;
  allWorkouts: Workout[] | undefined;
  dateLocale: Locale;
  onCreateSet: (payload: SetPayload) => Promise<{ id: string }>;
  onDeleteSet: (setId: string) => Promise<void>;
}

export function CopyWorkoutDialog({
  enabled,
  currentWorkout,
  allWorkouts,
  dateLocale,
  onCreateSet,
  onDeleteSet,
}: CopyWorkoutDialogProps) {
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);
  const [selectedSourceWorkoutId, setSelectedSourceWorkoutId] = useState<string | null>(null);
  const [selectedExerciseIds, setSelectedExerciseIds] = useState<Set<string>>(new Set());
  const [isCopyingWorkout, setIsCopyingWorkout] = useState(false);

  const currentSetsByExercise = useMemo(() => {
    if (!currentWorkout?.workout_sets) {
      return {} as Record<string, { exercise: WorkoutSet["exercise"]; sets: WorkoutSet[] }>;
    }

    return currentWorkout.workout_sets.reduce((acc, set) => {
      const exerciseId = set.exercise_id;
      if (!acc[exerciseId]) {
        acc[exerciseId] = {
          exercise: set.exercise,
          sets: [],
        };
      }
      acc[exerciseId].sets.push(set);
      return acc;
    }, {} as Record<string, { exercise: WorkoutSet["exercise"]; sets: WorkoutSet[] }>);
  }, [currentWorkout?.workout_sets]);

  const copyableWorkouts = useMemo(() => {
    if (!allWorkouts || !currentWorkout?.id) return [];

    return allWorkouts
      .filter((entry) => entry.id !== currentWorkout.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [allWorkouts, currentWorkout?.id]);

  const selectedSourceWorkout = useMemo(() => {
    if (!selectedSourceWorkoutId) return null;
    return copyableWorkouts.find((entry) => entry.id === selectedSourceWorkoutId) ?? null;
  }, [copyableWorkouts, selectedSourceWorkoutId]);

  const sourceSetsByExercise = useMemo(() => {
    if (!selectedSourceWorkout?.workout_sets) {
      return {} as Record<string, { exercise: WorkoutSet["exercise"]; sets: WorkoutSet[] }>;
    }

    return selectedSourceWorkout.workout_sets.reduce((acc, set) => {
      const exerciseId = set.exercise_id;
      if (!acc[exerciseId]) {
        acc[exerciseId] = {
          exercise: set.exercise,
          sets: [],
        };
      }
      acc[exerciseId].sets.push(set);
      return acc;
    }, {} as Record<string, { exercise: WorkoutSet["exercise"]; sets: WorkoutSet[] }>);
  }, [selectedSourceWorkout?.workout_sets]);

  const sourceOrderedExerciseEntries = useMemo(() => {
    const toTimestamp = (value: string | null | undefined) => {
      if (!value) return Number.POSITIVE_INFINITY;
      const timestamp = new Date(value).getTime();
      return Number.isNaN(timestamp) ? Number.POSITIVE_INFINITY : timestamp;
    };

    return Object.entries(sourceSetsByExercise).sort(([, a], [, b]) => {
      const aFirst = Math.min(...a.sets.map((set) => toTimestamp(set.created_at)));
      const bFirst = Math.min(...b.sets.map((set) => toTimestamp(set.created_at)));

      if (aFirst !== bFirst) return aFirst - bFirst;

      const aSetNumber = Math.min(...a.sets.map((set) => set.set_number));
      const bSetNumber = Math.min(...b.sets.map((set) => set.set_number));
      return aSetNumber - bSetNumber;
    });
  }, [sourceSetsByExercise]);

  const resetState = () => {
    setSelectedSourceWorkoutId(null);
    setSelectedExerciseIds(new Set());
    setIsCopyingWorkout(false);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    setOpen(nextOpen);
    if (!nextOpen) {
      resetState();
    }
  };

  const handleSelectSourceWorkout = (sourceWorkoutId: string) => {
    setSelectedSourceWorkoutId(sourceWorkoutId);

    const sourceWorkout = copyableWorkouts.find((entry) => entry.id === sourceWorkoutId);
    const allExerciseIds = new Set((sourceWorkout?.workout_sets ?? []).map((set) => set.exercise_id));
    setSelectedExerciseIds(allExerciseIds);
  };

  const handleToggleExerciseSelection = (exerciseId: string, isChecked: boolean) => {
    setSelectedExerciseIds((previous) => {
      const next = new Set(previous);
      if (isChecked) {
        next.add(exerciseId);
      } else {
        next.delete(exerciseId);
      }
      return next;
    });
  };

  const handleSelectAllExercisesToCopy = () => {
    setSelectedExerciseIds(new Set(sourceOrderedExerciseEntries.map(([exerciseId]) => exerciseId)));
  };

  const handleDeselectAllExercisesToCopy = () => {
    setSelectedExerciseIds(new Set());
  };

  const handleCopyWorkoutToCurrent = async () => {
    if (!currentWorkout || !selectedSourceWorkout) return;

    const selectedEntries = sourceOrderedExerciseEntries.filter(([exerciseId]) => selectedExerciseIds.has(exerciseId));

    if (selectedEntries.length === 0) {
      toast.error(t("workout.selectExercisesToCopy"));
      return;
    }

    const existingExerciseIds = new Set(Object.keys(currentSetsByExercise));
    const currentTotalSets = currentWorkout.workout_sets?.length ?? 0;
    const setsCountByExercise = new Map(
      Object.entries(currentSetsByExercise).map(([exerciseId, data]) => [exerciseId, data.sets.length])
    );

    let additionalExercisesCount = 0;
    let additionalSetsCount = 0;

    for (const [exerciseId, { sets }] of selectedEntries) {
      if (!existingExerciseIds.has(exerciseId)) {
        additionalExercisesCount += 1;
      }

      additionalSetsCount += sets.length;

      const existingForExercise = setsCountByExercise.get(exerciseId) ?? 0;
      if (existingForExercise + sets.length > LIMITS.MAX_SETS_PER_EXERCISE) {
        toast.error(t("limits.maxSetsPerExercise", { max: LIMITS.MAX_SETS_PER_EXERCISE }));
        return;
      }
    }

    if (existingExerciseIds.size + additionalExercisesCount > LIMITS.MAX_EXERCISES_PER_WORKOUT) {
      toast.error(t("limits.maxExercisesPerWorkout", { max: LIMITS.MAX_EXERCISES_PER_WORKOUT }));
      return;
    }

    if (currentTotalSets + additionalSetsCount > LIMITS.MAX_TOTAL_SETS_PER_WORKOUT) {
      toast.error(t("limits.maxTotalSetsPerWorkout", { max: LIMITS.MAX_TOTAL_SETS_PER_WORKOUT }));
      return;
    }

    const nextSetNumberByExercise = new Map<string, number>();
    Object.entries(currentSetsByExercise).forEach(([exerciseId, data]) => {
      const maxSetNumber = data.sets.length > 0 ? Math.max(...data.sets.map((set) => set.set_number)) : 0;
      nextSetNumberByExercise.set(exerciseId, maxSetNumber);
    });

    setIsCopyingWorkout(true);
    const createdSetIds: string[] = [];
    try {
      for (const [exerciseId, { sets }] of selectedEntries) {
        const sortedSets = sets.slice().sort((a, b) => a.set_number - b.set_number);

        for (const set of sortedSets) {
          const nextSetNumber = (nextSetNumberByExercise.get(exerciseId) ?? 0) + 1;
          nextSetNumberByExercise.set(exerciseId, nextSetNumber);

          const createdSet = await onCreateSet({
            exerciseId,
            setNumber: nextSetNumber,
            reps: set.reps ?? undefined,
            weight: set.weight ?? undefined,
            distance_km: set.distance_km ?? undefined,
            duration_minutes: set.duration_minutes ?? undefined,
            plank_seconds: set.plank_seconds ?? undefined,
            is_completed: false,
          });

          createdSetIds.push(createdSet.id);
        }
      }

      toast.success(t("workout.workoutCopied"));
      setOpen(false);
      resetState();
    } catch {
      if (createdSetIds.length > 0) {
        await Promise.allSettled(createdSetIds.map((setId) => onDeleteSet(setId)));
      }
      toast.error(t("workout.workoutCopyError"));
    } finally {
      setIsCopyingWorkout(false);
    }
  };

  if (!enabled || !currentWorkout) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant="outline" size="icon">
          <Copy className="h-5 w-5" />
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>{t("workout.copyWorkout")}</DialogTitle>
          <DialogDescription>
            {selectedSourceWorkout ? t("workout.selectExercisesToCopy") : t("workout.selectWorkoutToCopy")}
          </DialogDescription>
        </DialogHeader>

        {!selectedSourceWorkout ? (
          <div className="space-y-2 max-h-[60vh] overflow-y-auto">
            {copyableWorkouts.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">{t("workout.noWorkoutsToCopy")}</p>
            ) : (
              copyableWorkouts.map((entry) => {
                const totalSets = entry.workout_sets?.length ?? 0;
                const uniqueExercises = new Set((entry.workout_sets ?? []).map((set) => set.exercise_id)).size;

                return (
                  <button
                    key={entry.id}
                    type="button"
                    className="w-full rounded-lg border p-3 text-left hover:bg-muted/50 transition-colors"
                    onClick={() => handleSelectSourceWorkout(entry.id)}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div>
                        <p className="font-medium text-sm">
                          {format(new Date(entry.date), "d MMMM yyyy", { locale: dateLocale })}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {uniqueExercises} {t("workouts.exercises")} · {totalSets} {t("workouts.sets")}
                        </p>
                      </div>
                    </div>
                  </button>
                );
              })
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <div className="flex items-center justify-between gap-2">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="px-2"
                onClick={() => {
                  setSelectedSourceWorkoutId(null);
                  setSelectedExerciseIds(new Set());
                }}
              >
                <ArrowLeft className="h-4 w-4 mr-1" />
                {t("common.back")}
              </Button>

              <div className="flex items-center gap-2">
                <Button type="button" variant="outline" size="sm" onClick={handleSelectAllExercisesToCopy}>
                  {t("workout.selectAll")}
                </Button>
                <Button type="button" variant="outline" size="sm" onClick={handleDeselectAllExercisesToCopy}>
                  {t("workout.deselectAll")}
                </Button>
              </div>
            </div>

            {sourceOrderedExerciseEntries.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-6">{t("workout.noExercises")}</p>
            ) : (
              <div className="space-y-3 max-h-[56vh] overflow-y-auto pr-1">
                {sourceOrderedExerciseEntries.map(([exerciseId, { exercise, sets }], index) => {
                  const checked = selectedExerciseIds.has(exerciseId);

                  return (
                    <WorkoutExerciseCard
                      key={exerciseId}
                      exerciseId={exerciseId}
                      exercise={exercise}
                      sets={sets}
                      index={index}
                      readOnly
                      selectionChecked={checked}
                      onSelectionChange={(nextChecked) => handleToggleExerciseSelection(exerciseId, nextChecked)}
                      isOwner={false}
                      isLocked
                      isRecordSet={() => false}
                      dateLocale={dateLocale}
                      onOpenExerciseHistory={() => undefined}
                      onAddAnotherSet={async () => undefined}
                      onCreateSet={async () => undefined}
                      onEditSet={() => undefined}
                      onDeleteSet={async () => undefined}
                      onToggleSetCompleted={async () => undefined}
                    />
                  );
                })}
              </div>
            )}

            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={() => setOpen(false)}>
                {t("common.cancel")}
              </Button>
              <Button
                type="button"
                onClick={handleCopyWorkoutToCurrent}
                disabled={isCopyingWorkout || selectedExerciseIds.size === 0}
              >
                {isCopyingWorkout ? t("common.loading") : t("workout.copySelected")}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
