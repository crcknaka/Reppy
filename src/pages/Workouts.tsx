import { useState } from "react";
import { format } from "date-fns";
import { ru } from "date-fns/locale";
import { Plus, Calendar as CalendarIcon, Trash2, ChevronRight, MessageSquare } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar } from "@/components/ui/calendar";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useWorkouts, useCreateWorkout, useDeleteWorkout } from "@/hooks/useWorkouts";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { pluralizeWithCount } from "@/lib/pluralize";

export default function Workouts() {
  const navigate = useNavigate();
  const { data: workouts, isLoading } = useWorkouts();
  const createWorkout = useCreateWorkout();
  const deleteWorkout = useDeleteWorkout();
  const [date, setDate] = useState<Date | undefined>(new Date());
  const [open, setOpen] = useState(false);

  const handleCreateWorkout = async () => {
    if (!date) return;
    
    try {
      const workout = await createWorkout.mutateAsync(
        format(date, "yyyy-MM-dd")
      );
      toast.success("Тренировка создана!");
      setOpen(false);
      navigate(`/workout/${workout.id}`);
    } catch (error) {
      toast.error("Ошибка создания тренировки");
    }
  };

  const handleDeleteWorkout = async (workoutId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    try {
      await deleteWorkout.mutateAsync(workoutId);
      toast.success("Тренировка удалена");
    } catch (error) {
      toast.error("Ошибка удаления");
    }
  };

  const getTotalSets = (workout: typeof workouts extends (infer T)[] | undefined ? T : never) => {
    return workout?.workout_sets?.length || 0;
  };

  const getUniqueExercises = (workout: typeof workouts extends (infer T)[] | undefined ? T : never) => {
    const exerciseIds = new Set(workout?.workout_sets?.map(s => s.exercise_id));
    return exerciseIds.size;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h1 className="text-3xl font-bold bg-gradient-to-r from-foreground to-primary bg-clip-text text-transparent">Тренировки</h1>
          <p className="text-muted-foreground text-base">История твоих тренировок</p>
        </div>
        <Popover open={open} onOpenChange={setOpen}>
          <PopoverTrigger asChild>
            <Button className="gap-2 shadow-lg">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Новая тренировка</span>
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-auto p-0" align="end">
            <Calendar
              mode="single"
              selected={date}
              onSelect={setDate}
              locale={ru}
              className="rounded-md border-0"
            />
            <div className="p-3 border-t border-border">
              <Button 
                className="w-full" 
                onClick={handleCreateWorkout}
                disabled={createWorkout.isPending}
              >
                Создать на {date && format(date, "d MMM", { locale: ru })}
              </Button>
            </div>
          </PopoverContent>
        </Popover>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {[1, 2, 3].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-6 bg-muted rounded w-1/3 mb-2" />
                <div className="h-4 bg-muted rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : workouts?.length === 0 ? (
        <Card className="border-dashed">
          <CardContent className="flex flex-col items-center justify-center py-12 text-center">
            <div className="p-4 bg-muted rounded-full mb-4">
              <CalendarIcon className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">Нет тренировок</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Создай первую тренировку, чтобы начать отслеживать прогресс
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {workouts?.map((workout, index) => (
            <Card
              key={workout.id}
              className={cn(
                "cursor-pointer transition-all duration-200 hover:shadow-md hover:border-primary/30",
                "animate-fade-in"
              )}
              style={{ animationDelay: `${index * 50}ms` }}
              onClick={() => navigate(`/workout/${workout.id}`)}
            >
              <CardContent className="p-4 flex items-center justify-between">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-1">
                    <span className="font-semibold text-foreground">
                      {format(new Date(workout.date), "d MMMM yyyy", { locale: ru })}
                    </span>
                    <span className="text-xs px-2 py-0.5 bg-primary/10 text-primary rounded-full font-medium">
                      {format(new Date(workout.date), "EEEE", { locale: ru })}
                    </span>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    {pluralizeWithCount(getUniqueExercises(workout), "упражнение", "упражнения", "упражнений")} · {pluralizeWithCount(getTotalSets(workout), "подход", "подхода", "подходов")}
                  </p>
                  {workout.notes && (
                    <div className="flex items-start gap-2 mt-2 text-sm text-muted-foreground">
                      <MessageSquare className="h-4 w-4 flex-shrink-0 mt-0.5" />
                      <p className="line-clamp-2">{workout.notes}</p>
                    </div>
                  )}
                </div>
                <div className="flex items-center gap-2 ml-4">
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8 text-muted-foreground hover:text-destructive"
                    onClick={(e) => handleDeleteWorkout(workout.id, e)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                  <ChevronRight className="h-5 w-5 text-muted-foreground" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
