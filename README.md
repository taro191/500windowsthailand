# 500 Windows to Thailand

"ประกาศให้โลกรู้ ฉันอยู่ตรงนี้" — แพลตฟอร์มถือครองและจัดแสดงหน้าต่าง 500 บานต่อภูมิภาค (7 หน้าต่าง รวม 3,500 บาน) โดย Kapsulep

| โฟลเดอร์ | เนื้อหา |
|---|---|
| [`web/`](web/) | เว็บผู้ใช้ + ระบบผู้ดูแล (Admin แบบ AdminLTE) — React 19 + TypeScript + Vite + Tailwind 4 · รายละเอียดใน [web/README.md](web/README.md) |
| [`design/`](design/) | ดีไซน์ต้นฉบับฝั่งผู้ใช้จาก Figma Make (bundle ที่คอมไพล์แล้ว) เก็บไว้อ้างอิง |

```bash
cd web
npm install
npm run dev
```

สถานะ: เดโม ข้อมูลเก็บใน localStorage ยังไม่มีระบบหลังบ้าน (การชำระเงิน, ตรวจสลิป, OTP เป็นการจำลอง)
