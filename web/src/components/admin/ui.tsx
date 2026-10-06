// AdminLTE-style building blocks recreated with Tailwind (no Bootstrap dependency):
// light grey content, white cards with a coloured top border, coloured "small boxes".
import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'

export type Tone = 'primary' | 'info' | 'success' | 'warning' | 'danger' | 'secondary' | 'dark'

/** AdminLTE 3 colour palette. */
export const TONES: Record<Tone, { bg: string; text: string; border: string; soft: string }> = {
  primary: { bg: 'bg-[#007bff]', text: 'text-[#007bff]', border: 'border-t-[#007bff]', soft: 'bg-[#007bff]/10' },
  info: { bg: 'bg-[#17a2b8]', text: 'text-[#17a2b8]', border: 'border-t-[#17a2b8]', soft: 'bg-[#17a2b8]/10' },
  success: { bg: 'bg-[#28a745]', text: 'text-[#28a745]', border: 'border-t-[#28a745]', soft: 'bg-[#28a745]/10' },
  warning: { bg: 'bg-[#ffc107]', text: 'text-[#c69500]', border: 'border-t-[#ffc107]', soft: 'bg-[#ffc107]/15' },
  danger: { bg: 'bg-[#dc3545]', text: 'text-[#dc3545]', border: 'border-t-[#dc3545]', soft: 'bg-[#dc3545]/10' },
  secondary: { bg: 'bg-[#6c757d]', text: 'text-[#6c757d]', border: 'border-t-[#6c757d]', soft: 'bg-[#6c757d]/10' },
  dark: { bg: 'bg-[#343a40]', text: 'text-[#343a40]', border: 'border-t-[#343a40]', soft: 'bg-[#343a40]/10' },
}

const CARD_SHADOW = 'shadow-[0_0_1px_rgba(0,0,0,.125),0_1px_3px_rgba(0,0,0,.2)]'

interface CardProps {
  title?: ReactNode
  icon?: LucideIcon
  /** Coloured 3px top border ("card-outline"). */
  outline?: Tone
  tools?: ReactNode
  footer?: ReactNode
  /** Remove body padding, e.g. for full-width tables. */
  flush?: boolean
  className?: string
  children: ReactNode
}

export function Card({ title, icon: Icon, outline, tools, footer, flush, className = '', children }: CardProps) {
  return (
    <section
      className={`bg-white rounded ${CARD_SHADOW} mb-4 flex flex-col ${outline ? `border-t-[3px] ${TONES[outline].border}` : ''} ${className}`}
    >
      {(title || tools) && (
        <header className="flex items-center justify-between gap-3 px-5 py-3 border-b border-black/[.125]">
          <h3 className="text-[1.05rem] font-normal text-[#212529] flex items-center gap-2 m-0">
            {Icon && <Icon className="w-4 h-4 text-[#6c757d]" />}
            {title}
          </h3>
          {tools && <div className="flex items-center gap-2 text-sm">{tools}</div>}
        </header>
      )}
      <div className={flush ? '' : 'p-5'}>{children}</div>
      {footer && <footer className="px-5 py-3 bg-black/[.03] border-t border-black/[.125] text-sm">{footer}</footer>}
    </section>
  )
}

/** Coloured KPI tile with a large faded icon and a "more info" footer. */
export function SmallBox({
  tone,
  value,
  label,
  icon: Icon,
  onMore,
}: {
  tone: Tone
  value: ReactNode
  label: string
  icon: LucideIcon
  onMore?: () => void
}) {
  const dark = tone === 'warning'
  return (
    <div className={`relative overflow-hidden rounded ${CARD_SHADOW} ${TONES[tone].bg} ${dark ? 'text-[#1f2d3d]' : 'text-white'}`}>
      <div className="p-3 relative z-10">
        <div className="text-[2.1rem] font-bold leading-tight whitespace-nowrap">{value}</div>
        <p className="m-0 text-[0.95rem]">{label}</p>
      </div>
      <Icon className="absolute right-3 top-3 w-16 h-16 opacity-20" strokeWidth={1.5} />
      <button
        type="button"
        onClick={onMore}
        className={`block w-full text-center text-sm py-1 bg-black/10 hover:bg-black/15 cursor-pointer relative z-10 ${dark ? 'text-[#1f2d3d]/80' : 'text-white/80'}`}
      >
        ดูเพิ่มเติม →
      </button>
    </div>
  )
}

