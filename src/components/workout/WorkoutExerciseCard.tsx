import { useState } from "react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { motion, AnimatePresence, useMotionEnabled } from "@/components/ui/motion";
import { Activity, Check, CopyPlus, Dumbbell, History, Loader2, Plus, Timer, Trash2, Trophy, User } from "lucide-react";

import { getExerciseName } from "@/lib/i18n";
import { getMuscleGroupLabel, getMuscleGroupColor } from "@/lib/muscleGroupUtils";
import { LIMITS } from "@/lib/limits";
import { cn } from "@/lib/utils";
import { useUnits } from "@/hooks/useUnits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

type ExerciseCardType = "weighted" | "bodyweight" | "cardio" | "timed";

type ExerciseCardExercise = {
  id?: string;
  name: string;
  name_translations?: Record<string, string> | null;
  type: ExerciseCardType;
  image_url?: string | null;
};

type WorkoutSet = {
  id: string;
  exercise_id: string;
  set_number: number;
  is_completed: boolean;
  reps: number | null;
  weight: number | null;
  distance_km: number | null;
  duration_minutes: number | null;
  plank_seconds: number | null;
  created_at: string;
  exercise?: ExerciseCardExercise | null;
};

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

interface WorkoutExerciseCardProps {
  exerciseId: string;
  exercise: ExerciseCardExercise | null;
  sets: WorkoutSet[];
  index: number;
  readOnly?: boolean;
  selectionChecked?: boolean;
  onSelectionChange?: (checked: boolean) => void;
  isOwner: boolean;
  isLocked: boolean;
  isRecordSet: (setId: string) => boolean;
  onOpenExerciseHistory: (exerciseId: string, exerciseName: string, exerciseType: string) => void;
  onAddAnotherSet: (exerciseId: string) => Promise<void>;
  onCreateSet: (payload: SetPayload) => Promise<void>;
  onEditSet: (set: WorkoutSet) => void;
  onDeleteSet: (setId: string) => Promise<void>;
  onToggleSetCompleted: (setId: string, isCompleted: boolean) => Promise<void>;
}

