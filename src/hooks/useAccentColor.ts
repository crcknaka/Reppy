import { useEffect, useState } from "react";

export type AccentColor = "coral" | "blue" | "green" | "purple" | "pink" | "teal" | "amber" | "indigo" | "cyan" | "lime" | "orange" | "slate";

const ACCENT_STORAGE_KEY = "fittrack-accent-color";

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
