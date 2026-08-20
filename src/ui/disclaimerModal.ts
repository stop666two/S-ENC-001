import { i18n } from "./i18n";
import { setModalAria, trapFocus } from "./modalFocus";

export const DISCLAIMER_SECTIONS: string[] = [
  "【S-ENC-001 免责声明】版本 1.0.0 | 生效日期：2026 年 8 月 20 日",
  "一、引言：感谢您使用 S-ENC-001（以下简称「本软件」）。本软件是一款纯前端加密/解密工具，全部加密、解密运算均在您的浏览器本地完成，数据不会上传至任何服务器。在开始使用本软件之前，请您仔细阅读本免责声明的全部内容。当您点击「同意」按钮时，即表示您已阅读、理解并同意接受本免责声明全部条款的约束。若您不同意本免责声明的任何条款，请点击「取消」并停止使用本软件。",
  "二、软件性质：按现状提供：本软件按「现状」（AS IS）和「可用」（AS AVAILABLE）原则提供，不附带任何明示或默示的保证，包括但不限于对适销性、特定用途适用性、不侵权以及软件无缺陷、无错误、不间断运行的保证。我们不对软件的功能完整性、运算正确性、运行稳定性、兼容性做出任何承诺。您理解并同意，使用本软件的风险由您自行承担。",
  "三、加密强度不保证：本软件采用行业通用的加密算法（Argon2id 密钥派生、AES-256-GCM 对称加密、HMAC-SHA256 完整性认证），并参考相关国际标准实现。但任何加密算法都不是绝对不可破解的，随着计算能力提升与密码学研究进展，算法安全性可能发生变化。我们不保证本软件能抵御一切形式的攻击，包括但不限于暴力破解、侧信道攻击、社会工程学攻击、恶意软件窃取等。加密强度还取决于您选择的密码强度、密码管理习惯以及运行环境的可信程度。",
  "四、密码、恢复短语与密钥文件的管理责任：本软件采用密码（可选配合恢复短语、密钥文件）派生加密密钥。密钥派生所需的全部输入材料均由您自行保管，本软件不存储、不传输、不备份您的密码、恢复短语、密钥文件及其派生结果。一旦您遗忘密码、丢失恢复短语或密钥文件，加密数据将无法恢复，任何第三方（包括本软件开发者）都无法协助您找回。请您务必妥善保管上述信息，并采取合理的保密措施。",
  "五、数据丢失与损坏风险：加密、解密、分割、合并等运算过程中，可能因浏览器异常、设备断电、操作系统崩溃、网络中断、人为操作失误等原因导致数据损坏或丢失。请您在操作前对重要数据进行备份，并在操作完成后验证结果的完整性。因上述原因造成的任何数据丢失、损坏或泄露，本软件及其开发者不承担任何责任。",
  "六、存储介质与传输安全：加密后的文件可能保存在您的本地磁盘、移动存储介质或第三方网盘中，也可能通过网络传输。本软件无法控制存储介质与传输通道的安全性。若您的存储介质或传输通道被未授权第三方访问，即使数据已加密，仍存在被窃取、篡改或破坏的风险。请您根据数据敏感程度自行评估并采取相应的安全措施。",
  "七、隐私声明与运行环境风险：本软件为纯前端应用，除加载必要的静态资源与 WebAssembly 模块外，不向任何服务器发送您的数据、密码或文件内容。但您的浏览器、操作系统、浏览器扩展、网络环境（包括但不限于代理、VPN、企业网关）可能记录您的操作行为或截获页面内容。请您仅在可信的设备和网络环境中使用本软件，并注意防范键盘记录、屏幕录制、恶意扩展等风险。若运行环境存在安全缺陷（如浏览器漏洞、系统被植入后门），本软件无法保证您的数据安全。",
  "八、法律合规与使用限制：您承诺遵守所在国家/地区的法律法规，不将本软件用于任何违法用途，包括但不限于：存储、传输、处理侵犯他人合法权益的内容，协助他人逃避法律监管，从事危害国家安全或公共安全的活动等。若因您的违法使用行为产生任何法律责任，由您自行承担，与本软件及其开发者无关。",
  "九、第三方组件依赖：本软件基于若干开源第三方组件构建（包括 Rust WebAssembly 生态、加密算法库、前端构建工具等），这些组件均按各自的许可协议发布。本软件不承担因第三方组件自身缺陷、许可变更或供应链安全事件（包括但不限于组件被投毒、维护者恶意行为）所引发的任何责任。",
  "十、适用场景限制与建议：本软件适合普通用户在日常场景下对个人文件进行加密保护，不保证达到任何特定安全标准（如等级保护、金融级、涉密级要求）。对于高敏感数据、商业机密、受监管数据，建议您咨询专业安全机构，采用经过认证的商用加密解决方案。请勿将本软件用于存储、传输、处理受法律特别保护的数据，除非您已获得必要的授权。",
  "十一、责任限制与条款变更：在法律允许的最大范围内，本软件及其开发者不对因使用或无法使用本软件而产生的任何直接、间接、偶然、特殊或后果性损害承担责任，包括但不限于利润损失、数据丢失、业务中断、商誉损害等，即使已被告知此类损害的可能性。我们保留随时修改本免责声明的权利，修改后的条款将在本页面或相关文档中公布。您在条款变更后继续使用本软件，即视为接受变更后的条款。",
  "如您对本免责声明有任何疑问，请通过项目主页 https://github.com/stop666two/S-ENC-001 与我们联系。",
];

