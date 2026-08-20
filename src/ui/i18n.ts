import zh from "../locales/zh-CN.json";
import en from "../locales/en-US.json";

type Lang = "zh-CN" | "en-US";
type Messages = Record<string, string>;

export class I18nManager {
  currentLang: Lang = "zh-CN";
  private messages: Record<Lang, Messages> = { "zh-CN": zh, "en-US": en };

  t(key: string, params?: Record<string, string | number>): string {
    let s = this.messages[this.currentLang][key] ?? key;
    if (params) {
      for (const [k, v] of Object.entries(params)) {
        s = s.split("{" + k + "}").join(String(v));
      }
    }
    return s;
  }

  toggle(): void {
    this.currentLang = this.currentLang === "zh-CN" ? "en-US" : "zh-CN";
    localStorage.setItem("s-enc-lang", this.currentLang);
    this.apply();
  }

  apply(): void {
    document.querySelectorAll("[data-i18n]").forEach((el) => {
      const key = el.getAttribute("data-i18n");
      if (key) el.textContent = this.t(key);
    });
    document.documentElement.lang = this.currentLang === "zh-CN" ? "zh-CN" : "en";
  }

  load(): void {
    const saved = localStorage.getItem("s-enc-lang");
    if (saved === "en-US" || saved === "zh-CN") {
      this.currentLang = saved;
      return;
    }
    const nav = (navigator.language || "en").toLowerCase();
    this.currentLang = nav.startsWith("zh") ? "zh-CN" : "en-US";
  }
}

export const i18n = new I18nManager();
