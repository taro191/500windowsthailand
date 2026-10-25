import { useMemo, useState } from 'react'
import type { WindowLink } from '@shared/types'
import { REGION_IDS } from '@shared/regions'
import { thaiDayKey } from '@shared/thaiTime'
import { friendStatus, PROFILE_LIMITS, thaiDayLabel } from '@shared/windowProfile'
import { decideLink, loadBoard, removeLink, requestLink } from '@/lib/store'
import { btn, btnPri, card, CardHead, check, ConfirmButton, field, h3, muted, para, useCardDraft, type DetailContext } from './ui'

const LINK_STATUS: Record<WindowLink['status'], string> = {
  pending: 'กำลังรอเจ้าของหน้าต่างอนุมัติ',
  approved: 'เชื่อมลิงก์แล้ว',
  rejected: 'ไม่ได้รับการอนุมัติ (ส่งคำขอใหม่ได้)',
}

/** "Friend and Co": partner windows the owner approved, requests, and when requests are taken. */
export function FriendCard({ ctx }: { ctx: DetailContext }) {
  const { w, isOwner, currentUser } = ctx
  const editor = useCardDraft(ctx, ['friend'])
  const friend = editor.draft.friend
  const e = editor.editing
  const status = friendStatus(ctx.profile.friend, thaiDayKey())
  const links = w.links ?? []
  const pending = w.linkRequests ?? []
  const full = links.length >= PROFILE_LIMITS.partners
  const [asking, setAsking] = useState(false)
  const [busy, setBusy] = useState(false)

  const run = async (action: () => Promise<{ success: true } | { success: false; error: string }>, done: string) => {
    setBusy(true)
    const result = await action()
    setBusy(false)
    if (!result.success) {
      ctx.notify(result.error || 'ทำรายการไม่สำเร็จ', 'error')
      return false
    }
    ctx.changed()
    ctx.notify(done)
    return true
  }
  const visit = (link: WindowLink) => {
    const found = loadBoard(link.window.region).find((x) => x.id === link.window.id)
    if (found) ctx.openWindow(found)
  }
  const period = friend.from && friend.to ? `${thaiDayLabel(friend.from)} – ${thaiDayLabel(friend.to)}` : friend.from ? `ตั้งแต่ ${thaiDayLabel(friend.from)}` : friend.to ? `ถึง ${thaiDayLabel(friend.to)}` : ''

  return (
    <section className={card}>
      <CardHead title="🤝 Friend and Co" owner={isOwner} editor={editor} />
      <p className={`${para} !mt-0`}>หน้าต่างพันธมิตรที่เจ้าของอนุญาตให้เชื่อมลิงก์</p>
      <div className={`flex flex-col gap-0.5 px-3 py-2.5 rounded-xl my-2.5 border ${status.open ? 'border-[#2ecc71] bg-[#2ecc7118]' : 'border-[#e74c3c] bg-[#e74c3c18]'}`}>
        <b>{status.open ? '✅ เชื่อมต่อได้' : '⛔ เชื่อมต่อไม่ได้'}</b>
        <span className={`text-[13px] ${muted}`}>{status.reason}</span>
      </div>

      {e ? (
        <div className="grid gap-2 my-2">
          <label className="flex gap-2 items-center text-[13px]">
            <input type="checkbox" checked={friend.open} onChange={(ev) => editor.set({ friend: { ...friend, open: ev.target.checked } })} className={check} /> เปิดรับการเชื่อมต่อลิงก์พันธมิตร
          </label>
          <div className="flex gap-2 flex-wrap items-center text-[13px]">
            <label>
              เริ่ม <input type="date" value={friend.from} onChange={(ev) => editor.set({ friend: { ...friend, from: ev.target.value } })} className={`${field} !inline-block !w-auto !mb-0`} />
            </label>
            <label>
              สิ้นสุด <input type="date" value={friend.to} onChange={(ev) => editor.set({ friend: { ...friend, to: ev.target.value } })} className={`${field} !inline-block !w-auto !mb-0`} />
            </label>
            <button type="button" onClick={() => editor.set({ friend: { ...friend, from: '', to: '' } })} className={btn}>
              ล้างช่วงเวลา
            </button>
          </div>
          {friend.from && friend.to && friend.to < friend.from && <small className="text-(--kap-warn)">วันสิ้นสุดต้องไม่ก่อนวันเริ่ม</small>}
          <textarea
            rows={3}
            maxLength={PROFILE_LIMITS.friendNote}
            value={friend.note}
            onChange={(ev) => editor.set({ friend: { ...friend, note: ev.target.value } })}
            aria-label="เงื่อนไข"
            placeholder="แจ้งเงื่อนไขหรือเหตุผล เช่น รับเฉพาะธุรกิจในกรุงเทพฯ"
            className={`${field} !mb-0`}
          />
          <h3 className={`${h3} mt-3`}>📨 คำขอที่รออนุมัติ ({pending.length})</h3>
          {pending.length === 0 && <p className={para}>ไม่มีคำขอที่รออนุมัติ</p>}
          {pending.map((r) => (
            <div key={r.id} className="flex justify-between gap-2.5 items-center flex-wrap border border-(--kap-line) rounded-xl px-2.5 py-2 text-[13px]">
              <div className="min-w-0">
                <b>{r.window.title}</b> <small>{r.window.code}</small>
                <br />
                <span className={muted}>
                  ผู้ขอ: {r.requesterName}
                  {r.message && ` · “${r.message}”`}
                </span>
              </div>
              <div className="flex gap-2 flex-wrap">
                <button type="button" onClick={() => visit(r)} className={btn}>
                  ดูหน้าต่าง
                </button>
                <button type="button" disabled={busy || full} onClick={() => run(() => decideLink(w.region, w.id, r.id, true), 'อนุมัติแล้ว')} className={`${btn} ${btnPri}`}>
                  ✓ อนุมัติ
                </button>
                <button type="button" disabled={busy} onClick={() => run(() => decideLink(w.region, w.id, r.id, false), 'ปฏิเสธคำขอแล้ว')} className={btn}>
                  ✕ ปฏิเสธ
                </button>
              </div>
            </div>
          ))}
          {pending.length > 0 && full && (
            <p className={para}>
              ช่องพันธมิตรเต็ม ({PROFILE_LIMITS.partners}/{PROFILE_LIMITS.partners}) ลบพันธมิตรก่อนจึงจะอนุมัติเพิ่มได้
            </p>
          )}
        </div>
      ) : (
        <>
          {period && <p className={para}>🗓️ ช่วงเวลา: {period}</p>}
          {friend.note && <p className={para}>📝 เงื่อนไข: {friend.note}</p>}
          {!isOwner && (
            <>
              {(w.myLinkRequests ?? []).map((r) => (
                <p key={r.id} className={para}>
                  {r.status === 'approved' ? '✅' : r.status === 'pending' ? '⏳' : '⚠️'} คำขอของคุณ ({r.window.title}) {LINK_STATUS[r.status]}
                </p>
              ))}
              {!asking && (
                <button type="button" disabled={!status.open} onClick={() => (currentUser ? setAsking(true) : ctx.openAuth())} className={`${btn} ${btnPri}`}>
                  ＋ ขอเชื่อมลิงก์
                </button>
              )}
              {asking && status.open && <RequestForm ctx={ctx} busy={busy} run={run} onDone={() => setAsking(false)} />}
            </>
          )}
        </>
      )}

      <div className="grid grid-cols-3 gap-2 mt-2.5">
        {Array.from({ length: PROFILE_LIMITS.partners }, (_, i) => {
          const link = links[i]
          if (!link)
            return (
              <div key={i} className={`border border-dashed border-(--kap-line) rounded-[10px] min-h-[84px] flex items-center justify-center ${muted} text-[13px] p-1.5 text-center`}>
                ช่องว่าง
              </div>
            )
          return (
            <div
              key={link.id}
              className="border border-(--kap-teal) rounded-[10px] min-h-[84px] flex flex-col items-center justify-center gap-0.5 p-1.5 text-center bg-cover bg-center min-w-0"
              // The partner's main image as the backdrop, darkened so the text stays readable.
              style={link.window.imageUrl ? { backgroundImage: `linear-gradient(rgba(13,26,46,.6), rgba(13,26,46,.9)), url("${link.window.imageUrl.replace(/"/g, '%22')}")` } : undefined}
            >
              <b className="text-[13px] leading-tight line-clamp-2">{link.window.title}</b>
              <small className={muted}>{link.window.code}</small>
              <button type="button" onClick={() => visit(link)} className={`${btn} !min-h-0 !px-2 !py-1 !text-[12px] mt-1`}>
                เยี่ยมชม ›
              </button>
              {e && <ConfirmButton ariaLabel={`ยกเลิกลิงก์ ${link.window.title}`} label="✕ ลบ" onConfirm={() => run(() => removeLink(w.region, w.id, link.id), 'ยกเลิกลิงก์แล้ว')} className={`${btn} !min-h-0 !px-2 !py-1 !text-[12px]`} />}
            </div>
          )
        })}
      </div>
    </section>
  )
}

