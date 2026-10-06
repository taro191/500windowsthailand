import translations from "./translations";

type TranslationState = {
  th: string;
  en: string;
};

const translationOverrides = {
  กระบี่: "Krabi",
  กาฬสินธุ์: "Kalasin",
  กำแพงเพชร: "Kamphaeng Phet",
  จันทบุรี: "Chanthaburi",
  ชัยนาท: "Chai Nat",
  ชัยภูมิ: "Chaiyaphum",
  ชุมพร: "Chumphon",
  ตราด: "Trat",
  ตาก: "Tak",
  นครนายก: "Nakhon Nayok",
  นครปฐม: "Nakhon Pathom",
  นครพนม: "Nakhon Phanom",
  นครศรีธรรมราช: "Nakhon Si Thammarat",
  นครสวรรค์: "Nakhon Sawan",
  นนทบุรี: "Nonthaburi",
  นราธิวาส: "Narathiwat",
  น่าน: "Nan",
  บึงกาฬ: "Bueng Kan",
  บุรีรัมย์: "Buriram",
  ปทุมธานี: "Pathum Thani",
  ประจวบคีรีขันธ์: "Prachuap Khiri Khan",
  ปราจีนบุรี: "Prachinburi",
  ปัตตานี: "Pattani",
  พะเยา: "Phayao",
  พังงา: "Phang Nga",
  พัทลุง: "Phatthalung",
  พิจิตร: "Phichit",
  พิษณุโลก: "Phitsanulok",
  ภูเก็ต: "Phuket",
  มุกดาหาร: "Mukdahan",
  ยะลา: "Yala",
  ยโสธร: "Yasothon",
  ระนอง: "Ranong",
  ระยอง: "Rayong",
  ราชบุรี: "Ratchaburi",
  ลพบุรี: "Lopburi",
  ลำปาง: "Lampang",
  ลำพูน: "Lamphun",
  เลย: "Loei",
  ศรีสะเกษ: "Sisaket",
  สกลนคร: "Sakon Nakhon",
  สงขลา: "Songkhla",
  สตูล: "Satun",
  สมุทรสงคราม: "Samut Songkhram",
  สมุทรสาคร: "Samut Sakhon",
  สระแก้ว: "Sa Kaeo",
  สระบุรี: "Saraburi",
  สิงห์บุรี: "Sing Buri",
  สุโขทัย: "Sukhothai",
  สุพรรณบุรี: "Suphan Buri",
  สุราษฎร์ธานี: "Surat Thani",
  สุรินทร์: "Surin",
  หนองคาย: "Nong Khai",
  หนองบัวลำภู: "Nong Bua Lamphu",
  อ่างทอง: "Ang Thong",
  อำนาจเจริญ: "Amnat Charoen",
  อุตรดิตถ์: "Uttaradit",
  อุทัยธานี: "Uthai Thani",
  เพชรบุรี: "Phetchaburi",
  เพชรบูรณ์: "Phetchabun",
  แพร่: "Phrae",
  แม่ฮ่องสอน: "Mae Hong Son",
  "กติกา & เงื่อนไข 2 บาน": "Rules & 2-Window Limit",
  "ค้นหา & กรอง": "Search & Filter",
  "บัญชี & กระเป๋าเงิน": "Account & Wallet",
  "การได้รับโอกาสที่ดี ของคนเราไม่เท่ากัน แต่ หากวันหนึ่ง คนเรา มีโอกาส 500 เท่า และ โอกาส 3,500 เท่า ลองคิดดูนะครับชีวิตหนึ่งชีวิตจะท้าทายขนาดใหน แค่คิดก็อยากได้รับโอกาสนั้น จริงๆก็แค่เริ่มลงมือทำ \" เปิดหน้าต่างบานแรกที่แสนจะเรียบง่าย ประกาศให้โลกรู้ ฉันอยู่ตรงนี้\" บอกความเป็นตัวตน บอกสิ่งที่ชอบ จากความตั้งใจอันแรงกล้า บอกให้ทุกคนเห็นเอกลักษณ์เฉพาะตน บอกเรื่องเล่าเรื่องราว อาชีพ กิจกรรม ธุรกิจ ศิลปะ ดนตรี ผ่านหน้าต่าง บานเล็กๆ แห่งนี้ หากนี้คือโอกาสที่ดี ลงมือเลยเปิดหน้าต่างของคุณ ของวันนี้ ผ่านกาลเวลา ควบคู่กับการสร้างมูลค่าให้หน้าต่างบานนี้ ที่แตกต่างเฉพาะคุณ":
    "Not everyone receives the same opportunities. But imagine if, one day, each person had 500 opportunities—or even 3,500. Think about how challenging and exciting one life could become. Just imagining it makes you want that chance. In truth, it begins simply by taking action: \"Open your first, beautifully simple window and announce to the world, I am here.\" Show who you are and what you love. With strong intention, let everyone see what makes you unique. Share your stories, profession, activities, business, art, and music through this small window. If this is a meaningful opportunity, take it. Open your window today, let it travel through time, and build value in a window that is uniquely yours.",
  "ขอรหัส OTP": "Request OTP",
  "ส่ง OTP อีกครั้ง": "Resend OTP",
  "Hub-ระบบจัดการ": "Management Hub",
  "กลับหน้าแรก (500 Windows)": "Back to home (500 Windows)",
  "สมาชิกใหม่ (ผู้ใช้เริ่มต้น)": "New member",
  "ยังไม่ได้ยืนยันตัวตน (คลิกเพื่อยืนยัน)":
    "Identity not verified (tap to verify)",
  "เลือกหน้าต่างภูมิภาค": "Select a region",
  "กรองสถานะหน้าต่าง": "Filter by window status",
  "หน้าต่างประเทศไทย (KAP-TH)": "Thailand Windows (KAP-TH)",
  "เปิดขายต่อ": "For resale",
  "มีภาพแล้ว": "Has image",
  "บานของฉัน": "My windows",
  เบอร์โทรศัพท์มือถือ: "Mobile phone number",
  เหนือ: "North",
  กลาง: "Central",
  อีสาน: "Northeast",
  ตะวันตก: "West",
  ตะวันออก: "East",
  ใต้: "South",
  ว่าง: "Available",
  สถิติ: "Statistics",
  จับจอง: "Reserve",
  ขายต่อ: "Resell",
  ถือครอง: "Owned",
  ถอนเงิน: "Withdraw",
  เติมเงิน: "Add funds",
  โอนสิทธิ์: "Transfer ownership",
  ยอดเงิน: "Balance",
  รายการ: "items",
  รูป: "image",
  บาน: "windows",
  หน้าต่าง: "window",
  หน้าต่างประเทศไทย: "Thailand Windows",
  หน้าต่างสู่ประเทศไทย: "Windows to Thailand",
} as const;

