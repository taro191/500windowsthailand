import { useRef, useState } from 'react'
import type { ShowcaseItem } from '@shared/types'
import { PROFILE_LIMITS } from '@shared/windowProfile'
import { readPhotos } from './Gallery'
import { btn, btnPri, card, ConfirmButton, field, h3, Hint, ModeButton, muted, para, useCardDraft, type DetailContext } from './ui'

const KINDS = {
  works: {
    title: '🖼️ ผลงานเพิ่มเติม',
    noun: 'ผลงาน',
    unit: 'ชิ้น',
    max: PROFILE_LIMITS.works,
    placeholders: ['ชื่อผลงาน', 'หมวด/ปี เช่น งานออกแบบ · 2569', 'อธิบายผลงาน เช่น โจทย์ แนวคิด ผลลัพธ์'],
    subClass: 'text-(--kap-teal) text-[12px]',
    movable: true,
    help: 'โหมดเจ้าของ: เพิ่มผลงานใหม่ด้วยรูปใหม่ (เลือกได้สูงสุด 3 รูปต่อผลงาน) แล้วกรอกชื่อ หมวด/ปี และคำอธิบาย · กดรูปเล็กเพื่อตั้งเป็นรูปแรก · ✕ ลบรูป · ＋ รูป เพิ่มรูปให้ผลงานนั้น · ◀ ▶ เลื่อนลำดับ · 🗑 ลบผลงาน (กดสองครั้ง)',
    empty: 'ยังไม่มีผลงาน',
    emptyOwner: 'ยังไม่มีผลงาน กด “＋ เพิ่มผลงาน” เพื่อลงผลงานใหม่ (รูปใหม่ + ข้อมูลใหม่)',
  },
  products: {
    title: '🛍️ สินค้า',
    noun: 'สินค้า',
    unit: 'รายการ',
    max: PROFILE_LIMITS.products,
    placeholders: ['ชื่อสินค้า', 'ราคา เช่น ฿350', 'รายละเอียดสินค้า'],
    subClass: 'text-(--kap-gold) font-semibold my-0.5',
    movable: false,
    help: 'โหมดเจ้าของ: แต่ละสินค้าใส่รูปได้สูงสุด 3 รูป (เลือกพร้อมกันได้) · กดรูปเล็กเพื่อตั้งเป็นรูปแรก · ✕ ลบรูป · ＋ รูป เพิ่มรูปให้สินค้านั้น · กรอกชื่อ ราคา รายละเอียดใต้ภาพ · 🗑 ลบสินค้า (กดสองครั้ง)',
    empty: 'ยังไม่มีสินค้า',
    emptyOwner: 'ยังไม่มีสินค้า กด “＋ เพิ่มสินค้า” เพื่อเริ่มลงสินค้า',
  },
}

