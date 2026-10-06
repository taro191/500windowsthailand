import { BookOpen, ShieldCheck, Sparkles } from 'lucide-react'
import { getRotationCycle } from '@shared/thaiTime'
import { sortTiers, tierAgeLabel, useSettings } from '@/lib/settings'
import { CLAIM_PRICE } from '@/lib/ownershipRules'

/** "ตั้งราคาได้ไม่เกิน 10 เท่า (฿5,000)" or the no-cap text. */
const capText = (multiplier: number | null) =>
  multiplier === null
    ? 'ตั้งราคาตามความต้องการจริงของตลาดได้ (ไม่มีเพดาน)'
    : `ตั้งราคาได้ไม่เกิน ${multiplier} เท่าของราคาตั้งต้น (ไม่เกิน ฿${(CLAIM_PRICE * multiplier).toLocaleString()})`
import { SectionHeading } from './SectionHeading'

interface RulesTabProps {
  /** Demo: `forceRandom` false = show the standard 1–500 order, true = reshuffle now. */
  onRotateWindows: (forceRandom: boolean) => void
}

const MANIFESTO =
  'การได้รับโอกาสที่ดี ของคนเราไม่เท่ากัน แต่ หากวันหนึ่ง คนเรา มีโอกาส 500 เท่า และ โอกาส 3,500 เท่า ลองคิดดูนะครับชีวิตหนึ่งชีวิตจะท้าทายขนาดใหน แค่คิดก็อยากได้รับโอกาสนั้น จริงๆก็แค่เริ่มลงมือทำ " เปิดหน้าต่างบานแรกที่แสนจะเรียบง่าย ประกาศให้โลกรู้ ฉันอยู่ตรงนี้" บอกความเป็นตัวตน บอกสิ่งที่ชอบ จากความตั้งใจอันแรงกล้า บอกให้ทุกคนเห็นเอกลักษณ์เฉพาะตน บอกเรื่องเล่าเรื่องราว อาชีพ กิจกรรม ธุรกิจ ศิลปะ ดนตรี ผ่านหน้าต่าง บานเล็กๆ แห่งนี้ หากนี้คือโอกาสที่ดี ลงมือเลยเปิดหน้าต่างของคุณ ของวันนี้ ผ่านกาลเวลา ควบคู่กับการสร้างมูลค่าให้หน้าต่างบานนี้ ที่แตกต่างเฉพาะคุณ'

const IMAGE_RULES = [
  ['ไม่อนาจาร:', 'ห้ามภาพเปลือย ภาพลามก หรือเนื้อหาอนาจาร'],
  ['ไม่มีความรุนแรง:', 'ห้ามภาพเลือด ความโหดร้าย การทารุณกรรม'],
  ['ไม่ละเมิดข้อมูลส่วนบุคคล (PDPA):', 'ห้ามลงข้อมูลผู้อื่นโดยไม่ได้รับความยินยอม'],
  ['ไม่ผิดกฎหมายไทย:', 'ห้ามหมิ่นประมาท การพนัน ยาเสพติด อาวุธ'],
  ['ไม่ละเมิดลิขสิทธิ์:', 'ต้องเป็นภาพของคุณเองหรือได้รับอนุญาต'],
]

function RuleNumber({ n, color }: { n: number; color: string }) {
  return (
    <span className={`w-5 h-5 rounded-full border flex items-center justify-center font-bold text-[10px] ${color}`}>{n}</span>
  )
}

function RuleCard({
  n,
  color,
  title,
  border = 'border-stone-800',
  children,
}: {
  n: number
  color: string
  title: string
  border?: string
  children: React.ReactNode
}) {
  return (
    <div className={`p-3.5 rounded-xl bg-stone-950 border ${border} space-y-2`}>
      <div className="flex items-center gap-2 text-xs font-bold text-stone-200">
        <RuleNumber n={n} color={color} />
        <span>{title}</span>
      </div>
      {children}
    </div>
  )
}