const frame = document.querySelector<HTMLIFrameElement>("#app");
const entries = Object.entries({ ...translations, ...translationOverrides }).sort(
  ([thaiA], [thaiB]) => thaiB.length - thaiA.length,
);
const textStates = new WeakMap<Text, TranslationState>();
const attributeStates = new WeakMap<Element, Map<string, TranslationState>>();
const translatableAttributes = ["aria-label", "alt", "placeholder", "title"];

let language: "th" | "en" = "th";
let observer: MutationObserver | undefined;
let appDocument: Document | undefined;

function translate(value: string) {
  let translated = value;

  for (const [thai, english] of entries) {
    if (translated.includes(thai)) {
      translated = translated.split(thai).join(english);
    }
  }

  return translated;
}

function updateTextNode(node: Text) {
  const current = node.nodeValue ?? "";
  let state = textStates.get(node);

  if (!state || (current !== state.th && current !== state.en)) {
    state = { th: current, en: translate(current) };
    textStates.set(node, state);
  }

  const nextValue = language === "en" ? state.en : state.th;
  if (current !== nextValue) node.nodeValue = nextValue;
}

function updateAttributes(element: Element) {
  let states = attributeStates.get(element);
  if (!states) {
    states = new Map();
    attributeStates.set(element, states);
  }

  for (const attribute of translatableAttributes) {
    if (!element.hasAttribute(attribute)) continue;

    const current = element.getAttribute(attribute) ?? "";
    let state = states.get(attribute);
    if (!state || (current !== state.th && current !== state.en)) {
      state = { th: current, en: translate(current) };
      states.set(attribute, state);
    }

    const nextValue = language === "en" ? state.en : state.th;
    if (current !== nextValue) element.setAttribute(attribute, nextValue);
  }
}

function updateTree(root: Node) {
  if (root.nodeType === Node.TEXT_NODE) {
    updateTextNode(root as Text);
    return;
  }

  if (root.nodeType === Node.ELEMENT_NODE) {
    updateAttributes(root as Element);
  }

  const walker = (root.ownerDocument ?? document).createTreeWalker(
    root,
    NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT,
  );

  let node = walker.nextNode();
  while (node) {
    if (node.nodeType === Node.TEXT_NODE) updateTextNode(node as Text);
    else updateAttributes(node as Element);
    node = walker.nextNode();
  }
}

