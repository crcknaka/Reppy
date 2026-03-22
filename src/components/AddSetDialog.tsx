import { useEffect, useMemo, useState, memo, useCallback } from "react";
import { format, parseISO, type Locale } from "date-fns";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";
import { Activity, ArrowLeft, Dumbbell, History, LayoutGrid, Loader2, Search, Star, Timer, User } from "lucide-react";

import { getExerciseName } from "@/lib/i18n";
import { getExerciseIcon, getExerciseTypeLabel, type ExerciseType } from "@/lib/exerciseUtils";
import { LIMITS } from "@/lib/limits";
import { cn } from "@/lib/utils";
import type { Exercise } from "@/hooks/useExercises";
import type { LastSetData, RecentSetData } from "@/offline";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle, DrawerTrigger } from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ExerciseTimer } from "@/components/ExerciseTimer";

type AddSetPayload = {
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

type EditSetContext = {
  setId: string;
  exerciseId: string;
  reps: number | null;
  weight: number | null;
  distance_km: number | null;
  duration_minutes: number | null;
  plank_seconds: number | null;
};

type ExerciseTypeFilter = "all" | "bodyweight" | "weighted" | "cardio" | "timed";

interface AddSetDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  exercises: Exercise[];
  favoriteExerciseIds: Set<string>;
  dateLocale: Locale;
  effectiveUserId: string | null;
  autoFillEnabled: boolean;
  units: { weight: string; distance: string };
  convertWeight: (value: number) => number;
  convertDistance: (value: number) => number;
  toMetricWeight: (value: number) => number;
  toMetricDistance: (value: number) => number;
  existingSetCountByExercise: Record<string, number>;
  totalSetCount: number;
  initialExerciseId: string | null;
  onInitialExerciseHandled: () => void;
  isSubmitting: boolean;
  onToggleFavorite: (exerciseId: string, isFavorite: boolean) => Promise<void>;
  onGetRecentSets: (exerciseId: string, userId: string, limit: number) => Promise<RecentSetData[]>;
  onGetLastSet: (exerciseId: string, userId: string) => Promise<LastSetData | null>;
  onAddSet: (payload: AddSetPayload) => Promise<void>;
  onUpdateSet: (payload: UpdateSetPayload) => Promise<void>;
  editSetId: string | null;
  onResolveEditSet: (setId: string) => EditSetContext | null;
}

interface ExerciseSelectionCardProps {
  exercise: Exercise;
  isFavorite: boolean;
  onSelect: (exercise: Exercise) => void;
  onToggleFavorite: (id: string, e: React.MouseEvent) => void;
}

const ExerciseSelectionCard = memo(function ExerciseSelectionCard({
  exercise,
  isFavorite,
  onSelect,
  onToggleFavorite,
}: ExerciseSelectionCardProps) {
  const Icon = getExerciseIcon(exercise.type as ExerciseType);
  const { t } = useTranslation();

  return (
    <div
      onClick={() => onSelect(exercise)}
      className="text-left group hover:scale-[1.02] transition-transform cursor-pointer"
      role="button"
      tabIndex={0}
      onKeyDown={(e) => e.key === "Enter" && onSelect(exercise)}
    >
      <div className="border rounded-lg overflow-hidden hover:border-primary transition-colors relative">
        <button
          onClick={(e) => onToggleFavorite(exercise.id, e)}
          className="absolute top-2 right-2 z-10 p-1.5 rounded-full bg-background/80 backdrop-blur-sm hover:bg-background transition-colors"
        >
          <Star
            className={cn(
              "h-4 w-4 transition-colors",
              isFavorite ? "fill-primary text-primary" : "text-muted-foreground hover:text-primary"
            )}
          />
        </button>

        {exercise.image_url ? (
          <div className="w-full aspect-[4/3] overflow-hidden bg-muted">
            <img
              src={exercise.image_url}
              alt={getExerciseName(exercise.name, exercise.name_translations)}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform"
            />
          </div>
        ) : (
          <div className="w-full aspect-[4/3] bg-muted flex items-center justify-center">
            <Icon className="h-12 w-12 text-muted-foreground" />
          </div>
        )}
        <div className="p-3 bg-card">
          <p className="font-medium text-foreground text-center">
            {getExerciseName(exercise.name, exercise.name_translations)}
          </p>
          <p className="text-xs text-muted-foreground text-center">
            {getExerciseTypeLabel(exercise.type as ExerciseType, t)}
          </p>
        </div>
      </div>
    </div>
  );
});

