import { Moon, Sun } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useDarkMode } from "@/hooks/useDarkMode";

export default function ThemeToggle({ className = "" }) {
  const [isDark, toggle] = useDarkMode();
  return (
    <Button
      type="button"
      variant="outline"
      size="icon-lg"
      className={`rounded-full ${className}`}
      onClick={toggle}
      title="Cambiar tema"
      aria-label="Cambiar tema"
    >
      {isDark ? <Sun className="text-yellow-500" /> : <Moon />}
    </Button>
  );
}
