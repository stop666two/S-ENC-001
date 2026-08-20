import { i18n } from "./i18n";

export type ThemeMode = "auto" | "light" | "dark";

export class ThemeManager {
  private mode: ThemeMode;
  private mq: MediaQueryList;

  constructor() {
    const saved = localStorage.getItem("s-enc-theme") as ThemeMode | null;
    this.mode = saved === "light" || saved === "dark" || saved === "auto" ? saved : "auto";
    this.mq = window.matchMedia("(prefers-color-scheme: light)");
    this.mq.addEventListener("change", () => {
      if (this.mode === "auto") this.apply();
    });
    this.apply();
    this.updateButton();
  }

  toggle(): void {
    const order: ThemeMode[] = ["auto", "light", "dark"];
    this.mode = order[(order.indexOf(this.mode) + 1) % order.length];
    localStorage.setItem("s-enc-theme", this.mode);
    this.apply();
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