/** Works or products: cards with up to 3 photos each, opened in the zoomable viewer. */
export function Showcase({ ctx, kind }: { ctx: DetailContext; kind: keyof typeof KINDS }) {
  const k = KINDS[kind]
  const editor = useCardDraft(ctx, [kind])
  const items = editor.draft[kind]
  const own = editor.editing
  const addRef = useRef<HTMLInputElement>(null)
  const moreRef = useRef<HTMLInputElement>(null)
  const [moreFor, setMoreFor] = useState(-1)
  const maxImages = PROFILE_LIMITS.showcaseImages

  const update = (i: number, patch: Partial<ShowcaseItem>) => editor.set({ [kind]: items.map((it, j) => (j === i ? { ...it, ...patch } : it)) } as never)
  const setItems = (next: ShowcaseItem[]) => editor.set({ [kind]: next } as never)
  const add = async (files: File[]) => {
    if (items.length >= k.max) return ctx.notify(`ครบ ${k.max} ${k.noun}แล้ว`, 'info')
    if (files.length > maxImages) ctx.notify(`${k.noun}หนึ่งชิ้นใส่ได้สูงสุด ${maxImages} รูป`, 'info')
    const images = await readPhotos(files.slice(0, maxImages), maxImages, ctx.notify)
    if (images.length) setItems([...items, { images, name: '', sub: '', detail: '' }])
  }
  const addMore = async (files: File[]) => {
    const it = items[moreFor]
    if (!it) return
    const images = await readPhotos(files, maxImages - it.images.length, ctx.notify)
    if (images.length) update(moreFor, { images: [...it.images, ...images] })
  }
  const move = (i: number, step: number) => {
    const to = i + step
    if (to < 0 || to >= items.length) return
    const next = [...items]
    ;[next[i], next[to]] = [next[to], next[i]]
    setItems(next)
  }

  return (
    <section className={card}>
      <h3 className={`${h3} mb-2.5`}>
        {k.title} ({items.length}/{k.max})
      </h3>
      <div className="flex gap-2 flex-wrap items-center mb-3">
        {ctx.isOwner && <ModeButton on={own} busy={editor.busy} onClick={() => editor.toggle()} />}
        {own && !editor.busy && (
          <button type="button" onClick={editor.cancel} className={btn}>
            ยกเลิก
          </button>
        )}
        {own && (
          <button type="button" onClick={() => addRef.current?.click()} disabled={items.length >= k.max} className={`${btn} ${btnPri}`}>
            {items.length >= k.max ? `ครบ ${k.max} ${k.noun}แล้ว` : `＋ เพิ่ม${k.noun}`}
          </button>
        )}
        {own && kind === 'works' && items.length > 0 && <ConfirmButton ariaLabel="ล้างผลงานทั้งหมด" label="🧹 ล้างทั้งหมด" onConfirm={() => setItems([])} />}
        <span className={`${muted} text-[13px]`}>
          {k.noun} <b>{items.length}</b> {k.unit} · กดภาพเพื่อขยาย/ซูม
        </span>
        <input ref={addRef} type="file" accept="image/*" multiple hidden onChange={(e) => add([...(e.target.files ?? [])]).finally(() => (e.target.value = ''))} />
        <input ref={moreRef} type="file" accept="image/*" multiple hidden onChange={(e) => addMore([...(e.target.files ?? [])]).finally(() => (e.target.value = ''))} />
      </div>
      {own && <Hint>{k.help}</Hint>}
      {items.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(230px,1fr))] gap-3 items-stretch">
          {items.map((it, i) => (
            <ShowcaseCard
              key={i}
              item={it}
              index={i}
              kind={k}
              own={own}
              onOpen={(j) => it.images.length && ctx.showImages(it.images, j, { title: it.name, sub: it.sub, detail: it.detail })}
              onChange={(patch) => update(i, patch)}
              onMove={(step) => move(i, step)}
              onDelete={() => setItems(items.filter((_, j) => j !== i))}
              onAddImages={() => {
                setMoreFor(i)
                moreRef.current?.click()
              }}
              last={i === items.length - 1}
            />
          ))}
        </div>
      ) : (
        <p className={para}>{own ? k.emptyOwner : k.empty}</p>
      )}
    </section>
  )
}

