import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { ThemeProvider } from "./lib/theme";

(function initTheme() {
  try {
    const stored = localStorage.getItem("theme") ?? "dark";
    if (stored === "dark") document.documentElement.classList.add("dark");
  } catch {}
})();

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
