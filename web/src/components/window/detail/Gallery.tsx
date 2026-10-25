import { useEffect, useRef, useState } from 'react'
import { PROFILE_LIMITS } from '@shared/windowProfile'
import { compressImage } from '@/lib/browser'
import { btn, btnPri, card, ConfirmButton, ModeButton, para, useCardDraft, type DetailContext } from './ui'

const MAX_PICK_BYTES = 50 * 1024 * 1024

/** Reads picked photos as resized data URLs (the server stores them when the profile is saved). */
export async function readPhotos(files: File[], room: number, notify: DetailContext['notify']): Promise<string[]> {
  if (files.length > room) notify(room > 0 ? `เพิ่มได้อีก ${room} รูป ระบบรับเท่าที่เหลือ` : 'ครบจำนวนรูปแล้ว', 'info')
  const out: string[] = []
  for (const file of files.slice(0, Math.max(room, 0))) {
    if (!file.type.startsWith('image/')) {
      notify(`ไฟล์ "${file.name}" ไม่ใช่รูปภาพ`, 'error')
      continue
    }
    if (file.size > MAX_PICK_BYTES) {
      notify(`ไฟล์ "${file.name}" ใหญ่เกิน 50MB`, 'error')
      continue
    }
    try {
      out.push(await compressImage(file, 1600, 0.82))
    } catch {
      notify(`เปิดไฟล์ "${file.name}" ไม่ได้ (รองรับ JPG, PNG, WebP)`, 'error')
    }
  }
  return out
}

