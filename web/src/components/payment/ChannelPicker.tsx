import { Building2, CreditCard, QrCode, Smartphone } from 'lucide-react'
import type { PaymentChannel, PaymentChannelType } from '@shared/types'
import { CHANNEL_TYPE_LABELS } from '@/lib/settings'

const ICONS: Record<PaymentChannelType, typeof QrCode> = {
  promptpay: QrCode,
  bank: Building2,
  truemoney: Smartphone,
  card: CreditCard,
}

interface ChannelPickerProps {
  channels: PaymentChannel[]
  selectedId: string | null
  onSelect: (id: string) => void
}

/** List of the platform's enabled receiving channels (configured by admins). */
export function ChannelPicker({ channels, selectedId, onSelect }: ChannelPickerProps) {
  if (channels.length === 0) {
    return (
      <p className="p-3 rounded-xl bg-rose-950/40 border border-rose-800 text-rose-200 text-xs">
        ยังไม่มีช่องทางรับชำระเงินที่เปิดใช้งาน กรุณาติดต่อผู้ดูแลระบบ
      </p>
    )
  }
  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2" role="radiogroup" aria-label="ช่องทางชำระเงิน">
      {channels.map((channel) => {
        const Icon = ICONS[channel.type]
        const active = channel.id === selectedId
        return (
          <button
            key={channel.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onSelect(channel.id)}
            className={`p-3 rounded-xl border text-left flex items-center gap-2.5 cursor-pointer transition-all ${active ? 'bg-rose-500/15 border-rose-400 ring-1 ring-rose-400/40' : 'bg-[#140f22] border-purple-900/40 hover:border-rose-400/50'}`}
          >
            <Icon className={`w-5 h-5 shrink-0 ${active ? 'text-rose-300' : 'text-stone-400'}`} />
            <span className="min-w-0">
              <span className="block text-xs font-semibold text-stone-100 truncate">{channel.name}</span>
              <span className="block text-[10px] text-stone-400 truncate">{CHANNEL_TYPE_LABELS[channel.type]}</span>
            </span>
          </button>
        )
      })}
    </div>
  )
}
