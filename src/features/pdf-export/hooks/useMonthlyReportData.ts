import type { Workout, WorkoutSet } from "@/hooks/useWorkouts";
import { getExerciseName } from "@/lib/i18n";
import type { ExerciseRowData } from "../components/PdfWorkoutTable";

export interface MonthlyStats {
  workoutCount: number;
  totalReps: number;
  totalSets: number;
  maxWeight: number;
  totalVolume: number;
  totalDistance: number;
  totalDurationMinutes: number;
  totalPlankSeconds: number;
}

export interface DailyWorkoutData {
  date: string;
  label: string;
  reps: number;
  sets: number;
  volume: number;
  exercises: DailyExerciseData[];
}

export interface DailyExerciseData {
  name: string;
  type: "bodyweight" | "weighted" | "cardio" | "timed";
  sets: number;
  reps: number;
  maxWeight: number | null;
  distance: number | null;
  duration: number | null;
  plankSeconds: number | null;
}

export interface MonthlyReportData {
  stats: MonthlyStats;
  exerciseBreakdown: ExerciseRowData[];
  dailyData: DailyWorkoutData[];
}

export function calculateMonthlyReportData(
  workouts: Workout[],
  language: string
): MonthlyReportData {
  // Initialize stats
  let totalReps = 0;
  let totalSets = 0;
  let maxWeight = 0;
  let totalVolume = 0;
  let totalDistance = 0;
  let totalDurationMinutes = 0;
  let totalPlankSeconds = 0;

  // Track exercises for breakdown
  const exerciseMap = new Map<
    string,
    {
      name: string;
      type: "bodyweight" | "weighted" | "cardio" | "timed";
      sets: number;
      reps: number;
      maxWeight: number | null;
      volume: number;
    }
  >();

  // Track daily data for chart and breakdown
  const dailyMap = new Map<
    string,
    {
      reps: number;
      sets: number;
      volume: number;
      exercises: Map<string, DailyExerciseData>;
    }
  >();

  // Process all workouts
  workouts.forEach((workout) => {
    const sets = workout.workout_sets || [];

    sets.forEach((set: WorkoutSet) => {
      totalSets++;

      // Get exercise info
      const exercise = set.exercise;
      if (!exercise) return;

      const exerciseKey = exercise.id;
      const exerciseName = getExerciseName(
        exercise.name,
        exercise.name_translations
      );

      // Initialize exercise in map if needed
      if (!exerciseMap.has(exerciseKey)) {
        exerciseMap.set(exerciseKey, {
          name: exerciseName,
          type: exercise.type,
          sets: 0,
          reps: 0,
          maxWeight: null,
          volume: 0,
        });
      }
      const exerciseData = exerciseMap.get(exerciseKey)!;
      exerciseData.sets++;

      // Initialize daily data if needed
      if (!dailyMap.has(workout.date)) {
        dailyMap.set(workout.date, {
          reps: 0,
          sets: 0,
          volume: 0,
          exercises: new Map(),
        });
      }
      const dailyData = dailyMap.get(workout.date)!;
      dailyData.sets++;

      // Initialize daily exercise data if needed
      if (!dailyData.exercises.has(exerciseKey)) {
        dailyData.exercises.set(exerciseKey, {
          name: exerciseName,
          type: exercise.type,
          sets: 0,
          reps: 0,
          maxWeight: null,
          distance: null,
          duration: null,
          plankSeconds: null,
        });
      }
      const dailyExercise = dailyData.exercises.get(exerciseKey)!;
      dailyExercise.sets++;

      // Process based on exercise type
      switch (exercise.type) {
        case "weighted":
          if (set.reps) {
            totalReps += set.reps;
            exerciseData.reps += set.reps;
            dailyData.reps += set.reps;
            dailyExercise.reps += set.reps;
          }
          if (set.weight) {
            if (set.weight > maxWeight) maxWeight = set.weight;
            if (
              exerciseData.maxWeight === null ||
              set.weight > exerciseData.maxWeight
            ) {
              exerciseData.maxWeight = set.weight;
            }
            if (
              dailyExercise.maxWeight === null ||
              set.weight > dailyExercise.maxWeight
            ) {
              dailyExercise.maxWeight = set.weight;
            }
            if (set.reps) {
              const volume = set.reps * set.weight;
              totalVolume += volume;
              exerciseData.volume += volume;
              dailyData.volume += volume;
            }
          }
          break;

        case "bodyweight":
          if (set.reps) {
            totalReps += set.reps;
            exerciseData.reps += set.reps;
            dailyData.reps += set.reps;
            dailyExercise.reps += set.reps;
          }
          break;

        case "cardio":
          if (set.distance_km) {
            totalDistance += set.distance_km;
            dailyExercise.distance =
              (dailyExercise.distance || 0) + set.distance_km;
          }
          if (set.duration_minutes) {
            totalDurationMinutes += set.duration_minutes;
            dailyExercise.duration =
              (dailyExercise.duration || 0) + set.duration_minutes;
          }
          break;

        case "timed":
          if (set.plank_seconds) {
            totalPlankSeconds += set.plank_seconds;
            dailyExercise.plankSeconds =
              (dailyExercise.plankSeconds || 0) + set.plank_seconds;
          }
          break;
      }
    });
  });

  // Convert exercise map to sorted array
  const exerciseBreakdown: ExerciseRowData[] = Array.from(exerciseMap.values())
    .sort((a, b) => b.sets - a.sets) // Sort by number of sets
    .map((e) => ({
      name: e.name,
      type: e.type,
      sets: e.sets,
      reps: e.reps,
      maxWeight: e.maxWeight,
      volume: e.volume,
    }));

  // Convert daily map to sorted array with exercises
  const dailyData: DailyWorkoutData[] = Array.from(dailyMap.entries())
    .sort(([a], [b]) => a.localeCompare(b)) // Sort by date
    .map(([date, data]) => ({
      date,
      label: date, // Full date for formatting later
      reps: data.reps,
      sets: data.sets,
      volume: data.volume,
      exercises: Array.from(data.exercises.values()).sort(
        (a, b) => b.sets - a.sets
      ),
    }));

  return {
    stats: {
      workoutCount: workouts.length,
      totalReps,
      totalSets,
      maxWeight,
      totalVolume,
      totalDistance,
      totalDurationMinutes,
      totalPlankSeconds,
    },
    exerciseBreakdown,
    dailyData,
  };
}