function ShowcaseCard(props: {
  item: ShowcaseItem
  index: number
  kind: (typeof KINDS)[keyof typeof KINDS]
  own: boolean
  last: boolean
  onOpen: (image: number) => void
  onChange: (patch: Partial<ShowcaseItem>) => void
  onMove: (step: number) => void
  onDelete: () => void
  onAddImages: () => void
}) {
  const { item: it, index, kind: k, own } = props
  const [pick, setPick] = useState(0)
  const at = own ? 0 : Math.min(pick, Math.max(it.images.length - 1, 0))
  const n = it.images.length
  const overlay = 'border-0 bg-black/70 text-white rounded-lg h-7 min-w-7 px-1.5 text-[12px] cursor-pointer'

  return (
    <div className="flex flex-col border border-(--kap-line) rounded-[14px] overflow-hidden bg-white/[.03] min-w-0">
      <div className="relative bg-black aspect-[4/3] flex cursor-zoom-in" onClick={(e) => !(e.target as HTMLElement).closest('button') && props.onOpen(at)}>
        {n ? (
          <img src={it.images[at]} alt={it.name || `${k.noun} ${index + 1}`} loading="lazy" decoding="async" className="w-full h-full object-contain block" />
        ) : (
          <span className="m-auto text-[#cbd5e1] text-[13px]">ไม่มีรูป</span>
        )}
        {own && (
          <div className="absolute top-1.5 inset-x-1.5 flex gap-1">
            {k.movable && (
              <>
                <button type="button" onClick={() => props.onMove(-1)} disabled={index === 0} aria-label="เลื่อนไปก่อนหน้า" className={`${overlay} disabled:opacity-40`}>
                  ◀
                </button>
                <button type="button" onClick={() => props.onMove(1)} disabled={props.last} aria-label="เลื่อนไปถัดไป" className={`${overlay} disabled:opacity-40`}>
                  ▶
                </button>
              </>
            )}
            <ConfirmButton ariaLabel={`ลบ${k.noun}`} onConfirm={props.onDelete} className={overlay} />
          </div>
        )}
        {!own && n > 1 && <b className="absolute right-2 top-2 bg-black/70 text-white rounded-full px-2 py-0.5 text-[11px]">🖼 {n}</b>}
      </div>
      {!own && n > 1 && (
        <div className="flex flex-wrap gap-1.5 px-2.5 pt-1.5 items-center">
          {it.images.map((src, j) => (
            <button key={j} type="button" onClick={() => setPick(j)} aria-label={`รูปที่ ${j + 1}`} className={`p-0 border-2 rounded-lg overflow-hidden cursor-pointer ${j === at ? 'border-(--kap-gold) opacity-100' : 'border-transparent opacity-70'}`}>
              <img src={src} alt="" className="h-[52px] block" />
            </button>
          ))}
        </div>
      )}
      {own && (
        <div className="flex flex-wrap gap-1.5 px-2.5 pt-1.5 items-center">
          {it.images.map((src, j) => (
            <span key={j} className="relative">
              <button
                type="button"
                title="กดเพื่อตั้งเป็นรูปแรก"
                onClick={() => j && props.onChange({ images: [it.images[j], ...it.images.filter((_, q) => q !== j)] })}
                className="p-0 border border-(--kap-line) rounded-md overflow-hidden cursor-pointer"
              >
                <img src={src} alt="" className="h-11 w-auto block" />
              </button>
              {n > 1 && (
                <button
                  type="button"
                  onClick={() => props.onChange({ images: it.images.filter((_, q) => q !== j) })}
                  aria-label="ลบรูป"
                  className="absolute -top-2 -right-2 w-6 h-6 rounded-full border-0 bg-[#c0392b] text-white text-[12px] p-0 cursor-pointer"
                >
                  ✕
                </button>
              )}
            </span>
          ))}
          <button type="button" onClick={props.onAddImages} disabled={n >= PROFILE_LIMITS.showcaseImages} className={`${btn} !min-h-0 !px-2 !py-1 !text-[12px]`}>
            {n >= PROFILE_LIMITS.showcaseImages ? `ครบ ${PROFILE_LIMITS.showcaseImages} รูป` : `＋ รูป (${n}/${PROFILE_LIMITS.showcaseImages})`}
          </button>
        </div>
      )}
      <div className="flex-1 px-3 py-2.5 min-w-0">
        {own ? (
          <>
            <input value={it.name} maxLength={PROFILE_LIMITS.showcaseName} onChange={(e) => props.onChange({ name: e.target.value })} aria-label={k.placeholders[0]} placeholder={k.placeholders[0]} className={field} />
            <input value={it.sub} maxLength={PROFILE_LIMITS.showcaseSub} onChange={(e) => props.onChange({ sub: e.target.value })} aria-label={k.placeholders[1]} placeholder={k.placeholders[1]} className={field} />
            <textarea rows={3} value={it.detail} maxLength={PROFILE_LIMITS.showcaseDetail} onChange={(e) => props.onChange({ detail: e.target.value })} aria-label={k.placeholders[2]} placeholder={k.placeholders[2]} className={field} />
          </>
        ) : (
          <>
            <div className="font-semibold">{it.name}</div>
            {it.sub && <div className={k.subClass}>{it.sub}</div>}
            {it.detail && <p className={`mt-1 mb-0 text-[13px] ${muted} leading-relaxed whitespace-pre-line`}>{it.detail}</p>}
          </>
        )}
      </div>
    </div>
  )
}
