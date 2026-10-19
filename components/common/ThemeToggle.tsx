"use client";

import { useEffect, useState } from "react";
import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

export default function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) {
    return (
      <button
        type="button"
        disabled
        aria-label="Memuat tema"
        className="rounded-lg border border-gray-300 p-2"
      >
        <Sun size={18} />
      </button>
    );
  }

  const isDark = resolvedTheme === "dark";

  return (
    <button
      type="button"
      onClick={() =>
        setTheme(isDark ? "light" : "dark")
      }
      aria-label="Ganti tema"
      title={isDark ? "Light Mode" : "Dark Mode"}
      className="inline-flex items-center gap-2 rounded-lg
        border border-gray-300 bg-white px-3 py-2
        text-sm text-gray-800 hover:bg-gray-100
        dark:border-gray-700 dark:bg-gray-800
        dark:text-gray-100 dark:hover:bg-gray-700"
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
      <span>{isDark ? "Light Mode" : "Dark Mode"}</span>
    </button>
  );
}
