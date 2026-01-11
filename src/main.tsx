import { createRoot } from "react-dom/client";
import App from "./App.tsx";
import "./index.css";

// Initialize accent color from localStorage before React renders
const ACCENT_STORAGE_KEY = "fittrack-accent-color";
const VALID_ACCENTS = ["coral", "blue", "green", "purple", "pink", "teal", "amber", "indigo", "cyan", "lime", "orange", "slate"];
const storedAccent = localStorage.getItem(ACCENT_STORAGE_KEY);

if (storedAccent && VALID_ACCENTS.includes(storedAccent)) {
  document.documentElement.setAttribute("data-accent", storedAccent);
} else {
  document.documentElement.setAttribute("data-accent", "coral");
}

createRoot(document.getElementById("root")!).render(<App />);
