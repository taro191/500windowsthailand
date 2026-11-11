import { useEffect, useRef, useState, type ReactNode } from 'react'
import type { Pod, PodInput, PodLink, PodWindow } from '@shared/pod'
import {
  POD_BIO_MAX,
  POD_COLORS,
  POD_LINK_COLORS,
  POD_LINK_DESC_MAX,
  POD_LINK_TITLE_MAX,
  POD_LINKS_MAX,
  POD_NAME_MAX,
  POD_SLUG_MAX,
  normalizePodSlug,
  podLinkHost,
  podLinkHref,
  podSlugError,
} from '@shared/pod'
import { loadMyPod, loadPod, savePod } from '@/lib/store'
import { compressImage } from '@/lib/browser'
import '@/styles/pod.css'

const PEN = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d="M12 20h9" />
    <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
  </svg>
)
const WIN = (
  <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <rect x="4" y="3" width="16" height="18" rx="2" />
    <path d="M12 3v18M4 12h16" />
  </svg>
)
const SHARE = (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <circle cx="18" cy="5" r="3" />
    <circle cx="6" cy="12" r="3" />
    <circle cx="18" cy="19" r="3" />
    <path d="M8.6 13.5l6.8 4M15.4 6.5l-6.8 4" />
  </svg>
)

type Draft = Omit<PodInput, 'window'> & { window: PodWindow | null }

const newLink = (): PodLink => ({ title: 'Product', desc: '', url: '', img: '' })
const toDraft = (pod: Pod): Draft => ({ ...pod, links: pod.links.map((l) => ({ ...l })) })
const emptyDraft = (): Draft => ({
  slug: '',
  name: '',
  bio: '',
  avatar: '',
  profileColor: -1,
  window: null,
  windowColor: 0,
  links: [{ ...newLink(), desc: 'คำอธิบายสั้นๆ ไม่เกิน 100 ตัวอักษร' }],
})

/** /pod (the signed-in user's own pod) or /pod/<slug> (anyone's). */
export function PodPage({ slug }: { slug: string | null }) {
  const [state, setState] = useState<'loading' | 'ready' | 'signin' | string>('loading')
  const [pod, setPod] = useState<Pod | null>(null)
  const [isOwner, setIsOwner] = useState(false)
  const [windows, setWindows] = useState<PodWindow[]>([])
  const [draft, setDraft] = useState<Draft | null>(null)
  const [saving, setSaving] = useState(false)
  const [toast, setToast] = useState('')
  const toastTimer = useRef(0)

  const say = (message: string) => {
    setToast(message)
    window.clearTimeout(toastTimer.current)
    toastTimer.current = window.setTimeout(() => setToast(''), 2400)
  }

  useEffect(() => {
    if (slug) {
      loadPod(slug).then((r) => {
        if (!r.success) return setState(r.error)
        setPod(r.pod)
        setIsOwner(r.isOwner)
        setWindows(r.windows ?? [])
        setState('ready')
      })
      return
    }
    loadMyPod().then((r) => {
      if (!r.success) return setState((r as { status?: number }).status === 401 ? 'signin' : r.error)
      setIsOwner(true)
      setWindows(r.windows)
      if (r.pod) {
        setPod(r.pod)
        window.history.replaceState(null, '', `/pod/${r.pod.slug}`)
      } else {
        setDraft({ ...emptyDraft(), window: r.windows[0] ?? null })
      }
      setState('ready')
    })
  }, [slug])

  useEffect(() => {
    const name = draft ? draft.name : pod?.name
    document.title = name ? `${name} | 500 Windows Thailand : Pod` : '500 Windows Thailand : Pod'
  }, [pod, draft])

  const save = async () => {
    if (!draft) return
    const slugError = podSlugError(normalizePodSlug(draft.slug))
    if (slugError) return say(slugError)
    if (!draft.name.trim()) return say('กรุณาระบุชื่อ')
    setSaving(true)
    const r = await savePod({ ...draft, window: draft.window && { region: draft.window.region, num: draft.window.num } })
    setSaving(false)
    if (!r.success) return say(r.error)
    setPod(r.pod)
    setDraft(null)
    window.history.replaceState(null, '', `/pod/${r.pod.slug}`)
    say('บันทึกแล้ว')
  }

  const share = () => {
    const url = window.location.href
    const copy = () =>
      navigator.clipboard
        ?.writeText(url)
        .then(() => say('คัดลอกลิงก์แล้ว'))
        .catch(() => say('คัดลอกไม่สำเร็จ ให้คัดลอกลิงก์จากแถบที่อยู่')) ?? say('คัดลอกไม่สำเร็จ ให้คัดลอกลิงก์จากแถบที่อยู่')
    if (navigator.share) {
      navigator.share({ title: pod?.name, text: pod?.bio, url }).catch((e: unknown) => {
        if ((e as Error)?.name !== 'AbortError') copy()
      })
      return
    }
    copy()
  }

  let content: ReactNode
  if (state === 'loading') content = <div className="center">กำลังโหลด…</div>
  else if (state === 'signin')
    content = (
      <div className="center">
        <b>เข้าสู่ระบบเพื่อสร้าง Pod ของคุณ</b>
        <a className="pill" href="/#login">
          เข้าสู่ระบบ
        </a>
      </div>
    )
  else if (state !== 'ready')
    content = (
      <div className="center">
        <b>{state}</b>
        <a className="pill" href="/">
          กลับหน้าหลัก
        </a>
      </div>
    )
  else if (draft) content = <PodEditor draft={draft} setDraft={setDraft} windows={windows} saving={saving} onSave={save} onCancel={pod ? () => setDraft(null) : undefined} onError={say} />
  else if (pod)
    content = (
      <PodView pod={pod} onShare={share} onEdit={isOwner ? () => setDraft({ ...toDraft(pod), window: pod.window }) : undefined} />
    )

  return (
    <div className="pod">
      {content}
      <div className={`toast${toast ? ' on' : ''}`} role="status" aria-live="polite">
        {toast}
      </div>
    </div>
  )
}

