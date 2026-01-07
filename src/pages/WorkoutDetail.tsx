import { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { ArrowLeft, Plus, Trash2, User, Dumbbell, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useWorkouts, useAddSet, useDeleteSet } from "@/hooks/useWorkouts";
import { useExercises, Exercise } from "@/hooks/useExercises";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";
import { calculateTotalVolume, formatVolume } from "@/lib/volumeUtils";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function WorkoutDetail() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const { data: workouts } = useWorkouts();
  const { data: exercises } = useExercises();
  const addSet = useAddSet();
  const deleteSet = useDeleteSet();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [selectedExercise, setSelectedExercise] = useState<Exercise | null>(null);
  const [reps, setReps] = useState("");
  const [weight, setWeight] = useState("");
  const [currentWeight, setCurrentWeight] = useState<number | null>(null);

  const workout = workouts?.find((w) => w.id === id);

  // Load user's current body weight
  useEffect(() => {
    if (!user) return;

    const loadCurrentWeight = async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("current_weight")
        .eq("user_id", user.id)
        .single();

      if (error) {
        console.error("Error loading current weight:", error);
        return;
      }

      setCurrentWeight(data?.current_weight || null);
    };

    loadCurrentWeight();
  }, [user]);

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
    if (!selectedExercise || !reps) {
      toast.error("Введи количество повторений");
      return;
    }

    const existingSets = setsByExercise[selectedExercise.id]?.sets.length || 0;

    try {
      await addSet.mutateAsync({
        workoutId: workout.id,
        exerciseId: selectedExercise.id,
        setNumber: existingSets + 1,
        reps: parseInt(reps),
        weight: weight ? parseFloat(weight) : undefined,
      });
      toast.success("Подход добавлен!");
      setReps("");
      setWeight("");
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
    }
  };

  const handleDeleteSet = async (setId: string) => {
    try {
      await deleteSet.mutateAsync(setId);
      toast.success("Подход удален");
    } catch (error) {
      toast.error("Ошибка удаления");
    }
  };

  // Calculate total volume
  const totalVolume = workout.workout_sets 
    ? calculateTotalVolume(workout.workout_sets, currentWeight)
    : 0;

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center gap-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/")}>
          <ArrowLeft className="h-5 w-5" />
        </Button>
        <div className="flex-1">
          <h1 className="text-2xl font-bold text-foreground">
            {format(new Date(workout.date), "d MMMM yyyy", { locale: ru })}
          </h1>
          <p className="text-muted-foreground">
            {format(new Date(workout.date), "EEEE", { locale: ru })}
          </p>
        </div>
        {totalVolume > 0 && (
          <div className="text-right">
            <div className="text-sm text-muted-foreground flex items-center gap-1">
              <BarChart3 className="h-4 w-4" />
              <span>Объём</span>
            </div>
            <div className="text-lg font-bold text-primary">
              {formatVolume(totalVolume, false)}
            </div>
          </div>
        )}
      </div>

      <Dialog open={dialogOpen} onOpenChange={handleDialogChange}>
        <DialogTrigger asChild>
          <Button className="w-full gap-2 shadow-lg">
            <Plus className="h-4 w-4" />
            Добавить подход
          </Button>
        </DialogTrigger>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedExercise ? selectedExercise.name : "Выбери упражнение"}
            </DialogTitle>
          </DialogHeader>
          
          {!selectedExercise ? (
            <div className="grid grid-cols-2 gap-3 mt-4">
              {exercises?.map((exercise) => (
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
                        ) : (
                          <User className="h-12 w-12 text-muted-foreground" />
                        )}
                      </div>
                    )}
                    <div className="p-3 bg-card">
                      <p className="font-medium text-foreground text-center">{exercise.name}</p>
                      <p className="text-xs text-muted-foreground text-center">
                        {exercise.type === "weighted" ? "С отягощением" : "Собственный вес"}
                      </p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
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

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label>Повторения</Label>
                  <Input
                    type="number"
                    placeholder="12"
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
                      placeholder="50"
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                    />
                  </div>
                )}
              </div>

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
                <CardTitle className="flex items-center gap-2 text-lg">
                  {exercise?.type === "weighted" ? (
                    <Dumbbell className="h-5 w-5 text-primary" />
                  ) : (
                    <User className="h-5 w-5 text-primary" />
                  )}
                  {exercise?.name}
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {sets.sort((a, b) => a.set_number - b.set_number).map((set) => (
                  <div
                    key={set.id}
                    className="flex items-center justify-between p-3 bg-muted/50 rounded-lg"
                  >
                    <div className="flex items-center gap-4">
                      <span className="text-sm font-medium text-muted-foreground w-16">
                        Подход {set.set_number}
                      </span>
                      <span className="font-semibold text-foreground">
                        {set.reps} повторений
                      </span>
                      {set.weight && (
                        <span className="text-primary font-medium">
                          {set.weight} кг
                        </span>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-muted-foreground hover:text-destructive"
                      onClick={() => handleDeleteSet(set.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
