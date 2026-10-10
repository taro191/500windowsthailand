# 500 Windows to Thailand

"ประกาศให้โลกรู้ ฉันอยู่ตรงนี้" — แพลตฟอร์มถือครองและจัดแสดงหน้าต่าง 500 บานต่อภูมิภาค (7 หน้าต่าง รวม 3,500 บาน) โดย Kapsulep

| โฟลเดอร์ | เนื้อหา |
|---|---|
| [`web/`](web/) | เว็บผู้ใช้ + ระบบผู้ดูแล (Admin แบบ AdminLTE) — React 19 + TypeScript + Vite + Tailwind 4 · รายละเอียดใน [web/README.md](web/README.md) |
| [`server/`](server/) | API — Hono + Kysely · SQLite ตอน dev/test, MySQL ตอน production · ตั้งค่าผ่าน env (ดู [`server/.env.example`](server/.env.example)) |
| [`shared/`](shared/) | types และกติกาที่ใช้ร่วมกันทั้ง web และ server |
| [`design/`](design/) | ดีไซน์ต้นฉบับฝั่งผู้ใช้จาก Figma Make (bundle ที่คอมไพล์แล้ว) เก็บไว้อ้างอิง |

```bash
# terminal 1 — API (http://localhost:3001)
cd server
npm install
cp .env.example .env
npm run dev

# terminal 2 — เว็บ (http://localhost:5173, ส่ง /api ไปที่ API ให้เอง)
cd web
npm install
npm run dev
```

ทดสอบ API: `cd server && npm test`

สถานะ: ข้อมูลทั้งหมดอยู่ในฐานข้อมูลฝั่ง server แล้ว ส่วนที่ยังเป็นการจำลอง: ชำระเงินด้วยบัตร (ยังไม่ได้เลือก Payment Gateway, ตั้ง `CARD_PAYMENTS=disabled` เพื่อปิด)
· OTP ตอนยืนยันตัวตนส่งทาง SMS ผ่าน THSMS เมื่อตั้ง `OTP_MODE=sms` (ค่าเริ่มต้น `dev` แสดงรหัสบนหน้าจอ) · สลิปโอนเงินตรวจด้วยมือผ่านหน้า Admin

## Deploy

เว็บจริง: **https://500windowsthailand.yaydang.com** (Plesk @ Hostatom)

```bash
cd web
npm run deploy             # test + build เว็บและ API แล้ว push ขึ้น branch `deploy`
npm run deploy -- --dry-run  # build และแสดงไฟล์ที่จะขึ้น แต่ไม่ push
```

branch `deploy` มี `app.cjs` (startup file), `server.mjs` (API รวม dependency ไว้ในไฟล์เดียว ไม่ต้อง `npm install` บน host),
`public/` (เว็บที่ build แล้ว) และ `tmp/restart.txt` (เปลี่ยนทุกครั้ง ทำให้ Passenger รีสตาร์ตแอป)

GitHub webhook แจ้ง Plesk ทุกครั้งที่ branch `deploy` เปลี่ยน แล้ว Plesk (Git › 500windowsthailand.git, โหมด Automatic)
จะ deploy ลงโฟลเดอร์ `/500windowsthailand` ให้เอง ถ้าไม่อัปเดต กด **Pull now** / **Deploy now** ในหน้า Git ของโดเมนใน Plesk

### ตั้งค่า Plesk (ครั้งแรก)

1. **Databases › Add Database** — สร้างฐานข้อมูล MySQL (เช่น `windows500`) และ user
2. **Node.js › Enable Node.js**

   | ช่อง | ค่า |
   |---|---|
   | Node.js version | 22.13 ขึ้นไป |
   | Application mode | production |
   | Application root | `/500windowsthailand` |
   | Document root | `/500windowsthailand/public` |
   | Application startup file | `app.cjs` |

3. **Custom environment variables** (หน้า Node.js เดียวกัน)

   ```
   NODE_ENV=production
   APP_SECRET=<สุ่ม 64 ตัวขึ้นไป — ห้ามเปลี่ยนหลังมีผู้ใช้ เลขบัตรประชาชนที่เข้ารหัสไว้จะอ่านไม่ได้>
   DB_CLIENT=mysql
   DATABASE_URL=mysql://USER:PASSWORD@localhost:3306/windows500
   PUBLIC_DIR=public
   UPLOAD_DIR=<โฟลเดอร์นอก /500windowsthailand เช่น /var/www/vhosts/<โดเมนหลัก>/500windows-data/uploads>
   ADMIN_EMAIL=<อีเมลผู้ดูแล>
   ADMIN_PASSWORD=<รหัสชั่วคราว>
   SUPER_ADMIN_EMAIL=<อีเมล super admin ถ้าไม่ใส่จะใช้ ADMIN_EMAIL — บัญชีนี้ต้องเป็นแอดมินอยู่แล้ว>
   DEMO_TOOLS=false
   CARD_PAYMENTS=disabled
   OTP_MODE=sms
   THSMS_TOKEN=<Access Token จาก thsms.com › API Key: 200 ตัวแรก>
   THSMS_TOKEN_2=<ส่วนที่เหลือของ token (Plesk ใส่ได้ช่องละไม่เกิน 255 ตัว ระบบจะต่อให้เอง)>
   THSMS_SENDER=<ชื่อผู้ส่งที่อนุมัติแล้วในบัญชี THSMS>
   SMTP_HOST=<เซิร์ฟเวอร์ส่งอีเมล สำหรับรหัสลืมรหัสผ่าน เช่น mail.yaydang.com (Plesk › Mail)>
   SMTP_PORT=587
   SMTP_USER=<กล่องอีเมลที่ใช้ส่ง เช่น no-reply@yaydang.com>
   SMTP_PASS=<รหัสผ่านของกล่องอีเมลนั้น>
   MAIL_FROM=500 Windows <no-reply@yaydang.com>
   ```

   สุ่ม `APP_SECRET`: `node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"`
   · รหัสผ่านใน `DATABASE_URL` ที่มีอักขระพิเศษต้อง URL-encode
   · `UPLOAD_DIR` ต้องอยู่นอกโฟลเดอร์ที่ Git deploy เขียนทับ ไม่งั้นรูปและสลิปที่อัปโหลดอาจหาย
   · ไม่ตั้ง `SMTP_HOST` = เมนูลืมรหัสผ่านใช้ไม่ได้ (แจ้งผู้ใช้ให้ติดต่อผู้ดูแล) · พอร์ต 465 ใช้ SSL อัตโนมัติ

4. `npm run deploy` แล้วกด **Restart App** — ตอนเริ่มแอปจะสร้างตารางและบัญชีผู้ดูแลให้เอง
5. ล็อกอินด้วยบัญชีผู้ดูแล เปลี่ยนรหัสผ่าน แล้วลบ `ADMIN_PASSWORD` ออกจาก env
6. ถ้าเว็บไม่ขึ้น ดู log ในหน้า Node.js / Logs ของโดเมน
