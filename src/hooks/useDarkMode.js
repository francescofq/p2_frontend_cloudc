import { useCallback, useSyncExternalStore } from "react";

const KEY = "hcm_theme"; // preferencia visual, no sensible
const listeners = new Set();

function apply(isDark) {
  document.documentElement.classList.toggle("dark", isDark);
  try {
    localStorage.setItem(KEY, isDark ? "dark" : "light");
  } catch {
    /* ignorar */
  }
  listeners.forEach((l) => l());
}

// Restaurar preferencia guardada al cargar.
try {
  if (localStorage.getItem(KEY) === "dark") document.documentElement.classList.add("dark");
} catch {
  /* ignorar */
}

const subscribe = (cb) => {
  listeners.add(cb);
  return () => listeners.delete(cb);
};
const getSnapshot = () => document.documentElement.classList.contains("dark");

export function useDarkMode() {
  const isDark = useSyncExternalStore(subscribe, getSnapshot, () => false);
  const toggle = useCallback(() => apply(!getSnapshot()), []);
  return [isDark, toggle];
}
