import type { ProfileLink } from '@shared/types'
import { PROFILE_LIMITS, PROFILE_LINK_TYPES, safeLinkUrl } from '@shared/windowProfile'
import { btn, btnPri, card, CardHead, ConfirmButton, field, para, useCardDraft, type DetailContext } from './ui'

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
    </section>
  )
}
