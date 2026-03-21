import { useState } from "react";
import { format, type Locale } from "date-fns";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Activity, Copy, Dumbbell, History, Pencil, Plus, Save, Timer, Trash2, Trophy, User, X } from "lucide-react";

import { getExerciseName } from "@/lib/i18n";
import { LIMITS } from "@/lib/limits";
import { cn } from "@/lib/utils";
import { useUnits } from "@/hooks/useUnits";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
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
};

type UpdateSetPayload = {
  setId: string;
  reps: number | null;
  weight: number | null;
  distance_km: number | null;
  duration_minutes: number | null;
  plank_seconds: number | null;
};

interface WorkoutExerciseCardProps {
  exerciseId: string;
  exercise: ExerciseCardExercise | null;
  sets: WorkoutSet[];
  index: number;
  isOwner: boolean;
  isLocked: boolean;
  isRecordSet: (setId: string) => boolean;
  dateLocale: Locale;
  onOpenExerciseHistory: (exerciseId: string, exerciseName: string, exerciseType: string) => void;
  onAddAnotherSet: (exerciseId: string) => Promise<void>;
  onCreateSet: (payload: SetPayload) => Promise<void>;
  onUpdateSet: (payload: UpdateSetPayload) => Promise<void>;
  onDeleteSet: (setId: string) => Promise<void>;
}

