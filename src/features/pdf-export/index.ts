// MonthlyReportPdf is NOT exported here to enable proper code-splitting.
// Import it directly via: import("@/features/pdf-export/MonthlyReportPdf")
export { calculateMonthlyReportData } from "./hooks/useMonthlyReportData";
export type {
  MonthlyStats,
  MonthlyReportData,
  DailyWorkoutData,
  DailyExerciseData,
} from "./hooks/useMonthlyReportData";