export function AddSetDialog({
  open,
  onOpenChange,
  exercises,
  favoriteExerciseIds,
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
  initialExerciseId,
  onInitialExerciseHandled,
  isSubmitting,
  onToggleFavorite,
  onGetRecentSets,
  onGetLastSet,
  onAddSet,
  onUpdateSet,
  editSetId,
  onResolveEditSet,
}: AddSetDialogProps) {
  const { t } = useTranslation();
  const isEditMode = !!editSetId;

  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [reps, setReps] = useState("");
  const [weight, setWeight] = useState("");
  const [distance, setDistance] = useState("");
  const [duration, setDuration] = useState("");
  const [exerciseTypeFilter, setExerciseTypeFilter] = useState<ExerciseTypeFilter>("all");
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState("");
  const [exerciseTab, setExerciseTab] = useState<"all" | "favorites">("all");
  const [showTimer, setShowTimer] = useState(false);
  const [recentSets, setRecentSets] = useState<RecentSetData[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(false);
  const [hasMoreHistory, setHasMoreHistory] = useState(false);
  const [historyLimit, setHistoryLimit] = useState(5);
  const [suppressEditHydration, setSuppressEditHydration] = useState(false);

  const resetDialogState = () => {
    setSelectedExercise(null);
    setReps("");
    setWeight("");
    setDistance("");
    setDuration("");
    setShowTimer(false);
    setExerciseSearchQuery("");
    setRecentSets([]);
    setHistoryLimit(5);
    setHasMoreHistory(false);
  };

  const handleDialogChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setSuppressEditHydration(false);
      resetDialogState();
      onInitialExerciseHandled();
    }
  };

  const filteredExercises = useMemo(() => {
    let filtered = exercises;

    if (exerciseTab === "favorites") {
      filtered = filtered.filter((exercise) => favoriteExerciseIds.has(exercise.id));
    }

    if (exerciseTypeFilter !== "all") {
      filtered = filtered.filter((exercise) => exercise.type === exerciseTypeFilter);
    }

    if (exerciseSearchQuery) {
      filtered = filtered.filter((exercise) => {
        const translatedName = getExerciseName(exercise.name, exercise.name_translations);
        return translatedName.toLowerCase().includes(exerciseSearchQuery.toLowerCase());
      });
    }

    return filtered;
  }, [exerciseSearchQuery, exerciseTab, exerciseTypeFilter, exercises, favoriteExerciseIds]);

  const loadExerciseHistory = useCallback(async (exerciseId: string, limit: number) => {
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
  }, [effectiveUserId, onGetRecentSets]);

  const handleSelectExercise = useCallback(async (exercise: Exercise) => {
    setSelectedExercise(exercise);
    setRecentSets([]);
    setHistoryLimit(5);
    setHasMoreHistory(false);

    await loadExerciseHistory(exercise.id, 5);

    if (!autoFillEnabled || !effectiveUserId) return;

    try {
      const lastData = await onGetLastSet(exercise.id, effectiveUserId);
      if (!lastData) return;

      switch (exercise.type) {
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
  }, [
    autoFillEnabled,
    convertDistance,
    convertWeight,
    effectiveUserId,
    loadExerciseHistory,
    onGetLastSet,
  ]);

  const handleToggleFavorite = async (exerciseId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const isFavorite = favoriteExerciseIds.has(exerciseId);

    try {
      await onToggleFavorite(exerciseId, isFavorite);
      toast.success(isFavorite ? t("workout.removedFromFavorites") : t("workout.addedToFavorites"));
    } catch (error) {
      toast.error(t("workout.favoriteError"));
    }
  };

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

    const existingSets = existingSetCountByExercise[selectedExercise.id] || 0;
    const uniqueExercises = Object.keys(existingSetCountByExercise).length;
    const isNewExercise = !existingSetCountByExercise[selectedExercise.id];

    if (!isEditMode) {
      if (isNewExercise && uniqueExercises >= LIMITS.MAX_EXERCISES_PER_WORKOUT) {
        toast.error(t("limits.maxExercisesPerWorkout", { max: LIMITS.MAX_EXERCISES_PER_WORKOUT }));
        return;
      }

      if (existingSets >= LIMITS.MAX_SETS_PER_EXERCISE) {
        toast.error(t("limits.maxSetsPerExercise", { max: LIMITS.MAX_SETS_PER_EXERCISE }));
        return;
      }

      if (totalSetCount >= LIMITS.MAX_TOTAL_SETS_PER_WORKOUT) {
        toast.error(t("limits.maxTotalSetsPerWorkout", { max: LIMITS.MAX_TOTAL_SETS_PER_WORKOUT }));
        return;
      }
    }

    if (selectedExercise.type === "cardio") {
      if (!distance || !duration) {
        toast.error(t("workout.cardioRequired"));
        return;
      }

      const distanceNum = parseFloat(distance);
      const durationNum = parseInt(duration);
      if (isNaN(distanceNum) || distanceNum < LIMITS.MIN_DISTANCE_KM || distanceNum > LIMITS.MAX_DISTANCE_KM) {
        toast.error(t("limits.distanceRange", { min: LIMITS.MIN_DISTANCE_KM, max: LIMITS.MAX_DISTANCE_KM }));
        return;
      }
      if (isNaN(durationNum) || durationNum < LIMITS.MIN_DURATION_MINUTES || durationNum > LIMITS.MAX_DURATION_MINUTES) {
        toast.error(t("limits.durationRange", { min: LIMITS.MIN_DURATION_MINUTES, max: LIMITS.MAX_DURATION_MINUTES }));
        return;
      }
    } else if (selectedExercise.type === "timed") {
      if (!duration) {
        toast.error(t("workout.enterTime"));
        return;
      }

      const durationNum = parseInt(duration);
      if (isNaN(durationNum) || durationNum < LIMITS.MIN_TIME_SECONDS || durationNum > LIMITS.MAX_TIME_SECONDS) {
        toast.error(t("limits.timeRange", { min: LIMITS.MIN_TIME_SECONDS, max: LIMITS.MAX_TIME_SECONDS }));
        return;
      }
    } else if (selectedExercise.type === "weighted") {
      if (!reps || !weight) {
        toast.error(t("workout.weightedRequired"));
        return;
      }

      const repsNum = parseInt(reps);
      const weightNum = parseFloat(weight);
      if (isNaN(repsNum) || repsNum < LIMITS.MIN_REPS || repsNum > LIMITS.MAX_REPS) {
        toast.error(t("limits.repsRange", { min: LIMITS.MIN_REPS, max: LIMITS.MAX_REPS }));
        return;
      }
      if (isNaN(weightNum) || weightNum < LIMITS.MIN_WEIGHT_KG || weightNum > LIMITS.MAX_WEIGHT_KG) {
        toast.error(t("limits.weightRange", { min: LIMITS.MIN_WEIGHT_KG, max: LIMITS.MAX_WEIGHT_KG }));
        return;
      }
    } else if (selectedExercise.type === "bodyweight") {
      if (!reps) {
        toast.error(t("workout.enterReps"));
        return;
      }

      const repsNum = parseInt(reps);
      if (isNaN(repsNum) || repsNum < LIMITS.MIN_REPS || repsNum > LIMITS.MAX_REPS) {
        toast.error(t("limits.repsRange", { min: LIMITS.MIN_REPS, max: LIMITS.MAX_REPS }));
        return;
      }
    }

    try {
      const weightInKg = weight ? toMetricWeight(parseFloat(weight)) : undefined;
      const distanceInKm = distance ? toMetricDistance(parseFloat(distance)) : undefined;

      if (isEditMode) {
        if (!editSetId) {
          return;
        }

        setSuppressEditHydration(true);

        await onUpdateSet({
          setId: editSetId,
          reps: reps ? parseInt(reps) : null,
          weight: weightInKg ?? null,
          distance_km: distanceInKm ?? null,
          duration_minutes: selectedExercise.type === "cardio" && duration ? parseInt(duration) : null,
          plank_seconds: selectedExercise.type === "timed" && duration ? parseInt(duration) : null,
        });

        toast.success(t("workout.setUpdated"));
      } else {
        await onAddSet({
          exerciseId: selectedExercise.id,
          setNumber: existingSets + 1,
          reps: reps ? parseInt(reps) : undefined,
          weight: weightInKg,
          distance_km: distanceInKm,
          duration_minutes: selectedExercise.type === "cardio" && duration ? parseInt(duration) : undefined,
          plank_seconds: selectedExercise.type === "timed" && duration ? parseInt(duration) : undefined,
        });

        toast.success(t("workout.setAdded"));
      }
      handleDialogChange(false);
    } catch (error) {
      setSuppressEditHydration(false);
      toast.error(isEditMode ? t("workout.setUpdateError") : t("workout.setAddError"));
    }
  };

  useEffect(() => {
    if (!open || !isEditMode || !editSetId || exercises.length === 0) return;
    if (suppressEditHydration) return;

    const resolvedEditSet = onResolveEditSet(editSetId);
    if (!resolvedEditSet) return;

    const exercise = exercises.find((entry) => entry.id === resolvedEditSet.exerciseId);
    if (!exercise) return;

    setSelectedExercise(exercise);
    setExerciseSearchQuery("");
    setRecentSets([]);
    setHistoryLimit(5);
    setHasMoreHistory(false);
    setShowTimer(false);

    setReps(resolvedEditSet.reps?.toString() ?? "");
    setWeight(resolvedEditSet.weight ? convertWeight(resolvedEditSet.weight).toString() : "");
    setDistance(resolvedEditSet.distance_km ? convertDistance(resolvedEditSet.distance_km).toString() : "");

    const durationValue =
      exercise.type === "timed" ? resolvedEditSet.plank_seconds : exercise.type === "cardio" ? resolvedEditSet.duration_minutes : null;
    setDuration(durationValue?.toString() ?? "");

    void loadExerciseHistory(exercise.id, 5);
  }, [
    open,
    isEditMode,
    editSetId,
    onResolveEditSet,
    exercises,
    suppressEditHydration,
    convertWeight,
    convertDistance,
    loadExerciseHistory,
  ]);

  useEffect(() => {
    if (!open || isEditMode || !initialExerciseId || exercises.length === 0) return;
    const exercise = exercises.find((entry) => entry.id === initialExerciseId);
    if (exercise) {
      void handleSelectExercise(exercise);
      onInitialExerciseHandled();
    }
  }, [open, isEditMode, initialExerciseId, exercises, handleSelectExercise, onInitialExerciseHandled]);

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="exercise-dialog-description">
        <DialogHeader>
          <DialogTitle>
            {selectedExercise
              ? getExerciseName(selectedExercise.name, selectedExercise.name_translations)
              : t("workout.selectExercise")}
          </DialogTitle>
          <p id="exercise-dialog-description" className="sr-only">
            {selectedExercise ? t("workout.addingSetFor") : t("workout.selectingExercise")}
          </p>
        </DialogHeader>

        {!selectedExercise ? (
          <>
            <div className="flex gap-2 mt-4">
              <Button variant={exerciseTab === "all" ? "default" : "outline"} className="flex-1" onClick={() => setExerciseTab("all")}>
                {t("common.all")}
              </Button>
              <Button
                variant={exerciseTab === "favorites" ? "default" : "outline"}
                className="flex-1 gap-2"
                onClick={() => setExerciseTab("favorites")}
              >
                <Star className="h-4 w-4" />
                {t("workout.favorites")}
              </Button>
            </div>

            <div className="mt-4 space-y-3">
              <Select value={exerciseTypeFilter} onValueChange={(value) => setExerciseTypeFilter(value as ExerciseTypeFilter)}>
                <SelectTrigger className="w-full h-12">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">
                    <div className="flex items-center gap-2">
                      <LayoutGrid className="h-4 w-4" />
                      {t("progress.allTypes")}
                    </div>
                  </SelectItem>
                  <SelectItem value="bodyweight">
                    <div className="flex items-center gap-2">
                      <User className="h-4 w-4" />
                      {t("progress.bodyweight")}
                    </div>
                  </SelectItem>
                  <SelectItem value="weighted">
                    <div className="flex items-center gap-2">
                      <Dumbbell className="h-4 w-4" />
                      {t("progress.weighted")}
                    </div>
                  </SelectItem>
                  <SelectItem value="cardio">
                    <div className="flex items-center gap-2">
                      <Activity className="h-4 w-4" />
                      {t("progress.cardio")}
                    </div>
                  </SelectItem>
                  <SelectItem value="timed">
                    <div className="flex items-center gap-2">
                      <Timer className="h-4 w-4" />
                      {t("progress.timed")}
                    </div>
                  </SelectItem>
                </SelectContent>
              </Select>

              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder={t("workout.exerciseSearch")}
                  value={exerciseSearchQuery}
                  onChange={(e) => setExerciseSearchQuery(e.target.value)}
                  className="pl-9 h-12"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 mt-4">
              {filteredExercises.length === 0 ? (
                <div className="col-span-2 text-center py-12 text-muted-foreground">
                  {exerciseTab === "favorites" ? t("workout.noFavorites") : t("exercises.noExercisesFound")}
                </div>
              ) : (
                filteredExercises.map((exercise) => (
                  <ExerciseSelectionCard
                    key={exercise.id}
                    exercise={exercise}
                    isFavorite={favoriteExerciseIds.has(exercise.id)}
                    onSelect={handleSelectExercise}
                    onToggleFavorite={handleToggleFavorite}
                  />
                ))
              )}
            </div>
          </>
        ) : (
          <div className="space-y-4 mt-4">
            {!(selectedExercise.type === "timed" && showTimer) && (
              <div className="flex items-center justify-between mb-2">
                <Button type="button" variant="ghost" size="sm" onClick={() => handleDialogChange(false)}>
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>
                      {t("workout.distance")} ({units.distance})
                    </Label>
                    <Input
                      id="add-distance"
                      type="number"
                      inputMode="decimal"
                      enterKeyHint="next"
                      step="0.1"
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
                    <Input
                      id="add-duration"
                      type="number"
                      inputMode="numeric"
                      enterKeyHint="done"
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
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>{t("workout.timeSec")}</Label>
                      <Input
                        type="number"
                        inputMode="numeric"
                        enterKeyHint="done"
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
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>{t("workout.reps")}</Label>
                    <Input
                      id="add-reps"
                      type="number"
                      inputMode="numeric"
                      enterKeyHint={selectedExercise.type === "weighted" ? "next" : "done"}
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
                      <Input
                        id="add-weight"
                        type="number"
                        inputMode="decimal"
                        enterKeyHint="done"
                        step="0.5"
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
        )}
      </DialogContent>
    </Dialog>
  );
}
