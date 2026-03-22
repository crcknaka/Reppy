import { memo, useMemo, useState } from "react";
import { Activity, Dumbbell, LayoutGrid, Search, Star, Timer, User } from "lucide-react";
import { useTranslation } from "react-i18next";
import { toast } from "sonner";

import { getExerciseName } from "@/lib/i18n";
import { getExerciseIcon, getExerciseTypeLabel, type ExerciseType } from "@/lib/exerciseUtils";
import { cn } from "@/lib/utils";
import type { Exercise } from "@/hooks/useExercises";
import type { ExerciseSelectionBaseProps } from "@/components/setDialogTypes";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";

type ExerciseTypeFilter = "all" | "bodyweight" | "weighted" | "cardio" | "timed";

interface AddExerciseDialogProps extends ExerciseSelectionBaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelectExercise: (exercise: Exercise) => void;
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
          <p className="font-medium text-foreground text-center">{getExerciseName(exercise.name, exercise.name_translations)}</p>
          <p className="text-xs text-muted-foreground text-center">{getExerciseTypeLabel(exercise.type as ExerciseType, t)}</p>
        </div>
      </div>
    </div>
  );
});

export function AddExerciseDialog({
  open,
  onOpenChange,
  exercises,
  favoriteExerciseIds,
  onToggleFavorite,
  onSelectExercise,
}: AddExerciseDialogProps) {
  const { t } = useTranslation();
  const [exerciseTypeFilter, setExerciseTypeFilter] = useState<ExerciseTypeFilter>("all");
  const [exerciseSearchQuery, setExerciseSearchQuery] = useState("");
  const [exerciseTab, setExerciseTab] = useState<"all" | "favorites">("all");

  const handleDialogChange = (nextOpen: boolean) => {
    onOpenChange(nextOpen);
    if (!nextOpen) {
      setExerciseTypeFilter("all");
      setExerciseSearchQuery("");
      setExerciseTab("all");
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

  const handleToggleFavorite = async (exerciseId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const isFavorite = favoriteExerciseIds.has(exerciseId);

    try {
      await onToggleFavorite(exerciseId, isFavorite);
      toast.success(isFavorite ? t("workout.removedFromFavorites") : t("workout.addedToFavorites"));
    } catch {
      toast.error(t("workout.favoriteError"));
    }
  };

  const handleSelectExercise = (exercise: Exercise) => {
    onSelectExercise(exercise);
    handleDialogChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="add-exercise-dialog-description">
        <DialogHeader>
          <DialogTitle>{t("workout.selectExercise")}</DialogTitle>
          <p id="add-exercise-dialog-description" className="sr-only">
            {t("workout.selectingExercise")}
          </p>
        </DialogHeader>

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
      </DialogContent>
    </Dialog>
  );
}
