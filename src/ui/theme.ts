export class ThemeManager {
  private isDark: boolean;

  constructor() {
    this.isDark = localStorage.getItem("s-enc-theme") !== "light";
    this.apply();
  }

  toggle(): void {
    this.isDark = !this.isDark;
    localStorage.setItem("s-enc-theme", this.isDark ? "dark" : "light");
    this.apply();
  }

  private apply(): void {
    document.documentElement.setAttribute("data-theme", this.isDark ? "dark" : "light");
  }
}
