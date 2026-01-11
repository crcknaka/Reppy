import { View, Text } from "@react-pdf/renderer";
import { styles, colors } from "../styles";

interface BarData {
  label: string;
  value: number;
}

interface PdfBarChartProps {
  data: BarData[];
  title?: string;
  unit?: string;
  maxBars?: number;
}

export function PdfBarChart({
  data,
  title,
  unit = "",
  maxBars = 10,
}: PdfBarChartProps) {
  // Take only top N bars and find max value
  const displayData = data.slice(0, maxBars);
  const maxValue = Math.max(...displayData.map((d) => d.value), 1);

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
                      index % 2 === 0 ? colors.primary : colors.primaryLight,
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
