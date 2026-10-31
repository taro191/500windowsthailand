import { useMemo, useState } from 'react'
import type { WindowLink } from '@shared/types'
import { REGION_IDS } from '@shared/regions'
import { thaiDayKey } from '@shared/thaiTime'
import { friendStatus, PROFILE_LIMITS } from '@shared/windowProfile'
import { decideLink, loadBoard, removeLink, requestLink } from '@/lib/store'
import { btn, btnPri, card, check, ConfirmButton, field, h3, LogoTile, ModeButton, muted, para, useCardDraft, type DetailContext } from './ui'

const LINK_STATUS: Record<WindowLink['status'], string> = {
  pending: 'กำลังรอเจ้าของหน้าต่างอนุมัติ',
  approved: 'เชื่อมลิงก์แล้ว',
  rejected: 'ไม่ได้รับการอนุมัติ (ส่งคำขอใหม่ได้)',
}

const h4 = 'm-0 text-[14px] font-semibold'
const small = 'font-normal ml-1 text-[13px] text-(--kap-muted)'
const smallBtn = `${btn} !min-h-0 !px-2 !py-1 !text-[12px]`

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

  return (
    <section className={card}>
      <div className="flex justify-between items-start gap-2 mb-3">
        <div className="min-w-0">
          <h3 className={h3}>🤝 Friend &amp; Co</h3>
          <p className={`${muted} text-[13px] mt-0.5 mb-0`}>หน้าต่างพันธมิตรที่เจ้าของอนุญาตให้เชื่อมลิงก์</p>
        </div>
        {isOwner && (
          <span className="flex gap-2 shrink-0">
            {e && !editor.busy && (
              <button type="button" onClick={editor.cancel} className={btn}>
                ยกเลิก
              </button>
            )}
            <ModeButton on={e} busy={editor.busy} onClick={() => editor.toggle()} />
          </span>
        )}
      </div>

      {/* Status first and in the same place in every mode, so the layout never jumps. */}
      <div
        role="status"
        className={`flex gap-2 items-start px-3 py-[7px] rounded-[10px] border mb-3 text-[13px] leading-normal ${status.open ? 'border-[#2ecc7166] bg-[#2ecc7114]' : 'border-[#e74c3c66] bg-[#e74c3c14]'}`}
      >
        <span aria-hidden="true" className={`w-2 h-2 rounded-full mt-1.5 shrink-0 ${status.open ? 'bg-[#2ecc71]' : 'bg-[#e74c3c]'}`} />
        <div className="min-w-0 flex-1">
          <b className="font-semibold">{status.open ? 'เชื่อมต่อได้' : 'เชื่อมต่อไม่ได้'}</b>
          <span className={`${muted} text-[12.5px]`}> · {status.reason}</span>
          {!e && friend.note && <span className={`${muted} block text-[12px] mt-px`}>📝 เงื่อนไข: {friend.note}</span>}
        </div>
      </div>

      {/* Partners: the main content, as equal-size cards. */}
      <div className="flex justify-between items-center gap-2.5 min-h-[38px] mb-2.5">
        <h4 className={h4}>
          พันธมิตร
          <small className={small}>
            {links.length}/{PROFILE_LIMITS.partners}
          </small>
        </h4>
        {!isOwner && !asking && (
          <button type="button" disabled={!status.open} onClick={() => (currentUser ? setAsking(true) : ctx.openAuth())} className={`${btn} ${btnPri} !min-h-[34px] !py-1.5 !text-[13px]`}>
            ＋ ขอเชื่อมลิงก์
          </button>
        )}
      </div>
      <div className="grid grid-cols-3 gap-2.5">
        {Array.from({ length: PROFILE_LIMITS.partners }, (_, i) => {
          const link = links[i]
          if (!link)
            return (
              <div key={i} className={`min-h-[128px] border border-dashed border-(--kap-line) rounded-[14px] flex flex-col items-center justify-center gap-1 p-2 text-center ${muted} text-[12px]`}>
                <span aria-hidden="true" className="text-[22px] leading-none opacity-45">
                  ＋
                </span>
                ช่องว่าง
              </div>
            )
          return (
            <div key={link.id} className="relative min-h-[128px] border border-(--kap-teal) bg-(--kap-teal)/8 rounded-[14px] flex flex-col items-center gap-[3px] px-2 py-3 text-center min-w-0">
              <LogoTile src={link.window.logoUrl} name={link.window.title} hueKey={link.window.code} size="partner" />
              <b className="text-[13px] leading-[1.35] line-clamp-2 max-w-full">{link.window.title}</b>
              <small className={`${muted} text-[11px] max-w-full truncate`}>{link.window.code}</small>
              <button type="button" onClick={() => visit(link)} className={`${smallBtn} mt-auto`}>
                เยี่ยมชม ›
              </button>
              {e && (
                <ConfirmButton
                  ariaLabel={`ลบพันธมิตร ${link.window.title}`}
                  label="✕"
                  onConfirm={() => run(() => removeLink(w.region, w.id, link.id), 'ยกเลิกลิงก์แล้ว')}
                  className="absolute top-1.5 right-1.5 min-w-7 h-7 px-1.5 rounded-full border-0 bg-(--kap-text)/12 text-(--kap-text) text-[12px] cursor-pointer hover:bg-[#c0392b] hover:text-white"
                />
              )}
            </div>
          )
        })}
      </div>

      {/* Visitor: their own requests and the request form. */}
      {!isOwner &&
        (w.myLinkRequests ?? []).map((r) => (
          <p key={r.id} className="mt-2.5 mb-0 text-[13px]">
            {r.status === 'approved' ? '✅' : r.status === 'pending' ? '⏳' : '⚠️'} คำขอของคุณ ({r.window.title}) {LINK_STATUS[r.status]}
          </p>
        ))}
      {!isOwner && asking && status.open && <RequestForm ctx={ctx} busy={busy} run={run} onDone={() => setAsking(false)} />}

      {/* Owner: pending requests, then the settings. */}
      {e && (
        <>
          <div className="mt-5">
            <h4 className={h4}>
              คำขอที่รออนุมัติ<small className={small}>{pending.length}</small>
            </h4>
            {pending.length === 0 && <p className={`${para} !mb-0`}>ไม่มีคำขอที่รออนุมัติ</p>}
            {pending.map((r) => (
              <div key={r.id} className="border border-(--kap-line) rounded-[14px] p-3 mt-2.5 grid gap-2.5">
                <div className="flex gap-2.5 items-center min-w-0">
                  <LogoTile src={r.window.logoUrl} name={r.window.title} hueKey={r.window.code} size="sm" />
                  <div className="min-w-0 flex-1">
                    <b className="block leading-snug">{r.window.title}</b>
                    <small className={muted}>
                      {r.window.code} · ผู้ขอ: {r.requesterName}
                    </small>
                  </div>
                  <button type="button" onClick={() => visit(r)} className={`${smallBtn} shrink-0`}>
                    ดูหน้าต่าง
                  </button>
                </div>
                {r.message && <p className={`m-0 text-[13px] ${muted} bg-(--kap-text)/5 rounded-[10px] px-2.5 py-2 leading-relaxed`}>{r.message}</p>}
                <div className="grid grid-cols-2 gap-2">
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
              <p className="mt-2.5 mb-0 text-[13px]">
                ช่องพันธมิตรเต็ม ({PROFILE_LIMITS.partners}/{PROFILE_LIMITS.partners}) ลบพันธมิตรก่อนจึงจะอนุมัติเพิ่มได้
              </p>
            )}
          </div>
          <div className="mt-5">
            <h4 className={h4}>ตั้งค่าการรับเชื่อมต่อ</h4>
            <div className="border border-(--kap-line) rounded-[14px] p-3 mt-3 grid gap-3">
              <label className="flex justify-between items-center gap-3 text-[14px]">
                <span>เปิดรับการเชื่อมต่อลิงก์พันธมิตร</span>
                <input type="checkbox" checked={friend.open} onChange={(ev) => editor.set({ friend: { ...friend, open: ev.target.checked } })} className={check} />
              </label>
              <div className="grid grid-cols-2 gap-2.5">
                <label className={`grid gap-1 text-[12px] ${muted} min-w-0`}>
                  เริ่ม
                  <input type="date" value={friend.from} onChange={(ev) => editor.set({ friend: { ...friend, from: ev.target.value } })} className={`${field} !mb-0`} />
                </label>
                <label className={`grid gap-1 text-[12px] ${muted} min-w-0`}>
                  สิ้นสุด
                  <input type="date" value={friend.to} onChange={(ev) => editor.set({ friend: { ...friend, to: ev.target.value } })} className={`${field} !mb-0`} />
                </label>
              </div>
              {friend.from && friend.to && friend.to < friend.from && <small className="text-(--kap-warn)">วันสิ้นสุดต้องไม่ก่อนวันเริ่ม</small>}
              {(friend.from || friend.to) && (
                <button
                  type="button"
                  onClick={() => editor.set({ friend: { ...friend, from: '', to: '' } })}
                  className="justify-self-start bg-transparent border-0 text-(--kap-teal) text-[13px] p-0 min-h-6 underline cursor-pointer"
                >
                  ล้างช่วงเวลา
                </button>
              )}
              <textarea
                rows={3}
                maxLength={PROFILE_LIMITS.friendNote}
                value={friend.note}
                onChange={(ev) => editor.set({ friend: { ...friend, note: ev.target.value } })}
                aria-label="เงื่อนไข"
                placeholder="แจ้งเงื่อนไขหรือเหตุผล เช่น รับเฉพาะธุรกิจในกรุงเทพฯ"
                className={`${field} !mb-0`}
              />
            </div>
          </div>
        </>
      )}
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
      <div className="border border-(--kap-line) rounded-[14px] p-3 mt-3 grid gap-3">
        <p className={`${para} !my-0`}>ต้องเป็นเจ้าของหน้าต่างอย่างน้อย 1 บานจึงจะขอเชื่อมลิงก์ได้</p>
        <button type="button" onClick={onDone} className={`${btn} justify-self-start`}>
          ปิด
        </button>
      </div>
    )
  return (
    <div className="border border-(--kap-line) rounded-[14px] p-3 mt-3 grid gap-3">
      <b>ส่งคำขอเชื่อมลิงก์</b>
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
        <button type="button" onClick={send} disabled={busy || !pick} className={`${btn} ${btnPri} flex-1`}>
          ส่งคำขอ
        </button>
        <button type="button" onClick={onDone} className={`${btn} flex-1`}>
          ยกเลิก
        </button>
      </div>
    </div>
  )
}