/** Compact KPI ("info-box"): coloured icon square + label + number. */
export function InfoBox({ tone, icon: Icon, label, value }: { tone: Tone; icon: LucideIcon; label: string; value: ReactNode }) {
  return (
    <div className={`bg-white rounded ${CARD_SHADOW} p-2 flex items-center gap-3 min-h-[80px]`}>
      <span className={`w-[70px] h-[70px] rounded flex items-center justify-center text-white ${TONES[tone].bg}`}>
        <Icon className="w-7 h-7" />
      </span>
      <div className="min-w-0">
        <span className="block text-sm text-[#495057] truncate">{label}</span>
        <span className="block text-lg font-bold text-[#212529]">{value}</span>
      </div>
    </div>
  )
}

export function Badge({ tone, children }: { tone: Tone; children: ReactNode }) {
  const dark = tone === 'warning'
  return (
    <span className={`inline-block px-1.5 py-0.5 rounded text-[0.75rem] font-bold leading-none whitespace-nowrap ${TONES[tone].bg} ${dark ? 'text-[#1f2d3d]' : 'text-white'}`}>
      {children}
    </span>
  )
}

export function Button({
  tone = 'primary',
  outline,
  size = 'md',
  children,
  className = '',
  ...props
}: React.ButtonHTMLAttributes<HTMLButtonElement> & { tone?: Tone; outline?: boolean; size?: 'sm' | 'md' }) {
  const sizing = size === 'sm' ? 'px-2 py-1 text-[0.8rem]' : 'px-3 py-1.5 text-sm'
  const colors = outline
    ? `bg-white border ${TONES[tone].text} border-current hover:bg-black/[.04]`
    : `${TONES[tone].bg} ${tone === 'warning' ? 'text-[#1f2d3d]' : 'text-white'} border border-transparent hover:brightness-95`
  return (
    <button
      type="button"
      {...props}
      className={`inline-flex items-center gap-1.5 rounded ${sizing} ${colors} disabled:opacity-60 disabled:cursor-not-allowed cursor-pointer ${className}`}
    >
      {children}
    </button>
  )
}

/** Bordered striped table ("table table-striped table-hover"). */
export function DataTable({ head, children, empty }: { head: ReactNode[]; children: ReactNode; empty?: string }) {
  const hasRows = Array.isArray(children) ? children.length > 0 : !!children
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm text-[#212529] border-collapse">
        <thead>
          <tr className="border-b-2 border-[#dee2e6]">
            {head.map((h, i) => (
              <th key={i} className="text-left font-bold px-3 py-2 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="[&>tr:nth-child(odd)]:bg-black/[.03] [&>tr:hover]:bg-black/[.06] [&>tr]:border-t [&>tr]:border-[#dee2e6] [&_td]:px-3 [&_td]:py-2 [&_td]:align-middle">
          {hasRows ? (
            children
          ) : (
            <tr>
              <td colSpan={head.length} className="text-center text-[#6c757d] py-6">
                {empty || 'ไม่มีข้อมูล'}
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  )
}

export function FormRow({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="mb-3">
      <label className="block text-sm font-bold text-[#212529] mb-1">{label}</label>
      {children}
      {hint && <small className="block text-[0.8rem] text-[#6c757d] mt-1">{hint}</small>}
    </div>
  )
}

export const inputClass =
  'w-full bg-white border border-[#ced4da] rounded px-3 py-1.5 text-sm text-[#495057] focus:outline-none focus:border-[#80bdff] focus:shadow-[0_0_0_.2rem_rgba(0,123,255,.25)]'

export function Callout({ tone, title, children }: { tone: Tone; title?: string; children: ReactNode }) {
  const borderColor: Record<Tone, string> = {
    primary: 'border-l-[#007bff]',
    info: 'border-l-[#117a8b]',
    success: 'border-l-[#1e7e34]',
    warning: 'border-l-[#d39e00]',
    danger: 'border-l-[#bd2130]',
    secondary: 'border-l-[#545b62]',
    dark: 'border-l-[#1d2124]',
  }
  return (
    <div className={`bg-white rounded border-l-[5px] ${borderColor[tone]} ${CARD_SHADOW} p-4 mb-4 text-sm text-[#212529]`}>
      {title && <h5 className="font-bold mb-1">{title}</h5>}
      {children}
    </div>
  )
}

/** "Requires backend" notice for features that can't run in the browser-only demo. */
export function BackendNotice({ children }: { children: ReactNode }) {
  return (
    <Callout tone="warning" title="ต้องเชื่อมต่อระบบหลังบ้าน (backend)">
      {children}
    </Callout>
  )
}

export const baht = (n: number) => `฿${n.toLocaleString()}`
export const thaiDateTime = (iso?: string) => (iso ? new Date(iso).toLocaleString('th-TH') : '-')
