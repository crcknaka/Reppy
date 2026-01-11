import { View, Text } from "@react-pdf/renderer";
import { styles } from "../styles";
import { PdfStatsCard } from "./PdfStatsCard";
import { PdfLogo } from "./PdfLogo";
import type { MonthlyStats } from "../hooks/useMonthlyReportData";

interface PdfCoverPageProps {
  userName: string;
  monthYear: string;
  stats: MonthlyStats;
  primaryColor: string;
  labels: {
    title: string;
    workouts: string;
    totalReps: string;
    totalSets: string;
    maxWeight: string;
    volume: string;
    distance: string;
    duration: string;
    plankTime: string;
  };
  units: {
    kg: string;
    km: string;
    h: string;
    min: string;
  };
}

export function PdfCoverPage({
  userName,
  monthYear,
  stats,
  primaryColor,
  labels,
  units,
}: PdfCoverPageProps) {
  // Format duration from minutes to hours and minutes
  const formatDuration = (minutes: number): string => {
    if (minutes < 60) {
      return `${Math.round(minutes)} ${units.min}`;
    }
    const hours = Math.floor(minutes / 60);
    const mins = Math.round(minutes % 60);
    if (mins === 0) {
      return `${hours} ${units.h}`;
    }
    return `${hours}${units.h} ${mins}${units.min}`;
  };

  // Format plank time from seconds
  const formatPlankTime = (seconds: number): string => {
    if (seconds < 60) {
      return `${seconds}s`;
    }
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    if (secs === 0) {
      return `${mins} ${units.min}`;
    }
    return `${mins}${units.min} ${secs}s`;
  };

  return (
    <View>
      {/* Header with Logo */}
      <View style={styles.header}>
        <PdfLogo size={56} color={primaryColor} />
        <Text style={[styles.logo, { color: primaryColor }]}>FITTRACK</Text>
        <Text style={styles.title}>{labels.title}</Text>
        <Text style={styles.userName}>{userName}</Text>
        <Text style={[styles.monthYear, { color: primaryColor }]}>{monthYear}</Text>
      </View>

      {/* Stats Grid */}
      <View style={styles.statsGrid}>
        <PdfStatsCard label={labels.workouts} value={stats.workoutCount} />
        <PdfStatsCard
          label={labels.totalSets}
          value={stats.totalSets.toLocaleString()}
        />
        <PdfStatsCard
          label={labels.totalReps}
          value={stats.totalReps.toLocaleString()}
        />

        {stats.maxWeight > 0 && (
          <PdfStatsCard
            label={labels.maxWeight}
            value={stats.maxWeight}
            unit={units.kg}
          />
        )}
        {stats.totalVolume > 0 && (
          <PdfStatsCard
            label={labels.volume}
            value={stats.totalVolume.toLocaleString()}
          />
        )}
        {stats.totalDistance > 0 && (
          <PdfStatsCard
            label={labels.distance}
            value={stats.totalDistance.toFixed(1)}
            unit={units.km}
          />
        )}
        {stats.totalDurationMinutes > 0 && (
          <PdfStatsCard
            label={labels.duration}
            value={formatDuration(stats.totalDurationMinutes)}
          />
        )}
        {stats.totalPlankSeconds > 0 && (
          <PdfStatsCard
            label={labels.plankTime}
            value={formatPlankTime(stats.totalPlankSeconds)}
          />
        )}
      </View>
    </View>
  );
}
