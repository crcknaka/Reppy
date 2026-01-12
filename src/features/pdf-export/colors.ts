import type { AccentColor } from "@/hooks/useAccentColor";

// Accent color to hex mapping for PDF
const accentColorHexMap: Record<AccentColor, { primary: string; primaryLight: string; primaryDark: string }> = {
  coral: { primary: "#f97316", primaryLight: "#fdba74", primaryDark: "#c2410c" },
  blue: { primary: "#3b82f6", primaryLight: "#93c5fd", primaryDark: "#1d4ed8" },
  green: { primary: "#22c55e", primaryLight: "#86efac", primaryDark: "#15803d" },
  purple: { primary: "#a855f7", primaryLight: "#d8b4fe", primaryDark: "#7e22ce" },
  pink: { primary: "#ec4899", primaryLight: "#f9a8d4", primaryDark: "#be185d" },
  teal: { primary: "#14b8a6", primaryLight: "#5eead4", primaryDark: "#0d9488" },
  amber: { primary: "#f59e0b", primaryLight: "#fcd34d", primaryDark: "#b45309" },
  indigo: { primary: "#6366f1", primaryLight: "#a5b4fc", primaryDark: "#4338ca" },
  cyan: { primary: "#06b6d4", primaryLight: "#67e8f9", primaryDark: "#0891b2" },
  lime: { primary: "#84cc16", primaryLight: "#bef264", primaryDark: "#4d7c0f" },
  orange: { primary: "#f97316", primaryLight: "#fdba74", primaryDark: "#c2410c" },
  slate: { primary: "#64748b", primaryLight: "#94a3b8", primaryDark: "#475569" },
};

export function getAccentColors(accent: AccentColor) {
  return accentColorHexMap[accent] || accentColorHexMap.coral;
}

// Default color palette
export const colors = {
  primary: "#f97316", // Coral (default)
  primaryLight: "#fdba74",
  primaryDark: "#c2410c",
  secondary: "#6b7280",
  success: "#22c55e",
  background: "#ffffff",
  surface: "#f8fafc",
  border: "#e2e8f0",
  text: "#1e293b",
  textMuted: "#64748b",
  textLight: "#94a3b8",
};

// Create colors with custom accent
export function createColors(accent: AccentColor) {
  const accentColors = getAccentColors(accent);
  return {
    ...colors,
    primary: accentColors.primary,
    primaryLight: accentColors.primaryLight,
    primaryDark: accentColors.primaryDark,
  };
}

export type PdfColors = ReturnType<typeof createColors>;