/** Avatar on yellow or orange profile cards gets a dark circle, as in the design. */
const avatarStyle = (color: string) => (color === '#FFC857' || color === '#F4A259' ? { background: '#1E1E1E', color: '#F5F3EC' } : undefined)
const initial = (name: string) => Array.from(name.trim())[0] ?? '5'

function PodView({ pod, onShare, onEdit }: { pod: Pod; onShare: () => void; onEdit?: () => void }) {
  const profileColor = pod.profileColor >= 0 ? POD_COLORS[pod.profileColor] : ''
  const w = pod.window
  return (
    <div className="wrap">
      <div className="top">
        <a className="home" href="/">
          ← 500 Windows Thailand
        </a>
        <div className="acts">
          <button type="button" className="pill ico" onClick={onShare} aria-label="แชร์หน้านี้">
            {SHARE}
          </button>
          {onEdit && (
            <button type="button" className="pill ico" onClick={onEdit} aria-label="แก้ไข">
              {PEN}
            </button>
          )}
        </div>
      </div>
      <div className="duo">
        <div className="card pf" style={profileColor ? { background: profileColor, color: 'var(--dk)' } : undefined}>
          <div className="avrow">
            <div className="avatar" style={avatarStyle(profileColor)}>
              {pod.avatar ? <img src={pod.avatar} alt="" /> : initial(pod.name)}
            </div>
          </div>
        </div>
        <a className="card wc" style={{ background: POD_COLORS[pod.windowColor] ?? POD_COLORS[0] }} href={w ? `/w/${w.region}/${w.num}` : '/'}>
          <div className="wt">
            <div className="thumb">{WIN}</div>
            <i className="go">↗</i>
          </div>
          <div className="body">
            <b>{w ? w.code : '500 Windows'}</b>
            <span>{w ? 'บานหน้าต่างของฉัน' : 'หน้าต่าง 3,500 บานทั่วไทย'}</span>
          </div>
          <div className="in">
            <u>เปิดลิงก์</u>
          </div>
        </a>
      </div>
      <div className="hero">
        <h1>{pod.name}</h1>
        {pod.bio && <p className="bio">{pod.bio}</p>}
      </div>
      {pod.links.length > 0 && (
        <div className="sec">
          <span>Links</span>
        </div>
      )}
      {pod.links.map((link, i) => {
        const href = podLinkHref(link.url)
        const inner = (
          <>
            <div className="ct">
              {link.img && (
                <div className="thumb">
                  <img src={link.img} alt="" />
                </div>
              )}
              <div className="body">
                <b>{link.title}</b>
                {link.desc && <span>{link.desc}</span>}
              </div>
              {href && <i className="go">↗</i>}
            </div>
            {href && (
              <div className="in">
                <em>{podLinkHost(link.url)}</em>
                <u>เปิดลิงก์</u>
              </div>
            )}
          </>
        )
        const style = { background: POD_LINK_COLORS[i % POD_LINK_COLORS.length] }
        return href ? (
          <a key={i} className="card" style={style} href={href} target="_blank" rel="noopener noreferrer nofollow">
            {inner}
          </a>
        ) : (
          <div key={i} className="card" style={style}>
            {inner}
          </div>
        )
      })}
      <a className="foot" href="/">
        500 Windows Thailand : Pod
      </a>
    </div>
  )
}

