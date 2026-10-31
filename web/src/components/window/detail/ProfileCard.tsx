import { useRef, useState } from 'react'
import { CATEGORIES } from '@shared/categories'
import { todaysNote } from '@shared/windowBadges'
import { PROFILE_LIMITS } from '@shared/windowProfile'
import { compressImage } from '@/lib/browser'
import { getEditStatus } from '@/lib/ownershipRules'
import { useSettings } from '@/lib/settings'
import { deleteUpdate, editUpdate, fetchWindow, postUpdate } from '@/lib/store'
import { deleteUpdateAsAdmin } from '@/lib/adminApi'
import { btn, btnPri, card, CardHead, ConfirmButton, field, h3, Hint, LogoTile, ModeButton, muted, para, pill, useCardDraft, type DetailContext } from './ui'

const thaiDateTime = (iso: string) => new Date(iso).toLocaleString('th-TH', { dateStyle: 'medium', timeStyle: 'short' })

/** Logo, name, place, owner, tags and the short introduction (the window's title and description). */
export function ProfileCard({ ctx, onOpenEditor }: { ctx: DetailContext; onOpenEditor: () => void }) {
  const { w, profile, isOwner } = ctx
  const { editPolicy } = useSettings()
  const editor = useCardDraft(ctx, ['logoUrl', 'ownerLabel'])
  const fileRef = useRef<HTMLInputElement>(null)
  const note = todaysNote(w)
  const edit = isOwner ? getEditStatus(w, editPolicy) : null
  const { logoUrl, ownerLabel } = editor.draft
  const pickLogo = async (file?: File) => {
    if (!file) return
    if (!file.type.startsWith('image/')) return ctx.notify(`ไฟล์ "${file.name}" ไม่ใช่รูปภาพ`, 'error')
    try {
      editor.set({ logoUrl: await compressImage(file, 512, 0.9) })
    } catch {
      ctx.notify(`เปิดไฟล์ "${file.name}" ไม่ได้ (รองรับ JPG, PNG, WebP)`, 'error')
    }
  }
  const logo = <LogoTile src={logoUrl} name={w.title} hueKey={w.code} />
  return (
    <section className={card}>
      <div className="flex justify-between items-start gap-2 mb-1">
        <div className="flex gap-3 items-center flex-1 min-w-0">
          {logoUrl && !editor.editing ? (
            <button type="button" onClick={() => ctx.showImages([logoUrl], 0)} aria-label="ดูโลโก้ขยาย" title="กดเพื่อดูขยาย" className="cursor-zoom-in rounded-[14px] leading-none">
              {logo}
            </button>
          ) : (
            logo
          )}
          <div className="min-w-0 flex-1">
            <h3 className={`${h3} text-[18px]`}>{w.title}</h3>
            <p className={`${muted} text-[12.5px] mt-0.5 mb-0`}>
              📍 {w.code}
              {w.province && ` · ${w.province}`}
            </p>
          </div>
        </div>
        {isOwner && (
          <span className="flex gap-2 shrink-0">
            {editor.editing && !editor.busy && (
              <button type="button" onClick={editor.cancel} className={btn}>
                ยกเลิก
              </button>
            )}
            <ModeButton on={editor.editing} busy={editor.busy} onClick={() => editor.toggle({ ownerLabel: ownerLabel.trim() })} />
          </span>
        )}
      </div>
      {editor.editing && edit && (
        <div className="grid gap-2 my-2">
          <div className="flex gap-2 flex-wrap">
            <button type="button" onClick={() => fileRef.current?.click()} className={btn}>
              {logoUrl ? '📷 เปลี่ยนโลโก้' : '＋ เพิ่มโลโก้ / รูปโปรไฟล์'}
            </button>
            {logoUrl && (
              <button type="button" onClick={() => editor.set({ logoUrl: '' })} className={btn}>
                🗑 ลบโลโก้
              </button>
            )}
            <input ref={fileRef} type="file" accept="image/*" hidden onChange={(e) => pickLogo(e.target.files?.[0]).finally(() => (e.target.value = ''))} />
          </div>
          <Hint>โลโก้หรือรูปโปรไฟล์ของหน้าต่างนี้ (แยกจากแกลเลอรี) แนะนำภาพจัตุรัส · ถ้าไม่ใส่จะแสดงตัวอักษรย่อของชื่อ</Hint>
          <label className={`text-[13px] ${muted}`}>
            ชื่อที่แสดงเป็นเจ้าของหน้าต่างนี้ (เช่น ชื่อร้าน)
            <input
              value={ownerLabel}
              maxLength={PROFILE_LIMITS.ownerLabel}
              onChange={(e) => editor.set({ ownerLabel: e.target.value })}
              placeholder={w.ownerName}
              className={`${field} mt-1 !mb-0`}
            />
          </label>
          <Hint>แสดงบนการ์ดหน้าต่างและในหน้านี้ แยกกันแต่ละบาน · เว้นว่างไว้จะใช้ชื่อบัญชี ({w.ownerName})</Hint>
          <div className="border-t border-(--kap-line) pt-2">
            <button type="button" onClick={onOpenEditor} disabled={!edit.canEdit} className={btn}>
              ✏️ แก้ชื่อ คำแนะนำ หมวดหมู่ จังหวัด และรูปปก
            </button>
            <Hint>
              <span className="block mt-1.5">
                ใช้สิทธิ์แก้ไขรายวัน ·{' '}
                {!edit.paid ? `ฟรีอีก ${edit.freeLeft} ครั้งวันนี้` : edit.canEdit ? `ครั้งละ ฿${edit.price.toLocaleString()}` : 'ครบสิทธิ์ของวันนี้แล้ว'}
              </span>
            </Hint>
          </div>
        </div>
      )}
      <p className={`${para} !my-2`}>👤 {w.ownerLabel || w.ownerName}</p>
      {profile.tags.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {profile.tags.map((tag) => (
            <button key={tag} type="button" onClick={() => ctx.search(tag)} className={`${pill} cursor-pointer hover:border-(--kap-gold)`}>
              {tag}
            </button>
          ))}
        </div>
      )}
      {w.description && <p className={`${para} whitespace-pre-line`}>“{w.description}”</p>}
      {note && (
        <p className="mt-2 mb-0 px-2.5 py-2 rounded-xl border border-emerald-500/40 bg-emerald-950/30 text-[13px]">
          <b className="text-emerald-300">🟢 สเตตัสวันนี้: </b>
          {note}
        </p>
      )}
    </section>
  )
}

