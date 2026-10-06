import { useMemo } from 'react'
import { PROMO_LAYOUT_LABELS, previewPromoLayout } from '@/lib/promo'
import { sixHourBlock } from '@shared/thaiTime'

interface PromoLayoutPreviewProps {
  size: number
  /** 0 = this 6-hour round, 1 = next round. */
  offset: number
  image?: string
  brand?: string
}

/** A 6×8 mini board showing an example of where a `size`-window ad lands this round. */
export function PromoLayoutPreview({ size, offset, image, brand }: PromoLayoutPreviewProps) {
  const round = sixHourBlock(Date.now(), offset)
  const preview = useMemo(() => previewPromoLayout(size, round.idx), [size, round.idx])
  const cellAt = (row: number, col: number) => preview.cells.find((c) => c.r === row && c.c === col)

  return (
    <div className="rounded-2xl border border-purple-900/40 bg-[#0b0814] p-3">
      <div className="mb-2 flex items-center justify-between text-xs font-['Prompt',sans-serif]">
        <span className="font-semibold text-stone-100">
          {offset === 0 ? 'รอบนี้' : 'รอบถัดไป'} · {round.label}
        </span>
        <span className="rounded-full bg-rose-500/10 px-2 py-0.5 text-rose-300 ring-1 ring-rose-400/30">
          {PROMO_LAYOUT_LABELS[preview.layout]}
        </span>
      </div>
      <div className="grid gap-1" style={{ gridTemplateColumns: 'repeat(8, minmax(0, 1fr))' }}>
        {Array.from({ length: 48 }, (_, index) => {
          const cell = cellAt(Math.floor(index / 8), index % 8)
          if (!cell) return <div key={index} className="aspect-square rounded-md bg-[#17122a]" />
          return (
            <div
              key={index}
              className="relative aspect-square overflow-hidden rounded-md bg-gradient-to-br from-orange-400 to-fuchsia-500 ring-1 ring-amber-200/60"
            >
              {image && <img src={image} alt="" className="absolute inset-0 h-full w-full object-cover" />}
              <span className="absolute bottom-0 right-0 rounded-tl bg-black/60 px-1 font-mono text-[9px] text-white">
                {cell.num}
              </span>
              {!image && (
                <span className="absolute inset-0 flex items-center justify-center text-[10px] font-bold text-white font-['Prompt',sans-serif]">
                  {(brand || 'โปรโมท').slice(0, 2)}
                </span>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
