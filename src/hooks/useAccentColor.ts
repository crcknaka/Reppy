import { useEffect, useState } from "react";

export type AccentColor = "coral" | "blue" | "green" | "purple" | "pink" | "teal";

const ACCENT_STORAGE_KEY = "fittrack-accent-color";

export function useAccentColor() {
  const [accentColor, setAccentColorState] = useState<AccentColor>(() => {
    if (typeof window !== "undefined") {
      const stored = localStorage.getItem(ACCENT_STORAGE_KEY);
      if (stored && isValidAccent(stored)) {
        return stored as AccentColor;
      }
    }
    return "coral";
  });

  useEffect(() => {
    const root = document.documentElement;
    root.setAttribute("data-accent", accentColor);
    localStorage.setItem(ACCENT_STORAGE_KEY, accentColor);
  }, [accentColor]);

  // Initialize on mount
  useEffect(() => {
    const stored = localStorage.getItem(ACCENT_STORAGE_KEY);
    if (stored && isValidAccent(stored)) {
      document.documentElement.setAttribute("data-accent", stored);
    }
  }, []);

  const setAccentColor = (color: AccentColor) => {
    setAccentColorState(color);
  };

  return { accentColor, setAccentColor };
}

function isValidAccent(value: string): value is AccentColor {
  return ["coral", "blue", "green", "purple", "pink", "teal"].includes(value);
}

export const ACCENT_COLORS: { value: AccentColor; label: string; color: string }[] = [
  { value: "coral", label: "Коралл", color: "hsl(16, 90%, 55%)" },
  { value: "blue", label: "Синий", color: "hsl(217, 91%, 60%)" },
  { value: "green", label: "Зелёный", color: "hsl(142, 70%, 45%)" },
  { value: "purple", label: "Фиолетовый", color: "hsl(270, 70%, 60%)" },
  { value: "pink", label: "Розовый", color: "hsl(330, 80%, 60%)" },
  { value: "teal", label: "Бирюзовый", color: "hsl(175, 70%, 45%)" },
];
