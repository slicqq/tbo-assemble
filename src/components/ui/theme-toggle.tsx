"use client";

import { useState, useEffect } from "react";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    const saved = localStorage.getItem("tbo-theme");
    if (saved === "dark") {
      setDark(true);
      document.documentElement.classList.add("dark");
    }
  }, []);

  const toggle = () => {
    const next = !dark;
    setDark(next);
    if (next) {
      document.documentElement.classList.add("dark");
      localStorage.setItem("tbo-theme", "dark");
    } else {
      document.documentElement.classList.remove("dark");
      localStorage.setItem("tbo-theme", "light");
    }
  };

  return (
    <button
      onClick={toggle}
      title={dark ? "Switch to light mode" : "Switch to dark mode"}
      className="flex size-9 items-center justify-center rounded-md border bg-background text-muted-foreground shadow-xs hover:bg-accent hover:text-foreground transition-colors dark:bg-input/30"
    >
      {dark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </button>
  );
}

// Script to set theme before hydration to avoid flash
export function ThemeScript() {
  const script = `
    (function() {
      try {
        var t = localStorage.getItem('tbo-theme');
        if (t === 'dark') document.documentElement.classList.add('dark');
      } catch(e) {}
    })();
  `;
  return <script dangerouslySetInnerHTML={{ __html: script }} />;
}
