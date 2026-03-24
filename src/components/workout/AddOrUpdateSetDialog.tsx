import { useCallback, useEffect, useMemo, useState } from "react";
import { format, parseISO } from "date-fns";
import { ArrowLeft, History, Loader2, Timer } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { getExerciseName } from "@/lib/i18n";
import { LIMITS } from "@/lib/limits";
import { isValidationFailure, validateSetCreationLimits, validateSetInputValues } from "@/lib/setValidation";
import type { Exercise } from "@/hooks/useExercises";
import type { EditSetContext, SharedSetDialogDataProps } from "@/components/workout/setDialogTypes";
import { ExerciseTimer } from "@/components/ExerciseTimer";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Label } from "@/components/ui/label";
import { SwipeNumberInput } from "@/components/ui/swipe-number-input";

type SetDialogMode = "add" | "edit";

interface AddOrUpdateSetDialogProps extends SharedSetDialogDataProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedExercise: Exercise | null;
  mode: SetDialogMode;
  editSetId: string | null;
  editContext: EditSetContext | null;
}

export function AddOrUpdateSetDialog({
  open,
  onOpenChange,
  selectedExercise,
  mode,
  editSetId,
  editContext,
  dateLocale,
  effectiveUserId,
  autoFillEnabled,
  units,
  convertWeight,
  convertDistance,
  toMetricWeight,
  toMetricDistance,
  existingSetCountByExercise,
  totalSetCount,
  isSubmitting,
  onGetRecentSets,
  onGetLastSet,
  onAddSet,
  onUpdateSet,
}: AddOrUpdateSetDialogProps) {
  const { t } = useTranslation();
  const isEditMode = mode === "edit";

  const [reps, setReps] = useState("");
  const [weight, setWeight] = useState("");
  const [distance, setDistance] = useState("");
  const [duration, setDuration] = useState("");
  const [showTimer, setShowTimer] = useState(false);
  const [recentSets, setRecentSets] = useState<Awaited<ReturnType<typeof onGetRecentSets>>>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [historyLimit, setHistoryLimit] = useState(5);
  const [suppressEditHydration, setSuppressEditHydration] = useState(false);

  useEffect(() => {
    if (!open) {
      setSuppressEditHydration(false);
    }
  }, [open]);

  const resetFormState = useCallback(() => {
    setReps("");
    setWeight("");
    setDistance("");
    setDuration("");
    setShowTimer(false);
    setRecentSets([]);
    setHistoryLimit(5);
    setHasMoreHistory(false);
  }, []);

  const loadExerciseHistory = useCallback(
    async (exerciseId: string, limit: number) => {
      if (!effectiveUserId) {
        setRecentSets([]);
        setHasMoreHistory(false);
        return;
      }

      setIsLoadingHistory(true);
      try {
        const history = await onGetRecentSets(exerciseId, effectiveUserId, limit + 1);
        if (history.length > limit) {
          setRecentSets(history.slice(0, limit));
          setHasMoreHistory(true);
        } else {
          setRecentSets(history);
          setHasMoreHistory(false);
        }
      } catch (error) {
        console.error("Failed to load recent sets:", error);
        setRecentSets([]);
        setHasMoreHistory(false);
      } finally {
        setIsLoadingHistory(false);
      }
    },
    [effectiveUserId, onGetRecentSets]
  );

  useEffect(() => {
    if (!open || !selectedExercise) return;

    if (isEditMode && suppressEditHydration) {
      return;
    }

    resetFormState();
    void loadExerciseHistory(selectedExercise.id, 5);

    if (isEditMode) {
      if (!editContext) return;

      setReps(editContext.reps?.toString() ?? "");
      setWeight(editContext.weight ? convertWeight(editContext.weight).toString() : "");
      setDistance(editContext.distance_km ? convertDistance(editContext.distance_km).toString() : "");

      const durationValue =
        selectedExercise.type === "timed"
          ? editContext.plank_seconds
          : selectedExercise.type === "cardio"
            ? editContext.duration_minutes
            : null;

      setDuration(durationValue?.toString() ?? "");
      return;
    }

    if (!autoFillEnabled || !effectiveUserId) {
      return;
    }

    void (async () => {
      try {
        const lastData = await onGetLastSet(selectedExercise.id, effectiveUserId);
        if (!lastData) return;

        switch (selectedExercise.type) {
          case "weighted":
            if (lastData.weight) setWeight(convertWeight(lastData.weight).toString());
            if (lastData.reps) setReps(lastData.reps.toString());
            break;
          case "bodyweight":
            if (lastData.reps) setReps(lastData.reps.toString());
            break;
          case "cardio":
            if (lastData.distance_km) setDistance(convertDistance(lastData.distance_km).toString());
            if (lastData.duration_minutes) setDuration(lastData.duration_minutes.toString());
            break;
          case "timed":
            if (lastData.plank_seconds) setDuration(lastData.plank_seconds.toString());
            break;
        }
      } catch (error) {
        console.error("Failed to get last set data:", error);
      }
    })();
  }, [
    autoFillEnabled,
    convertDistance,
    convertWeight,
    editContext,
    effectiveUserId,
    isEditMode,
    loadExerciseHistory,
    onGetLastSet,
    open,
    resetFormState,
    selectedExercise,
    suppressEditHydration,
  ]);

  const existingSets = useMemo(() => {
    if (!selectedExercise) return 0;
    return existingSetCountByExercise[selectedExercise.id] || 0;
  }, [existingSetCountByExercise, selectedExercise]);

  const loadMoreHistory = async () => {
    if (!selectedExercise) return;
    const newLimit = historyLimit + 5;
    await loadExerciseHistory(selectedExercise.id, newLimit);
    setHistoryLimit(newLimit);
  };

  const handleSubmitSet = async () => {
    if (!selectedExercise) {
      toast.error(t("workout.enterExercise"));
      return;
    }

    const uniqueExercises = Object.keys(existingSetCountByExercise).length;
    const isNewExercise = !existingSetCountByExercise[selectedExercise.id];

    const limitsValidation = validateSetCreationLimits({
      isEditMode,
      isNewExercise,
      uniqueExercises,
      existingSets,
      totalSetCount,
    });

    if (isValidationFailure(limitsValidation)) {
      toast.error(t(limitsValidation.errorKey, limitsValidation.params));
      return;
    }

    const inputValidation = validateSetInputValues({
      exerciseType: selectedExercise.type,
      reps,
      weight,
      distance,
      duration,
    });

    if (isValidationFailure(inputValidation)) {
      toast.error(t(inputValidation.errorKey, inputValidation.params));
      return;
    }

    try {
      const weightInKg = weight ? toMetricWeight(parseFloat(weight)) : undefined;
      const distanceInKm = distance ? toMetricDistance(parseFloat(distance)) : undefined;

      if (isEditMode) {
        if (!editSetId) return;

        setSuppressEditHydration(true);

        await onUpdateSet({
          setId: editSetId,
          reps: reps ? parseInt(reps, 10) : null,
          weight: weightInKg ?? null,
          distance_km: distanceInKm ?? null,
          duration_minutes: selectedExercise.type === "cardio" && duration ? parseInt(duration, 10) : null,
          plank_seconds: selectedExercise.type === "timed" && duration ? parseInt(duration, 10) : null,
        });

        toast.success(t("workout.setUpdated"));
      } else {
        await onAddSet({
          exerciseId: selectedExercise.id,
          setNumber: existingSets + 1,
          reps: reps ? parseInt(reps, 10) : undefined,
          weight: weightInKg,
          distance_km: distanceInKm,
          duration_minutes: selectedExercise.type === "cardio" && duration ? parseInt(duration, 10) : undefined,
          plank_seconds: selectedExercise.type === "timed" && duration ? parseInt(duration, 10) : undefined,
        });

        toast.success(t("workout.setAdded"));
      }

      onOpenChange(false);
    } catch {
      setSuppressEditHydration(false);
      toast.error(isEditMode ? t("workout.setUpdateError") : t("workout.setAddError"));
    }
  };

  if (!selectedExercise) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="set-dialog-description">
        <DialogHeader>
          <DialogTitle>{getExerciseName(selectedExercise.name, selectedExercise.name_translations)}</DialogTitle>
          <p id="set-dialog-description" className="sr-only">
            {isEditMode ? t("workout.editSet") : t("workout.addingSetFor")}
          </p>
        </DialogHeader>

        <div className="space-y-4 mt-4">
          {!(selectedExercise.type === "timed" && showTimer) && (
            <div className="flex items-center justify-between mb-2">
              <Button type="button" variant="ghost" size="sm" onClick={() => onOpenChange(false)}>
                <ArrowLeft className="h-4 w-4 mr-2" />
                {t("common.back")}
              </Button>

              <Drawer>
                <DrawerTrigger asChild>
                  <Button type="button" variant="ghost" size="sm" className="gap-1.5" disabled={isLoadingHistory}>
                    <History className="h-4 w-4" />
                    <span className="hidden sm:inline">{t("workout.history")}</span>
                  </Button>
                </DrawerTrigger>
                <DrawerContent>
                  <DrawerHeader>
                    <DrawerTitle>{t("workout.recentSets")}</DrawerTitle>
                  </DrawerHeader>
                  <div className="px-4 pb-6 max-h-[60vh] overflow-y-auto">
                    {isLoadingHistory ? (
                      <div className="flex items-center justify-center py-8">
                        <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
                      </div>
                    ) : recentSets.length === 0 ? (
                      <p className="text-sm text-muted-foreground text-center py-8">{t("workout.noHistory")}</p>
                    ) : (
                      <div className="space-y-2">
                        {recentSets.map((set, i) => {
                          const showDate = i === 0 || set.date !== recentSets[i - 1].date;
                          return (
                            <div key={i}>
                              {showDate && (
                                <div className="text-xs text-muted-foreground mb-1 mt-2 first:mt-0">
                                  {format(parseISO(set.date), "d MMM yyyy", { locale: dateLocale })}
                                </div>
                              )}
                              <div className="text-sm p-3 bg-muted/50 rounded-md">
                                <div className="font-medium">
                                  {selectedExercise.type === "cardio" ? (
                                    <>
                                      {convertDistance(set.distance_km || 0)} {units.distance} · {set.duration_minutes} {t("units.min")}
                                    </>
                                  ) : selectedExercise.type === "timed" ? (
                                    <>
                                      {set.plank_seconds} {t("units.sec")}
                                    </>
                                  ) : selectedExercise.type === "bodyweight" ? (
                                    <>
                                      {set.reps} {t("units.reps")}
                                    </>
                                  ) : (
                                    <>
                                      {set.reps} {t("units.reps")} × {convertWeight(set.weight || 0)} {units.weight}
                                    </>
                                  )}
                                </div>
                              </div>
                            </div>
                          );
                        })}
                        {hasMoreHistory && (
                          <Button
                            type="button"
                            variant="outline"
                            size="sm"
                            className="w-full mt-3"
                            onClick={(e) => {
                              e.currentTarget.blur();
                              void loadMoreHistory();
                            }}
                          >
                            {t("workout.loadMoreHistory")}
                          </Button>
                        )}
                      </div>
                    )}
                  </div>
                </DrawerContent>
              </Drawer>
            </div>
          )}

          <form
            onSubmit={(e) => {
              e.preventDefault();
              void handleSubmitSet();
            }}
          >
            {selectedExercise.type === "cardio" ? (
              <div className="space-y-4 max-w-md mx-auto w-full">
                <div className="space-y-2">
                  <Label>
                    {t("workout.distance")} ({units.distance})
                  </Label>
                  <SwipeNumberInput
                    id="add-distance"
                    type="number"
                    inputMode="decimal"
                    enterKeyHint="next"
                    step="0.1"
                    min={LIMITS.MIN_DISTANCE_KM}
                    max={LIMITS.MAX_DISTANCE_KM}
                    placeholder="5.5"
                    value={distance}
                    onChange={(e) => setDistance(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") {
                        e.preventDefault();
                        document.getElementById("add-duration")?.focus();
                      }
                    }}
                    autoFocus
                  />
                </div>
                <div className="space-y-2">
                  <Label>{t("workout.timeMin")}</Label>
                  <SwipeNumberInput
                    id="add-duration"
                    type="number"
                    inputMode="numeric"
                    enterKeyHint="done"
                    min={LIMITS.MIN_DURATION_MINUTES}
                    max={LIMITS.MAX_DURATION_MINUTES}
                    placeholder="30"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                  />
                </div>
              </div>
            ) : selectedExercise.type === "timed" ? (
              showTimer ? (
                <ExerciseTimer
                  onSave={(seconds) => {
                    setDuration(seconds.toString());
                    setShowTimer(false);
                  }}
                  onCancel={() => setShowTimer(false)}
                />
              ) : (
                <div className="space-y-4 max-w-md mx-auto w-full">
                  <div className="space-y-2">
                    <Label>{t("workout.timeSec")}</Label>
                    <SwipeNumberInput
                      type="number"
                      inputMode="numeric"
                      enterKeyHint="done"
                      min={LIMITS.MIN_TIME_SECONDS}
                      max={LIMITS.MAX_TIME_SECONDS}
                      placeholder="60"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <Button type="button" variant="outline" className="w-full gap-2" onClick={() => setShowTimer(true)}>
                    <Timer className="h-4 w-4" />
                    {t("workout.enableTimer")}
                  </Button>
                </div>
              )
            ) : (
              <div className="space-y-4 max-w-md mx-auto w-full">
                <div className="space-y-2">
                  <Label>{t("workout.reps")}</Label>
                  <SwipeNumberInput
                    id="add-reps"
                    type="number"
                    inputMode="numeric"
                    enterKeyHint={selectedExercise.type === "weighted" ? "next" : "done"}
                    min={LIMITS.MIN_REPS}
                    max={LIMITS.MAX_REPS}
                    placeholder="8"
                    value={reps}
                    onChange={(e) => setReps(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && selectedExercise.type === "weighted") {
                        e.preventDefault();
                        document.getElementById("add-weight")?.focus();
                      }
                    }}
                    autoFocus
                  />
                </div>
                {selectedExercise.type === "weighted" && (
                  <div className="space-y-2">
                    <Label>{t("workout.weight")}</Label>
                    <SwipeNumberInput
                      id="add-weight"
                      type="number"
                      inputMode="decimal"
                      enterKeyHint="done"
                      step="0.1"
                      swipeStep="0.5"
                      min={LIMITS.MIN_WEIGHT_KG}
                      max={LIMITS.MAX_WEIGHT_KG}
                      placeholder="18"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                    />
                    {selectedExercise.name.toLowerCase().includes("гантел") && (
                      <p className="text-xs text-muted-foreground">{t("workout.dumbbellNote")}</p>
                    )}
                  </div>
                )}
              </div>
            )}

            {!(selectedExercise.type === "timed" && showTimer) && (
              <Button type="submit" className="w-full mt-4" disabled={isSubmitting}>
                {isEditMode ? t("common.save") : t("common.add")}
              </Button>
            )}
          </form>
        </div>
      </DialogContent>
    </Dialog>
  );
}
