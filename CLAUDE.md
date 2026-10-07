# CLAUDE.md

500 Windows to Thailand (Kapsulep) — แพลตฟอร์มถือครอง/จัดแสดงหน้าต่าง 3,500 บาน (7 ภูมิภาค × 500 บาน)
มีเว็บผู้ใช้ + ระบบผู้ดูแล (Admin สไตล์ AdminLTE) และ API หลังบ้าน

## โครงสร้าง

| โฟลเดอร์ | เนื้อหา |
|---|---|
| `web/` | React 19 + TypeScript + Vite + Tailwind 4 + lucide-react · รายละเอียดใน `web/README.md` |
| `server/` | API: Hono + Kysely · SQLite (`node:sqlite`) ตอน dev/test, MySQL ตอน production · Node >= 22.13 |
| `shared/` | types และกติกาที่ใช้ทั้ง web และ server (import ผ่าน alias `@shared/*`) |
| `design/` | ดีไซน์ต้นฉบับจาก Figma Make (bundle ที่คอมไพล์แล้ว) — **ใช้อ้างอิงเท่านั้น ห้ามแก้** `design/CLAUDE.md`/`AGENTS.md` เป็นของ Figma Make ไม่เกี่ยวกับ `web/`/`server/` |

## คำสั่ง

```bash
# API (port 3001) — ต้องรันก่อน web เพราะ web โหลดข้อมูลจาก API ตอนเปิด
cd server && npm install
cp .env.example .env      # แก้ค่าตามต้องการ
npm run migrate && npm run seed
npm run dev               # tsx watch
npm test                  # node:test กับ SQLite in-memory (test/api.test.ts)
npm run typecheck

# Web (http://localhost:5173) — Vite proxy /api และ /uploads ไป localhost:3001
cd web && npm install
npm run dev
npm run build             # tsc -b + vite build
npm run deploy            # build แล้ว force-push web/dist ขึ้น branch `deploy`
```

ก่อนบอกว่างานเสร็จ: รัน `npm run typecheck` ในโฟลเดอร์ที่แก้ (ถ้าแก้ `shared/` ให้รันทั้ง web และ server) และ `npm test` ใน `server/` เมื่อแก้ฝั่ง API

## สถาปัตยกรรม

- **shared/** เป็นแหล่งเดียวของ types (`types.ts`) และกติกาธุรกิจ (ownershipRules, boardOrder, promo, settings, identity, thaiTime ฯลฯ) — อย่าคัดลอก logic ไปไว้ฝั่งใดฝั่งหนึ่ง ถ้า server ต้องใช้กติกาเดียวกับ UI ให้ย้ายมาไว้ที่นี่ ไฟล์ใน `shared/` ต้องไม่ import อะไรจาก DOM หรือ Node
- **server/src**: `app.ts` = route ทั้งหมด (`/api/*`), `services/` = business logic แยกตามโดเมน (users, windows, purchases, ledger, promo, settings, admin, audit), `db/` = schema/migrations/seed/CLI, `lib/` = crypto, errors, files, rateLimit, `config.ts` = อ่าน env (ดู `.env.example`)
  - ทุก response เป็น JSON `{ success: true, ... }` หรือ `{ success: false, error }` — โยน `ApiError` จาก `lib/errors.ts` แทนการ return error เอง
  - คำขอที่ไม่ใช่ GET ต้องเป็น `application/json` (กัน CSRF) · session ผ่าน cookie `sid`
  - เปลี่ยนยอดกระเป๋าเงินผ่าน `services/ledger.ts` เท่านั้น (debit แบบ atomic + บันทึกธุรกรรม) และ action ของ admin ต้องเขียน audit log
  - เลขบัตรประชาชนถูก hash/เข้ารหัสด้วย `APP_SECRET` — ห้ามเปลี่ยนค่านี้ใน production
- **web/src**: `lib/api.ts` = client กลาง (ห้าม `fetch` ตรงจาก component), `lib/store.ts` = data layer ฝั่งผู้ใช้ (cache ในหน่วยความจำ เติมโดย `init()` ใน `main.tsx`; action คืน `Result` ไม่ throw), `lib/adminApi.ts` = action ของผู้ดูแล, `components/` แยกตามส่วน (board, window, payment, hub, auth, promo, layout, admin)
  - หน้า Admin ใช้ Tailwind เลียนแบบ AdminLTE 3 (ไม่ติดตั้ง AdminLTE/Bootstrap เพราะ CSS ชนกับฝั่งผู้ใช้) — ชิ้นส่วน UI อยู่ใน `components/admin/ui.tsx` · เข้าผ่าน `#admin/<page>`
  - i18n: UI เขียนข้อความภาษาไทยตรงๆ แล้ว `i18n/domTranslator.ts` แปลเป็นอังกฤษจากตาราง `i18n/translations.ts` — เมื่อเพิ่มข้อความใหม่ให้เพิ่มคำแปลในตารางด้วย

## แนวทางเขียนโค้ด

- ข้อความที่ผู้ใช้เห็น (รวม error จาก API) เป็นภาษาไทย · comment ในโค้ดเป็นภาษาอังกฤษ สั้นๆ ตามสไตล์เดิม
- ใช้ single quotes, ไม่มี semicolon, indent 2 spaces (ตามไฟล์ที่มีอยู่)
- TypeScript strict + `noUnusedLocals`/`noUnusedParameters`

## Deploy

- เว็บจริง: https://500windowsthailand.yaydang.com (Plesk @ Hostatom, Node.js/Passenger + MySQL) — ขั้นตอนตั้งค่า Plesk อยู่ใน `README.md`
- `npm run deploy` ใน `web/` = test server + build ทั้งสองฝั่ง แล้ว force-push ขึ้น branch `deploy` (`app.cjs`, `server.mjs` ที่ esbuild รวม dependency ไว้แล้ว, `public/`, `tmp/restart.txt`) → GitHub webhook ให้ Plesk ดึงไปเอง · `-- --dry-run` = build อย่างเดียวไม่ push
- `server/scripts/build.mjs` สร้าง `server/dist/server.mjs` — ถ้าเพิ่ม dependency ที่ bundle ไม่ได้ (native module) ต้องแก้ขั้นตอน deploy ด้วย
- ค่า production ทั้งหมดตั้งใน env ของ Plesk ไม่ใช้ไฟล์ `.env` · `UPLOAD_DIR` อยู่นอกโฟลเดอร์ deploy
- ห้าม commit `.env` และ `server/data/` (ฐานข้อมูล dev, ไฟล์อัปโหลด)
