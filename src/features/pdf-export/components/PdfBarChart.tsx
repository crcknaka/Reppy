import { View, Text } from "@react-pdf/renderer";
import { styles } from "../styles";

interface BarData {
  label: string;
  value: number;
}

interface PdfBarChartProps {
  data: BarData[];
  title?: string;
  unit?: string;
  maxBars?: number;
  primaryColor: string;
}

// Lighten a hex color by a percentage
function lightenColor(hex: string, percent: number): string {
  const num = parseInt(hex.replace("#", ""), 16);
  const amt = Math.round(2.55 * percent);
  const R = Math.min(255, (num >> 16) + amt);
  const G = Math.min(255, ((num >> 8) & 0x00ff) + amt);
  const B = Math.min(255, (num & 0x0000ff) + amt);
  return `#${((1 << 24) + (R << 16) + (G << 8) + B).toString(16).slice(1)}`;
}

export function PdfBarChart({
  data,
  title,
  unit = "",
  maxBars = 10,
  primaryColor,
}: PdfBarChartProps) {
  // Take only top N bars and find max value
  const displayData = data.slice(0, maxBars);
  const maxValue = Math.max(...displayData.map((d) => d.value), 1);
  const primaryLight = lightenColor(primaryColor, 30);

  if (displayData.length === 0) {
    return null;
  }

  return (
    <View style={styles.chartContainer}>
      {title && <Text style={styles.chartTitle}>{title}</Text>}
      {displayData.map((item, index) => {
        const widthPercent = (item.value / maxValue) * 100;
        return (
          <View key={index} style={styles.barRow}>
            <Text style={styles.barLabel}>{item.label}</Text>
            <View style={styles.barContainer}>
              <View
                style={[
                  styles.bar,
                  {
                    width: `${widthPercent}%`,
                    backgroundColor:
                      index % 2 === 0 ? primaryColor : primaryLight,
                  },
                ]}
              />
            </View>
            <Text style={styles.barValue}>
              {item.value.toLocaleString()}
              {unit ? ` ${unit}` : ""}
            </Text>
          </View>
        );
      })}
    </View>
  );
}