/** Main window photo (the cover on the board) followed by the owner's extra photos. */
export function Gallery({ ctx, onEditCover, badge }: { ctx: DetailContext; onEditCover?: () => void; badge?: React.ReactNode }) {
  const { w, isOwner } = ctx
  const editor = useCardDraft(ctx, ['gallery'])
  const extras = editor.draft.gallery
  const images = [w.imageUrl, ...extras].filter(Boolean)
  const hasCover = !!w.imageUrl
  const [index, setIndex] = useState(0)
  const [portrait, setPortrait] = useState<boolean | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  useEffect(() => setIndex(0), [w.id, w.region])
  const at = Math.min(index, Math.max(images.length - 1, 0))
  const go = (step: number) => images.length && setIndex((at + step + images.length) % images.length)
  // Position in `extras` of the photo on show, or -1 for the cover.
  const extraAt = hasCover ? at - 1 : at
  const room = PROFILE_LIMITS.gallery - extras.length

  const move = (step: number) => {
    const to = extraAt + step
    if (extraAt < 0 || to < 0 || to >= extras.length) return
    const next = [...extras]
    ;[next[extraAt], next[to]] = [next[to], next[extraAt]]
    editor.set({ gallery: next })
    setIndex(at + step)
  }
  const add = async (files: File[]) => {
    const photos = await readPhotos(files, room, ctx.notify)
    if (!photos.length) return
    editor.set({ gallery: [...extras, ...photos] })
    setIndex((hasCover ? 1 : 0) + extras.length + photos.length - 1)
  }

  return (
    <section className={card} aria-label="แกลเลอรี">
      <div
        onClick={(e) => images.length && !(e.target as HTMLElement).closest('button') && ctx.showImages(images, at)}
        className={`relative rounded-2xl overflow-hidden aspect-[4/3] max-h-[74vh] w-full bg-black border border-(--kap-line) ${images.length ? 'cursor-zoom-in' : ''}`}
      >
        {images.length ? (
          <>
            <div className="absolute -inset-5 bg-cover bg-center blur-[28px] brightness-[.55]" style={{ backgroundImage: `url("${images[at].replace(/"/g, '%22')}")` }} />
            <img src={images[at]} alt={`ภาพที่ ${at + 1} จาก ${images.length}`} onLoad={(e) => setPortrait(e.currentTarget.naturalHeight > e.currentTarget.naturalWidth)} className="relative w-full h-full object-contain block" />
          </>
        ) : (
          <div className="absolute inset-0 flex items-center justify-center text-[#cbd5e1] text-[14px]">ยังไม่มีรูปภาพ</div>
        )}
        {images.length > 1 && (
          <>
            <button type="button" onClick={() => go(-1)} aria-label="ภาพก่อนหน้า" className="absolute top-1/2 -translate-y-1/2 left-2.5 w-[42px] h-[42px] rounded-full bg-black/65 text-white text-xl cursor-pointer">
              ‹
            </button>
            <button type="button" onClick={() => go(1)} aria-label="ภาพถัดไป" className="absolute top-1/2 -translate-y-1/2 right-2.5 w-[42px] h-[42px] rounded-full bg-black/65 text-white text-xl cursor-pointer">
              ›
            </button>
          </>
        )}
        {images.length > 0 && <span className="absolute right-2.5 top-2.5 bg-black/70 text-white rounded-full px-3 py-1 text-[12px]">คลิก/แตะเพื่อขยาย · ซูมได้</span>}
        {badge && <span className="absolute left-2.5 top-2.5">{badge}</span>}
        {images.length > 0 && (
          <span className="absolute left-2.5 bottom-2.5 bg-black/70 text-white rounded-full px-3 py-1 text-[12px]">
            {extraAt < 0 ? 'ปก · ' : ''}
            {portrait === null ? '' : portrait ? 'แนวตั้ง' : 'แนวนอน'}
          </span>
        )}
        {images.length > 0 && (
          <span className="absolute right-2.5 bottom-2.5 bg-black/70 text-white rounded-full px-3 py-1 text-[12px]">
            {at + 1}/{images.length}
          </span>
        )}
      </div>

      {images.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pt-2.5 pb-1">
          {images.map((src, i) => (
            <button
              key={`${i}-${src.slice(-24)}`}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`ภาพที่ ${i + 1}`}
              aria-current={i === at || undefined}
              className={`shrink-0 h-16 border-2 rounded-[10px] p-0 overflow-hidden cursor-pointer ${i === at ? 'border-(--kap-gold) opacity-100' : 'border-transparent opacity-65'}`}
            >
              <img src={src} alt="" className="h-full block" />
            </button>
          ))}
        </div>
      )}

      <div className="flex gap-2 flex-wrap items-center mt-1">
        {isOwner && <ModeButton on={editor.editing} busy={editor.busy} onClick={() => editor.toggle()} />}
        {editor.editing && !editor.busy && (
          <button type="button" onClick={editor.cancel} className={btn}>
            ยกเลิก
          </button>
        )}
        {editor.editing && (
          <button type="button" onClick={() => fileRef.current?.click()} disabled={room <= 0} className={`${btn} ${btnPri}`}>
            {room <= 0 ? `ครบ ${PROFILE_LIMITS.gallery} รูปแล้ว` : `＋ เพิ่มรูป (${extras.length}/${PROFILE_LIMITS.gallery})`}
          </button>
        )}
        {images.length > 0 && (
          <button type="button" onClick={() => ctx.showImages(images, at)} className={btn}>
            ⤢ ดูเต็มจอ
          </button>
        )}
        <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => add([...(e.target.files ?? [])]).finally(() => (e.target.value = ''))} />
      </div>

      {editor.editing && (
        <>
          <div className="flex gap-2 flex-wrap mt-2">
            {extraAt < 0 ? (
              onEditCover && (
                <button type="button" onClick={onEditCover} className={btn}>
                  📷 เปลี่ยนรูปปก (ใช้สิทธิ์แก้ไขรายวัน)
                </button>
              )
            ) : (
              <>
                <button type="button" onClick={() => move(-1)} disabled={extraAt <= 0} className={btn}>
                  ◀ เลื่อนซ้าย
                </button>
                <button type="button" onClick={() => move(1)} disabled={extraAt >= extras.length - 1} className={btn}>
                  เลื่อนขวา ▶
                </button>
                <ConfirmButton
                  ariaLabel="ลบรูปนี้"
                  label="🗑 ลบ"
                  onConfirm={() => {
                    editor.set({ gallery: extras.filter((_, i) => i !== extraAt) })
                    setIndex(Math.max(0, at - 1))
                  }}
                />
              </>
            )}
          </div>
          <p className={para}>
            โหมดเจ้าของ: เลือกรูปด้วยลูกศรหรือรูปเล็ก แล้วเลื่อนลำดับหรือลบ (กดสองครั้งเพื่อยืนยัน) · เพิ่มรูปจากแกลเลอรีหรือกล้องมือถือได้สูงสุด {PROFILE_LIMITS.gallery} รูป · รูปปกคือรูปที่แสดงบนกระดาน
            เปลี่ยนได้ด้วยสิทธิ์แก้ไขรายวัน · กด “✓ เสร็จสิ้น” เพื่อบันทึก
          </p>
        </>
      )}
    </section>
  )
}