export function WorkoutExerciseCard({
  exerciseId,
  exercise,
  sets,
  index,
  readOnly = false,
  selectionChecked = false,
  onSelectionChange,
  isOwner,
  isLocked,
  isRecordSet,
  onOpenExerciseHistory,
  onAddAnotherSet,
  onCreateSet,
  onEditSet,
  onDeleteSet,
  onToggleSetCompleted,
}: WorkoutExerciseCardProps) {
  const { t } = useTranslation();
  const { units, convertWeight, convertDistance } = useUnits();
  const motionEnabled = useMotionEnabled();
  const [setToDelete, setSetToDelete] = useState<string | null>(null);
  const [pendingAction, setPendingAction] = useState<string | null>(null); // "copy:setId" | "complete:setId" | "delete"

  const canManageSets = !readOnly && isOwner && !isLocked;
  const allCompleted = sets.length > 0 && sets.every(s => s.is_completed);
  const showSelectionCheckbox = readOnly && typeof onSelectionChange === "function";

  const handleCopySet = async (set: WorkoutSet) => {
    if (pendingAction) return;
    setPendingAction(`copy:${set.id}`);
    try {
      const exerciseSets = sets.filter((workoutSet) => workoutSet.exercise_id === set.exercise_id);

      if (exerciseSets.length >= LIMITS.MAX_SETS_PER_EXERCISE) {
        toast.error(t("limits.maxSetsPerExercise", { max: LIMITS.MAX_SETS_PER_EXERCISE }));
        return;
      }

      const nextSetNumber =
        exerciseSets.length > 0 ? Math.max(...exerciseSets.map((workoutSet) => workoutSet.set_number)) + 1 : 1;

      await onCreateSet({
        exerciseId: set.exercise_id,
        setNumber: nextSetNumber,
        reps: set.reps ?? undefined,
        weight: set.weight ?? undefined,
        distance_km: set.distance_km ?? undefined,
        duration_minutes: set.duration_minutes ?? undefined,
        plank_seconds: set.plank_seconds ?? undefined,
        is_completed: false,
      });

      toast.success(t("workout.setCopied"));
    } catch {
      toast.error(t("workout.setCopyError"));
    } finally {
      setPendingAction(null);
    }
  };

  const confirmDeleteSet = async () => {
    if (!setToDelete || pendingAction) return;
    const idToDelete = setToDelete;
    setSetToDelete(null);
    setPendingAction("delete");

    try {
      await onDeleteSet(idToDelete);
      toast.success(t("workout.setDeleted"));
    } catch {
      toast.error(t("workout.setDeleteError"));
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <>
      <Card className="relative">
        {showSelectionCheckbox && (
          <div className="absolute left-2 top-2 z-10">
            <Checkbox
              checked={selectionChecked}
              className="h-5 w-5"
              onCheckedChange={(value) => onSelectionChange(value === true)}
            />
          </div>
        )}
        <CardHeader className="pb-1 pt-3 px-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-1.5 flex-1 min-w-0">
              <CardTitle className="flex items-center gap-1.5 text-sm truncate">
                {exercise?.type === "weighted" ? (
                  <Dumbbell className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                ) : exercise?.type === "cardio" ? (
                  <Activity className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                ) : exercise?.type === "timed" ? (
                  <Timer className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                ) : (
                  <User className="h-3.5 w-3.5 text-primary flex-shrink-0" />
                )}
                <span className="truncate">{exercise?.name ? getExerciseName(exercise.name, exercise.name_translations) : ""}</span>
              </CardTitle>
              {exercise?.muscle_group && (
                <span className={cn("text-[9px] px-1.5 py-0.5 rounded-full flex-shrink-0", getMuscleGroupColor(exercise.muscle_group))}>
                  {getMuscleGroupLabel(exercise.muscle_group, t)}
                </span>
              )}
              {!readOnly && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-6 w-6 flex-shrink-0 hover:bg-transparent focus:bg-transparent active:bg-transparent [-webkit-tap-highlight-color:transparent]"
                  onClick={() =>
                    exercise &&
                    onOpenExerciseHistory(
                      exerciseId,
                      getExerciseName(exercise.name, exercise.name_translations),
                      exercise.type
                    )
                  }
                >
                  <History className="h-3.5 w-3.5 text-muted-foreground" />
                </Button>
              )}
            </div>
            {exercise?.image_url ? (
              <div className="w-[4.5rem] h-[4.5rem] rounded-lg overflow-hidden bg-muted flex-shrink-0">
                <img
                  src={exercise.image_url}
                  alt={getExerciseName(exercise.name, exercise.name_translations)}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-[4.5rem] h-[4.5rem] rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                {exercise?.type === "weighted" ? (
                  <Dumbbell className="h-8 w-8 text-muted-foreground" />
                ) : exercise?.type === "cardio" ? (
                  <Activity className="h-8 w-8 text-muted-foreground" />
                ) : exercise?.type === "timed" ? (
                  <Timer className="h-8 w-8 text-muted-foreground" />
                ) : (
                  <User className="h-8 w-8 text-muted-foreground" />
                )}
              </div>
            )}
          </div>
        </CardHeader>

        <CardContent className="space-y-1 px-4 pb-3">
          <div>
          <div
            className={cn(
              "grid gap-1 pl-2 pr-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide",
              exercise?.type === "bodyweight" || exercise?.type === "timed"
                ? readOnly
                  ? "grid-cols-[32px_1fr]"
                  : "grid-cols-[32px_1fr_64px]"
                : readOnly
                  ? "grid-cols-[32px_1fr_1fr]"
                  : "grid-cols-[32px_1fr_1fr_64px]"
            )}
          >
            <div className="text-center">#</div>
            <div className="text-center">
              {exercise?.type === "cardio" ? t("progress.distance") : exercise?.type === "timed" ? t("progress.time") : t("workout.reps")}
            </div>
            {exercise?.type !== "bodyweight" && exercise?.type !== "timed" && (
              <div className="text-center">{exercise?.type === "cardio" ? t("progress.time") : t("workout.weight")}</div>
            )}
            {!readOnly && <div></div>}
          </div>

          <AnimatePresence>
            {sets
              .slice()
              .sort((a, b) => a.set_number - b.set_number)
              .map((set, displayIndex) => (
                    <motion.div
                      key={set.id}
                      className="relative"
                      {...(motionEnabled ? {
                        initial: { opacity: 0, y: 6 },
                        animate: { opacity: 1, y: 0 },
                        exit: { opacity: 0, x: -20, scale: 0.95 },
                        transition: { duration: 0.2, delay: displayIndex * 0.03 },
                      } : {})
                      }
                    >
                      {isRecordSet(set.id) && (
                        <Trophy className="absolute -left-0.5 -top-0.5 h-4 w-4 text-yellow-500 z-10 drop-shadow-sm" />
                      )}
                    <div
                      className={cn(
                        "relative grid gap-1 items-center py-1.5 pl-2 pr-2 rounded-md cursor-pointer select-none",
                        exercise?.type === "bodyweight" || exercise?.type === "timed"
                          ? readOnly
                            ? "grid-cols-[32px_1fr]"
                            : "grid-cols-[32px_1fr_64px]"
                          : readOnly
                            ? "grid-cols-[32px_1fr_1fr]"
                            : "grid-cols-[32px_1fr_1fr_64px]",
                        isRecordSet(set.id) ? "bg-yellow-100 dark:bg-yellow-900/30" : "bg-muted/30",
                      )}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest("button")) {
                          return;
                        }
                        if (!readOnly && canManageSets) {
                          onEditSet(set);
                          return;
                        }
                      }}
                    >
                      <div className="flex justify-center">
                        {readOnly ? (
                          <span className="text-sm font-semibold text-muted-foreground tabular-nums">{displayIndex + 1}</span>
                        ) : (
                          <button
                            type="button"
                            className={cn(
                              "inline-flex h-7 w-7 items-center justify-center rounded-[0.65rem] text-xs font-semibold tabular-nums transition-all duration-200",
                              set.is_completed
                                ? "border border-primary bg-primary text-primary-foreground"
                                : "border border-dashed border-muted-foreground/40 bg-background text-muted-foreground",
                              canManageSets && !set.is_completed && "hover:border-primary/60 hover:text-primary active:scale-95",
                              !canManageSets && "cursor-default"
                            )}
                            aria-label={
                              set.is_completed ? t("workout.markSetIncomplete") : t("workout.markSetComplete")
                            }
                            disabled={!canManageSets || pendingAction === `complete:${set.id}`}
                            onClick={async (event) => {
                              event.stopPropagation();
                              if (!canManageSets || pendingAction) return;
                              setPendingAction(`complete:${set.id}`);
                              try {
                                const nextIsCompleted = !set.is_completed;
                                await onToggleSetCompleted(set.id, nextIsCompleted);
                                toast.success(
                                  nextIsCompleted
                                    ? t("workout.setMarkedComplete")
                                    : t("workout.setMarkedIncomplete")
                                );
                              } catch {
                                toast.error(t("workout.setUpdateError"));
                              } finally {
                                setPendingAction(null);
                              }
                            }}
                          >
                            {set.is_completed
                              ? <Check className="h-4 w-4" strokeWidth={3} />
                              : displayIndex + 1
                            }
                          </button>
                        )}
                      </div>

                      <>
                        {exercise?.type === "cardio" ? (
                          <>
                            <div className="text-center text-sm font-semibold text-foreground">
                              {set.distance_km ? `${convertDistance(set.distance_km)} ${units.distance}` : "—"}
                            </div>
                            <div className="text-center text-sm font-medium text-primary">
                              {set.duration_minutes ? `${set.duration_minutes} ${t("units.min")}` : "—"}
                            </div>
                          </>
                        ) : exercise?.type === "timed" ? (
                          <div className="text-center text-sm font-semibold text-primary">
                            {set.plank_seconds ? `${set.plank_seconds} ${t("units.sec")}` : "—"}
                          </div>
                        ) : exercise?.type === "bodyweight" ? (
                          <div className="text-center text-sm font-semibold text-foreground">{set.reps || "—"}</div>
                        ) : (
                          <>
                            <div className="text-center text-sm font-semibold text-foreground">{set.reps || "—"}</div>
                            <div className="text-center text-sm font-medium text-primary">
                              {set.weight ? `${convertWeight(set.weight)} ${units.weight}` : "—"}
                            </div>
                          </>
                        )}

                        {!readOnly && (
                          canManageSets ? (
                            <div className="flex gap-0 justify-end -mr-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-transparent active:bg-transparent focus:bg-transparent [-webkit-tap-highlight-color:transparent]"
                                disabled={!!pendingAction}
                                onClick={() => handleCopySet(set)}
                              >
                                {pendingAction === `copy:${set.id}` ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CopyPlus className="h-3.5 w-3.5" />}
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground hover:bg-transparent active:bg-transparent focus:bg-transparent [-webkit-tap-highlight-color:transparent]"
                                disabled={!!pendingAction}
                                onClick={() => setSetToDelete(set.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <div></div>
                          )
                        )}
                      </>
                    </div>
                    </motion.div>
              ))}
          </AnimatePresence>
          </div>

          {canManageSets && (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-1.5 gap-1.5 h-7 text-xs"
              onClick={() => onAddAnotherSet(exerciseId)}
            >
              <Plus className="h-3.5 w-3.5" />
              {t("workout.anotherSet")}
            </Button>
          )}
        </CardContent>
        {/* Set completion progress bar */}
        {sets.length > 0 && !readOnly && (
          <div className="h-[2px] bg-muted/30 rounded-b-xl overflow-hidden">
            <div
              className="h-full bg-primary/40 transition-all duration-300 rounded-b-xl"
              style={{ width: `${(sets.filter(s => s.is_completed).length / sets.length) * 100}%` }}
            />
          </div>
        )}
      </Card>

      <AlertDialog open={!!setToDelete} onOpenChange={(open) => !open && setSetToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("workout.deleteSetTitle")}</AlertDialogTitle>
            <AlertDialogDescription>{t("workout.deleteSetDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDeleteSet}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
