import { useState } from 'react'
import { BadgeDollarSign, BookOpen, CreditCard, Pencil, Plus, RotateCcw, Save, Scale, Trash2 } from 'lucide-react'
import type { PaymentChannel, PaymentChannelType, PlatformSettings, PriceCapTier } from '@/types'
import { BANKS } from '@/data/banks'
import { updateSettings } from '@/lib/adminStore'
import {
  CHANNEL_TYPE_LABELS,
  DEFAULT_SETTINGS,
  multiplierLabel,
  sortTiers,
  tierAgeLabel,
  useSettings,
  validateTiers,
} from '@/lib/settings'
import { CLAIM_PRICE, MIN_HOLDING_DAYS, MIN_RESALE_PRICE, RESALE_COMMISSION_RATE } from '@/lib/ownershipRules'
import { PROMO_PRICE_PER_WINDOW_ROUND, PROMO_SLOTS } from '@/lib/promo'
import type { AdminPageProps } from '../adminData'
import { Badge, baht, Button, Callout, Card, DataTable, FormRow, inputClass } from '../ui'

const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`

// ---------------------------------------------------------------- price caps

export function PriceCapsPage({ admin, notify }: AdminPageProps) {
  const settings = useSettings()
  const [unused, setUnused] = useState<number | null>(settings.priceCaps.unusedMultiplier)
  const [tiers, setTiers] = useState<PriceCapTier[]>(sortTiers(settings.priceCaps.usedTiers))
  const [error, setError] = useState('')
  const base = CLAIM_PRICE

  const updateTier = (id: string, change: Partial<PriceCapTier>) => setTiers(tiers.map((t) => (t.id === id ? { ...t, ...change } : t)))

  /** Inserts a new tier before the open-ended one, one year after the previous bound. */
  const addTier = () => {
    const bounded = tiers.filter((t) => t.upToYears !== null)
    const lastBound = bounded.length ? Math.max(...bounded.map((t) => t.upToYears!)) : 0
    setTiers(sortTiers([...tiers, { id: newId('tier'), upToYears: lastBound + 1, multiplier: 10 }]))
  }

  const save = () => {
    const sorted = sortTiers(tiers)
    const problem = validateTiers(sorted) || (unused !== null && !(unused >= 1) ? 'ตัวคูณของบานที่ยังไม่ใช้งานต้องไม่น้อยกว่า 1 เท่า' : null)
    if (problem) return setError(problem)
    setError('')
    const next: PlatformSettings = { ...settings, priceCaps: { unusedMultiplier: unused, usedTiers: sorted } }
    const summary = [
      `ยังไม่ใช้งาน: ${multiplierLabel(unused)}`,
      ...sorted.map((t, i) => `${tierAgeLabel(sorted, i)}: ${multiplierLabel(t.multiplier)}`),
    ].join(' · ')
    updateSettings(admin, next, `เพดานราคาขายต่อ → ${summary}`)
    setTiers(sorted)
    notify('บันทึกเพดานราคาขายต่อแล้ว มีผลกับการตั้งราคาขายต่อทันที')
  }

  const reset = () => {
    setUnused(DEFAULT_SETTINGS.priceCaps.unusedMultiplier)
    setTiers(sortTiers(DEFAULT_SETTINGS.priceCaps.usedTiers))
  }

  const sorted = sortTiers(tiers)

  return (
    <>
      <Callout tone="info" title="วิธีคำนวณเพดานราคา">
        เพดาน = ราคาตั้งต้น ({baht(base)}) × ตัวคูณ ตามอายุนับจากวันจับจองครั้งแรก · ถ้าผู้ขายซื้อมาแพงกว่าเพดาน
        เพดานจะถูกปรับขึ้นเป็นราคาที่ซื้อมา · ช่วงสุดท้ายต้องเป็น "ขึ้นไป" เสมอ
      </Callout>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
        <div className="xl:col-span-2">
          <Card
            title="ช่วงอายุและตัวคูณเพดานราคา"
            icon={Scale}
            outline="primary"
            footer={
              <div className="flex flex-wrap justify-between gap-2">
                <Button tone="secondary" outline onClick={reset}>
                  <RotateCcw className="w-4 h-4" /> ค่าเริ่มต้น
                </Button>
                <Button tone="primary" onClick={save}>
                  <Save className="w-4 h-4" /> บันทึก
                </Button>
              </div>
            }
          >
            {error && <div className="mb-3 p-2.5 rounded bg-[#f8d7da] text-[#721c24] text-sm border border-[#f5c6cb]">{error}</div>}

            <FormRow label="บานที่ยังไม่เคยผ่านการใช้งาน" hint="ยังไม่เคยลงรูป ไม่มีประวัติรูป ข้อความประจำวัน หรือยอดถูกใจ">
              <MultiplierInput value={unused} onChange={setUnused} />
            </FormRow>

            <h4 className="text-sm font-bold mt-5 mb-2">บานที่ผ่านการใช้งานแล้ว (ตามอายุ)</h4>
            <DataTable head={['ช่วงอายุ', 'อายุสิ้นสุด (ปี)', 'ตัวคูณสูงสุด', 'เพดาน', '']}>
              {sorted.map((tier, index) => {
                const isLast = index === sorted.length - 1
                return (
                  <tr key={tier.id}>
                    <td className="whitespace-nowrap">{tierAgeLabel(sorted, index)}</td>
                    <td>
                      {isLast ? (
                        <span className="text-[#6c757d]">ขึ้นไป (ไม่มีสิ้นสุด)</span>
                      ) : (
                        <input
                          type="number"
                          min={0.5}
                          step={0.5}
                          value={tier.upToYears ?? ''}
                          onChange={(e) => updateTier(tier.id, { upToYears: e.target.value === '' ? 0 : Number(e.target.value) })}
                          className={`${inputClass} w-24`}
                        />
                      )}
                    </td>
                    <td>
                      <MultiplierInput value={tier.multiplier} onChange={(m) => updateTier(tier.id, { multiplier: m })} />
                    </td>
                    <td className="font-mono whitespace-nowrap">{tier.multiplier === null ? 'ไม่จำกัด' : baht(base * tier.multiplier)}</td>
                    <td>
                      {!isLast && (
                        <Button size="sm" tone="danger" outline onClick={() => setTiers(tiers.filter((t) => t.id !== tier.id))} aria-label="ลบช่วงนี้">
                          <Trash2 className="w-3.5 h-3.5" />
                        </Button>
                      )}
                    </td>
                  </tr>
                )
              })}
            </DataTable>
            <Button tone="success" size="sm" className="mt-3" onClick={addTier}>
              <Plus className="w-3.5 h-3.5" /> เพิ่มช่วงอายุ
            </Button>
          </Card>
        </div>

        <Card title="ตัวอย่างที่ผู้ใช้จะเห็น" outline="success">
          <ul className="space-y-2 text-sm">
            <li className="flex justify-between gap-2 border-b border-[#dee2e6] pb-1">
              <span>ยังไม่เคยใช้งาน</span>
              <b>{unused === null ? 'ไม่จำกัด' : `ไม่เกิน ${baht(base * unused)}`}</b>
            </li>
            {sorted.map((t, i) => (
              <li key={t.id} className="flex justify-between gap-2 border-b border-[#dee2e6] pb-1">
                <span>ใช้งานแล้ว {tierAgeLabel(sorted, i)}</span>
                <b>{t.multiplier === null ? 'ตามกลไกตลาด' : `ไม่เกิน ${baht(base * t.multiplier)}`}</b>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}

/** Number input plus a "no cap" switch. */
function MultiplierInput({ value, onChange }: { value: number | null; onChange: (value: number | null) => void }) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <input
        type="number"
        min={1}
        step={1}
        disabled={value === null}
        value={value ?? ''}
        onChange={(e) => onChange(Number(e.target.value))}
        className={`${inputClass} w-24 disabled:bg-[#e9ecef]`}
      />
      <span className="text-sm text-[#6c757d]">เท่า</span>
      <label className="flex items-center gap-1 text-sm cursor-pointer">
        <input type="checkbox" checked={value === null} onChange={(e) => onChange(e.target.checked ? null : 10)} />
        ไม่จำกัด
      </label>
    </div>
  )
}

