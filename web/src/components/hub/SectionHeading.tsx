import type { LucideIcon } from 'lucide-react'

interface SectionHeadingProps {
  icon: LucideIcon
  title: string
  hint?: string
  tone?: 'rose' | 'amber'
}

export function SectionHeading({ icon: Icon, title, hint, tone = 'rose' }: SectionHeadingProps) {
  const toneClass =
    tone === 'amber' ? 'bg-amber-500/10 text-amber-300 ring-amber-400/30' : 'bg-rose-500/10 text-rose-300 ring-rose-400/30'
  return (
    <div className="flex items-center gap-3">
      <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-xl ring-1 ${toneClass}`}>
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <h4 className="font-['Prompt',sans-serif] text-sm font-semibold leading-snug text-stone-100">{title}</h4>
        {hint && <p className="font-['Prompt',sans-serif] text-[11px] font-light text-stone-500">{hint}</p>}
      </div>
    </div>
  )
}
