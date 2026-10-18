// preview.html added to every downloaded theme zip: a standalone page that mocks the main site,
// the promo page and the promo form with the theme's variables and theme.css, so a theme can be
// checked by opening the file in a browser. It is never stored or served by the site.
import { DEFAULT_THEME_VARIABLES } from '@shared/themes'

/** JSON safe to put inside a <script> element. */
const scriptJson = (value: unknown) => JSON.stringify(value).replace(/</g, `${String.fromCharCode(92)}u003c`)

const TILES = Array.from({ length: 40 }, (_, i) => {
  const n = [12, 47, 103, 5, 88, 260, 31, 499, 150, 72, 9, 318, 64, 207, 3, 441, 129, 56, 380, 24, 91, 233, 17, 402, 68, 155, 290, 7, 344, 81, 120, 466, 39, 198, 275, 14, 357, 101, 420, 60][i]
  const kind = [1, 4, 9, 15, 22, 30].includes(i) ? 'owned' : [6, 27].includes(i) ? 'hot' : [12, 13].includes(i) ? 'promo' : 'free'
  return `<div class="tile ${kind}"><b>${n}</b><span>${kind === 'owned' ? 'มีเจ้าของ' : kind === 'hot' ? '🔥 ฮิต' : kind === 'promo' ? 'โฆษณา' : 'ว่าง'}</span></div>`
}).join('')

