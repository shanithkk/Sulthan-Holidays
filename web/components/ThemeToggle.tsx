"use client";
import { Moon, Sun } from "lucide-react";

/** Switches light/dark by toggling the `dark` class on <html> and remembering the choice. */
export default function ThemeToggle() {
  function toggle() {
    const dark = document.documentElement.classList.toggle("dark");
    try {
      localStorage.setItem("sh_theme", dark ? "dark" : "light");
    } catch {
      /* private mode: the choice just will not persist */
    }
  }
  return (
    <button onClick={toggle} aria-label="Switch light or dark mode" title="Light / dark" className="btn btn-ghost !p-2.5">
      {/* Which icon shows is decided by CSS (.dark), so there is no flash or hydration mismatch. */}
      <Moon size={18} className="theme-icon-light" />
      <Sun size={18} className="theme-icon-dark" />
    </button>
  );
}
