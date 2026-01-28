// Application limits to protect the database from abuse

export const LIMITS = {
  // Workout limits
  MAX_WORKOUTS_PER_DAY: 5,
  MAX_EXERCISES_PER_WORKOUT: 30,
  MAX_SETS_PER_EXERCISE: 20,
  MAX_TOTAL_SETS_PER_WORKOUT: 100,

  // Notes limits
  MAX_NOTES_LENGTH: 500,

  // Value limits - weighted exercises
  MIN_WEIGHT_KG: 0.1,
  MAX_WEIGHT_KG: 500,
  MIN_REPS: 1,
  MAX_REPS: 999,

  // Value limits - cardio exercises
  MIN_DISTANCE_KM: 0.1,
  MAX_DISTANCE_KM: 500,
  MIN_DURATION_MINUTES: 1,
  MAX_DURATION_MINUTES: 1440, // 24 hours

  // Value limits - timed exercises
  MIN_TIME_SECONDS: 1,
  MAX_TIME_SECONDS: 3600, // 1 hour
} as const;
