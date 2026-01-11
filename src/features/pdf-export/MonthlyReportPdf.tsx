import { Document, Page, View, Text } from "@react-pdf/renderer";
import { styles, type PdfColors } from "./styles";
import { PdfCoverPage } from "./components/PdfCoverPage";
import { PdfBarChart } from "./components/PdfBarChart";
import { PdfWorkoutTable } from "./components/PdfWorkoutTable";
import { PdfDailyBreakdown } from "./components/PdfDailyBreakdown";
import type { MonthlyReportData } from "./hooks/useMonthlyReportData";

interface MonthlyReportPdfProps {
  userName: string;
  monthYear: string;
  data: MonthlyReportData;
  colors: PdfColors;
  translations: {
    title: string;
    exerciseBreakdown: string;
    workoutProgress: string;
    dailyBreakdown: string;
    noData: string;
    footer: string;
    stats: {
      workouts: string;
      totalReps: string;
      totalSets: string;
      maxWeight: string;
      volume: string;
      distance: string;
      duration: string;
      plankTime: string;
    };
    table: {
      exercise: string;
      sets: string;
      reps: string;
      maxWeight: string;
      volume: string;
    };
    daily: {
      sets: string;
      reps: string;
      weight: string;
      distance: string;
      time: string;
    };
    units: {
      kg: string;
      km: string;
      h: string;
      min: string;
      sec: string;
    };
  };
  formatDate: (date: string) => string;
}

export function MonthlyReportPdf({
  userName,
  monthYear,
  data,
  colors,
  translations,
  formatDate,
}: MonthlyReportPdfProps) {
  const { stats, exerciseBreakdown, dailyData } = data;
  const hasData = stats.workoutCount > 0;

  // Prepare chart data for sets per day with formatted dates
  const chartData = dailyData.map((d) => ({
    label: formatDate(d.date),
    value: d.sets,
  }));

  return (
    <Document>
      {/* Page 1: Cover with stats */}
      <Page size="A4" style={styles.page}>
        <PdfCoverPage
          userName={userName}
          monthYear={monthYear}
          stats={stats}
          primaryColor={colors.primary}
          labels={{
            title: translations.title,
            workouts: translations.stats.workouts,
            totalReps: translations.stats.totalReps,
            totalSets: translations.stats.totalSets,
            maxWeight: translations.stats.maxWeight,
            volume: translations.stats.volume,
            distance: translations.stats.distance,
            duration: translations.stats.duration,
            plankTime: translations.stats.plankTime,
          }}
          units={translations.units}
        />

        {!hasData && <Text style={styles.noData}>{translations.noData}</Text>}

        {/* Footer */}
        <Text style={styles.footer}>{translations.footer}</Text>
      </Page>

      {/* Page 2: Exercise breakdown table (only if has data) */}
      {hasData && (
        <Page size="A4" style={styles.page}>
          {/* Workout progress chart */}
          {chartData.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { borderBottomColor: colors.primary }]}>
                {translations.workoutProgress}
              </Text>
              <PdfBarChart
                data={chartData}
                unit={translations.daily.sets}
                maxBars={15}
                primaryColor={colors.primary}
              />
            </View>
          )}

          {/* Exercise breakdown table */}
          {exerciseBreakdown.length > 0 && (
            <View style={styles.section}>
              <Text style={[styles.sectionTitle, { borderBottomColor: colors.primary }]}>
                {translations.exerciseBreakdown}
              </Text>
              <PdfWorkoutTable
                exercises={exerciseBreakdown}
                labels={translations.table}
                units={{ kg: translations.units.kg }}
                primaryColor={colors.primary}
              />
            </View>
          )}

          {/* Footer */}
          <Text style={styles.footer}>{translations.footer}</Text>
        </Page>
      )}

      {/* Page 3+: Daily breakdown (only if has data) */}
      {hasData && dailyData.length > 0 && (
        <Page size="A4" style={styles.page}>
          <PdfDailyBreakdown
            dailyData={dailyData}
            labels={{
              title: translations.dailyBreakdown,
              sets: translations.daily.sets,
              reps: translations.daily.reps,
              weight: translations.daily.weight,
              distance: translations.daily.distance,
              time: translations.daily.time,
            }}
            units={{
              kg: translations.units.kg,
              km: translations.units.km,
              min: translations.units.min,
              sec: translations.units.sec,
            }}
            formatDate={formatDate}
            primaryColor={colors.primary}
          />

          {/* Footer */}
          <Text style={styles.footer}>{translations.footer}</Text>
        </Page>
      )}
    </Document>
  );
}
