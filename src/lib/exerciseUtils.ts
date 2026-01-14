import { Dumbbell, Activity, Timer, User, LucideIcon } from "lucide-react";

export type ExerciseType = "weighted" | "cardio" | "timed" | "bodyweight";

export function getExerciseIcon(type: ExerciseType): LucideIcon {
  switch (type) {
    case "weighted":
      return Dumbbell;
    case "cardio":
      return Activity;
    case "timed":
      return Timer;
    default:
      return User;
  }
}

export function getExerciseTypeLabel(type: ExerciseType, t: (key: string) => string): string {
  switch (type) {
    case "weighted":
      return t("progress.weighted");
    case "cardio":
      return t("progress.cardio");
    case "timed":
      return t("progress.timed");
    default:
      return t("progress.bodyweight");
  }
}
