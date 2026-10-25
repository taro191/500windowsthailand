import { useEffect, useRef, useState } from 'react'
import type { ProfileDisplay, WindowItem } from '@shared/types'
import { followerCount, likesToday } from '@shared/windowBadges'
import { PROFILE_LIMITS } from '@shared/windowProfile'
import { useDialogFocus } from '@/hooks/useDialogFocus'
import { deleteReview, fetchWindow, saveReview } from '@/lib/store'
import { deleteReviewAsAdmin } from '@/lib/adminApi'
import { btn, btnPri, card, check, CardHead, field, Hint, muted, para, useCardDraft, type DetailContext } from './ui'

const compact = (n: number) => (n >= 1000 ? `${(n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '')}K` : n.toLocaleString())

const STATS: { key: keyof ProfileDisplay; icon: string; label: string; value: (w: WindowItem) => string }[] = [
  { key: 'views', icon: '👁️', label: 'ผู้เข้าชม', value: (w) => compact(w.viewsCount) },
  { key: 'likes', icon: '❤️', label: 'ถูกใจ', value: (w) => compact(w.likesCount) },
  { key: 'today', icon: '📈', label: 'วันนี้', value: (w) => `+${likesToday(w)}` },
  { key: 'followers', icon: '👥', label: 'ผู้ติดตาม', value: (w) => compact(followerCount(w)) },
]

/** Views, likes, today's likes and followers (each can be hidden by the owner), with follow and reviews. */
export function StatsCard({ ctx, onLike, onToggleFollow, onShowFollowing }: { ctx: DetailContext; onLike: () => void; onToggleFollow: () => void; onShowFollowing: () => void }) {
  const { w, isOwner, currentUser } = ctx
  const editor = useCardDraft(ctx, ['display'])
  const display = editor.draft.display
  const [reviewsOpen, setReviewsOpen] = useState(false)
  const following = !!currentUser && !!w.followerIds?.includes(currentUser.id)
  const canFollow = display.follow || following
  const set = (key: keyof ProfileDisplay, on: boolean) => editor.set({ display: { ...display, [key]: on } })
  const shown = STATS.filter((s) => display[s.key])

  return (
    <section className={`${card} !py-3`}>
      <CardHead title="📊 การเข้าชมและโต้ตอบ" owner={isOwner} editor={editor} />
      {editor.editing ? (
        <>
          <Hint>ตัวเลขสถิติเป็นข้อมูลระบบ แก้ไขไม่ได้ เลือกได้ว่าจะแสดงหรือซ่อน</Hint>
          <div className="grid sm:grid-cols-2 gap-1.5">
            {STATS.map((s) => (
              <Toggle key={s.key} checked={display[s.key]} onChange={(on) => set(s.key, on)}>
                {s.icon} แสดง{s.label} ({s.value(w)})
              </Toggle>
            ))}
            <Toggle checked={display.follow} onChange={(on) => set('follow', on)}>
              🔔 เปิดให้กดติดตาม
            </Toggle>
            <Toggle checked={display.reviews} onChange={(on) => set('reviews', on)}>
              ✍️ เปิดรับรีวิวใหม่
            </Toggle>
          </div>
        </>
      ) : (
        shown.length > 0 && (
          <div className="grid grid-cols-4 gap-2">
            {shown.map((s) => {
              const body = (
                <>
                  <i className="not-italic text-[12px] mr-0.5">{s.icon}</i>
                  <b className="text-[16px]">{s.value(w)}</b>
                  <span className={`block text-[11px] ${muted}`}>{s.label}</span>
                </>
              )
              const box = 'border border-(--kap-line) rounded-[10px] px-1 py-1.5 text-center bg-white/5 leading-tight'
              return s.key === 'likes' ? (
                <button key={s.key} type="button" onClick={onLike} title="กดถูกใจ (วันละ 1 ครั้ง)" className={`${box} cursor-pointer hover:border-(--kap-gold) text-(--kap-text)`}>
                  {body}
                </button>
              ) : (
                <div key={s.key} className={box}>
                  {body}
                </div>
              )
            })}
          </div>
        )
      )}
      <div className="flex gap-2 mt-2">
        {!isOwner && (
          <button type="button" onClick={onToggleFollow} disabled={!canFollow} aria-pressed={following} className={`${btn} flex-1 ${canFollow && !following ? btnPri : ''}`}>
            {!canFollow ? 'ปิดการติดตาม' : following ? '✓ กำลังติดตาม' : '＋ ติดตาม'}
          </button>
        )}
        <button type="button" onClick={() => setReviewsOpen(true)} className={`${btn} flex-1`}>
          ★ รีวิว ({w.reviewStats?.count ?? 0})
        </button>
      </div>
      {following && (
        <p className={`${para} !mb-0 text-[12.5px]`}>
          ✓ ติดตามบานนี้แล้ว · ดูรวมทุกภูมิภาคได้ที่ตัวกรอง «กำลังติดตาม»{' '}
          <button type="button" onClick={onShowFollowing} className="text-(--kap-teal) underline cursor-pointer">
            ดูบานที่ติดตาม ›
          </button>
        </p>
      )}
      {reviewsOpen && <ReviewsDialog ctx={ctx} onClose={() => setReviewsOpen(false)} />}
    </section>
  )
}

