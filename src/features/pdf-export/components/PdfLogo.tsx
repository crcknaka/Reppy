import { View, Svg, Path, Circle, G } from "@react-pdf/renderer";

interface PdfLogoProps {
  size?: number;
  color?: string;
}

export function PdfLogo({ size = 48, color = "#3b82f6" }: PdfLogoProps) {
  // Dumbbell icon as SVG paths
  return (
    <View style={{ alignItems: "center", marginBottom: 8 }}>
      <Svg width={size} height={size} viewBox="0 0 24 24">
        {/* Dumbbell shape */}
        <G>
          {/* Left weight plates */}
          <Path
            d="M6.5 6.5C6.5 5.67 5.83 5 5 5C4.17 5 3.5 5.67 3.5 6.5V17.5C3.5 18.33 4.17 19 5 19C5.83 19 6.5 18.33 6.5 17.5V6.5Z"
            fill={color}
          />
          <Path
            d="M3 8C3 7.17 2.33 6.5 1.5 6.5C0.67 6.5 0 7.17 0 8V16C0 16.83 0.67 17.5 1.5 17.5C2.33 17.5 3 16.83 3 16V8Z"
            fill={color}
          />
          {/* Right weight plates */}
          <Path
            d="M17.5 6.5C17.5 5.67 18.17 5 19 5C19.83 5 20.5 5.67 20.5 6.5V17.5C20.5 18.33 19.83 19 19 19C18.17 19 17.5 18.33 17.5 17.5V6.5Z"
            fill={color}
          />
          <Path
            d="M21 8C21 7.17 21.67 6.5 22.5 6.5C23.33 6.5 24 7.17 24 8V16C24 16.83 23.33 17.5 22.5 17.5C21.67 17.5 21 16.83 21 16V8Z"
            fill={color}
          />
          {/* Bar */}
          <Path
            d="M6.5 11H17.5V13H6.5V11Z"
            fill={color}
          />
        </G>
      </Svg>
    </View>
  );
}