function RequestForm({ ctx, busy, run, onDone }: { ctx: DetailContext; busy: boolean; run: (action: () => ReturnType<typeof requestLink>, done: string) => Promise<boolean>; onDone: () => void }) {
  const { w, currentUser } = ctx
  const mine = useMemo(
    () => (currentUser ? REGION_IDS.flatMap((r) => loadBoard(r)).filter((x) => x.ownerId === currentUser.id && !(x.region === w.region && x.id === w.id)) : []),
    [currentUser, w.region, w.id],
  )
  const [pick, setPick] = useState(mine[0] ? `${mine[0].region}:${mine[0].id}` : '')
  const [message, setMessage] = useState('')
  const send = async () => {
    const from = mine.find((x) => `${x.region}:${x.id}` === pick)
    if (!from) return
    if (await run(() => requestLink(w.region, w.id, { region: from.region, id: from.id }, message.trim()), 'ส่งคำขอแล้ว รอเจ้าของหน้าต่างอนุมัติ')) onDone()
  }
  if (!mine.length)
    return (
      <div className="my-2">
        <p className={para}>ต้องเป็นเจ้าของหน้าต่างอย่างน้อย 1 บานจึงจะขอเชื่อมลิงก์ได้</p>
        <button type="button" onClick={onDone} className={btn}>
          ปิด
        </button>
      </div>
    )
  return (
    <div className="grid gap-2 my-2">
      <label className={`text-[13px] ${muted}`}>
        หน้าต่างของคุณที่จะแสดงใน Friend and Co
        <select value={pick} onChange={(e) => setPick(e.target.value)} className={`${field} mt-1 !mb-0`}>
          {mine.map((x) => (
            <option key={`${x.region}:${x.id}`} value={`${x.region}:${x.id}`}>
              {x.code} · {x.title}
            </option>
          ))}
        </select>
      </label>
      <textarea rows={2} maxLength={PROFILE_LIMITS.linkMessage} value={message} onChange={(e) => setMessage(e.target.value)} aria-label="ข้อความถึงเจ้าของ" placeholder="ข้อความถึงเจ้าของ (ไม่บังคับ)" className={`${field} !mb-0`} />
      <p className={`${para} !my-0 text-[12.5px]`}>ลิงก์จะแสดงเมื่อเจ้าของหน้าต่างอนุมัติแล้วเท่านั้น ส่งซ้ำจะแทนที่ข้อความเดิม</p>
      <div className="flex gap-2">
        <button type="button" onClick={send} disabled={busy || !pick} className={`${btn} ${btnPri}`}>
          ส่งคำขอ
        </button>
        <button type="button" onClick={onDone} className={btn}>
          ยกเลิก
        </button>
      </div>
    </div>
  )
}
