import { i18n } from "./i18n";

export type ThemeMode = "auto" | "light" | "dark";

export function applyStoredTheme(): ThemeMode {
  const saved = localStorage.getItem("s-enc-theme") as ThemeMode | null;
  const mode = saved === "light" || saved === "dark" || saved === "auto" ? saved : "auto";
  const mq = window.matchMedia("(prefers-color-scheme: light)");
  const light = mode === "light" || (mode === "auto" && mq.matches);
  document.documentElement.setAttribute("data-theme", light ? "light" : "dark");
  return mode;
}

export function cycleTheme(): ThemeMode {
  const order: ThemeMode[] = ["auto", "light", "dark"];
  const next = order[(order.indexOf(applyStoredTheme()) + 1) % order.length];
  localStorage.setItem("s-enc-theme", next);
  applyStoredTheme();
  return next;
}

export class ThemeManager {
  private mode: ThemeMode;
  private mq: MediaQueryList;

  constructor() {
    this.mode = applyStoredTheme();
    this.mq = window.matchMedia("(prefers-color-scheme: light)");
    this.mq.addEventListener("change", () => {
      if (this.mode === "auto") this.apply();
    });
    this.updateButton();
  }

  toggle(): void {
    this.mode = cycleTheme();
    this.updateButton();
  }

  private apply(): void {
    const light = this.mode === "light" || (this.mode === "auto" && this.mq.matches);
    document.documentElement.setAttribute("data-theme", light ? "light" : "dark");
  }

  private updateButton(): void {
    const btn = document.getElementById("btn-theme");
    if (btn) btn.setAttribute("title", i18n.t("hint.btn.theme." + this.mode));
  }
}
