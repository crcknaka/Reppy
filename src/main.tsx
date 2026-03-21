import { createRoot } from "react-dom/client";
import { registerSW } from "virtual:pwa-register";
import App from "./App.tsx";
import "./index.css";
import "./lib/i18n";

// Register service worker for PWA
const updateSW = registerSW({
  immediate: true, // Register immediately for faster caching
  onNeedRefresh() {
    // Auto-update when new content is available
    console.log("New content available, updating...");
    updateSW(true); // Force update
  },
  onOfflineReady() {
    console.log("App ready for offline use.");
  },
  onRegistered(registration) {
    console.log("Service worker registered:", registration);
    // Check for updates periodically
    if (registration) {
      setInterval(() => {
        registration.update();
      }, 60 * 60 * 1000); // Check every hour
    }
  },
  onRegisterError(error) {
    console.error("Service worker registration error:", error);
  },
});

// Initialize accent color from localStorage before React renders
const ACCENT_STORAGE_KEY = "reppy-accent-color";
const VALID_ACCENTS = ["coral", "blue", "green", "purple", "pink", "teal", "amber", "indigo", "cyan", "lime", "orange", "slate"];
const storedAccent = localStorage.getItem(ACCENT_STORAGE_KEY);

const accentToApply = storedAccent && VALID_ACCENTS.includes(storedAccent) ? storedAccent : "coral";
document.documentElement.setAttribute("data-accent", accentToApply);

// Disable context menu (long press) for PWA in production.
// Keep right-click enabled during local development for easier debugging.
if (!import.meta.env.DEV) {
  document.addEventListener("contextmenu", (e) => {
    e.preventDefault();
  });
}

createRoot(document.getElementById("root")!).render(<App />);
