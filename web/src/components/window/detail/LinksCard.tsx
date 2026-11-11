import { useEffect, useState } from 'react'
import type { Pod } from '@shared/pod'
import type { ProfileLink } from '@shared/types'
import { PROFILE_LIMITS, PROFILE_LINK_TYPES, safeLinkUrl } from '@shared/windowProfile'
import { loadWindowPod } from '@/lib/store'
import { btn, btnPri, card, CardHead, ConfirmButton, field, para, useCardDraft, type DetailContext } from './ui'

type PodCard = Pick<Pod, 'slug' | 'name' | 'bio' | 'avatar'>

/** Link Pod: the owner's own link page, kept apart from the links above and edited/shared on its own. */
function LinkPod({ ctx }: { ctx: DetailContext }) {
  const [pod, setPod] = useState<PodCard | null>(null)
  const { region, id } = ctx.w
  useEffect(() => {
    let live = true
    setPod(null)
    loadWindowPod(region, id).then((r) => live && r.success && setPod(r.pod))
    return () => {
      live = false
    }
  }, [region, id, ctx.w.ownerId])

  if (!pod && !ctx.isOwner) return null
  const url = pod ? `${window.location.origin}/pod/${pod.slug}` : ''
  const share = async () => {
    try {
      if (navigator.share) return await navigator.share({ title: pod?.name, url })
      await navigator.clipboard.writeText(url)
      ctx.notify('คัดลอกลิงก์ Link Pod แล้ว')
    } catch (e) {
      if ((e as Error).name !== 'AbortError') ctx.notify('คัดลอกไม่สำเร็จ', 'info')
    }
  }

  return (
    <div className="mt-3 pt-3 border-t border-(--kap-line)">
      <div className="text-[13px] font-semibold text-(--kap-muted) mb-1.5">🫛 Link Pod</div>
      {pod ? (
        <div className="flex items-center gap-2.5 p-2.5 border border-(--kap-line) rounded-xl bg-white/[.03] min-w-0">
          <a href={`/pod/${pod.slug}`} className="flex items-center gap-2.5 flex-1 min-w-0 no-underline text-(--kap-text)">
            <span className="w-10 h-10 rounded-full bg-[#ffc857] text-[#1e1e1e] font-bold flex items-center justify-center overflow-hidden shrink-0">
              {pod.avatar ? <img src={pod.avatar} alt="" className="w-full h-full object-cover" /> : pod.name.slice(0, 1)}
            </span>
            <span className="min-w-0">
              <b className="block text-[14px] truncate">{pod.name}</b>
              <span className="block text-[12px] text-(--kap-muted) truncate">/pod/{pod.slug}</span>
            </span>
          </a>
          <button type="button" onClick={share} className={btn}>
            แชร์
          </button>
          {ctx.isOwner && (
            <a href="/pod" className={`${btn} no-underline`} aria-label="แก้ไข Link Pod" title="แก้ไข Link Pod">
              ✏️
            </a>
          )}
        </div>
      ) : (
        <a href="/pod" className={`${btn} ${btnPri} no-underline inline-flex`}>
          ＋ สร้าง Link Pod ของฉัน
        </a>
      )}
    </div>
  )
}

const defaultLabel = (icon: string) => PROFILE_LINK_TYPES.find(([i]) => i === icon)?.[1] ?? ''

/** "ช่องทางนำเสนอผลงาน": the owner's own list of links (website, YouTube, shop, …). */
export function LinksCard({ ctx }: { ctx: DetailContext }) {
  const editor = useCardDraft(ctx, ['links'])
  const links = editor.draft.links
  const set = (i: number, patch: Partial<ProfileLink>) => editor.set({ links: links.map((k, j) => (j === i ? { ...k, ...patch } : k)) })
  const visible = links.filter((k) => safeLinkUrl(k.url))

  return (
    <section className={card}>
      <CardHead title="🔗 ช่องทางนำเสนอผลงาน" owner={ctx.isOwner} editor={editor} />
      {editor.editing ? (
        <>
          {links.map((k, i) => (
            <div key={i} className="grid grid-cols-[auto_1fr_auto] gap-1.5 mt-2 border border-(--kap-line) rounded-xl p-2">
              <select
                value={k.icon}
                onChange={(e) => set(i, { icon: e.target.value, label: !k.label || k.label === defaultLabel(k.icon) ? defaultLabel(e.target.value) : k.label })}
                aria-label="ประเภทช่องทาง"
                className={`${field} !mb-0 !w-auto`}
              >
                {PROFILE_LINK_TYPES.map(([icon, label]) => (
                  <option key={icon} value={icon}>
                    {icon} {label}
                  </option>
                ))}
              </select>
              <input value={k.label} maxLength={PROFILE_LIMITS.linkLabel} onChange={(e) => set(i, { label: e.target.value })} aria-label="ชื่อที่แสดง" placeholder="ชื่อที่แสดง" className={`${field} !mb-0`} />
              <ConfirmButton ariaLabel="ลบช่องทาง" onConfirm={() => editor.set({ links: links.filter((_, j) => j !== i) })} />
              <input
                value={k.url}
                maxLength={PROFILE_LIMITS.linkUrl}
                onChange={(e) => set(i, { url: e.target.value })}
                aria-label="ลิงก์"
                placeholder={k.icon === '✉️' ? 'อีเมล เช่น shop@example.com' : 'ลิงก์ เช่น https://...'}
                className={`${field} !mb-0 col-span-full`}
              />
            </div>
          ))}
          <div className="mt-2.5">
            <button
              type="button"
              onClick={() => editor.set({ links: [...links, { icon: '🔗', label: 'ลิงก์อื่นๆ', url: '' }] })}
              disabled={links.length >= PROFILE_LIMITS.links}
              className={`${btn} ${btnPri}`}
            >
              {links.length >= PROFILE_LIMITS.links ? `ครบ ${PROFILE_LIMITS.links} ช่องทางแล้ว` : '＋ เพิ่มช่องทาง'}
            </button>
          </div>
          <p className={para}>ช่องทางที่ไม่ได้ใส่ลิงก์จะไม่ถูกบันทึก</p>
        </>
      ) : visible.length ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(130px,1fr))] gap-2">
          {visible.map((k, i) => {
            const href = safeLinkUrl(k.url)
            return (
              <a
                key={i}
                href={href}
                target={href.startsWith('http') ? '_blank' : undefined}
                rel="noopener noreferrer"
                className="flex gap-2 items-center p-2.5 border border-(--kap-line) rounded-xl text-(--kap-text) no-underline text-[13px] bg-white/[.03] hover:border-(--kap-gold) min-w-0"
              >
                <span>{k.icon}</span>
                <span className="min-w-0 break-words">{k.label || 'ลิงก์'}</span>
              </a>
            )
          })}
        </div>
      ) : (
        <p className={para}>ยังไม่มีช่องทาง</p>
      )}
      <LinkPod ctx={ctx} />
    </section>
  )
}
