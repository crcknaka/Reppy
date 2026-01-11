import { useState } from "react";
import { useTranslation } from "react-i18next";
import { getExerciseName } from "@/lib/i18n";
import { Plus, User, Dumbbell, Trash2, Search, Activity, Timer, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
import { useExercises, useCreateExercise, useDeleteExercise } from "@/hooks/useExercises";
import { useWorkouts, useCreateWorkout } from "@/hooks/useWorkouts";
import { useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function Exercises() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { data: exercises, isLoading } = useExercises();
  const { data: workouts } = useWorkouts();
  const createExercise = useCreateExercise();
  const deleteExercise = useDeleteExercise();
  const createWorkout = useCreateWorkout();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"bodyweight" | "weighted" | "cardio" | "timed">("weighted");
  const [searchQuery, setSearchQuery] = useState("");
  const [typeFilter, setTypeFilter] = useState<"all" | "bodyweight" | "weighted" | "cardio" | "timed">("all");
  const [exerciseToDelete, setExerciseToDelete] = useState<string | null>(null);

  const handleCreate = async () => {
    if (!name.trim()) {
      toast.error(t("exercises.enterExerciseName"));
      return;
    }

    try {
      await createExercise.mutateAsync({ name: name.trim(), type });
      toast.success(t("exercises.exerciseAdded"));
      setName("");
      setType("weighted");
      setDialogOpen(false);
    } catch (error) {
      toast.error(t("exercises.addError"));
    }
  };

  const handleDelete = (exerciseId: string) => {
    setExerciseToDelete(exerciseId);
  };

  const confirmDelete = async () => {
    if (!exerciseToDelete) return;
    try {
      await deleteExercise.mutateAsync(exerciseToDelete);
      toast.success(t("exercises.exerciseDeleted"));
      setExerciseToDelete(null);
    } catch (error) {
      toast.error(t("exercises.deleteError"));
    }
  };

  const handleExerciseClick = async (exerciseId: string) => {
    const today = format(new Date(), "yyyy-MM-dd");

    // Найти тренировку на сегодня
    let todayWorkout = workouts?.find((w) => w.date === today);

    // If no workout for today, create one
    if (!todayWorkout) {
      try {
        todayWorkout = await createWorkout.mutateAsync(today);
        toast.success(t("workouts.workoutCreated"));
      } catch (error) {
        toast.error(t("workouts.createError"));
        return;
      }
    }

    // Перейти на страницу тренировки с автоматическим открытием диалога для этого упражнения
    navigate(`/workout/${todayWorkout.id}`, { state: { autoAddExerciseId: exerciseId } });
  };

  const filteredExercises = exercises?.filter((e) => {
    const matchesSearch = e.name.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesType = typeFilter === "all" || e.type === typeFilter;
    return matchesSearch && matchesType;
  });

  const presetExercises = filteredExercises?.filter((e) => e.is_preset);
  const customExercises = filteredExercises?.filter((e) => !e.is_preset);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Modern Header */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-2xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
            {t("exercises.title")}
          </h1>
          <p className="text-muted-foreground text-sm">{t("exercises.subtitle")}</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-lg">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">{t("common.add")}</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="border-border/50 shadow-2xl" aria-describedby="exercise-form-description">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">{t("exercises.newExercise")}</DialogTitle>
              <p id="exercise-form-description" className="sr-only">
                {t("exercises.newExercise")}
              </p>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t("exercises.exerciseName")}</Label>
                <Input
                  placeholder={t("exercises.exerciseNamePlaceholder")}
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">{t("exercises.exerciseType")}</Label>
                <Select
                  value={type}
                  onValueChange={(v) => setType(v as "bodyweight" | "weighted" | "cardio")}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="weighted">
                      <div className="flex items-center gap-2">
                        <Dumbbell className="h-4 w-4" />
                        {t("exercises.weighted")}
                      </div>
                    </SelectItem>
                    <SelectItem value="bodyweight">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        {t("exercises.bodyweight")}
                      </div>
                    </SelectItem>
                    <SelectItem value="cardio">
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        {t("exercises.cardio")}
                      </div>
                    </SelectItem>
                    <SelectItem value="timed">
                      <div className="flex items-center gap-2">
                        <Timer className="h-4 w-4" />
                        {t("exercises.timed")}
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <Button
                className="w-full"
                onClick={handleCreate}
                disabled={createExercise.isPending}
              >
                {t("exercises.addExercise")}
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-2 items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
          <Input
            placeholder={t("common.search")}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as "all" | "bodyweight" | "weighted" | "cardio")}>
          <SelectTrigger className="h-9 w-auto min-w-[120px] text-xs px-3">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">
              <div className="flex items-center gap-2">
                <LayoutGrid className="h-3.5 w-3.5" />
                {t("progress.allTypes")}
              </div>
            </SelectItem>
            <SelectItem value="bodyweight">
              <div className="flex items-center gap-2">
                <User className="h-3.5 w-3.5" />
                {t("progress.bodyweight")}
              </div>
            </SelectItem>
            <SelectItem value="weighted">
              <div className="flex items-center gap-2">
                <Dumbbell className="h-3.5 w-3.5" />
                {t("progress.weighted")}
              </div>
            </SelectItem>
            <SelectItem value="cardio">
              <div className="flex items-center gap-2">
                <Activity className="h-3.5 w-3.5" />
                {t("progress.cardio")}
              </div>
            </SelectItem>
            <SelectItem value="timed">
              <div className="flex items-center gap-2">
                <Timer className="h-3.5 w-3.5" />
                {t("progress.timed")}
              </div>
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <div className="grid grid-cols-2 gap-3">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-3">
                <div className="aspect-[4/3] bg-muted rounded-lg mb-2" />
                <div className="h-3 bg-muted rounded w-2/3 mx-auto" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Custom exercises */}
          {customExercises && customExercises.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <div className="h-4 w-0.5 bg-primary rounded-full"></div>
                {t("exercises.customExercises")}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {customExercises.map((exercise, index) => (
                  <Card
                    key={exercise.id}
                    className="animate-fade-in relative group hover:shadow-lg transition-all duration-200 overflow-hidden cursor-pointer"
                    style={{ animationDelay: `${index * 30}ms` }}
                    onClick={() => handleExerciseClick(exercise.id)}
                  >
                    <CardContent className="p-3 flex flex-col gap-2">
                      {exercise.image_url ? (
                        <div className="w-full aspect-[4/3] rounded-lg overflow-hidden bg-primary/10">
                          <img
                            src={exercise.image_url}
                            alt={getExerciseName(exercise.name, exercise.name_translations)}
                            className="w-full h-full object-cover"
                          />
                        </div>
                      ) : (
                        <div className="w-full aspect-[4/3] rounded-lg bg-primary/10 flex items-center justify-center">
                          {exercise.type === "weighted" ? (
                            <Dumbbell className="h-10 w-10 text-primary" />
                          ) : exercise.type === "cardio" ? (
                            <Activity className="h-10 w-10 text-primary" />
                          ) : exercise.type === "timed" ? (
                            <Timer className="h-10 w-10 text-primary" />
                          ) : (
                            <User className="h-10 w-10 text-primary" />
                          )}
                        </div>
                      )}
                      <div className="text-center">
                        <p className="text-sm font-semibold text-foreground">{getExerciseName(exercise.name, exercise.name_translations)}</p>
                        <p className="text-xs text-muted-foreground">
                          {exercise.type === "weighted" ? t("progress.weighted") : exercise.type === "cardio" ? t("progress.cardio") : exercise.type === "timed" ? t("progress.timed") : t("progress.bodyweight")}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-7 w-7 bg-background/90 backdrop-blur-sm text-muted-foreground hover:text-foreground rounded-lg opacity-0 group-hover:opacity-100 transition-opacity"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleDelete(exercise.id);
                        }}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {/* Preset exercises */}
          {presetExercises && presetExercises.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                <div className="h-4 w-0.5 bg-primary rounded-full"></div>
                {t("exercises.baseExercises")}
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {presetExercises.map((exercise, index) => (
                  <Card
                    key={exercise.id}
                    className="animate-fade-in group hover:shadow-lg transition-all duration-200 cursor-pointer"
                    style={{ animationDelay: `${(customExercises?.length || 0) * 30 + index * 30}ms` }}
                    onClick={() => handleExerciseClick(exercise.id)}
                  >
                    <CardContent className="p-3 flex flex-col gap-2">
                      {exercise.image_url ? (
                        <div className="w-full aspect-[4/3] rounded-lg overflow-hidden bg-muted">
                          <img
                            src={exercise.image_url}
                            alt={getExerciseName(exercise.name, exercise.name_translations)}
                            className="w-full h-full object-cover"
                            onError={(e) => {
                              console.error(`Failed to load image for ${exercise.name}:`, exercise.image_url);
                              e.currentTarget.style.display = 'none';
                            }}
                          />
                        </div>
                      ) : (
                        <div className="w-full aspect-[4/3] rounded-lg bg-muted flex items-center justify-center">
                          {exercise.type === "weighted" ? (
                            <Dumbbell className="h-10 w-10 text-muted-foreground" />
                          ) : exercise.type === "cardio" ? (
                            <Activity className="h-10 w-10 text-muted-foreground" />
                          ) : exercise.type === "timed" ? (
                            <Timer className="h-10 w-10 text-muted-foreground" />
                          ) : (
                            <User className="h-10 w-10 text-muted-foreground" />
                          )}
                        </div>
                      )}
                      <div className="text-center">
                        <p className="text-sm font-semibold text-foreground">{getExerciseName(exercise.name, exercise.name_translations)}</p>
                        <p className="text-xs text-muted-foreground">
                          {exercise.type === "weighted" ? t("progress.weighted") : exercise.type === "cardio" ? t("progress.cardio") : exercise.type === "timed" ? t("progress.timed") : t("progress.bodyweight")}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {filteredExercises?.length === 0 && (
            <Card className="border-dashed">
              <CardContent className="flex flex-col items-center justify-center py-12 text-center">
                <div className="p-4 bg-muted rounded-full mb-4">
                  <Dumbbell className="h-8 w-8 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  {searchQuery ? t("exercises.noExercisesFound") : t("exercises.noExercises")}
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={!!exerciseToDelete} onOpenChange={(open) => !open && setExerciseToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("exercises.deleteExerciseTitle")}</AlertDialogTitle>
            <AlertDialogDescription>
              {t("exercises.deleteExerciseDescription")}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("common.cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              {t("common.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
