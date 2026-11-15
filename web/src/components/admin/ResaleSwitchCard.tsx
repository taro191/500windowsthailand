import { useState } from 'react'
import { Tag } from 'lucide-react'
import { setResaleEnabled } from '@/lib/adminApi'
import { useSettings } from '@/lib/settings'
import type { AdminPageProps } from './adminData'
import { Badge, Button, Callout, Card, Modal } from './ui'

/** Super admin only: opens or closes the resale marketplace for everyone. */
export function ResaleSwitchCard({ data, refresh, notify }: Pick<AdminPageProps, 'data' | 'refresh' | 'notify'>) {
  const { resale } = useSettings()
  const [confirming, setConfirming] = useState(false)
  const [busy, setBusy] = useState(false)
  const listed = data.windows.filter((w) => w.status === 'for_resale').length
  const next = !resale.enabled

  const save = async () => {
    setBusy(true)
    const result = await setResaleEnabled(next)
    setBusy(false)
    setConfirming(false)
    if (!result.success) return notify(result.error || 'บันทึกไม่สำเร็จ', 'error')
    notify(next ? 'เปิดการขายต่อแล้ว' : 'ปิดการขายต่อแล้ว')
    await refresh()
  }

  return (
    <Card title="เปิด/ปิดการขายต่อ" icon={Tag} outline={resale.enabled ? 'success' : 'danger'}>
      <div className="text-sm space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <span>สถานะตอนนี้:</span>
          {resale.enabled ? <Badge tone="success">เปิดการขายต่อ</Badge> : <Badge tone="danger">ปิดการขายต่อ</Badge>}
          <span className="text-stone-500">บานที่ประกาศขายต่ออยู่ {listed} บาน</span>
        </div>
        <Callout tone="info">
          เมื่อปิด ผู้ใช้จะประกาศขายต่อใหม่ไม่ได้ และกดซื้อต่อไม่ได้ทั้งหมด บานที่ประกาศขายอยู่แล้วยังแสดงบนกระดาน และเจ้าของยกเลิกประกาศได้
          ส่วนรายการที่ส่งสลิปไว้แล้วก่อนปิด ยังตรวจและอนุมัติได้ตามปกติ
        </Callout>
        <Button tone={resale.enabled ? 'danger' : 'success'} onClick={() => setConfirming(true)}>
          {resale.enabled ? 'ปิดการขายต่อ' : 'เปิดการขายต่อ'}
        </Button>
      </div>
      {confirming && (
        <Modal
          title={next ? 'ยืนยันเปิดการขายต่อ' : 'ยืนยันปิดการขายต่อ'}
          icon={Tag}
          onClose={() => setConfirming(false)}
          footer={
            <>
              <Button tone="secondary" outline onClick={() => setConfirming(false)} disabled={busy}>
                ยกเลิก
              </Button>
              <Button tone={next ? 'success' : 'danger'} onClick={save} disabled={busy}>
                {busy ? 'กำลังบันทึก...' : next ? 'เปิดการขายต่อ' : 'ปิดการขายต่อ'}
              </Button>
            </>
          }
        >
          <p className="text-sm">
            {next
              ? 'ผู้ใช้จะประกาศขายต่อและซื้อต่อได้ตามปกติทันที'
              : 'ผู้ใช้ทุกคนจะประกาศขายต่อใหม่และซื้อต่อไม่ได้ทันที จนกว่าจะเปิดอีกครั้ง'}
          </p>
        </Modal>
      )}
    </Card>
  )
}
