import { View, Text } from "@react-pdf/renderer";
import { styles } from "../styles";

export interface ExerciseRowData {
  name: string;
  sets: number;
  reps: number;
  maxWeight: number | null;
  volume: number;
  type: "bodyweight" | "weighted" | "cardio" | "timed";
}

interface PdfWorkoutTableProps {
  exercises: ExerciseRowData[];
  labels: {
    exercise: string;
    sets: string;
    reps: string;
    maxWeight: string;
    volume: string;
  };
  units: {
    kg: string;
  };
  primaryColor: string;
}

export function PdfWorkoutTable({
  exercises,
  labels,
  units,
  primaryColor,
}: PdfWorkoutTableProps) {
  if (exercises.length === 0) {
    return null;
  }

  // Column widths (percentages)
  const colWidths = {
    name: "40%",
    sets: "12%",
    reps: "15%",
    max: "15%",
    volume: "18%",
  };

  return (
    <View style={styles.table}>
      {/* Header */}
      <View style={[styles.tableHeader, { backgroundColor: primaryColor }]}>
        <Text style={[styles.tableHeaderCell, { width: colWidths.name }]}>
          {labels.exercise}
        </Text>
        <Text
          style={[
            styles.tableHeaderCell,
            { width: colWidths.sets, textAlign: "center" },
          ]}
        >
          {labels.sets}
        </Text>
        <Text
          style={[
            styles.tableHeaderCell,
            { width: colWidths.reps, textAlign: "center" },
          ]}
        >
          {labels.reps}
        </Text>
        <Text
          style={[
            styles.tableHeaderCell,
            { width: colWidths.max, textAlign: "center" },
          ]}
        >
          {labels.maxWeight}
        </Text>
        <Text
          style={[
            styles.tableHeaderCell,
            { width: colWidths.volume, textAlign: "right" },
          ]}
        >
          {labels.volume}
        </Text>
      </View>

      {/* Rows */}
      {exercises.map((exercise, index) => (
        <View
          key={index}
          style={[styles.tableRow, index % 2 === 1 && styles.tableRowAlt]}
        >
          <Text style={[styles.tableCell, { width: colWidths.name }]}>
            {exercise.name}
          </Text>
          <Text
            style={[
              styles.tableCell,
              { width: colWidths.sets, textAlign: "center" },
            ]}
          >
            {exercise.sets}
          </Text>
          <Text
            style={[
              styles.tableCell,
              { width: colWidths.reps, textAlign: "center" },
            ]}
          >
            {exercise.reps > 0 ? exercise.reps.toLocaleString() : "-"}
          </Text>
          <Text
            style={[
              styles.tableCell,
              { width: colWidths.max, textAlign: "center" },
            ]}
          >
            {exercise.maxWeight !== null
              ? `${exercise.maxWeight} ${units.kg}`
              : "-"}
          </Text>
          <Text
            style={[
              styles.tableCell,
              { width: colWidths.volume, textAlign: "right" },
            ]}
          >
            {exercise.volume > 0 ? exercise.volume.toLocaleString() : "-"}
          </Text>
        </View>
      ))}
    </View>
  );
}