interface PodEditorProps {
  draft: Draft
  setDraft: (draft: Draft) => void
  windows: PodWindow[]
  saving: boolean
  onSave: () => void
  onCancel?: () => void
  onError: (message: string) => void
}

function PodEditor({ draft, setDraft, windows, saving, onSave, onCancel, onError }: PodEditorProps) {
  const fileRef = useRef<HTMLInputElement>(null)
  const pickFor = useRef<'avatar' | number>('avatar')
  const set = (changes: Partial<Draft>) => setDraft({ ...draft, ...changes })
  const setLink = (i: number, changes: Partial<PodLink>) => set({ links: draft.links.map((l, j) => (j === i ? { ...l, ...changes } : l)) })
  const pick = (target: 'avatar' | number) => {
    pickFor.current = target
    fileRef.current?.click()
  }
  const onFile = async (file: File | undefined) => {
    if (!file) return
    const target = pickFor.current
    const image = await compressImage(file, target === 'avatar' ? 400 : 300, 0.82).catch(() => '')
    if (!image) return onError('อ่านไฟล์รูปไม่ได้ กรุณาเลือกรูปอื่น')
    if (target === 'avatar') set({ avatar: image })
    else setLink(target, { img: image })
  }
  const move = (i: number, d: number) => {
    const links = [...draft.links]
    ;[links[i], links[i + d]] = [links[i + d], links[i]]
    set({ links })
  }
  const profileColor = draft.profileColor >= 0 ? POD_COLORS[draft.profileColor] : ''
  const slugError = draft.slug ? podSlugError(normalizePodSlug(draft.slug)) : null

  return (
    <div className="wrap edit">
      <div className="top">
        <a className="home" href="/">
          ← 500 Windows Thailand
        </a>
        <div className="acts">
          {onCancel && (
            <button type="button" className="pill sub" onClick={onCancel} disabled={saving}>
              ยกเลิก
            </button>
          )}
          <button type="button" className="pill" onClick={onSave} disabled={saving}>
            {saving ? 'กำลังบันทึก…' : 'บันทึก'}
          </button>
        </div>
      </div>

      <div className="slug">
        <b>ลิงก์ Pod ของคุณ</b>
        <div className="row">
          <span>500windowsthailand.com/pod/</span>
          <input
            value={draft.slug}
            maxLength={POD_SLUG_MAX}
            onChange={(e) => set({ slug: e.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '') })}
            placeholder="ชื่อร้านหรือชื่อคุณ"
            inputMode="url"
            autoCapitalize="none"
          />
        </div>
        <div className="cnt" style={{ textAlign: 'left', color: slugError ? '#EB5A4F' : undefined }}>
          {slugError ?? 'ใช้ได้เฉพาะ a-z, 0-9 และขีด (-)'}
        </div>
      </div>

      <div className="card pf" style={profileColor ? { background: profileColor, color: 'var(--dk)' } : undefined}>
        <div className="avrow">
          <button type="button" className="avatar" style={avatarStyle(profileColor)} onClick={() => pick('avatar')} aria-label="เปลี่ยนรูปโปรไฟล์">
            {draft.avatar ? <img src={draft.avatar} alt="" /> : initial(draft.name)}
          </button>
        </div>
        {draft.avatar && (
          <button type="button" className="mv" style={{ margin: '10px 0 0' }} onClick={() => set({ avatar: '' })}>
            ลบรูปโปรไฟล์
          </button>
        )}
        <div className="cnt" style={{ textAlign: 'center', marginTop: 12 }}>
          สีโปรไฟล์
        </div>
        <div className="sw" style={{ justifyContent: 'center', marginTop: 6 }}>
          <button
            type="button"
            className={`dot df${draft.profileColor < 0 ? ' on' : ''}`}
            style={{ background: 'var(--panel)' }}
            onClick={() => set({ profileColor: -1 })}
            aria-label="สีเริ่มต้น"
          />
          {POD_COLORS.map((c, i) => (
            <button
              key={c}
              type="button"
              className={`dot${draft.profileColor === i ? ' on' : ''}`}
              style={{ background: c }}
              onClick={() => set({ profileColor: i })}
              aria-label={`สีโปรไฟล์ ${i + 1}`}
            />
          ))}
        </div>
      </div>

      <div className="hero">
        <input
          value={draft.name}
          maxLength={POD_NAME_MAX}
          onChange={(e) => set({ name: e.target.value })}
          placeholder="ชื่อของคุณหรือชื่อร้าน"
          style={{ textAlign: 'center', marginBottom: 8 }}
        />
        <textarea value={draft.bio} maxLength={POD_BIO_MAX} onChange={(e) => set({ bio: e.target.value })} placeholder={`แนะนำตัวตนของคุณที่นี่ (ไม่เกิน ${POD_BIO_MAX} ตัวอักษร)`} />
        <div className="cnt">
          {draft.bio.length}/{POD_BIO_MAX}
        </div>
      </div>

      <div className="card wc ed" style={{ background: POD_COLORS[draft.windowColor] ?? POD_COLORS[0] }}>
        <b>การ์ดบานหน้าต่าง</b>
        {windows.length ? (
          <select
            value={draft.window ? `${draft.window.region}/${draft.window.num}` : ''}
            onChange={(e) => set({ window: windows.find((w) => `${w.region}/${w.num}` === e.target.value) ?? null })}
          >
            <option value="">ไม่แสดงบาน (ลิงก์ไปหน้าหลัก)</option>
            {windows.map((w) => (
              <option key={`${w.region}/${w.num}`} value={`${w.region}/${w.num}`}>
                {w.code}
                {w.title ? ` · ${w.title}` : ''}
              </option>
            ))}
          </select>
        ) : (
          <div className="cnt" style={{ textAlign: 'left' }}>
            คุณยังไม่มีบานหน้าต่าง การ์ดนี้จะลิงก์ไปหน้าหลักของ 500 Windows Thailand
          </div>
        )}
        <div className="cnt" style={{ textAlign: 'left' }}>
          สีการ์ด
        </div>
        <div className="sw">
          {POD_COLORS.map((c, i) => (
            <button
              key={c}
              type="button"
              className={`dot${draft.windowColor === i ? ' on' : ''}`}
              style={{ background: c }}
              onClick={() => set({ windowColor: i })}
              aria-label={`สีการ์ด ${i + 1}`}
            />
          ))}
        </div>
      </div>

      <div className="sec">
        <span>Links</span>
        <small>
          {draft.links.length}/{POD_LINKS_MAX}
        </small>
      </div>
      {draft.links.map((link, i) => (
        <div key={i} className="card ed" style={{ background: POD_LINK_COLORS[i % POD_LINK_COLORS.length] }}>
          <div className="row">
            <button type="button" className="thumb" onClick={() => pick(i)} aria-label="เปลี่ยนรูป">
              {link.img ? <img src={link.img} alt="" /> : '+'}
            </button>
            <div className="f">
              <input value={link.title} maxLength={POD_LINK_TITLE_MAX} onChange={(e) => setLink(i, { title: e.target.value })} placeholder="ชื่อลิงก์" />
              <input value={link.url} onChange={(e) => setLink(i, { url: e.target.value })} placeholder="https://..." inputMode="url" autoCapitalize="none" />
            </div>
          </div>
          <textarea value={link.desc} maxLength={POD_LINK_DESC_MAX} onChange={(e) => setLink(i, { desc: e.target.value })} placeholder="คำอธิบายสั้นๆ" />
          <div className="cnt">
            {link.desc.length}/{POD_LINK_DESC_MAX}
          </div>
          {link.img && (
            <button type="button" className="mv" onClick={() => setLink(i, { img: '' })}>
              ลบรูป
            </button>
          )}
          {i > 0 && (
            <button type="button" className="mv" onClick={() => move(i, -1)}>
              ↑ ย้ายขึ้น
            </button>
          )}
          {i < draft.links.length - 1 && (
            <button type="button" className="mv" onClick={() => move(i, 1)}>
              ↓ ย้ายลง
            </button>
          )}
          <button type="button" className="del" onClick={() => set({ links: draft.links.filter((_, j) => j !== i) })}>
            ลบลิงก์นี้
          </button>
        </div>
      ))}
      {draft.links.length < POD_LINKS_MAX ? (
        <button type="button" className="add" onClick={() => set({ links: [...draft.links, newLink()] })}>
          + เพิ่มลิงก์ ({draft.links.length}/{POD_LINKS_MAX})
        </button>
      ) : (
        <div className="cnt" style={{ textAlign: 'center' }}>
          ครบ {POD_LINKS_MAX} ลิงก์แล้ว
        </div>
      )}
      <p className="note">กด "บันทึก" ด้านบนเพื่อเผยแพร่ ทุกคนที่มีลิงก์จะเห็นหน้านี้</p>
      <input
        ref={fileRef}
        type="file"
        accept="image/*"
        onChange={(e) => {
          onFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />
    </div>
  )
}
