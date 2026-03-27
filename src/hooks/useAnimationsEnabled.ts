import { useCallback, useSyncExternalStore } from "react";

const STORAGE_KEY = "reppy-animations-enabled";
const listeners = new Set<() => void>();

function getSnapshot(): boolean {
  const stored = localStorage.getItem(STORAGE_KEY);
  return stored === null ? true : stored === "true";
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function setEnabled(value: boolean) {
  localStorage.setItem(STORAGE_KEY, value.toString());
  if (value) {
    document.documentElement.removeAttribute("data-animations-disabled");
  } else {
    document.documentElement.setAttribute("data-animations-disabled", "true");
  }
  // Notify all subscribers
  listeners.forEach((fn) => fn());
}

// Apply on module load (before any React render)
if (typeof window !== "undefined") {
  const initial = getSnapshot();
  if (!initial) {
    document.documentElement.setAttribute("data-animations-disabled", "true");
  }
}

export function useAnimationsEnabled() {
  const animationsEnabled = useSyncExternalStore(subscribe, getSnapshot, () => true);

  const setAnimationsEnabled = useCallback((value: boolean) => {
    setEnabled(value);
  }, []);

  return { animationsEnabled, setAnimationsEnabled };
}
