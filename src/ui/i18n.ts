import zh from "../locales/zh-CN.json";
import en from "../locales/en-US.json";

type Lang = "zh-CN" | "en-US";
type Messages = Record<string, string>;

export class I18nManager {
  currentLang: Lang = "zh-CN";
  private messages: Record<Lang, Messages> = { "zh-CN": zh, "en-US": en };

  t(key: string): string {
    return this.messages[this.currentLang][key] ?? key;
  }

  toggle(): void {
    this.currentLang = this.currentLang === "zh-CN" ? "en-US" : "zh-CN";
    localStorage.setItem("s-enc-lang", this.currentLang);
    this.apply();
  }

  /** Apply translations to all [data-i18n] elements in the DOM */
  apply(): void {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (key) el.textContent = this.t(key);
    });
    document.documentElement.lang = this.currentLang === "zh-CN" ? "zh-CN" : "en";
  }

  /** Load persisted language preference */
  load(): void {
    const saved = localStorage.getItem("s-enc-lang");
    if (saved === "en-US" || saved === "zh-CN") this.currentLang = saved;
  }
}

export {};