// ---------------------------------------------------------------- payment channels

const EMPTY_CHANNEL: PaymentChannel = { id: '', type: 'bank', name: '', enabled: true, bankCode: 'kbank', accountName: '', accountNumber: '' }

export function ChannelsPage({ admin, notify }: AdminPageProps) {
  const settings = useSettings()
  const [editing, setEditing] = useState<PaymentChannel | null>(null)
  const [error, setError] = useState('')

  const saveChannels = (channels: PaymentChannel[], what: string) => updateSettings(admin, { ...settings, paymentChannels: channels }, what)

  const toggle = (channel: PaymentChannel) => {
    saveChannels(
      settings.paymentChannels.map((c) => (c.id === channel.id ? { ...c, enabled: !c.enabled } : c)),
      `${channel.enabled ? 'ปิด' : 'เปิด'}ช่องทาง ${channel.name}`,
    )
    notify(`${channel.enabled ? 'ปิด' : 'เปิด'}ช่องทาง ${channel.name} แล้ว`)
  }
  const remove = (channel: PaymentChannel) => {
    if (!window.confirm(`ลบช่องทาง ${channel.name}?`)) return
    saveChannels(settings.paymentChannels.filter((c) => c.id !== channel.id), `ลบช่องทาง ${channel.name}`)
    notify(`ลบช่องทาง ${channel.name} แล้ว`)
  }
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    if (!editing) return
    if (!editing.name.trim()) return setError('กรุณาระบุชื่อช่องทาง')
    if (editing.type !== 'card' && !editing.accountNumber?.trim()) return setError('กรุณาระบุเลขบัญชี / พร้อมเพย์ / เบอร์')
    setError('')
    const channel = { ...editing, name: editing.name.trim(), id: editing.id || newId('ch') }
    const exists = settings.paymentChannels.some((c) => c.id === channel.id)
    saveChannels(
      exists ? settings.paymentChannels.map((c) => (c.id === channel.id ? channel : c)) : [...settings.paymentChannels, channel],
      `${exists ? 'แก้ไข' : 'เพิ่ม'}ช่องทาง ${channel.name}`,
    )
    setEditing(null)
    notify(`บันทึกช่องทาง ${channel.name} แล้ว`)
  }

  const enabledCount = settings.paymentChannels.filter((c) => c.enabled).length

  return (
    <div className="grid grid-cols-1 xl:grid-cols-3 gap-4">
      <div className="xl:col-span-2">
        <Card
          title={`ช่องทางรับชำระเงิน (เปิดใช้ ${enabledCount}/${settings.paymentChannels.length})`}
          icon={CreditCard}
          outline="primary"
          flush
          tools={
            <Button size="sm" tone="success" onClick={() => setEditing({ ...EMPTY_CHANNEL })}>
              <Plus className="w-3.5 h-3.5" /> เพิ่มช่องทาง
            </Button>
          }
        >
          <DataTable head={['ช่องทาง', 'ประเภท', 'บัญชี', 'สถานะ', 'จัดการ']}>
            {settings.paymentChannels.map((c) => (
              <tr key={c.id}>
                <td className="font-bold">{c.name}</td>
                <td className="whitespace-nowrap text-[#6c757d]">{CHANNEL_TYPE_LABELS[c.type]}</td>
                <td className="text-[#6c757d]">
                  {c.type === 'card' ? c.note || 'Payment Gateway' : (
                    <>
                      <span className="font-mono">{c.accountNumber}</span>
                      <br />
                      {c.accountName}
                    </>
                  )}
                </td>
                <td>
                  <label className="flex items-center gap-1.5 cursor-pointer text-sm">
                    <input type="checkbox" checked={c.enabled} onChange={() => toggle(c)} />
                    {c.enabled ? <Badge tone="success">เปิดใช้</Badge> : <Badge tone="secondary">ปิด</Badge>}
                  </label>
                </td>
                <td className="whitespace-nowrap">
                  <div className="flex gap-1">
                    <Button size="sm" tone="info" onClick={() => setEditing({ ...c })}>
                      <Pencil className="w-3.5 h-3.5" /> แก้ไข
                    </Button>
                    <Button size="sm" tone="danger" outline onClick={() => remove(c)} aria-label="ลบ">
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  </div>
                </td>
              </tr>
            ))}
          </DataTable>
        </Card>
        {enabledCount === 0 && (
          <Callout tone="danger" title="ไม่มีช่องทางที่เปิดใช้งาน">
            ผู้ใช้จะเติมเงินไม่ได้ และจ่ายได้เฉพาะกรณีที่เงินในกระเป๋าพอ
          </Callout>
        )}
      </div>

      {editing && (
        <Card title={editing.id ? 'แก้ไขช่องทาง' : 'เพิ่มช่องทาง'} outline="info">
          <form onSubmit={submit}>
            {error && <div className="mb-3 p-2.5 rounded bg-[#f8d7da] text-[#721c24] text-sm border border-[#f5c6cb]">{error}</div>}
            <FormRow label="ประเภท">
              <select
                value={editing.type}
                onChange={(e) => setEditing({ ...editing, type: e.target.value as PaymentChannelType })}
                className={inputClass}
              >
                {(Object.keys(CHANNEL_TYPE_LABELS) as PaymentChannelType[]).map((type) => (
                  <option key={type} value={type}>
                    {CHANNEL_TYPE_LABELS[type]}
                  </option>
                ))}
              </select>
            </FormRow>
            <FormRow label="ชื่อที่แสดง">
              <input value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} className={inputClass} placeholder="เช่น กสิกรไทย ออมทรัพย์" />
            </FormRow>
            {editing.type === 'bank' && (
              <FormRow label="ธนาคาร">
                <select value={editing.bankCode} onChange={(e) => setEditing({ ...editing, bankCode: e.target.value })} className={inputClass}>
                  {BANKS.map((b) => (
                    <option key={b.code} value={b.code}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </FormRow>
            )}
            {editing.type !== 'card' && (
              <>
                <FormRow
                  label={editing.type === 'promptpay' ? 'หมายเลขพร้อมเพย์' : editing.type === 'truemoney' ? 'เบอร์ TrueMoney' : 'เลขที่บัญชี'}
                >
                  <input value={editing.accountNumber || ''} onChange={(e) => setEditing({ ...editing, accountNumber: e.target.value })} className={`${inputClass} font-mono`} />
                </FormRow>
                <FormRow label="ชื่อบัญชี">
                  <input value={editing.accountName || ''} onChange={(e) => setEditing({ ...editing, accountName: e.target.value })} className={inputClass} />
                </FormRow>
              </>
            )}
            <FormRow label="หมายเหตุ (แสดงให้ผู้ใช้เห็น)">
              <input value={editing.note || ''} onChange={(e) => setEditing({ ...editing, note: e.target.value })} className={inputClass} />
            </FormRow>
            <label className="flex items-center gap-2 text-sm mb-4 cursor-pointer">
              <input type="checkbox" checked={editing.enabled} onChange={(e) => setEditing({ ...editing, enabled: e.target.checked })} />
              เปิดใช้งาน
            </label>
            <div className="flex justify-end gap-2">
              <Button tone="secondary" outline onClick={() => setEditing(null)}>
                ยกเลิก
              </Button>
              <Button tone="primary" type="submit">
                <Save className="w-4 h-4" /> บันทึก
              </Button>
            </div>
          </form>
        </Card>
      )}
    </div>
  )
}

// ---------------------------------------------------------------- top-up settings

export function TopUpSettingsPage({ admin, notify }: AdminPageProps) {
  const settings = useSettings()
  const [min, setMin] = useState(String(settings.topUp.min))
  const [max, setMax] = useState(String(settings.topUp.max))
  const [presets, setPresets] = useState(settings.topUp.presets.join(', '))
  const [error, setError] = useState('')

  const save = (e: React.FormEvent) => {
    e.preventDefault()
    const minValue = Number(min)
    const maxValue = Number(max)
    const presetValues = presets
      .split(',')
      .map((p) => Number(p.trim()))
      .filter((p) => p > 0)
    if (!(minValue > 0) || !(maxValue >= minValue)) return setError('ยอดสูงสุดต้องมากกว่าหรือเท่ากับยอดขั้นต่ำ และต้องมากกว่า 0')
    if (presetValues.some((p) => p < minValue || p > maxValue)) return setError('ปุ่มยอดลัดต้องอยู่ระหว่างยอดขั้นต่ำและสูงสุด')
    setError('')
    updateSettings(
      admin,
      { ...settings, topUp: { min: minValue, max: maxValue, presets: presetValues } },
      `การเติมเงิน → ขั้นต่ำ ${baht(minValue)}, สูงสุด ${baht(maxValue)}, ปุ่มลัด ${presetValues.join('/')}`,
    )
    notify('บันทึกการตั้งค่าการเติมเงินแล้ว')
  }

  return (
    <div className="max-w-xl">
      <Card title="เงื่อนไขการเติมเงินเข้ากระเป๋า" icon={BadgeDollarSign} outline="success">
        <form onSubmit={save}>
          {error && <div className="mb-3 p-2.5 rounded bg-[#f8d7da] text-[#721c24] text-sm border border-[#f5c6cb]">{error}</div>}
          <div className="grid grid-cols-2 gap-3">
            <FormRow label="ยอดขั้นต่ำต่อครั้ง (บาท)">
              <input type="number" min={1} value={min} onChange={(e) => setMin(e.target.value)} className={inputClass} />
            </FormRow>
            <FormRow label="ยอดสูงสุดต่อครั้ง (บาท)">
              <input type="number" min={1} value={max} onChange={(e) => setMax(e.target.value)} className={inputClass} />
            </FormRow>
          </div>
          <FormRow label="ปุ่มยอดลัด" hint="คั่นด้วยเครื่องหมายจุลภาค เช่น 500, 1000, 2000, 5000">
            <input value={presets} onChange={(e) => setPresets(e.target.value)} className={inputClass} />
          </FormRow>
          <div className="flex justify-end">
            <Button tone="primary" type="submit">
              <Save className="w-4 h-4" /> บันทึก
            </Button>
          </div>
        </form>
      </Card>
    </div>
  )
}

// ---------------------------------------------------------------- general rules (read-only for now)

export function RulesPage() {
  const rows: [string, string][] = [
    ['ราคาจับจองบาน', `${baht(CLAIM_PRICE)} (ตลอดชีพ)`],
    ['ค่าคอมมิชชั่นขายต่อ', `${RESALE_COMMISSION_RATE * 100}% (ผู้ขายได้รับ ${100 - RESALE_COMMISSION_RATE * 100}%)`],
    ['ระยะถือครองขั้นต่ำก่อนขายต่อ', `${MIN_HOLDING_DAYS} วัน`],
    ['ราคาขายต่อขั้นต่ำ', baht(MIN_RESALE_PRICE)],
    ['โควตาต่อผู้ใช้', 'บานประเทศไทย 1 + บานภูมิภาค 1 (รวม 2)'],
    ['สิทธิ์แก้ไขรูป/ข้อความ', 'วันละ 1 ครั้ง (24 ชม.)'],
    ['สลับตำแหน่ง', 'ทุก 6 ชม. (00/06/12/18 น.) · วันที่ 1, 15, 25 เรียง 1–500'],
    ['พื้นที่โปรโมท', `บาน ${PROMO_SLOTS[0]}–${PROMO_SLOTS[PROMO_SLOTS.length - 1]} · ${PROMO_PRICE_PER_WINDOW_ROUND} บาท/บาน/รอบ 6 ชม.`],
  ]
  return (
    <>
      <Callout tone="warning" title="ยังแก้ไขจากหน้านี้ไม่ได้">
        ค่าเหล่านี้ถูกเขียนไว้ในโค้ดและข้อความหลายหน้าของฝั่งผู้ใช้ การเปิดให้แก้จากหน้า Admin ต้องปรับข้อความทุกจุดให้ดึงค่าจากการตั้งค่า
        (แนะนำให้ทำพร้อมระบบหลังบ้าน)
      </Callout>
      <Card title="กติกาที่ใช้งานอยู่" icon={BookOpen} outline="secondary" flush>
        <DataTable head={['กติกา', 'ค่าปัจจุบัน']}>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <td className="font-bold">{label}</td>
              <td>{value}</td>
            </tr>
          ))}
        </DataTable>
      </Card>
    </>
  )
}
