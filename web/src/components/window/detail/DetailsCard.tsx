import { useEffect, useState } from 'react'
import QRCode from 'qrcode'
import { lineUrl, PROFILE_LIMITS, telHref } from '@shared/windowProfile'
import { btn, btnPri, card, CardHead, field, h3, Hint, muted, para, useCardDraft, type DetailContext } from './ui'

/** "About us" and how to reach the owner (phone, LINE with a QR code to add them). */
export function DetailsCard({ ctx }: { ctx: DetailContext }) {
  const editor = useCardDraft(ctx, ['about', 'phone', 'lineId'])
  const { about, phone, lineId } = editor.draft
  const e = editor.editing
  const line = lineUrl(lineId)
  const contact = () => {
    if (line) window.open(line, '_blank', 'noopener')
    else if (phone) window.location.href = telHref(phone)
    else ctx.notify('ยังไม่ได้ระบุช่องทางติดต่อ', 'info')
  }
  const row = 'flex justify-between items-center gap-2.5 py-2 border-b border-(--kap-line) text-[14px]'

  return (
    <section className={card}>
      <CardHead title="📋 รายละเอียดเพิ่มเติม" owner={ctx.isOwner} editor={editor} />
      {e && <Hint>โหมดเจ้าของ: แก้ข้อความเกี่ยวกับเรา และข้อมูลติดต่อ (เบอร์โทร, LINE) ได้โดยตรง</Hint>}
      <h3 className={`${h3} mb-2.5`}>ℹ️ เกี่ยวกับเรา</h3>
      {e ? (
        <textarea rows={9} maxLength={PROFILE_LIMITS.about} value={about} onChange={(ev) => editor.set({ about: ev.target.value })} aria-label="เกี่ยวกับเรา" placeholder="เกี่ยวกับเรา" className={field} />
      ) : (
        <p className={`${para} whitespace-pre-line`}>{about || 'เจ้าของบานยังไม่ได้เพิ่มรายละเอียด'}</p>
      )}

      <h3 className={`${h3} mt-4 mb-2.5`}>📞 ข้อมูลติดต่อ</h3>
      <div className="flex gap-3 items-start max-[480px]:flex-wrap">
        <div className="flex-1 min-w-0">
          <div className={row}>
            <span className="flex-1 min-w-0">
              <small className={`block ${muted}`}>เบอร์โทร</small>
              {e ? (
                <input type="tel" inputMode="tel" maxLength={20} value={phone} onChange={(ev) => editor.set({ phone: ev.target.value })} aria-label="เบอร์โทร" placeholder="เบอร์โทร" className={field} />
              ) : (
                phone || <span className={muted}>-</span>
              )}
            </span>
            {!e && phone && (
              <a href={telHref(phone)} className={btn}>
                โทรเลย
              </a>
            )}
          </div>
          <div className={row}>
            <span className="flex-1 min-w-0">
              <small className={`block ${muted}`}>LINE</small>
              {e ? (
                <input maxLength={40} value={lineId} onChange={(ev) => editor.set({ lineId: ev.target.value })} aria-label="LINE ID" placeholder="LINE ID เช่น @shop" className={field} />
              ) : (
                lineId || <span className={muted}>-</span>
              )}
            </span>
            {!e && line && (
              <a href={line} target="_blank" rel="noopener noreferrer" className={btn}>
                แชท
              </a>
            )}
          </div>
          {!e && (phone || line) && (
            <div className="mt-2.5">
              <button type="button" onClick={contact} className={`${btn} ${btnPri}`}>
                💬 ติดต่อเจ้าของหน้าต่าง
              </button>
            </div>
          )}
        </div>
        {!e && line && <LineQr url={line} />}
      </div>
    </section>
  )
}

function LineQr({ url }: { url: string }) {
  const [src, setSrc] = useState('')
  useEffect(() => {
    let live = true
    QRCode.toDataURL(url, { margin: 1, width: 220, errorCorrectionLevel: 'M' })
      .then((data) => live && setSrc(data))
      .catch(() => live && setSrc(''))
    return () => {
      live = false
    }
  }, [url])
  if (!src) return null
  return (
    <a href={url} target="_blank" rel="noopener noreferrer" className="text-center no-underline">
      <span className="w-[110px] h-[110px] rounded-lg bg-white p-1.5 flex items-center justify-center mx-auto mb-1">
        <img src={src} alt="QR code เพิ่มเพื่อน LINE" className="w-full h-full block" />
      </span>
      <small className={muted}>สแกนเพื่อเพิ่มเพื่อน</small>
    </a>
  )
}
