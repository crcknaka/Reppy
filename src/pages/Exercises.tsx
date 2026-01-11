import { useState } from "react";
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
      toast.error("Введи название упражнения");
      return;
    }

    try {
      await createExercise.mutateAsync({ name: name.trim(), type });
      toast.success("Упражнение добавлено!");
      setName("");
      setType("weighted");
      setDialogOpen(false);
    } catch (error) {
      toast.error("Ошибка добавления упражнения");
    }
  };

  const handleDelete = (exerciseId: string) => {
    setExerciseToDelete(exerciseId);
  };

  const confirmDelete = async () => {
    if (!exerciseToDelete) return;
    try {
      await deleteExercise.mutateAsync(exerciseToDelete);
      toast.success("Упражнение удалено");
      setExerciseToDelete(null);
    } catch (error) {
      toast.error("Ошибка удаления");
    }
  };

  const handleExerciseClick = async (exerciseId: string) => {
    const today = format(new Date(), "yyyy-MM-dd");

    // Найти тренировку на сегодня
    let todayWorkout = workouts?.find((w) => w.date === today);

    // Если тренировки на сегодня нет, создать её
    if (!todayWorkout) {
      try {
        todayWorkout = await createWorkout.mutateAsync(today);
        toast.success("Тренировка создана!");
      } catch (error) {
        toast.error("Ошибка создания тренировки");
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
            Упражнения
          </h1>
          <p className="text-muted-foreground text-sm">Библиотека упражнений</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-lg">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Добавить</span>
            </Button>
          </DialogTrigger>
          <DialogContent className="border-border/50 shadow-2xl" aria-describedby="exercise-form-description">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold">Новое упражнение</DialogTitle>
              <p id="exercise-form-description" className="sr-only">
                Форма для создания нового упражнения
              </p>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label className="text-sm font-medium">Название</Label>
                <Input
                  placeholder="Например: Французский жим"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label className="text-sm font-medium">Тип</Label>
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
                        С отягощением (вес + повторения)
                      </div>
                    </SelectItem>
                    <SelectItem value="bodyweight">
                      <div className="flex items-center gap-2">
                        <User className="h-4 w-4" />
                        Собственный вес (только повторения)
                      </div>
                    </SelectItem>
                    <SelectItem value="cardio">
                      <div className="flex items-center gap-2">
                        <Activity className="h-4 w-4" />
                        Кардио (дистанция + время)
                      </div>
                    </SelectItem>
                    <SelectItem value="timed">
                      <div className="flex items-center gap-2">
                        <Timer className="h-4 w-4" />
                        На время (секунды)
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
                Добавить упражнение
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filter */}
      <div className="flex gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Поиск..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v as "all" | "bodyweight" | "weighted" | "cardio")}>
          <SelectTrigger className="w-[160px]">
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
                Мои упражнения
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
                            alt={exercise.name}
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
                        <p className="text-sm font-semibold text-foreground">{exercise.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {exercise.type === "weighted" ? "С отягощением" : exercise.type === "cardio" ? "Кардио" : exercise.type === "timed" ? "На время" : "Собственный вес"}
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
                Базовые упражнения
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
                            alt={exercise.name}
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
                        <p className="text-sm font-semibold text-foreground">{exercise.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {exercise.type === "weighted" ? "С отягощением" : exercise.type === "cardio" ? "Кардио" : exercise.type === "timed" ? "На время" : "Собственный вес"}
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
                  {searchQuery ? "Ничего не найдено" : "Нет упражнений"}
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
            <AlertDialogTitle>Удалить упражнение?</AlertDialogTitle>
            <AlertDialogDescription>
              Вы уверены, что хотите удалить это упражнение? Это действие нельзя будет отменить.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Отмена</AlertDialogCancel>
            <AlertDialogAction onClick={confirmDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Удалить
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