function Toggle({ checked, onChange, children }: { checked: boolean; onChange: (on: boolean) => void; children: React.ReactNode }) {
  return (
    <label className="flex gap-1.5 items-center border border-(--kap-line) rounded-[10px] px-2.5 py-1.5 text-[12.5px] cursor-pointer">
      <input type="checkbox" checked={checked} onChange={(e) => onChange(e.target.checked)} className={check} /> {children}
    </label>
  )
}

const stars = (n: number) => '★'.repeat(n) + '☆'.repeat(5 - n)

/** A dialog on the window page, over everything else. */
export function KapDialog({ title, label, onClose, children }: { title: React.ReactNode; label: string; onClose: () => void; children: React.ReactNode }) {
  const ref = useRef<HTMLDivElement>(null)
  useDialogFocus(true, ref, onClose)
  return (
    <div className="kap fixed inset-0 z-[70] bg-black/75 flex items-center justify-center p-4" onClick={(e) => e.target === e.currentTarget && onClose()}>
      <div ref={ref} tabIndex={-1} role="dialog" aria-modal aria-label={label} className={`${card} w-full max-w-[520px] max-h-[90vh] overflow-auto text-(--kap-text) outline-none`}>
        <div className="flex justify-between items-center gap-2 mb-3">
          <h3 className="text-[16px] font-semibold m-0">{title}</h3>
          <button type="button" onClick={onClose} aria-label="ปิด" className={btn}>
            ✕
          </button>
        </div>
        {children}
      </div>
    </div>
  )
}