export const DISCLAIMER_TEXT = DISCLAIMER_SECTIONS.join(String.fromCharCode(10) + String.fromCharCode(10));

export class DisclaimerModal {
  static async show(): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      const overlay = document.createElement("div");
      overlay.className = "modal-overlay";
      const body = DISCLAIMER_SECTIONS.map((s) => "<p>" + s + "</p>").join("");
      overlay.innerHTML = [
        '<div class="modal disclaimer-modal">'
        , '  <h3>' + i18n.t("disclaimer.title") + '</h3>'
        , '  <div class="disclaimer-scroll" tabindex="0">' + body + '</div>'
        , '  <div class="disclaimer-note" hidden>' + i18n.t("disclaimer.need.scroll") + '</div>'
        , '  <div class="modal-actions">'
        , '    <button id="dm-agree" class="term-btn dm-disabled">' + i18n.t("disclaimer.agree") + '</button>'
        , '    <button id="dm-cancel" class="term-btn">' + i18n.t("disclaimer.cancel") + '</button>'
        , '  </div>'
        , '</div>'
      ].join("");
      document.body.appendChild(overlay);
      setModalAria(overlay, "dm-title");
      trapFocus(overlay);
      const scrollEl = overlay.querySelector<HTMLElement>(".disclaimer-scroll")!;
      const agree = overlay.querySelector<HTMLButtonElement>("#dm-agree")!;
      const cancel = overlay.querySelector<HTMLButtonElement>("#dm-cancel")!;
      const note = overlay.querySelector<HTMLElement>(".disclaimer-note")!;
      const atBottom = (): boolean =>
        scrollEl.scrollTop + scrollEl.clientHeight >= scrollEl.scrollHeight - 2;
      scrollEl.addEventListener("scroll", () => {
        if (atBottom()) {
          agree.classList.remove("dm-disabled");
          note.hidden = true;
        }
      });
      const cleanup = (): void => {
        overlay.remove();
        window.removeEventListener("keydown", onKey);
      };
      const onKey = (e: KeyboardEvent): void => {
        if (e.key === "Escape") {
          cleanup();
          resolve(false);
        }
      };
      window.addEventListener("keydown", onKey);
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) {
          cleanup();
          resolve(false);
        }
      });
      agree.addEventListener("click", () => {
        if (!atBottom()) {
          note.hidden = false;
          scrollEl.focus();
          return;
        }
        cleanup();
        resolve(true);
      });
      cancel.addEventListener("click", () => {
        cleanup();
        resolve(false);
      });
      cancel.focus();
    });
  }
}