/** The owner's daily updates: the newest one shown as a note, the rest on request. */
export function UpdatesCard({ ctx }: { ctx: DetailContext }) {
  const { w, isOwner, currentUser } = ctx
  const updates = w.updates ?? []
  const [editing, setEditing] = useState(false)
  const [all, setAll] = useState(false)
  const [draft, setDraft] = useState<{ id: string | null; text: string } | null>(null)
  const [busy, setBusy] = useState(false)
  const isAdmin = currentUser?.role === 'admin'
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
  const save = async () => {
    if (!draft) return
    const text = draft.text.trim()
    if (!text) return ctx.notify('กรุณาพิมพ์ข้อความ', 'error')
    const id = draft.id
    if (await run(() => (id ? editUpdate(w.region, w.id, id, text) : postUpdate(w.region, w.id, text)), id ? 'บันทึกแล้ว' : 'โพสต์แล้ว')) setDraft(null)
  }
  const shown = editing || all ? updates : updates.slice(0, 1)

  return (
    <section className={card}>
      <CardHead
        title="📣 อัปเดตประจำวัน"
        owner={isOwner}
        editor={{ editing, busy: false, toggle: () => (setEditing(!editing), setDraft(null)), cancel: () => (setEditing(false), setDraft(null)) }}
      />
      {editing ? (
        <>
          <Hint>โหมดเจ้าของ: เขียนอัปเดตใหม่ แก้ไข หรือลบอัปเดตเดิมได้ทันที ผู้เยี่ยมชมทุกคนเห็นอัปเดตล่าสุด</Hint>
          {draft ? (
            <div className="mb-2">
              <textarea autoFocus rows={5} maxLength={PROFILE_LIMITS.updateText} value={draft.text} onChange={(e) => setDraft({ ...draft, text: e.target.value })} aria-label="ข้อความอัปเดต" placeholder="ข้อความอัปเดต" className={field} />
              <div className="flex gap-2 items-center flex-wrap">
                <button type="button" onClick={save} disabled={busy} className={`${btn} ${btnPri}`}>
                  {draft.id ? 'บันทึก' : 'โพสต์'}
                </button>
                <button type="button" onClick={() => setDraft(null)} className={btn}>
                  ยกเลิก
                </button>
                <small className={muted}>
                  {draft.text.length}/{PROFILE_LIMITS.updateText} ตัวอักษร
                </small>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setDraft({ id: null, text: '' })} className={`${btn} ${btnPri} mb-2`}>
              ✍️ เขียนอัปเดตใหม่
            </button>
          )}
        </>
      ) : (
        <p className={`${para} !mt-0`}>ข่าวสารและกิจกรรมล่าสุดจากเจ้าของบ้าน</p>
      )}
      {updates.length === 0 ? (
        <p className={para}>ยังไม่มีอัปเดต</p>
      ) : (
        shown.map((u) => (
          <div key={u.id} className="border-l-[3px] border-(--kap-gold) pl-2.5 my-2.5">
            <small className={muted}>
              {thaiDateTime(u.createdAt)}
              {u.editedAt && ' (แก้ไขแล้ว)'}
            </small>
            <p className="m-0 text-[14px] leading-[1.7] whitespace-pre-wrap">{u.text}</p>
            {(editing || (isAdmin && !isOwner)) && (
              <div className="flex gap-2 mt-1">
                {editing && (
                  <button type="button" onClick={() => setDraft({ id: u.id, text: u.text })} className={btn}>
                    ✏️ แก้ไข
                  </button>
                )}
                <ConfirmButton
                  ariaLabel="ลบอัปเดตนี้"
                  label={editing ? '🗑 ลบ' : '🗑 ลบ (ผู้ดูแลระบบ)'}
                  onConfirm={() =>
                    run(
                      editing
                        ? () => deleteUpdate(w.region, w.id, u.id)
                        : async () => {
                            const result = await deleteUpdateAsAdmin(u.id)
                            if (result.success) await fetchWindow(w.region, w.id)
                            return result
                          },
                      'ลบแล้ว',
                    )
                  }
                />
              </div>
            )}
          </div>
        ))
      )}
      {!editing && updates.length > 1 && (
        <button type="button" onClick={() => setAll(!all)} className={btn}>
          {all ? 'ย่อ' : `ดูอัปเดตทั้งหมด (${updates.length})`}
        </button>
      )}
    </section>
  )
}

