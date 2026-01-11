import { useEffect, useState } from "react";

export type AccentColor = "coral" | "blue" | "green" | "purple" | "pink" | "teal" | "amber" | "indigo" | "cyan" | "lime" | "orange" | "slate";

const ACCENT_STORAGE_KEY = "fittrack-accent-color";

// HEX colors for theme-color meta tag (status bar)
export const ACCENT_THEME_COLORS: Record<AccentColor, string> = {
  coral: "#f05a2a",
  blue: "#3b82f6",
  green: "#22c55e",
  purple: "#a855f7",
  pink: "#ec4899",
  teal: "#14b8a6",
  amber: "#f59e0b",
  indigo: "#818cf8",
  cyan: "#06b6d4",
  lime: "#84cc16",
  orange: "#f97316",
  slate: "#64748b",
};

export function updateThemeColor(color: AccentColor) {
  const themeColorMeta = document.querySelector('meta[name="theme-color"]');
  if (themeColorMeta) {
    themeColorMeta.setAttribute("content", ACCENT_THEME_COLORS[color]);
  }
}

export function useAccentColor() {
  // Read initial value from DOM attribute (already set in main.tsx)
  const [accentColor, setAccentColorState] = useState<AccentColor>(() => {
    const currentAccent = document.documentElement.getAttribute("data-accent");
    if (currentAccent && isValidAccent(currentAccent)) {
      return currentAccent as AccentColor;
    }
    return "coral";
  });

  useEffect(() => {
    document.documentElement.setAttribute("data-accent", accentColor);
    localStorage.setItem(ACCENT_STORAGE_KEY, accentColor);
    updateThemeColor(accentColor);
  }, [accentColor]);

  const setAccentColor = (color: AccentColor) => {
    setAccentColorState(color);
  };

  return { accentColor, setAccentColor };
}

function isValidAccent(value: string): value is AccentColor {
  return ["coral", "blue", "green", "purple", "pink", "teal", "amber", "indigo", "cyan", "lime", "orange", "slate"].includes(value);
}

export const ACCENT_COLORS: { value: AccentColor; label: string; color: string }[] = [
  { value: "coral", label: "Коралл", color: "hsl(16, 90%, 55%)" },
  { value: "blue", label: "Синий", color: "hsl(217, 91%, 60%)" },
  { value: "green", label: "Зелёный", color: "hsl(142, 70%, 45%)" },
  { value: "purple", label: "Фиолетовый", color: "hsl(270, 70%, 60%)" },
  { value: "pink", label: "Розовый", color: "hsl(330, 80%, 60%)" },
  { value: "teal", label: "Бирюзовый", color: "hsl(175, 70%, 45%)" },
  { value: "amber", label: "Янтарь", color: "hsl(38, 92%, 50%)" },
  { value: "indigo", label: "Индиго", color: "hsl(239, 84%, 67%)" },
  { value: "cyan", label: "Голубой", color: "hsl(192, 91%, 50%)" },
  { value: "lime", label: "Лайм", color: "hsl(84, 85%, 45%)" },
  { value: "orange", label: "Оранжевый", color: "hsl(25, 95%, 53%)" },
  { value: "slate", label: "Сланец", color: "hsl(215, 25%, 50%)" },
];
