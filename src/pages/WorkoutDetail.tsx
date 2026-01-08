import { useState, useEffect } from "react";
import { useParams, useNavigate, useLocation } from "react-router-dom";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ArrowLeft, Plus, Trash2, User, Dumbbell, MessageSquare, Save, Pencil, X, Activity, Timer, Camera, Loader2, ImageIcon, LayoutGrid } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
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
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useWorkouts, useAddSet, useDeleteSet, useUpdateSet, useUpdateWorkout } from "@/hooks/useWorkouts";
import { useExercises, Exercise } from "@/hooks/useExercises";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useAuth } from "@/contexts/AuthContext";
import { uploadWorkoutPhoto, deleteWorkoutPhoto, validateImageFile } from "@/lib/photoUpload";

export default function WorkoutDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { user } = useAuth();
  const { data: workouts } = useWorkouts();
  const { data: exercises } = useExercises();
  const addSet = useAddSet();
  const deleteSet = useDeleteSet();
  const updateSet = useUpdateSet();
  const updateWorkout = useUpdateWorkout();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [reps, setReps] = useState("");
  const [weight, setWeight] = useState("");
  const [distance, setDistance] = useState("");
  const [duration, setDuration] = useState("");
  const [exerciseTypeFilter, setExerciseTypeFilter] = useState<"all" | "bodyweight" | "weighted" | "cardio" | "timed">("all");
  const [notes, setNotes] = useState("");
  const [isEditingNotes, setIsEditingNotes] = useState(false);
  const [setToDelete, setSetToDelete] = useState<string | null>(null);
  const [editingSetId, setEditingSetId] = useState<string | null>(null);
  const [editReps, setEditReps] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editDistance, setEditDistance] = useState("");
  const [editDuration, setEditDuration] = useState("");
  const [openTooltipId, setOpenTooltipId] = useState<string | null>(null);
  const [isUploadingPhoto, setIsUploadingPhoto] = useState(false);
  const [photoToDelete, setPhotoToDelete] = useState(false);
  const [isPhotoFullscreen, setIsPhotoFullscreen] = useState(false);

  const workout = workouts?.find((w) => w.id === id);

  // Load workout notes when workout changes
  useEffect(() => {
    if (workout?.notes) {
      setNotes(workout.notes);
    } else {
      setNotes("");
    }
  }, [workout]);

  // Auto-open dialog with selected exercise if coming from Exercises page
  useEffect(() => {
    const state = location.state as { autoAddExerciseId?: string } | null;
    if (state?.autoAddExerciseId && exercises) {
      const exercise = exercises.find((e) => e.id === state.autoAddExerciseId);
      if (exercise) {
        setSelectedExercise(exercise);
        setDialogOpen(true);
        // Clear the state to prevent reopening on re-render
        navigate(location.pathname, { replace: true, state: {} });
      }
    }
  }, [location.state, exercises, navigate, location.pathname]);

  if (!workout) {
    return (
      <div className="flex items-center justify-center min-h-[50vh]">
        <p className="text-muted-foreground">Тренировка не найдена</p>
      </div>
    );
  }

  // Group sets by exercise
  const setsByExercise = workout.workout_sets?.reduce((acc, set) => {
    const exerciseId = set.exercise_id;
    if (!acc[exerciseId]) {
      acc[exerciseId] = {
        exercise: set.exercise,
        sets: [],
      };
    }
    acc[exerciseId].sets.push(set);
    return acc;
  }, {} as Record<string, { exercise: typeof workout.workout_sets[0]["exercise"]; sets: typeof workout.workout_sets }>) || {};

  const handleAddSet = async () => {
    if (!selectedExercise) {
      toast.error("Выбери упражнение");
      return;
    }

    // Валидация для кардио
    if (selectedExercise.type === "cardio") {
      if (!distance || !duration) {
        toast.error("Для кардио упражнений необходимо указать дистанцию и время");
        return;
      }
      const distanceNum = parseFloat(distance);
      const durationNum = parseInt(duration);
      if (isNaN(distanceNum) || distanceNum <= 0 || distanceNum > 500) {
        toast.error("Дистанция должна быть от 0 до 500 км");
        return;
      }
      if (isNaN(durationNum) || durationNum <= 0 || durationNum > 1440) {
        toast.error("Время должно быть от 0 до 1440 минут");
        return;
      }
    } else if (selectedExercise.type === "timed") {
      // Валидация для временных упражнений (например, планка)
      if (!duration) {
        toast.error("Введи время в секундах");
        return;
      }
      const durationNum = parseInt(duration);
      if (isNaN(durationNum) || durationNum <= 0 || durationNum > 3600) {
        toast.error("Время должно быть от 1 до 3600 секунд");
        return;
      }
    } else if (selectedExercise.type === "weighted") {
      // Валидация для упражнений с весом
      if (!reps || !weight) {
        toast.error("Для упражнений с отягощением необходимо указать повторения и вес");
        return;
      }
    } else if (selectedExercise.type === "bodyweight") {
      // Валидация для собственного веса
      if (!reps) {
        toast.error("Введи количество повторений");
        return;
      }
    }

    const existingSets = setsByExercise[selectedExercise.id]?.sets.length || 0;

    try {
      await addSet.mutateAsync({
        workoutId: workout.id,
        exerciseId: selectedExercise.id,
        setNumber: existingSets + 1,
        reps: reps ? parseInt(reps) : undefined,
        weight: weight ? parseFloat(weight) : undefined,
        distance_km: distance ? parseFloat(distance) : undefined,
        duration_minutes: selectedExercise.type === "cardio" && duration ? parseInt(duration) : undefined,
        plank_seconds: selectedExercise.type === "timed" && duration ? parseInt(duration) : undefined,
      });
      toast.success("Подход добавлен!");
      setReps("");
      setWeight("");
      setDistance("");
      setDuration("");
      setSelectedExercise(null);
      setDialogOpen(false);
    } catch (error) {
      toast.error("Ошибка добавления подхода");
    }
  };

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      // Сбросить форму при закрытии
      setSelectedExercise(null);
      setReps("");
      setWeight("");
      setDistance("");
      setDuration("");
    }
  };

  const handleDeleteSet = (setId: string) => {
    setSetToDelete(setId);
  };

  const confirmDeleteSet = async () => {
    if (!setToDelete) return;
    try {
      await deleteSet.mutateAsync(setToDelete);
      toast.success("Подход удален");
      setSetToDelete(null);
    } catch (error) {
      toast.error("Ошибка удаления");
    }
  };

  const handleEditSet = (set: any) => {
    setEditingSetId(set.id);
    setEditReps(set.reps?.toString() || "");
    setEditWeight(set.weight ? set.weight.toString() : "");
    setEditDistance(set.distance_km ? set.distance_km.toString() : "");
    // Для cardio используем duration_minutes, для timed - plank_seconds
    const durationValue = set.exercise?.type === "timed"
      ? set.plank_seconds
      : set.duration_minutes;
    setEditDuration(durationValue ? durationValue.toString() : "");
  };

  const handleSaveEdit = async () => {
    if (!editingSetId) return;

    // Найти редактируемый set чтобы определить тип упражнения
    const currentSet = workout?.workout_sets?.find(s => s.id === editingSetId);
    const exerciseType = currentSet?.exercise?.type;

    try {
      await updateSet.mutateAsync({
        setId: editingSetId,
        reps: editReps ? parseInt(editReps) : null,
        weight: editWeight ? parseFloat(editWeight) : null,
        distance_km: editDistance ? parseFloat(editDistance) : null,
        duration_minutes: exerciseType === "cardio" && editDuration ? parseInt(editDuration) : null,
        plank_seconds: exerciseType === "timed" && editDuration ? parseInt(editDuration) : null,
      });
      toast.success("Подход обновлен");
      setEditingSetId(null);
      setEditReps("");
      setEditWeight("");
      setEditDistance("");
      setEditDuration("");
    } catch (error) {
      toast.error("Ошибка обновления");
    }
  };

  const handleCancelEdit = () => {
    setEditingSetId(null);
    setEditReps("");
    setEditWeight("");
  };

  const handleSaveNotes = async () => {
    if (!workout) return;

    try {
      await updateWorkout.mutateAsync({
        workoutId: workout.id,
        notes: notes.trim(),
      });
      setIsEditingNotes(false);
      toast.success("Комментарий сохранен");
    } catch (error) {
      toast.error("Ошибка сохранения комментария");
    }
  };

  const handlePhotoUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file || !workout || !user) return;

    // Validate file
    const validation = validateImageFile(file);
    if (!validation.valid) {
      toast.error(validation.error);
      return;
    }

    setIsUploadingPhoto(true);
    try {
      const photoUrl = await uploadWorkoutPhoto(file, user.id, workout.id);
      await updateWorkout.mutateAsync({
        workoutId: workout.id,
        photo_url: photoUrl,
      });
      toast.success("Фото добавлено");
    } catch (error) {
      console.error("Photo upload error:", error);
      toast.error("Ошибка загрузки фото");
    } finally {
      setIsUploadingPhoto(false);
      // Reset input
      event.target.value = "";
    }
  };

  const handleDeletePhoto = async () => {
    if (!workout?.photo_url) return;

    try {
      await deleteWorkoutPhoto(workout.photo_url);
      await updateWorkout.mutateAsync({
        workoutId: workout.id,
        photo_url: null,
      });
      setPhotoToDelete(false);
      toast.success("Фото удалено");
    } catch (error) {
      console.error("Photo delete error:", error);
      toast.error("Ошибка удаления фото");
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1 space-y-1">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">
            {format(new Date(workout.date), "d MMMM yyyy", { locale: ru })}
          </h1>
          <p className="text-muted-foreground text-base">
            {format(new Date(workout.date), "EEEE", { locale: ru })}
          </p>
        </div>
      </div>

      <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
        <DialogTrigger asChild>
          <Button className="w-full gap-2 shadow-lg">
            <Plus className="h-4 w-4" />
            Добавить подход
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto" aria-describedby="exercise-dialog-description">
          <DialogHeader>
            <DialogTitle>
              {selectedExercise ? selectedExercise.name : "Выбери упражнение"}
            </DialogTitle>
            <p id="exercise-dialog-description" className="sr-only">
              {selectedExercise ? "Добавление подходов для упражнения" : "Выбор упражнения для тренировки"}
            </p>
          </DialogHeader>
          
          {!selectedExercise ? (
            <>
              {/* Filter */}
              <div className="mt-4">
                <Select value={exerciseTypeFilter} onValueChange={(v) => setExerciseTypeFilter(v as "all" | "bodyweight" | "weighted" | "cardio" | "timed")}>
                  <SelectTrigger className="w-full h-12">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">
                      <div className="flex items-center gap-2">
                        <LayoutGrid className="h-4 w-4" />
                        Все типы
                      </div>
                    </SelectItem>
                    <SelectItem value="bodyweight">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Собственный вес
                      </div>
                    </SelectItem>
                    <SelectItem value="weighted">
                      <div className="flex items-center gap-2">
                        <Dumbbell className="h-4 w-4" />
                        С отягощением
                      </div>
                    </SelectItem>
                    <SelectItem value="cardio">
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Кардио
                      </div>
                    </SelectItem>
                    <SelectItem value="timed">
                      <div className="flex items-center gap-2">
                        <Timer className="h-4 w-4" />
                        На время
                      </div>
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div className="grid grid-cols-2 gap-3 mt-4">
              {exercises?.filter((e) => exerciseTypeFilter === "all" || e.type === exerciseTypeFilter).map((exercise) => (
                <button
                  key={exercise.id}
                  onClick={() => setSelectedExercise(exercise)}
                  className="text-left group hover:scale-[1.02] transition-transform"
                >
                  <div className="border rounded-lg overflow-hidden hover:border-primary transition-colors">
                    {exercise.image_url ? (
                      <div className="w-full aspect-[4/3] overflow-hidden bg-muted">
                        <img 
                          src={exercise.image_url} 
                          alt={exercise.name}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                        />
                      </div>
                    ) : (
                      <div className="w-full aspect-[4/3] bg-muted flex items-center justify-center">
                        {exercise.type === "weighted" ? (
                          <Dumbbell className="h-12 w-12 text-muted-foreground" />
                        ) : exercise.type === "cardio" ? (
                          <Activity className="h-12 w-12 text-muted-foreground" />
                        ) : exercise.type === "timed" ? (
                          <Timer className="h-12 w-12 text-muted-foreground" />
                        ) : (
                          <User className="h-12 w-12 text-muted-foreground" />
                        )}
                      </div>
                    )}
                    <div className="p-3 bg-card">
                      <p className="font-medium text-foreground text-center">{exercise.name}</p>
                      <p className="text-xs text-muted-foreground text-center">
                        {exercise.type === "weighted" ? "С отягощением" :
                         exercise.type === "cardio" ? "Кардио" :
                         exercise.type === "timed" ? "На время" :
                         "Собственный вес"}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            </>
          ) : (
            <div className="space-y-4 mt-4">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setSelectedExercise(null)}
                className="mb-2"
              >
                <ArrowLeft className="h-4 w-4 mr-2" />
                Назад к упражнениям
              </Button>

              {selectedExercise.type === "cardio" ? (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Дистанция (км)</Label>
                    <Input
                      type="number"
                      step="0.1"
                      placeholder="5.5"
                      value={distance}
                      onChange={(e) => setDistance(e.target.value)}
                      autoFocus
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Время (мин)</Label>
                    <Input
                      type="number"
                      placeholder="30"
                      value={duration}
                      onChange={(e) => setDuration(e.target.value)}
                    />
                  </div>
                </div>
              ) : selectedExercise.type === "timed" ? (
                <div className="space-y-2">
                  <Label>Время (сек)</Label>
                  <Input
                    type="number"
                    placeholder="60"
                    value={duration}
                    onChange={(e) => setDuration(e.target.value)}
                    autoFocus
                  />
                </div>
              ) : (
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Повторения</Label>
                    <Input
                      type="number"
                      placeholder="8"
                      value={reps}
                      onChange={(e) => setReps(e.target.value)}
                      autoFocus
                    />
                  </div>
                  {selectedExercise.type === "weighted" && (
                    <div className="space-y-2">
                      <Label>Вес (кг)</Label>
                      <Input
                        type="number"
                        step="0.5"
                        placeholder="18"
                        value={weight}
                        onChange={(e) => setWeight(e.target.value)}
                      />
                    </div>
                  )}
                </div>
              )}

              <Button
                className="w-full"
                onClick={handleAddSet}
                disabled={addSet.isPending}
              >
                Добавить
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {Object.keys(setsByExercise).length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 bg-muted rounded-full mb-4">
              <Dumbbell className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">Нет упражнений</h3>
            <p className="text-muted-foreground text-sm">
              Добавь первый подход, чтобы начать тренировку
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(setsByExercise).map(([exerciseId, { exercise, sets }], index) => (
            <Card
              key={exerciseId}
              className="animate-fade-in"
              style={{ animationDelay: `${index * 50}ms` }}
            >
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between gap-3">
                  <CardTitle className="flex items-center gap-2 text-lg">
                    {exercise?.type === "weighted" ? (
                      <Dumbbell className="h-5 w-5 text-primary" />
                    ) : exercise?.type === "cardio" ? (
                      <Activity className="h-5 w-5 text-primary" />
                    ) : exercise?.type === "timed" ? (
                      <Timer className="h-5 w-5 text-primary" />
                    ) : (
                      <User className="h-5 w-5 text-primary" />
                    )}
                    {exercise?.name}
                  </CardTitle>
                  {exercise?.image_url ? (
                    <div className="w-24 h-24 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                      <img
                        src={exercise.image_url}
                        alt={exercise.name}
                        className="w-full h-full object-cover"
                      />
                    </div>
                  ) : (
                    <div className="w-24 h-24 rounded-lg bg-muted flex items-center justify-center flex-shrink-0">
                      {exercise?.type === "weighted" ? (
                        <Dumbbell className="h-12 w-12 text-muted-foreground" />
                      ) : exercise?.type === "cardio" ? (
                        <Activity className="h-12 w-12 text-muted-foreground" />
                      ) : exercise?.type === "timed" ? (
                        <Timer className="h-12 w-12 text-muted-foreground" />
                      ) : (
                        <User className="h-12 w-12 text-muted-foreground" />
                      )}
                    </div>
                  )}
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {/* Table Header */}
                <div className={cn(
                  "grid gap-2 px-3 py-2 text-xs font-semibold text-muted-foreground uppercase",
                  exercise?.type === "bodyweight" || exercise?.type === "timed"
                    ? "grid-cols-[60px_1fr_80px]"
                    : "grid-cols-[60px_1fr_1fr_80px]"
                )}>
                  <div className="text-center">Подход</div>
                  <div className="text-center">
                    {exercise?.type === "cardio" ? "Дистанция" :
                     exercise?.type === "timed" ? "Время (сек)" :
                     "Повторений"}
                  </div>
                  {exercise?.type !== "bodyweight" && exercise?.type !== "timed" && (
                    <div className="text-center">
                      {exercise?.type === "cardio" ? "Время (мин)" : "Вес"}
                    </div>
                  )}
                  <div></div>
                </div>

                {/* Table Rows */}
                <TooltipProvider>
                {sets.sort((a, b) => a.set_number - b.set_number).map((set) => (
                  <Tooltip
                    key={set.id}
                    open={openTooltipId === set.id}
                    onOpenChange={(open) => setOpenTooltipId(open ? set.id : null)}
                  >
                    <TooltipTrigger asChild>
                      <div
                        className={cn(
                          "grid gap-2 items-center p-3 bg-muted/50 rounded-lg cursor-pointer select-none",
                          exercise?.type === "bodyweight" || exercise?.type === "timed"
                            ? "grid-cols-[60px_1fr_80px]"
                            : "grid-cols-[60px_1fr_1fr_80px]"
                        )}
                        onClick={(e) => {
                          // Не открывать тултип если кликнули на кнопки редактирования/удаления
                          if ((e.target as HTMLElement).closest('button')) {
                            return;
                          }
                          setOpenTooltipId(openTooltipId === set.id ? null : set.id);
                        }}
                      >
                    <div className="text-center font-bold text-foreground">
                      {set.set_number}
                    </div>

                    {editingSetId === set.id ? (
                      <>
                        {exercise?.type === "cardio" ? (
                          <>
                            <Input
                              type="number"
                              step="0.1"
                              value={editDistance}
                              onChange={(e) => setEditDistance(e.target.value)}
                              className="h-8 text-center"
                              placeholder="км"
                              autoFocus
                            />
                            <Input
                              type="number"
                              value={editDuration}
                              onChange={(e) => setEditDuration(e.target.value)}
                              className="h-8 text-center"
                              placeholder="мин"
                            />
                          </>
                        ) : exercise?.type === "timed" ? (
                          <>
                            <Input
                              type="number"
                              value={editDuration}
                              onChange={(e) => setEditDuration(e.target.value)}
                              className="h-8 text-center"
                              placeholder="сек"
                              autoFocus
                            />
                          </>
                        ) : exercise?.type === "bodyweight" ? (
                          <>
                            <Input
                              type="number"
                              value={editReps}
                              onChange={(e) => setEditReps(e.target.value)}
                              className="h-8 text-center"
                              autoFocus
                            />
                          </>
                        ) : (
                          <>
                            <Input
                              type="number"
                              value={editReps}
                              onChange={(e) => setEditReps(e.target.value)}
                              className="h-8 text-center"
                              autoFocus
                            />
                            <Input
                              type="number"
                              step="0.5"
                              value={editWeight}
                              onChange={(e) => setEditWeight(e.target.value)}
                              className="h-8 text-center"
                              placeholder="—"
                            />
                          </>
                        )}
                        <div className="flex gap-1">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-green-600 hover:bg-green-100 dark:hover:bg-green-900/30 hover:text-green-700"
                            onClick={handleSaveEdit}
                          >
                            <Save className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-muted-foreground hover:bg-muted hover:text-foreground"
                            onClick={handleCancelEdit}
                          >
                            <X className="h-4 w-4" />
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        {exercise?.type === "cardio" ? (
                          <>
                            <div className="text-center font-semibold text-foreground">
                              {set.distance_km ? `${set.distance_km} км` : '—'}
                            </div>
                            <div className="text-center font-medium text-primary">
                              {set.duration_minutes ? `${set.duration_minutes} мин` : '—'}
                            </div>
                          </>
                        ) : exercise?.type === "timed" ? (
                          <>
                            <div className="text-center font-semibold text-primary">
                              {set.plank_seconds ? `${set.plank_seconds} сек` : '—'}
                            </div>
                          </>
                        ) : exercise?.type === "bodyweight" ? (
                          <>
                            <div className="text-center font-semibold text-foreground">
                              {set.reps || '—'}
                            </div>
                          </>
                        ) : (
                          <>
                            <div className="text-center font-semibold text-foreground">
                              {set.reps || '—'}
                            </div>
                            <div className="text-center font-medium text-primary">
                              {set.weight ? `${set.weight} кг` : '—'}
                            </div>
                          </>
                        )}
                        <div className="flex gap-1 justify-end">
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-blue-600 dark:text-blue-400 hover:bg-blue-100 dark:hover:bg-blue-900/30 hover:text-blue-700 dark:hover:text-blue-300"
                            onClick={() => handleEditSet(set)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="h-8 w-8 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-900/30 hover:text-red-700 dark:hover:text-red-300"
                            onClick={() => handleDeleteSet(set.id)}
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </>
                    )}
                      </div>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Время: {format(new Date(set.created_at), "HH:mm", { locale: ru })}</p>
                    </TooltipContent>
                  </Tooltip>
                ))}
                </TooltipProvider>

                {/* Add Next Set Button */}
                <Button
                  variant="outline"
                  className="w-full mt-2 gap-2"
                  onClick={() => {
                    // Найти полное упражнение из списка exercises
                    const fullExercise = exercises?.find(e => e.id === exerciseId);
                    if (fullExercise) {
                      setSelectedExercise(fullExercise);
                      setDialogOpen(true);
                    }
                  }}
                >
                  <Plus className="h-4 w-4" />
                  Добавить подход
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Notes Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <MessageSquare className="h-5 w-5 text-primary" />
              Комментарий
            </CardTitle>
            {!isEditingNotes && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setIsEditingNotes(true)}
              >
                {notes ? "Редактировать" : "Добавить"}
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {isEditingNotes ? (
            <div className="space-y-3">
              <Textarea
                placeholder="Как прошла тренировка? Какие ощущения?"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                className="resize-none"
              />
              <div className="flex gap-2">
                <Button
                  onClick={handleSaveNotes}
                  disabled={updateWorkout.isPending}
                  className="flex-1"
                >
                  <Save className="h-4 w-4 mr-2" />
                  Сохранить
                </Button>
                <Button
                  variant="outline"
                  onClick={() => {
                    setNotes(workout?.notes || "");
                    setIsEditingNotes(false);
                  }}
                  disabled={updateWorkout.isPending}
                >
                  Отмена
                </Button>
              </div>
            </div>
          ) : (
            <div className="text-muted-foreground whitespace-pre-wrap">
              {notes || "Пока пусто"}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Photo Card */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <ImageIcon className="h-5 w-5 text-primary" />
              Фото
            </CardTitle>
            {workout?.photo_url && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setPhotoToDelete(true)}
                className="text-destructive hover:text-destructive"
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {workout?.photo_url ? (
            <div className="relative">
              <img
                src={workout.photo_url}
                alt="Фото тренировки"
                className="w-full rounded-lg object-cover max-h-96 cursor-pointer hover:opacity-90 transition-opacity"
                onClick={() => setIsPhotoFullscreen(true)}
              />
            </div>
          ) : (
            <label className="flex flex-col items-center justify-center gap-3 p-8 border-2 border-dashed border-muted-foreground/25 rounded-lg cursor-pointer hover:border-primary/50 transition-colors">
              {isUploadingPhoto ? (
                <>
                  <Loader2 className="h-10 w-10 text-primary animate-spin" />
                  <span className="text-sm text-muted-foreground">Загрузка...</span>
                </>
              ) : (
                <>
                  <Camera className="h-10 w-10 text-muted-foreground" />
                  <span className="text-sm text-muted-foreground">Нажмите чтобы добавить фото</span>
                  <span className="text-xs text-muted-foreground/70">JPG, PNG или WebP до 20 MB</span>
                </>
              )}
              <input
                type="file"
                accept="image/jpeg,image/jpg,image/png,image/webp"
                onChange={handlePhotoUpload}
                disabled={isUploadingPhoto}
                className="hidden"
              />
            </label>
          )}
        </CardContent>
      </Card>

      {/* Delete Photo Confirmation Dialog */}
      <AlertDialog open={photoToDelete} onOpenChange={setPhotoToDelete}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить фото?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить это фото? Это действие нельзя будет отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={handleDeletePhoto} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Fullscreen Photo Viewer */}
      {isPhotoFullscreen && workout?.photo_url && (
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
            src={workout.photo_url}
            alt="Фото тренировки"
            className="max-w-full max-h-full object-contain rounded-lg"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {/* Delete Set Confirmation Dialog */}
      <AlertDialog open={!!setToDelete} onOpenChange={(open) => !open && setSetToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Удалить подход?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить этот подход? Это действие нельзя будет отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDeleteSet} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