export function RulesTab({ onRotateWindows }: RulesTabProps) {
  const cycle = getRotationCycle()
  const settings = useSettings()
  const tiers = sortTiers(settings.priceCaps.usedTiers)

  return (
    <div className="space-y-4">
      <div className="p-4 rounded-xl bg-gradient-to-r from-purple-950/40 via-[#151022] to-rose-950/30 border border-purple-500/30">
        <SectionHeading icon={Sparkles} title="แนวคิดหลัก" />
        <h3 className="text-base font-semibold text-stone-100 mt-3 font-['Prompt',sans-serif]">
          500 Windows to Thailand “ประกาศให้โลกรู้ ฉันอยู่ตรงนี้”
        </h3>
        <p className="text-xs text-stone-300 mt-2 leading-relaxed font-['Prompt',sans-serif] font-light">{MANIFESTO}</p>
      </div>

      <div className="p-4 rounded-xl bg-gradient-to-r from-orange-950/30 via-[#161025] to-purple-950/30 border border-rose-500/40 space-y-2.5">
        <SectionHeading icon={ShieldCheck} title="เงื่อนไขข้อบังคับสำคัญ: โควตาไม่เกิน 2 บาน และต้องยืนยันตัวตน" />
        <div className="p-3 bg-stone-950 rounded-lg border border-amber-500/30 text-xs text-stone-200 space-y-2">
          <p className="font-semibold text-amber-200">
            ผู้ใช้งาน 1 คน (อ้างอิงเลขประจำตัวประชาชน 13 หลัก และเบอร์โทรศัพท์) สามารถมีหน้าต่างได้{' '}
            <span className="underline decoration-amber-400 decoration-2">ไม่เกิน 2 บาน</span> ประกอบด้วย:
          </p>
          <ul className="space-y-1.5 pl-2 font-mono text-[11px]">
            {[
              ['หน้าต่าง บานประเทศไทย: ', ' (KAP-TH)'],
              ['หน้าต่าง บานภูมิภาค: ', ' (จาก 6 ภาคใดๆ)'],
            ].map(([label, suffix], index) => (
              <li key={label} className="flex items-center gap-2 text-amber-300">
                <span className="w-5 h-5 rounded-full bg-amber-500 text-stone-950 font-bold flex items-center justify-center text-[10px]">
                  {index + 1}
                </span>
                <span>
                  {label}
                  <strong>1 บาน</strong>
                  {suffix}
                </span>
              </li>
            ))}
          </ul>
          <div className="pt-2 border-t border-stone-800 text-[11px] text-amber-400 font-sans font-medium flex items-center gap-1.5">
            <ShieldCheck className="w-4 h-4 text-amber-400 shrink-0" />
            <span>หากจะทำการซื้อหรือขายต่อ ต้องยืนยันตัวตน (KYC) เท่านั้น</span>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        <SectionHeading icon={BookOpen} tone="amber" title="กติกา 5 ข้อของระบบ:" />

        <RuleCard n={1} color="bg-cyan-950 text-cyan-300 border-cyan-700/60" title="ซื้อเพื่อเป็นเจ้าของพื้นที่ส่วนตัว (500 ฿ ตลอดชีพ)">
          <p className="text-[11px] text-stone-400 pl-7 leading-relaxed">
            ชำระครั้งเดียวเพื่อเป็นเจ้าของกรรมสิทธิ์บานหน้าต่างนั้นในหน้าต่างอย่างถาวร
          </p>
        </RuleCard>

        <RuleCard n={2} color="bg-amber-950 text-amber-300 border-amber-700/60" title="ลงภาพของตนเอง · แก้ไขรูปภาพ/ข้อความได้วันละ 1 ครั้ง">
          <p className="text-[11px] text-stone-400 pl-7 leading-relaxed">
            ภาพครอบครัว ภาพถ่ายสถานที่ท่องเที่ยว กิจการร้านค้า ศิลปะ หรือเรื่องราวชีวิต มีระบบบันทึกภาพถ่ายย้อนหลังทุกครั้งที่เปลี่ยนรูป
          </p>
        </RuleCard>

        <RuleCard
          n={3}
          color="bg-purple-950 text-purple-300 border-purple-700/60"
          title="เงื่อนไขการขายต่อและเปลี่ยนเจ้าของ (ลบข้อมูลเดิม เหลือ ID USER อ้างอิง)"
        >
          <p className="text-[11px] text-stone-400 pl-7 leading-relaxed">
            เจ้าของหน้าต่างสามารถกำหนดราคาเปิดขายต่อให้ผู้อื่นได้ การเปลี่ยนเจ้าของทุกครั้งต้องผ่านระบบขายต่อและหักค่าคอมมิชชั่น 5%
            (ไม่มีการโอนฟรี) อายุหน้าต่างนับจากวันจับจองครั้งแรก และเพดานราคาจะไม่ต่ำกว่าราคาที่ผู้ขายซื้อมา
          </p>
          <div className="ml-7 p-3 rounded-lg bg-stone-900 border border-amber-500/40 text-[11px] text-stone-200 space-y-2">
            <div className="font-bold text-amber-300">📋 เงื่อนไขการซื้อขายต่อ ({tiers.length + 2} ข้อบังคับ · ผู้ดูแลระบบเป็นผู้กำหนดเพดานราคา):</div>
            <ol className="space-y-1.5 text-[10px] text-stone-300 leading-relaxed list-decimal pl-4">
              <li>
                <strong>ระยะเวลาถือครองขั้นต่ำ:</strong> การขายต่อ เจ้าของจะต้องถือครองหน้าต่างบานนั้นๆ{' '}
                <strong>ไม่ต่ำกว่า 1 เดือน ขึ้นไป (30 วัน)</strong>
              </li>
              <li>
                <strong>เพดานราคา (ยังไม่เคยใช้งาน):</strong> ถ้าหน้าต่างไม่เคยผ่านการนำไปใช้งาน{' '}
                <strong>{capText(settings.priceCaps.unusedMultiplier)}</strong>
              </li>
              {tiers.map((tier, index) => (
                <li key={tier.id}>
                  <strong>เพดานราคา (ผ่านการใช้งาน {tierAgeLabel(tiers, index)}):</strong> <strong>{capText(tier.multiplier)}</strong>
                </li>
              ))}
            </ol>
          </div>
          <div className="ml-7 p-2.5 rounded-lg bg-stone-900 border border-purple-500/40 text-[11px] text-stone-200 space-y-1.5">
            <div className="font-bold text-amber-300">🔄 กติกาเมื่อเปลี่ยนเจ้าของบานหน้าต่าง:</div>
            <ul className="space-y-1 text-[10px] text-stone-300 leading-relaxed list-disc pl-3">
              <li>
                <strong>ข้อมูลเจ้าของเดิมจะถูกลบออก:</strong> ชื่อ, เบอร์โทร, บัตร ปชช., ลิงก์
                และข้อความประจำวันของเจ้าของเดิมจะถูกลบออก และแทนที่ด้วยข้อมูลของเจ้าของคนใหม่ทันที
              </li>
              <li>
                <strong>คงเหลือเฉพาะ ID USER เจ้าของเดิม:</strong> สิ่งที่ระบบยังคงเก็บรักษาไว้ คือรหัส{' '}
                <strong>ID USER เจ้าของคนเดิม</strong> เพื่อใช้อ้างอิงประวัติที่มาที่ไปการใช้งานอย่างโปร่งใส
              </li>
            </ul>
          </div>
          <div className="ml-7 p-2 rounded-lg bg-amber-950/40 border border-amber-500/30 text-[11px] text-amber-300 space-y-1">
            <div className="font-bold flex items-center gap-1.5">
              <span>⚡ เงื่อนไขทุกการขายต่อ:</span>
              <span className="px-1.5 py-0.2 rounded bg-amber-500/20 text-amber-200 font-mono text-[10px]">Commission 5%</span>
            </div>
            <p className="text-stone-300 text-[10px] leading-relaxed">
              ระบบจะต้องได้ค่าคอมมิชชั่น 5% ของราคาขายต่อทุกรายการ เพื่อเป็นกองทุนบำรุงรักษาเซิร์ฟเวอร์ พัฒนาระบบ และรักษาความปลอดภัย
              โดยผู้ขายเดิมจะได้รับเงินสุทธิ 95%
            </p>
          </div>
        </RuleCard>

        <RuleCard n={4} color="bg-emerald-950 text-emerald-300 border-emerald-700/60" title="ระบบจะโรเตชั่น หรือสุ่มสลับตำแหน่ง ทุก 6 ชม. ทุกวัน">
          <div className="pl-7 space-y-1.5">
            <p className="text-[11px] text-stone-400 leading-relaxed">
              ระบบจะโรเตชั่นสุ่มสลับตำแหน่งทุก 6 ชม. ทุกวัน (00:00, 06:00, 12:00, 18:00 น.){' '}
              <strong>ยกเว้นเฉพาะวันที่ 1, 15, 25 ของทุกเดือน</strong> ตำแหน่งจะกลับคืนตำแหน่งเดิมตามมาตรฐาน (1 ถึง 500) ครบ 24 ชม.
              จึงกลับเข้าสู่ระบบโรเตชั่นเหมือนเดิม
            </p>
          </div>
          <div className="ml-7 p-2.5 rounded-lg bg-emerald-950/30 border border-emerald-500/30 text-[11px] text-emerald-200 space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-semibold text-amber-300">รอบจัดแสดงปัจจุบัน:</span>
              <span className="font-mono text-[10px] px-1.5 py-0.2 rounded bg-stone-900 border border-emerald-600/40 text-emerald-300">
                {cycle.thaiCycleTitle}
              </span>
            </div>
            <div className="text-[10px] text-stone-300 flex items-center justify-between">
              <span>รอบสลับตำแหน่งถัดไป:</span>
              <span className="font-mono text-amber-300 font-bold">
                {cycle.thaiNextCycleTitle} ({cycle.remainingText})
              </span>
            </div>
            <div className="pt-2 border-t border-emerald-900/40 space-y-1.5">
              <span className="text-[10px] text-stone-400 block font-sans">ทดสอบจำลองการสลับตำแหน่ง (Simulation):</span>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  onClick={() => onRotateWindows(false)}
                  className="p-1.5 bg-stone-900 hover:bg-stone-850 text-amber-300 border border-amber-500/40 rounded text-[10px] font-medium cursor-pointer transition-colors"
                >
                  🔄 จำลองรอบมาตรฐาน (1 / 15 / 25)
                </button>
                <button
                  onClick={() => onRotateWindows(true)}
                  className="p-1.5 bg-emerald-950/70 hover:bg-emerald-900 text-emerald-200 border border-emerald-500/50 rounded text-[10px] font-medium cursor-pointer transition-colors"
                >
                  ✨ สุ่มสลับตำแหน่งทันที
                </button>
              </div>
            </div>
          </div>
        </RuleCard>

        <RuleCard
          n={5}
          color="bg-rose-950 text-rose-300 border-rose-700/60"
          border="border-rose-900/40"
          title="เงื่อนไขภาพที่ลงได้ (ไม่ผิดกฎหมายไทย และ PDPA)"
        >
          <div className="pl-7 space-y-1.5 text-[11px] text-stone-400">
            {IMAGE_RULES.map(([title, detail]) => (
              <p key={title}>
                • <strong>{title}</strong> {detail}
              </p>
            ))}
          </div>
        </RuleCard>
      </div>
    </div>
  )
}
