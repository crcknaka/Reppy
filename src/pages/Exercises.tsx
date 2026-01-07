import { useState } from "react";
import { Plus, User, Dumbbell, Trash2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useExercises, useCreateExercise, useDeleteExercise } from "@/hooks/useExercises";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

export default function Exercises() {
  const { data: exercises, isLoading } = useExercises();
  const createExercise = useCreateExercise();
  const deleteExercise = useDeleteExercise();

  const [dialogOpen, setDialogOpen] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"bodyweight" | "weighted">("weighted");
  const [searchQuery, setSearchQuery] = useState("");

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

  const handleDelete = async (exerciseId: string) => {
    try {
      await deleteExercise.mutateAsync(exerciseId);
      toast.success("Упражнение удалено");
    } catch (error) {
      toast.error("Ошибка удаления");
    }
  };

  const filteredExercises = exercises?.filter((e) =>
    e.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const presetExercises = filteredExercises?.filter((e) => e.is_preset);
  const customExercises = filteredExercises?.filter((e) => !e.is_preset);

  // Debug: вывести упражнения с их image_url
  if (presetExercises && presetExercises.length > 0) {
    console.log('Preset exercises:', presetExercises.map(e => ({
      name: e.name,
      image_url: e.image_url,
      has_image: !!e.image_url
    })));
  }

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Упражнения</h1>
          <p className="text-muted-foreground">Библиотека упражнений</p>
        </div>
        <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
          <DialogTrigger asChild>
            <Button className="gap-2 shadow-lg">
              <Plus className="h-4 w-4" />
              <span className="hidden sm:inline">Добавить</span>
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Новое упражнение</DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div className="space-y-2">
                <Label>Название</Label>
                <Input
                  placeholder="Например: Французский жим"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label>Тип</Label>
                <Select
                  value={type}
                  onValueChange={(v) => setType(v as "bodyweight" | "weighted")}
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

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Поиск упражнений..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="pl-10"
        />
      </div>

      {isLoading ? (
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-5 bg-muted rounded w-1/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Custom exercises */}
          {customExercises && customExercises.length > 0 && (
            <div className="space-y-3">
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Мои упражнения
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {customExercises.map((exercise, index) => (
                  <Card
                    key={exercise.id}
                    className="animate-fade-in relative"
                    style={{ animationDelay: `${index * 30}ms` }}
                  >
                    <CardContent className="p-3 flex flex-col gap-3">
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
                            <Dumbbell className="h-12 w-12 text-primary" />
                          ) : (
                            <User className="h-12 w-12 text-primary" />
                          )}
                        </div>
                      )}
                      <div className="text-center">
                        <p className="font-medium text-foreground">{exercise.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {exercise.type === "weighted" ? "С отягощением" : "Собственный вес"}
                        </p>
                      </div>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="absolute top-2 right-2 h-8 w-8 bg-background/80 backdrop-blur-sm text-muted-foreground hover:text-destructive hover:bg-background"
                        onClick={() => handleDelete(exercise.id)}
                      >
                        <Trash2 className="h-4 w-4" />
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
              <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
                Базовые упражнения
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {presetExercises.map((exercise, index) => (
                  <Card
                    key={exercise.id}
                    className="animate-fade-in"
                    style={{ animationDelay: `${(customExercises?.length || 0) * 30 + index * 30}ms` }}
                  >
                    <CardContent className="p-3 flex flex-col gap-3">
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
                            <Dumbbell className="h-12 w-12 text-muted-foreground" />
                          ) : (
                            <User className="h-12 w-12 text-muted-foreground" />
                          )}
                        </div>
                      )}
                      <div className="text-center">
                        <p className="font-medium text-foreground">{exercise.name}</p>
                        <p className="text-xs text-muted-foreground">
                          {exercise.type === "weighted" ? "С отягощением" : "Собственный вес"}
                        </p>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          )}

          {filteredExercises?.length === 0 && (
            <div className="text-center py-12 text-muted-foreground">
              {searchQuery ? "Ничего не найдено" : "Нет упражнений"}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