function ReviewsDialog({ ctx, onClose }: { ctx: DetailContext; onClose: () => void }) {
  const { w, isOwner, currentUser } = ctx
  const reviews = w.reviews ?? []
  const mine = currentUser ? reviews.find((r) => r.userId === currentUser.id) : undefined
  const [rating, setRating] = useState(mine?.rating ?? 0)
  const [text, setText] = useState(mine?.text ?? '')
  const [editing, setEditing] = useState(!mine)
  const [warn, setWarn] = useState(false)
  const [busy, setBusy] = useState(false)
  const open = ctx.profile.display.reviews
  const isAdmin = currentUser?.role === 'admin'
  useEffect(() => {
    setRating(mine?.rating ?? 0)
    setText(mine?.text ?? '')
    setEditing(!mine)
  }, [mine?.id, mine?.rating, mine?.text])

  const run = async (action: () => Promise<{ success: true } | { success: false; error: string }>, done: string) => {
    setBusy(true)
    const result = await action()
    setBusy(false)
    if (!result.success) return ctx.notify(result.error || 'ทำรายการไม่สำเร็จ', 'error')
    ctx.changed()
    ctx.notify(done)
  }
  const send = () => {
    if (!rating) return setWarn(true)
    run(() => saveReview(w.region, w.id, rating, text.trim()), mine ? 'แก้ไขรีวิวเรียบร้อยแล้ว' : 'ขอบคุณสำหรับรีวิว!')
  }
  const average = w.reviewStats?.count ? w.reviewStats.average : 0

  return (
    <KapDialog title={`★ รีวิว (${reviews.length})`} label="รีวิว" onClose={onClose}>
      {reviews.length ? <p className="text-(--kap-gold) text-[16px] my-2">★ {average.toFixed(1)} / 5</p> : <p className={para}>ยังไม่มีรีวิว{isOwner ? '' : ' เป็นคนแรกที่รีวิวหน้าต่างนี้'}</p>}
      {reviews.map((r) => (
        <div key={r.id} className="border border-(--kap-line) rounded-xl px-2.5 py-2 mt-2 text-[13px]">
          <b>{r.userName}</b> <span className="text-(--kap-gold)">{stars(r.rating)}</span> <small className={muted}>{new Date(r.createdAt).toLocaleDateString('th-TH')}</small>
          {r.text && <span className={`block ${muted} whitespace-pre-line`}>{r.text}</span>}
          {isAdmin && r.userId !== currentUser?.id && (
            <button
              type="button"
              disabled={busy}
              onClick={() =>
                window.confirm(`ลบรีวิวของ ${r.userName}? (บันทึกใน audit log)`) &&
                run(async () => {
                  const result = await deleteReviewAsAdmin(r.id)
                  if (result.success) await fetchWindow(w.region, w.id)
                  return result
                }, 'ลบรีวิวแล้ว')
              }
              className="text-(--kap-teal) text-[12px] underline cursor-pointer mt-1"
            >
              ลบรีวิว (ผู้ดูแลระบบ)
            </button>
          )}
        </div>
      ))}

      {isOwner ? null : !currentUser ? (
        <button type="button" onClick={ctx.openAuth} className={`${btn} w-full mt-3.5`}>
          เข้าสู่ระบบเพื่อเขียนรีวิว
        </button>
      ) : !open && !mine ? (
        <p className={`${para} mt-3.5`}>เจ้าของปิดรับรีวิวใหม่ในขณะนี้</p>
      ) : editing ? (
        <div className="mt-3.5">
          <div className="flex gap-2 flex-wrap">
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                aria-label={`${n} ดาว`}
                onClick={() => {
                  setRating(n)
                  setWarn(false)
                }}
                className={`${btn} text-(--kap-gold)`}
              >
                {n <= rating ? '★' : '☆'}
              </button>
            ))}
          </div>
          <textarea rows={3} value={text} onChange={(e) => setText(e.target.value)} maxLength={PROFILE_LIMITS.reviewText} aria-label="ความเห็น" placeholder="เขียนความเห็น (ไม่บังคับ)" className={`${field} mt-2`} />
          <div className="flex gap-2 items-center flex-wrap">
            <button type="button" onClick={send} disabled={busy} className={`${btn} ${btnPri}`}>
              {mine ? 'บันทึกรีวิว' : 'ส่งรีวิว'}
            </button>
            {mine && (
              <button type="button" onClick={() => setEditing(false)} className={btn}>
                ยกเลิก
              </button>
            )}
            {warn && <small className="text-(--kap-warn)">กรุณาเลือกคะแนนก่อน</small>}
          </div>
        </div>
      ) : (
        <div className="flex gap-2 mt-3.5">
          <button type="button" onClick={() => setEditing(true)} className={btn}>
            ✏️ แก้ไขรีวิวของคุณ
          </button>
          <button type="button" disabled={busy} onClick={() => window.confirm('ลบรีวิวของคุณ?') && run(() => deleteReview(w.region, w.id), 'ลบรีวิวแล้ว')} className={btn}>
            🗑 ลบ
          </button>
        </div>
      )}
    </KapDialog>
  )
}
