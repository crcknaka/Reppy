import { View, Text } from "@react-pdf/renderer";
import { styles } from "../styles";

interface PdfStatsCardProps {
  label: string;
  value: string | number;
  unit?: string;
}

export function PdfStatsCard({ label, value, unit }: PdfStatsCardProps) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.row}>
        <Text style={styles.statValue}>{value}</Text>
        {unit && <Text style={styles.statUnit}>{unit}</Text>}
      </View>
    </View>
  );
}