/** Category of the window and the owner's tags (#), searchable. */
export function TagsCard({ ctx, footer }: { ctx: DetailContext; footer?: React.ReactNode }) {
  const { w, isOwner } = ctx
  const editor = useCardDraft(ctx, ['tags'])
  const [input, setInput] = useState('')
  const category = CATEGORIES[w.category]
  const tags = editor.draft.tags
  const withTags = (raw: string) => {
    const next = [...tags]
    for (const t of raw.split(',').map((x) => x.trim().replace(/^#/, '').slice(0, PROFILE_LIMITS.tagLength))) if (t && !next.includes(t)) next.push(t)
    return next.slice(0, PROFILE_LIMITS.tags)
  }
  const addTags = (raw: string) => {
    editor.set({ tags: withTags(raw) })
    setInput('')
  }
  return (
    <section className={card}>
      <CardHead
        title="🏷️ หมวดหมู่"
        owner={isOwner}
        editor={{
          ...editor,
          // Text still in the box counts when the owner presses "เสร็จสิ้น".
          toggle: () => {
            editor.toggle(editor.editing && input.trim() ? { tags: withTags(input) } : undefined)
            setInput('')
          },
        }}
      />
      {editor.editing && (
        <>
          <Hint>
            แท็กใต้ชื่อหน้าต่าง (สูงสุด {PROFILE_LIMITS.tags} แท็ก) · พิมพ์แล้วกด Enter หรือคั่นด้วยจุลภาค · หมวดหมู่หลักเปลี่ยนผ่านสิทธิ์แก้ไขรายวัน
          </Hint>
          <input
            value={input}
            onChange={(e) => (e.target.value.includes(',') ? addTags(e.target.value) : setInput(e.target.value))}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault()
                addTags(input)
              }
            }}
            disabled={tags.length >= PROFILE_LIMITS.tags}
            aria-label="เพิ่มแท็ก"
            placeholder={tags.length >= PROFILE_LIMITS.tags ? `ครบ ${PROFILE_LIMITS.tags} แท็กแล้ว` : 'เช่น ธุรกิจ, Application, Ai Factory'}
            className={field}
          />
        </>
      )}
      <div className="flex flex-wrap gap-2">
        {category && !editor.editing && (
          <button type="button" onClick={() => ctx.search(category.label)} className={`${pill} cursor-pointer hover:border-(--kap-gold)`}>
            #{category.label}
          </button>
        )}
        {tags.map((tag) =>
          editor.editing ? (
            <span key={tag} className={pill}>
              #{tag}{' '}
              <button type="button" onClick={() => editor.set({ tags: tags.filter((t) => t !== tag) })} aria-label={`ลบแท็ก ${tag}`} className="ml-1 text-(--kap-warn) cursor-pointer">
                ✕
              </button>
            </span>
          ) : (
            <button key={tag} type="button" onClick={() => ctx.search(tag)} className={`${pill} cursor-pointer hover:border-(--kap-gold)`}>
              #{tag}
            </button>
          ),
        )}
      </div>
      {footer}
    </section>
  )
}
