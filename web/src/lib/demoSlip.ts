/** Random reference like `SLIP-123456-4821`. */
export function makeSlipReference(prefix = 'SLIP'): string {
  return `${prefix}-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 8999 + 1000)}`
}

/** Draws a fake "transfer successful" e-slip for testing the payment flow without a real transfer. */
export function drawDemoSlip(options: { amount: number; payerName: string; windowCode: string; reference: string }): string {
  const canvas = document.createElement('canvas')
  canvas.width = 400
  canvas.height = 560
  const ctx = canvas.getContext('2d')
  if (!ctx) return ''

  const background = ctx.createLinearGradient(0, 0, 0, 560)
  background.addColorStop(0, '#052b1b')
  background.addColorStop(0.3, '#0b3d26')
  background.addColorStop(1, '#061d13')
  ctx.fillStyle = background
  ctx.fillRect(0, 0, 400, 560)
  ctx.strokeStyle = '#10b981'
  ctx.lineWidth = 2
  ctx.strokeRect(10, 10, 380, 540)

  const text = (value: string, x: number, y: number, font: string, color: string, align: CanvasTextAlign = 'left') => {
    ctx.fillStyle = color
    ctx.font = font
    ctx.textAlign = align
    ctx.fillText(value, x, y)
  }

  text('โอนเงินสำเร็จ', 200, 55, 'bold 22px sans-serif', '#34d399', 'center')
  text(new Date().toLocaleString('th-TH'), 200, 85, '14px sans-serif', '#a7f3d0', 'center')
  ctx.strokeStyle = 'rgba(52, 211, 153, 0.3)'
  ctx.beginPath()
  ctx.moveTo(30, 105)
  ctx.lineTo(370, 105)
  ctx.stroke()
  text(`฿${options.amount.toLocaleString()}.00`, 200, 160, 'bold 36px monospace', '#ffffff', 'center')
  text('จำนวนเงิน', 200, 185, '13px sans-serif', '#94a3b8', 'center')

  text('จาก:', 40, 230, '14px sans-serif', '#e2e8f0')
  text(options.payerName, 120, 230, 'bold 14px sans-serif', '#ffffff')
  text('ไปยัง:', 40, 270, '14px sans-serif', '#e2e8f0')
  text('500 Windows to Thailand', 120, 270, 'bold 14px sans-serif', '#38bdf8')
  text('บจก. แคปซูลเลพ (ไทยแลนด์)', 120, 292, '12px monospace', '#94a3b8')
  text('รายการ:', 40, 330, '14px sans-serif', '#e2e8f0')
  text(`หน้าต่างบานที่ ${options.windowCode}`, 120, 330, 'bold 14px monospace', '#f43f5e')
  text('รหัสอ้างอิง:', 40, 370, '14px sans-serif', '#e2e8f0')
  text(options.reference, 120, 370, '12px monospace', '#cbd5e1')

  text('✓ e-Slip Verified & Authenticated', 200, 480, 'bold 13px sans-serif', '#10b981', 'center')
  text('ตรวจสอบข้อมูลด้วย QR Code สลิปทางการ', 200, 505, '11px sans-serif', '#6ee7b7', 'center')
  return canvas.toDataURL('image/png')
}
