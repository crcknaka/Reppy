import { LIMITS } from "@/lib/limits";

type ValidationSuccess = { isValid: true };
type ValidationFailure = {
  isValid: false;
  errorKey: string;
  params?: Record<string, number>;
};

export type ValidationResult = ValidationSuccess | ValidationFailure;

export function isValidationFailure(result: ValidationResult): result is ValidationFailure {
  return !result.isValid;
}

type SetInputValidationArgs = {
  exerciseType: "weighted" | "bodyweight" | "cardio" | "timed";
  reps: string;
  weight: string;
  distance: string;
  duration: string;
};

type SetLimitValidationArgs = {
  isEditMode: boolean;
  isNewExercise: boolean;
  uniqueExercises: number;
  existingSets: number;
  totalSetCount: number;
};

const valid = (): ValidationSuccess => ({ isValid: true });

export function validateSetInputValues({
  exerciseType,
  reps,
  weight,
  distance,
  duration,
}: SetInputValidationArgs): ValidationResult {
  if (exerciseType === "cardio") {
    if (!distance || !duration) {
      return { isValid: false, errorKey: "workout.cardioRequired" };
    }

    const distanceNum = parseFloat(distance);
    const durationNum = parseInt(duration, 10);

    if (Number.isNaN(distanceNum) || distanceNum < LIMITS.MIN_DISTANCE_KM || distanceNum > LIMITS.MAX_DISTANCE_KM) {
      return {
        isValid: false,
        errorKey: "limits.distanceRange",
        params: { min: LIMITS.MIN_DISTANCE_KM, max: LIMITS.MAX_DISTANCE_KM },
      };
    }

    if (Number.isNaN(durationNum) || durationNum < LIMITS.MIN_DURATION_MINUTES || durationNum > LIMITS.MAX_DURATION_MINUTES) {
      return {
        isValid: false,
        errorKey: "limits.durationRange",
        params: { min: LIMITS.MIN_DURATION_MINUTES, max: LIMITS.MAX_DURATION_MINUTES },
      };
    }

    return valid();
  }

  if (exerciseType === "timed") {
    if (!duration) {
      return { isValid: false, errorKey: "workout.enterTime" };
    }

    const durationNum = parseInt(duration, 10);
    if (Number.isNaN(durationNum) || durationNum < LIMITS.MIN_TIME_SECONDS || durationNum > LIMITS.MAX_TIME_SECONDS) {
      return {
        isValid: false,
        errorKey: "limits.timeRange",
        params: { min: LIMITS.MIN_TIME_SECONDS, max: LIMITS.MAX_TIME_SECONDS },
      };
    }

    return valid();
  }

  if (exerciseType === "weighted") {
    if (!reps || !weight) {
      return { isValid: false, errorKey: "workout.weightedRequired" };
    }

    const repsNum = parseInt(reps, 10);
    const weightNum = parseFloat(weight);

    if (Number.isNaN(repsNum) || repsNum < LIMITS.MIN_REPS || repsNum > LIMITS.MAX_REPS) {
      return {
        isValid: false,
        errorKey: "limits.repsRange",
        params: { min: LIMITS.MIN_REPS, max: LIMITS.MAX_REPS },
      };
    }

    if (Number.isNaN(weightNum) || weightNum < LIMITS.MIN_WEIGHT_KG || weightNum > LIMITS.MAX_WEIGHT_KG) {
      return {
        isValid: false,
        errorKey: "limits.weightRange",
        params: { min: LIMITS.MIN_WEIGHT_KG, max: LIMITS.MAX_WEIGHT_KG },
      };
    }

    return valid();
  }

  if (!reps) {
    return { isValid: false, errorKey: "workout.enterReps" };
  }

  const repsNum = parseInt(reps, 10);
  if (Number.isNaN(repsNum) || repsNum < LIMITS.MIN_REPS || repsNum > LIMITS.MAX_REPS) {
    return {
      isValid: false,
      errorKey: "limits.repsRange",
      params: { min: LIMITS.MIN_REPS, max: LIMITS.MAX_REPS },
    };
  }

  return valid();
}

export function validateSetCreationLimits({
  isEditMode,
  isNewExercise,
  uniqueExercises,
  existingSets,
  totalSetCount,
}: SetLimitValidationArgs): ValidationResult {
  if (isEditMode) {
    return valid();
  }

  if (isNewExercise && uniqueExercises >= LIMITS.MAX_EXERCISES_PER_WORKOUT) {
    return {
      isValid: false,
      errorKey: "limits.maxExercisesPerWorkout",
      params: { max: LIMITS.MAX_EXERCISES_PER_WORKOUT },
    };
  }

  if (existingSets >= LIMITS.MAX_SETS_PER_EXERCISE) {
    return {
      isValid: false,
      errorKey: "limits.maxSetsPerExercise",
      params: { max: LIMITS.MAX_SETS_PER_EXERCISE },
    };
  }

  if (totalSetCount >= LIMITS.MAX_TOTAL_SETS_PER_WORKOUT) {
    return {
      isValid: false,
      errorKey: "limits.maxTotalSetsPerWorkout",
      params: { max: LIMITS.MAX_TOTAL_SETS_PER_WORKOUT },
    };
  }

  return valid();
}