function setLanguage(nextLanguage: "th" | "en") {
  language = nextLanguage;
  document.documentElement.lang = language;
  appDocument?.documentElement.setAttribute("lang", language);

  appDocument
    ?.querySelectorAll<HTMLButtonElement>("[data-language]")
    .forEach((button) => {
      const active = button.dataset.language === language;
      button.dataset.active = String(active);
      button.setAttribute("aria-pressed", String(active));
    });

  if (appDocument?.body) updateTree(appDocument.body);
}

function addRenderingStyles(documentRoot: Document) {
  if (documentRoot.querySelector("#text-rendering-enhancements")) return;

  const style = documentRoot.createElement("style");
  style.id = "text-rendering-enhancements";
  style.textContent = `
    html {
      -webkit-font-smoothing: antialiased;
      -moz-osx-font-smoothing: grayscale;
      text-rendering: optimizeLegibility;
      font-kerning: normal;
      font-synthesis: none;
      -webkit-text-size-adjust: 100%;
    }
    [role="tab"] > span {
      overflow-wrap: anywhere;
    }
    input[type="tel"] {
      min-width: 0;
    }
  `;
  documentRoot.head.append(style);
}

function ensureLanguageControl(documentRoot: Document) {
  const slot = documentRoot.querySelector("#language-control-slot");
  if (!slot || slot.querySelector(".language-control")) return;

  if (!documentRoot.querySelector("#language-control-styles")) {
    const style = documentRoot.createElement("style");
    style.id = "language-control-styles";
    style.textContent = `
      .language-control {
        display: flex;
        padding: 3px;
        border: 1px solid rgba(255, 255, 255, 0.18);
        border-radius: 999px;
        background: rgba(12, 10, 9, 0.82);
        box-shadow: 0 4px 14px rgba(0, 0, 0, 0.24);
        font: 600 11px/1 system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      }
      .language-control-label {
        color: rgba(255, 255, 255, 0.58);
        font: 500 11px/1.2 system-ui, -apple-system, BlinkMacSystemFont, sans-serif;
      }
      .language-control button {
        min-width: 36px;
        min-height: 36px;
        padding: 0 8px;
        border: 0;
        border-radius: 999px;
        color: rgba(255, 255, 255, 0.62);
        background: transparent;
        cursor: pointer;
        touch-action: manipulation;
      }
      .language-control button[data-active="true"] {
        color: #fff;
        background: rgba(244, 63, 94, 0.92);
      }
      .language-control button:focus-visible {
        outline: 2px solid #fda4af;
        outline-offset: 2px;
      }
    `;
    documentRoot.head.append(style);
  }

  const control = documentRoot.createElement("div");
  control.className = "language-control";
  control.setAttribute("role", "group");
  control.setAttribute("aria-label", "Language");

  for (const option of ["th", "en"] as const) {
    const button = documentRoot.createElement("button");
    const active = option === language;
    button.type = "button";
    button.dataset.language = option;
    button.dataset.active = String(active);
    button.textContent = option.toUpperCase();
    button.setAttribute("aria-pressed", String(active));
    button.setAttribute(
      "aria-label",
      option === "th" ? "เปลี่ยนเป็นภาษาไทย" : "Switch to English",
    );
    button.addEventListener("click", () => setLanguage(option));
    control.append(button);
  }

  const label = documentRoot.createElement("span");
  label.className = "language-control-label";
  label.textContent = "ภาษา / Language";
  slot.append(label);
  slot.append(control);
}

function connectToApp() {
  const documentRoot = frame?.contentDocument;
  if (!documentRoot?.body) return;

  observer?.disconnect();
  appDocument = documentRoot;
  addRenderingStyles(documentRoot);
  updateTree(documentRoot.body);
  ensureLanguageControl(documentRoot);

  observer = new MutationObserver((mutations) => {
    for (const mutation of mutations) {
      if (mutation.type === "attributes") {
        updateAttributes(mutation.target as Element);
      } else if (mutation.type === "characterData") {
        updateTextNode(mutation.target as Text);
      } else {
        mutation.addedNodes.forEach(updateTree);
      }
    }
    ensureLanguageControl(documentRoot);
  });

  observer.observe(documentRoot.body, {
    attributes: true,
    attributeFilter: translatableAttributes,
    characterData: true,
    childList: true,
    subtree: true,
  });
}

frame?.addEventListener("load", connectToApp);
connectToApp();
setLanguage("th");