export function WorkoutExerciseCard({
  exerciseId,
  exercise,
  sets,
  index,
  isOwner,
  isLocked,
  isRecordSet,
  dateLocale,
  onOpenExerciseHistory,
  onAddAnotherSet,
  onCreateSet,
  onUpdateSet,
  onDeleteSet,
}: WorkoutExerciseCardProps) {
  const { t } = useTranslation();
  const { units, convertWeight, convertDistance, toMetricWeight, toMetricDistance } = useUnits();
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editReps, setEditReps] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editDistance, setEditDistance] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [openTooltipId, setOpenTooltipId] = useState<string | null>(null);
  const [setToDelete, setSetToDelete] = useState<string | null>(null);

  const canManageSets = isOwner && !isLocked;

  const handleCopySet = async (set: WorkoutSet) => {
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
      });

      toast.success(t("workout.setCopied"));
    } catch {
      toast.error(t("workout.setCopyError"));
    }
  };

  const handleEditSet = (set: WorkoutSet) => {
    setEditingSetId(set.id);
    setEditReps(set.reps?.toString() || "");
    setEditWeight(set.weight ? convertWeight(set.weight).toString() : "");
    setEditDistance(set.distance_km ? convertDistance(set.distance_km).toString() : "");
    const durationValue = set.exercise?.type === "timed" ? set.plank_seconds : set.duration_minutes;
    setEditDuration(durationValue ? durationValue.toString() : "");
  };

  const handleCancelEdit = () => {
    setEditingSetId(null);
    setEditReps("");
    setEditWeight("");
    setEditDistance("");
    setEditDuration("");
  };

  const handleSaveEdit = async () => {
    if (!editingSetId) return;

    const currentSet = sets.find((s) => s.id === editingSetId);
    const exerciseType = currentSet?.exercise?.type;

    const weightInKg = editWeight ? toMetricWeight(parseFloat(editWeight)) : null;
    const distanceInKm = editDistance ? toMetricDistance(parseFloat(editDistance)) : null;

    try {
      await onUpdateSet({
        setId: editingSetId,
        reps: editReps ? parseInt(editReps) : null,
        weight: weightInKg,
        distance_km: distanceInKm,
        duration_minutes: exerciseType === "cardio" && editDuration ? parseInt(editDuration) : null,
        plank_seconds: exerciseType === "timed" && editDuration ? parseInt(editDuration) : null,
      });
      toast.success(t("workout.setUpdated"));
      handleCancelEdit();
    } catch {
      toast.error(t("workout.setUpdateError"));
    }
  };

  const confirmDeleteSet = async () => {
    if (!setToDelete) return;

    try {
      await onDeleteSet(setToDelete);
      toast.success(t("workout.setDeleted"));
      setSetToDelete(null);
    } catch {
      toast.error(t("workout.setDeleteError"));
    }
  };

  return (
    <>
      <Card className="animate-fade-in" style={{ animationDelay: `${index * 50}ms` }}>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <CardTitle className="flex items-center gap-2 text-base truncate">
                {exercise?.type === "weighted" ? (
                  <Dumbbell className="h-4 w-4 text-primary flex-shrink-0" />
                ) : exercise?.type === "cardio" ? (
                  <Activity className="h-4 w-4 text-primary flex-shrink-0" />
                ) : exercise?.type === "timed" ? (
                  <Timer className="h-4 w-4 text-primary flex-shrink-0" />
                ) : (
                  <User className="h-4 w-4 text-primary flex-shrink-0" />
                )}
                <span className="truncate">{exercise?.name ? getExerciseName(exercise.name, exercise.name_translations) : ""}</span>
              </CardTitle>
              <Button
                variant="ghost"
                size="icon"
                className="h-7 w-7 flex-shrink-0"
                onClick={() =>
                  exercise &&
                  onOpenExerciseHistory(
                    exerciseId,
                    getExerciseName(exercise.name, exercise.name_translations),
                    exercise.type
                  )
                }
              >
                <History className="h-4 w-4 text-muted-foreground" />
              </Button>
            </div>
            {exercise?.image_url ? (
              <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                <img
                  src={exercise.image_url}
                  alt={getExerciseName(exercise.name, exercise.name_translations)}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-16 h-16 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
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

        <CardContent className="space-y-1 px-4 pb-4">
          <div
            className={cn(
              "grid gap-1 px-2 py-1.5 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide",
              exercise?.type === "bodyweight" || exercise?.type === "timed"
                ? "grid-cols-[44px_1fr_84px]"
                : "grid-cols-[44px_1fr_1fr_84px]"
            )}
          >
            <div className="text-center">#</div>
            <div className="text-center">
              {exercise?.type === "cardio" ? t("progress.distance") : exercise?.type === "timed" ? t("progress.time") : t("workout.reps")}
            </div>
            {exercise?.type !== "bodyweight" && exercise?.type !== "timed" && (
              <div className="text-center">{exercise?.type === "cardio" ? t("progress.time") : t("workout.weight")}</div>
            )}
            <div></div>
          </div>

          <TooltipProvider>
            {sets
              .slice()
              .sort((a, b) => a.set_number - b.set_number)
              .map((set, setIndex) => (
                <Tooltip
                  key={set.id}
                  open={openTooltipId === set.id}
                  onOpenChange={(open) => setOpenTooltipId(open ? set.id : null)}
                >
                  <TooltipTrigger asChild>
                    <div
                      className={cn(
                        "relative grid gap-1 items-center py-2 px-2 rounded-md cursor-pointer select-none",
                        exercise?.type === "bodyweight" || exercise?.type === "timed"
                          ? "grid-cols-[44px_1fr_84px]"
                          : "grid-cols-[44px_1fr_1fr_84px]",
                        isRecordSet(set.id) ? "bg-yellow-100 dark:bg-yellow-900/30" : "bg-muted/30"
                      )}
                      onClick={(e) => {
                        if ((e.target as HTMLElement).closest("button")) {
                          return;
                        }
                        setOpenTooltipId(openTooltipId === set.id ? null : set.id);
                      }}
                    >
                      {isRecordSet(set.id) && (
                        <Trophy className="absolute left-1.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-yellow-500" />
                      )}
                      <div className="text-center text-sm font-medium text-muted-foreground">{setIndex + 1}</div>

                      {editingSetId === set.id ? (
                        <>
                          {exercise?.type === "cardio" ? (
                            <>
                              <Input
                                type="number"
                                inputMode="decimal"
                                enterKeyHint="next"
                                step="0.1"
                                value={editDistance}
                                onChange={(e) => setEditDistance(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    (e.currentTarget.nextElementSibling as HTMLInputElement)?.focus();
                                  }
                                }}
                                className="h-7 text-center text-sm px-2"
                                placeholder={t("units.km")}
                                autoFocus
                              />
                              <Input
                                type="number"
                                inputMode="numeric"
                                enterKeyHint="done"
                                value={editDuration}
                                onChange={(e) => setEditDuration(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleSaveEdit();
                                  }
                                }}
                                className="h-7 text-center text-sm px-2"
                                placeholder={t("units.min")}
                              />
                            </>
                          ) : exercise?.type === "timed" ? (
                            <Input
                              type="number"
                              inputMode="numeric"
                              enterKeyHint="done"
                              value={editDuration}
                              onChange={(e) => setEditDuration(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleSaveEdit();
                                }
                              }}
                              className="h-7 text-center text-sm px-2"
                              placeholder={t("units.sec")}
                              autoFocus
                            />
                          ) : exercise?.type === "bodyweight" ? (
                            <Input
                              type="number"
                              inputMode="numeric"
                              enterKeyHint="done"
                              value={editReps}
                              onChange={(e) => setEditReps(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  handleSaveEdit();
                                }
                              }}
                              className="h-7 text-center text-sm px-2"
                              autoFocus
                            />
                          ) : (
                            <>
                              <Input
                                type="number"
                                inputMode="numeric"
                                enterKeyHint="next"
                                value={editReps}
                                onChange={(e) => setEditReps(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    (e.currentTarget.nextElementSibling as HTMLInputElement)?.focus();
                                  }
                                }}
                                className="h-7 text-center text-sm px-2"
                                autoFocus
                              />
                              <Input
                                type="number"
                                inputMode="decimal"
                                enterKeyHint="done"
                                step="0.5"
                                value={editWeight}
                                onChange={(e) => setEditWeight(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") {
                                    e.preventDefault();
                                    handleSaveEdit();
                                  }
                                }}
                                className="h-7 text-center text-sm px-2"
                                placeholder="—"
                              />
                            </>
                          )}

                          <div className="flex gap-0.5 justify-end">
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-foreground"
                              onClick={handleSaveEdit}
                            >
                              <Save className="h-3 w-3" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              className="h-6 w-6 text-muted-foreground hover:text-foreground"
                              onClick={handleCancelEdit}
                            >
                              <X className="h-3 w-3" />
                            </Button>
                          </div>
                        </>
                      ) : (
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

                          {canManageSets ? (
                            <div className="flex gap-0 justify-end -mr-1">
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => handleCopySet(set)}
                              >
                                <Copy className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => handleEditSet(set)}
                              >
                                <Pencil className="h-3.5 w-3.5" />
                              </Button>
                              <Button
                                variant="ghost"
                                size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-foreground"
                                onClick={() => setSetToDelete(set.id)}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          ) : (
                            <div></div>
                          )}
                        </>
                      )}
                    </div>
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>
                      {t("workout.createdAt")}: {format(new Date(set.created_at), "HH:mm", { locale: dateLocale })}
                    </p>
                  </TooltipContent>
                </Tooltip>
              ))}
          </TooltipProvider>

          {canManageSets && (
            <Button
              variant="outline"
              size="sm"
              className="w-full mt-2 gap-1.5 h-8"
              onClick={() => onAddAnotherSet(exerciseId)}
            >
              <Plus className="h-3.5 w-3.5" />
              {t("workout.anotherSet")}
            </Button>
          )}
        </CardContent>
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
