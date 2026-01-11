import { View, Text, StyleSheet } from "@react-pdf/renderer";
import { colors } from "../styles";
import type { DailyWorkoutData } from "../hooks/useMonthlyReportData";

interface PdfDailyBreakdownProps {
  dailyData: DailyWorkoutData[];
  labels: {
    title: string;
    sets: string;
    reps: string;
    weight: string;
    distance: string;
    time: string;
  };
  units: {
    kg: string;
    km: string;
    min: string;
    sec: string;
  };
  formatDate: (date: string) => string;
}

const localStyles = StyleSheet.create({
  container: {
    marginTop: 16,
  },
  title: {
    fontSize: 14,
    fontWeight: 700,
    color: colors.text,
    marginBottom: 12,
    paddingBottom: 6,
    borderBottomWidth: 2,
    borderBottomColor: colors.primary,
  },
  dayCard: {
    marginBottom: 12,
    backgroundColor: colors.surface,
    borderRadius: 6,
    padding: 10,
    borderWidth: 1,
    borderColor: colors.border,
  },
  dayHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 8,
    paddingBottom: 6,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  dayDate: {
    fontSize: 11,
    fontWeight: 700,
    color: colors.primary,
  },
  daySummary: {
    fontSize: 9,
    color: colors.textMuted,
  },
  exerciseRow: {
    flexDirection: "row",
    paddingVertical: 4,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
    borderBottomStyle: "dotted",
  },
  exerciseRowLast: {
    borderBottomWidth: 0,
  },
  exerciseName: {
    flex: 1,
    fontSize: 9,
    color: colors.text,
  },
  exerciseDetails: {
    fontSize: 9,
    color: colors.textMuted,
    textAlign: "right",
    width: 120,
  },
});

export function PdfDailyBreakdown({
  dailyData,
  labels,
  units,
  formatDate,
}: PdfDailyBreakdownProps) {
  if (dailyData.length === 0) {
    return null;
  }

  const formatExerciseDetails = (
    exercise: DailyWorkoutData["exercises"][0]
  ): string => {
    const parts: string[] = [];

    switch (exercise.type) {
      case "weighted":
        parts.push(`${exercise.sets} ${labels.sets}`);
        if (exercise.reps > 0) {
          parts.push(`${exercise.reps} ${labels.reps}`);
        }
        if (exercise.maxWeight) {
          parts.push(`${exercise.maxWeight} ${units.kg}`);
        }
        break;
      case "bodyweight":
        parts.push(`${exercise.sets} ${labels.sets}`);
        if (exercise.reps > 0) {
          parts.push(`${exercise.reps} ${labels.reps}`);
        }
        break;
      case "cardio":
        if (exercise.distance) {
          parts.push(`${exercise.distance.toFixed(1)} ${units.km}`);
        }
        if (exercise.duration) {
          parts.push(`${Math.round(exercise.duration)} ${units.min}`);
        }
        break;
      case "timed":
        if (exercise.plankSeconds) {
          if (exercise.plankSeconds >= 60) {
            const mins = Math.floor(exercise.plankSeconds / 60);
            const secs = exercise.plankSeconds % 60;
            parts.push(`${mins}${units.min} ${secs}${units.sec}`);
          } else {
            parts.push(`${exercise.plankSeconds} ${units.sec}`);
          }
        }
        break;
    }

    return parts.join(" · ");
  };

  return (
    <View style={localStyles.container}>
      <Text style={localStyles.title}>{labels.title}</Text>
      {dailyData.map((day, dayIndex) => (
        <View key={dayIndex} style={localStyles.dayCard} wrap={false}>
          <View style={localStyles.dayHeader}>
            <Text style={localStyles.dayDate}>{formatDate(day.date)}</Text>
            <Text style={localStyles.daySummary}>
              {day.sets} {labels.sets}
              {day.reps > 0 ? ` · ${day.reps} ${labels.reps}` : ""}
            </Text>
          </View>
          {day.exercises.map((exercise, exIndex) => (
            <View
              key={exIndex}
              style={[
                localStyles.exerciseRow,
                exIndex === day.exercises.length - 1 &&
                  localStyles.exerciseRowLast,
              ]}
            >
              <Text style={localStyles.exerciseName}>{exercise.name}</Text>
              <Text style={localStyles.exerciseDetails}>
                {formatExerciseDetails(exercise)}
              </Text>
            </View>
          ))}
        </View>
      ))}
    </View>
  );
}