const PAGE = `<!doctype html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>ตัวอย่างธีม</title>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Prompt:wght@300;400;500;600;700&family=Plus+Jakarta+Sans:wght@500;700;800&family=Noto+Sans+Thai:wght@400;700&display=swap" rel="stylesheet">
<style>
:root { __DEFAULTS__ }
* { box-sizing: border-box; margin: 0; }
body { font-family: var(--app-font-body); background: #e9ecef; color: #212529; }

/* preview toolbar (not part of the theme) */
.bar { position: sticky; top: 0; z-index: 10; display: flex; flex-wrap: wrap; gap: 8px; align-items: center; padding: 10px 16px; background: #fff; border-bottom: 1px solid #dee2e6; font: 14px/1.4 system-ui, 'Prompt', sans-serif; color: #212529; }
.bar h1 { font-size: 16px; margin-right: auto; }
.bar h1 small { font-weight: 400; color: #6c757d; }
.bar button, .bar label { border: 1px solid #ced4da; background: #fff; border-radius: 6px; padding: 6px 12px; cursor: pointer; font: inherit; }
.bar button[aria-selected=true] { background: #007bff; border-color: #007bff; color: #fff; }
.bar input { display: none; }
.note { padding: 8px 16px; font: 13px/1.5 system-ui, 'Prompt', sans-serif; color: #6c757d; background: #f8f9fa; border-bottom: 1px solid #dee2e6; }
.note.warn { color: #856404; background: #fff3cd; }
section[data-view] { display: none; }
section[data-view].on { display: block; }

/* main site mock */
.site-theme-page { min-height: 100vh; background-color: var(--theme-page-bg); background-image: var(--theme-page-bg-image); background-size: cover; background-position: center top; color: var(--theme-page-text); font-family: var(--theme-font-heading); padding-bottom: 40px; }
.hdr { display: flex; align-items: center; gap: 12px; padding: 14px 20px; border-bottom: 1px solid color-mix(in oklab, var(--color-stone-800) 70%, transparent); background: color-mix(in oklab, var(--color-stone-950) 70%, transparent); }
.logo { width: 34px; height: 34px; border-radius: 50%; background: linear-gradient(135deg, var(--color-amber-400), var(--color-rose-500)); }
.brand { font-weight: 800; font-size: 18px; }
.brand em { font-style: normal; font-size: 12px; color: var(--color-amber-400); }
.pill { padding: 6px 12px; border-radius: 10px; font-size: 13px; border: 1px solid var(--color-stone-800); color: var(--color-stone-300); background: var(--color-stone-900); }
.pill.region { border-color: color-mix(in oklab, var(--color-purple-500) 50%, transparent); background: color-mix(in oklab, var(--color-purple-900) 50%, transparent); color: var(--color-purple-200); }
.pill.gold { margin-left: auto; background: linear-gradient(90deg, var(--color-amber-400), var(--color-amber-600)); color: var(--color-stone-950); border: 0; font-weight: 700; }
.welcome { margin: 16px 20px; padding: 14px 18px; border-radius: 14px; display: flex; flex-wrap: wrap; gap: 12px; align-items: center; background: linear-gradient(90deg, color-mix(in oklab, var(--color-purple-900) 60%, transparent), color-mix(in oklab, var(--color-rose-900) 40%, transparent)); border: 1px solid color-mix(in oklab, var(--color-rose-500) 25%, transparent); }
.welcome p { flex: 1; min-width: 200px; font-family: var(--app-font-body); }
.welcome p strong { color: var(--color-rose-300); }
.btn-kyc { padding: 8px 14px; border-radius: 10px; color: #fff; font-weight: 600; background: linear-gradient(90deg, var(--color-orange-500), var(--color-rose-500)); }
.wrap { max-width: 1100px; margin: 0 auto; padding: 0 20px; }
.region-head { margin: 8px 0 14px; padding: 12px 16px; border-radius: 14px; border: 1px solid color-mix(in oklab, var(--color-amber-500) 30%, transparent); background: color-mix(in oklab, var(--color-amber-500) 8%, transparent); }
.region-head h2 { font-size: 20px; color: var(--color-amber-300); }
.region-head p { font-family: var(--app-font-body); font-size: 14px; color: var(--color-stone-400); }
.chips { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 14px; font-family: var(--app-font-body); }
.chip { padding: 5px 12px; border-radius: 999px; font-size: 13px; background: var(--color-stone-900); border: 1px solid var(--color-stone-800); color: var(--color-stone-400); }
.chip.on { background: var(--color-amber-400); border-color: var(--color-amber-400); color: var(--color-stone-950); font-weight: 600; }
.grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(78px, 1fr)); gap: 6px; }
.tile { aspect-ratio: 1; border-radius: 8px; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 2px; background: var(--color-stone-900); border: 1px solid var(--color-stone-800); color: var(--color-stone-500); font-size: 11px; }
.tile b { font-size: 16px; color: var(--color-stone-300); }
.tile.free span { color: var(--color-emerald-400); }
.tile.owned { border-color: color-mix(in oklab, var(--color-amber-400) 60%, transparent); background: linear-gradient(160deg, color-mix(in oklab, var(--color-amber-500) 22%, var(--color-stone-900)), var(--color-stone-900)); box-shadow: 0 0 14px color-mix(in oklab, var(--color-amber-400) 25%, transparent); }
.tile.owned b, .tile.owned span { color: var(--color-amber-300); }
.tile.hot { border-color: var(--color-rose-500); background: color-mix(in oklab, var(--color-rose-600) 25%, var(--color-stone-900)); }
.tile.hot b, .tile.hot span { color: var(--color-rose-300); }
.tile.promo { border-color: color-mix(in oklab, var(--color-purple-400) 60%, transparent); background: linear-gradient(135deg, color-mix(in oklab, var(--color-orange-500) 30%, transparent), color-mix(in oklab, var(--color-purple-600) 35%, transparent)); }
.tile.promo b, .tile.promo span { color: var(--color-purple-100); }
.cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 14px; margin-top: 20px; font-family: var(--app-font-body); }
.card { padding: 16px; border-radius: 16px; background: var(--color-stone-900); border: 1px solid var(--color-stone-800); }
.card h3 { font-family: var(--theme-font-heading); font-size: 17px; color: var(--color-stone-100); margin-bottom: 6px; }
.card p { font-size: 14px; color: var(--color-stone-400); margin-bottom: 12px; }
.badge { display: inline-block; padding: 2px 8px; border-radius: 6px; font-size: 12px; margin-right: 4px; }
.badge.ok { background: color-mix(in oklab, var(--color-emerald-500) 18%, transparent); color: var(--color-emerald-300); }
.badge.gold { background: color-mix(in oklab, var(--color-amber-500) 18%, transparent); color: var(--color-amber-300); }
.badge.hot { background: color-mix(in oklab, var(--color-rose-500) 18%, transparent); color: var(--color-rose-300); }
.cta { display: block; width: 100%; padding: 11px; border: 0; border-radius: 12px; font: 600 15px var(--app-font-body); color: #fff; background: linear-gradient(90deg, var(--color-orange-500), var(--color-purple-600)); }
.cta.gold { color: var(--color-stone-950); background: linear-gradient(90deg, var(--color-amber-300), var(--color-amber-500)); }

/* promo page mock */
.theme-scope-promo.page { min-height: 100vh; background: radial-gradient(120% 50% at 50% 0%, var(--promo-page-glow), var(--promo-page-bg) 62%); color: var(--promo-page-text); font-family: var(--promo-page-font); }
.page .inner { max-width: 520px; margin: 0 auto; padding-bottom: 30px; }
.page .media { position: relative; aspect-ratio: 4/3; background: var(--promo-page-media-bg); display: grid; place-items: center; font-size: 64px; }
.page .media::after { content: ''; position: absolute; inset: auto 0 0; height: 34%; background: linear-gradient(to top, var(--promo-page-bg) 6%, transparent); }
.page .top { position: absolute; inset: 12px 12px auto; display: flex; justify-content: space-between; z-index: 2; }
.glass { padding: 8px 14px; border-radius: 999px; background: var(--promo-page-glass); backdrop-filter: blur(8px); color: #fff; font-size: 14px; font-weight: 600; }
.glass.badge-t { color: var(--promo-page-badge); }
.page .body { position: relative; z-index: 1; padding: 6px 20px 0; }
.page h1 { font-size: 32px; font-weight: 800; line-height: 1.2; }
.page .role { margin-top: 6px; font-size: 15px; color: var(--promo-page-muted); }
.page .hook { margin-top: 10px; font-size: 19px; font-weight: 700; color: var(--promo-page-highlight); }
.offer { margin-top: 18px; padding: 14px 16px; border-radius: 16px; color: #fff; display: flex; justify-content: space-between; align-items: center; gap: 10px; background: linear-gradient(90deg, var(--promo-page-offer-from), var(--promo-page-offer-to)); box-shadow: 0 8px 24px var(--promo-page-shadow); }
.offer b { font-size: 24px; }
.offer s { opacity: .7; margin-left: 6px; }
.info { margin-top: 18px; display: grid; gap: 10px; font-size: 15px; }
.info div { display: flex; gap: 10px; color: var(--promo-page-muted); }
.info div b { color: var(--promo-page-text); font-weight: 500; }
.chipbox { display: flex; flex-wrap: wrap; gap: 8px; margin-top: 16px; }
.chipbox span { padding: 6px 12px; border-radius: 999px; border: 1px solid rgba(255,255,255,.15); background: rgba(255,255,255,.06); font-size: 14px; }
.actions { display: flex; gap: 10px; margin-top: 22px; }
.actions a { flex: 1; min-height: 54px; display: grid; place-items: center; border-radius: 16px; font-weight: 700; text-decoration: none; }
.actions .main { flex: 1.6; color: #fff; font-size: 19px; background: linear-gradient(90deg, var(--promo-page-button-from), var(--promo-page-button-to)); box-shadow: 0 8px 24px var(--promo-page-shadow); }
.actions .sub { color: var(--promo-page-text); border: 2px solid rgba(255,255,255,.15); background: rgba(255,255,255,.06); }

/* promo form mock */
.formbg { min-height: 100vh; display: grid; place-items: center; padding: 24px; background: #000; background: radial-gradient(circle at 30% 20%, #2a1245, #000 70%); }
.theme-scope-promo.dialog { width: 100%; max-width: 510px; border-radius: 24px; border: 1px solid var(--promo-border); background: var(--promo-bg); color: var(--promo-text); font: 13px var(--app-font-body); overflow: hidden; }
.dialog header { display: flex; gap: 13px; align-items: center; padding: 22px 24px; border-bottom: 1px solid var(--promo-border); }
.dialog .icon { width: 44px; height: 44px; border-radius: 14px; display: grid; place-items: center; color: var(--promo-accent); background: linear-gradient(140deg, color-mix(in oklab, var(--promo-orange) 15%, transparent), color-mix(in oklab, var(--promo-fuchsia) 15%, transparent)); font-size: 22px; }
.dialog .eyebrow { font: 700 9px 'Plus Jakarta Sans', sans-serif; letter-spacing: 1.6px; color: var(--promo-accent); }
.dialog h3 { font-size: 19px; font-weight: 600; }
.dialog .muted { color: var(--promo-muted); }
.dialog .content { padding: 22px 24px; display: grid; gap: 16px; }
.dialog .label { font-weight: 600; font-size: 14px; }
.opts { display: grid; grid-template-columns: repeat(4, 1fr); gap: 8px; }
.opt { padding: 12px 6px; border-radius: 12px; text-align: center; background: var(--promo-surface); border: 1px solid var(--promo-border); }
.opt.on { background: var(--promo-surface-active); border-color: var(--promo-accent); color: var(--promo-accent); }
.opt b { display: block; font-size: 18px; color: var(--promo-text); }
.field { padding: 11px 14px; border-radius: 12px; background: var(--promo-surface); border: 1px solid var(--promo-border); color: var(--promo-muted); }
.dialog footer { padding: 16px 24px; border-top: 1px solid var(--promo-border); display: flex; justify-content: space-between; align-items: center; }
.dialog footer b { font-size: 20px; }
.dialog footer span.go { padding: 11px 20px; border-radius: 12px; color: #fff; font-weight: 600; background: linear-gradient(90deg, var(--promo-orange), var(--promo-fuchsia)); }

/* palette */
.pal { padding: 20px; font: 13px system-ui, 'Prompt', sans-serif; }
.pal h3 { margin: 18px 0 8px; font-size: 15px; }
.sw { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 8px; }
.sw div { border-radius: 8px; overflow: hidden; border: 1px solid #dee2e6; background: #fff; }
.sw i { display: block; height: 44px; }
.sw code { display: block; padding: 4px 6px; font-size: 11px; word-break: break-all; }
.sw small { display: block; padding: 0 6px 6px; color: #6c757d; word-break: break-all; }
.sw .changed code { color: #d63384; font-weight: 700; }
</style>
<style id="theme-vars"></style>
<link rel="stylesheet" href="theme.css">
</head>
<body>
<div class="bar">
  <h1 id="title">ตัวอย่างธีม</h1>
  <button data-tab="main" aria-selected="true">หน้าเว็บหลัก</button>
  <button data-tab="promo">หน้าโปรโมชัน</button>
  <button data-tab="form">ฟอร์มขอโปรโมท</button>
  <button data-tab="palette">ตัวแปรทั้งหมด</button>
  <label title="เลือกไฟล์ theme.json ที่แก้แล้วเพื่อดูผลทันที">↻ โหลด theme.json ที่แก้แล้ว<input type="file" id="pick" accept=".json,application/json"></label>
</div>
<div class="note" id="note"></div>

<section data-view="main" class="on">
  <div class="site-theme-page">
    <div class="hdr"><span class="logo"></span><span class="brand">500 Windows <em>to Thailand</em></span><span class="pill region">🏔️ ภาคเหนือ</span><span class="pill">Hub รวมข้อมูล</span><span class="pill gold">เข้าสู่ระบบ</span></div>
    <div class="welcome"><p>ยินดีต้อนรับ <strong>คุณผู้ใช้</strong> — ยืนยันตัวตนเพื่อเปิดสิทธิ์ซื้อ-ขายต่อ</p><span class="btn-kyc">ยืนยันตัวตน (KYC)</span></div>
    <div class="wrap">
      <div class="region-head"><h2>🏔️ ภาคเหนือ · 500 บาน</h2><p>ดินแดนล้านนา ขุนเขา ทะเลหมอก ไร่ชา กาแฟอาราบิก้า และวิถีชีวิตสโลว์ไลฟ์</p></div>
      <div class="chips"><span class="chip on">ทั้งหมด (500)</span><span class="chip">ว่าง (452)</span><span class="chip">มีเจ้าของ (46)</span><span class="chip">ขายต่อ (2)</span></div>
      <div class="grid">__TILES__</div>
      <div class="cards">
        <div class="card"><h3>หน้าต่างบานที่ 47</h3><p><span class="badge gold">มีเจ้าของ</span><span class="badge hot">🔥 ยอดนิยม</span></p><p>ร้านกาแฟริมดอย เปิดทุกวัน 8:00–17:00 แวะมาชิมกาแฟคั่วเองได้เลย</p><button class="cta gold">ดูหน้าต่างนี้</button></div>
        <div class="card"><h3>หน้าต่างบานที่ 5</h3><p><span class="badge ok">ว่าง</span></p><p>บานนี้ยังไม่มีเจ้าของ จับจองเพื่อจัดแสดงเรื่องราวของคุณ</p><button class="cta">จับจองเป็นเจ้าของบานนี้ (500 ฿)</button></div>
      </div>
    </div>
  </div>
</section>

<section data-view="promo">
  <div class="theme-scope-promo page"><div class="inner">
    <div class="media">☕<div class="top"><span class="glass">✕ ปิด</span><span class="glass badge-t">โฆษณา · Sponsored</span><span class="glass">แชร์</span></div></div>
    <div class="body">
      <h1>บ้านกาแฟดอยสูง</h1>
      <p class="role">คาเฟ่และร้านกาแฟ</p>
      <p class="hook">ซื้อ 1 แถม 1 ทุกเมนูกาแฟ</p>
      <div class="offer"><span><b>ซื้อ 1 แถม 1</b><br>ทุกเมนูเครื่องดื่ม</span><span><b>฿65</b><s>฿130</s></span></div>
      <div class="info"><div>🕘 <b>เปิด 8:00–17:00 ทุกวัน</b></div><div>📍 <b>อ.แม่ริม เชียงใหม่</b></div><div>✓ เมล็ดกาแฟคั่วเองจากไร่</div></div>
      <div class="chipbox"><span>Facebook</span><span>Instagram</span><span>เว็บไซต์</span></div>
      <div class="actions"><a class="main" href="#">💬 แชทผ่าน LINE</a><a class="sub" href="#">ไปที่ลิงก์</a></div>
    </div>
  </div></div>
</section>

<section data-view="form">
  <div class="formbg"><div class="theme-scope-promo dialog">
    <header><span class="icon">📣</span><div><div class="eyebrow">500 WINDOWS · PROMOTE</div><h3>โปรโมทแบรนด์ของคุณ</h3><p class="muted">แสดงบนกระดานหน้าต่างทุกภูมิภาค</p></div></header>
    <div class="content">
      <div class="label">เลือกแพ็กเกจโปรโมท</div>
      <div class="opts"><div class="opt"><b>2</b>ช่อง</div><div class="opt on"><b>3</b>ช่อง</div><div class="opt"><b>4</b>ช่อง</div><div class="opt"><b>6</b>ช่อง</div></div>
      <div class="label">ชื่อแบรนด์</div>
      <div class="field">เช่น บ้านกาแฟดอยสูง</div>
    </div>
    <footer><span class="muted">ยอดชำระ <b style="color:var(--promo-text)">฿90</b></span><span class="go">ส่งคำขอโปรโมท</span></footer>
  </div></div>
</section>

<section data-view="palette"><div class="pal" id="palette"></div></section>

<script type="application/json" id="embedded">__MANIFEST__</script>
<script>
var DEFAULTS = __DEFAULT_VARS__;
var SAFE = /^--[A-Za-z0-9_-]{1,80}$/;

function flatten(vars) {
  var out = {};
  Object.keys(vars || {}).forEach(function (k) {
    var v = vars[k];
    if (v && typeof v === 'object') Object.keys(v).forEach(function (n) { out[n] = String(v[n]); });
    else out[k] = String(v);
  });
  return out;
}

function apply(manifest, source) {
  var vars = flatten(manifest.variables);
  var lines = [];
  Object.keys(vars).forEach(function (n) {
    if (SAFE.test(n) && vars[n] && !/[;{}<>]/.test(vars[n])) lines.push(n + ': ' + vars[n] + ';');
  });
  document.getElementById('theme-vars').textContent = ':root, .theme-scope-promo {\\n' + lines.join('\\n') + '\\n}';
  document.getElementById('title').innerHTML = '';
  document.getElementById('title').append('ตัวอย่างธีม: ' + (manifest.name || '(ไม่มีชื่อ)'));
  var small = document.createElement('small');
  small.textContent = manifest.version ? '  v' + manifest.version : '';
  document.getElementById('title').append(small);
  var note = document.getElementById('note');
  note.className = 'note' + (source === 'embedded' ? ' warn' : '');
  note.textContent = source === 'embedded'
    ? 'แสดงค่าตอนดาวน์โหลด — ถ้าแก้ theme.json แล้ว กด "โหลด theme.json ที่แก้แล้ว" เพื่อดูผล (theme.css และรูปใน assets/ อัปเดตเองเมื่อรีเฟรชหน้า)'
    : 'แสดงค่าจาก ' + source + ' · ตัวแปรที่เปลี่ยนจากค่าเดิม ' + Object.keys(vars).filter(function (n) { return DEFAULTS[n] !== vars[n]; }).length + ' ตัว';
  renderPalette(vars);
}

function renderPalette(vars) {
  var groups = {};
  Object.keys(DEFAULTS).concat(Object.keys(vars).filter(function (n) { return !(n in DEFAULTS); })).forEach(function (n) {
    var g = n.indexOf('--color-') === 0 ? n.split('-')[3] : n.indexOf('--promo-page') === 0 ? 'promo-page' : n.indexOf('--promo-') === 0 ? 'promo-dialog' : 'page';
    (groups[g] = groups[g] || []).push(n);
  });
  var root = document.getElementById('palette');
  root.innerHTML = '';
  Object.keys(groups).forEach(function (g) {
    var h = document.createElement('h3'); h.textContent = g; root.append(h);
    var box = document.createElement('div'); box.className = 'sw';
    groups[g].forEach(function (n) {
      var cell = document.createElement('div');
      if (n in vars && vars[n] !== DEFAULTS[n]) cell.className = 'changed';
      var i = document.createElement('i'); i.style.background = 'var(' + n + ')';
      var c = document.createElement('code'); c.textContent = n;
      var s = document.createElement('small'); s.textContent = n in vars ? vars[n] : DEFAULTS[n] + ' (ค่าเดิม)';
      cell.append(i, c, s); box.append(cell);
    });
    root.append(box);
  });
}

document.querySelectorAll('[data-tab]').forEach(function (b) {
  b.onclick = function () {
    document.querySelectorAll('[data-tab]').forEach(function (x) { x.setAttribute('aria-selected', x === b); });
    document.querySelectorAll('section[data-view]').forEach(function (s) { s.classList.toggle('on', s.dataset.view === b.dataset.tab); });
  };
});

document.getElementById('pick').onchange = function (e) {
  var file = e.target.files[0];
  if (!file) return;
  file.text().then(function (t) {
    try { apply(JSON.parse(t.replace(/^\\uFEFF/, '')), file.name); }
    catch (err) { alert('theme.json ไม่ใช่ JSON ที่ถูกต้อง: ' + err.message); }
  });
  e.target.value = '';
};

var embedded = JSON.parse(document.getElementById('embedded').textContent);
apply(embedded, 'embedded');
// Served over http (not file://), read the current theme.json directly.
if (location.protocol !== 'file:') {
  fetch('theme.json', { cache: 'no-store' }).then(function (r) { return r.json(); }).then(function (m) { apply(m, 'theme.json'); }).catch(function () {});
}
</script>
</body>
</html>
`

/** preview.html for a theme, with its theme.json embedded. */
export function themePreviewHtml(manifest: unknown): string {
  const defaults = Object.entries(DEFAULT_THEME_VARIABLES)
    .map(([name, value]) => `${name}: ${value};`)
    .join(' ')
  return PAGE.replace('__DEFAULTS__', defaults)
    .replace('__TILES__', TILES)
    .replace('__DEFAULT_VARS__', () => scriptJson(DEFAULT_THEME_VARIABLES))
    .replace('__MANIFEST__', () => scriptJson(manifest))
}
