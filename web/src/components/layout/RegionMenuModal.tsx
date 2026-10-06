import { ArrowRight, Award, Check, X } from 'lucide-react'
import type { RegionId } from '@shared/types'
import { REGIONS } from '@shared/regions'
import { KapsulepLogo } from '../KapsulepLogo'

interface RegionMenuModalProps {
  isOpen: boolean
  onClose: () => void
  activeRegion: RegionId
  onSelectRegion: (region: RegionId) => void
  /** Available (unclaimed) windows per region. */
  regionalAvailableCounts: Partial<Record<RegionId, number>>
}

export function RegionMenuModal({ isOpen, onClose, activeRegion, onSelectRegion, regionalAvailableCounts }: RegionMenuModalProps) {
  if (!isOpen) return null
  const thailand = REGIONS.find((r) => r.isCoreHeart)
  const regions = REGIONS.filter((r) => !r.isCoreHeart)
  const select = (region: RegionId) => {
    onSelectRegion(region)
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/85 backdrop-blur-sm overflow-y-auto animate-in fade-in duration-200 font-['Plus_Jakarta_Sans','Prompt',sans-serif]">
      <div
        className="relative w-full max-w-2xl bg-[#0e0b17] border border-purple-900/40 rounded-2xl shadow-2xl overflow-hidden my-auto max-h-[90vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 bg-[#09080e] border-b border-purple-900/30">
          <div className="flex items-center gap-3">
            <KapsulepLogo size={34} showGlow />
            <div>
              <h2 className="font-bold text-stone-100 text-base font-['Prompt',sans-serif]">เลือกหน้าต่างภูมิภาค</h2>
              <p className="text-xs text-stone-400 font-['Prompt',sans-serif]">สลับระหว่างหน้าต่างประเทศไทย 500 บาน หรือ 6 ภาค</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 text-stone-400 hover:text-stone-200 hover:bg-[#1a142c] rounded-lg cursor-pointer transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="mx-5 mt-4 p-3 rounded-xl bg-gradient-to-r from-purple-950/40 via-[#151022] to-rose-950/30 border border-purple-500/30 text-xs flex items-center gap-2.5 text-rose-300 font-['Prompt',sans-serif]">
          <Award className="w-4 h-4 text-rose-400 shrink-0" />
          <span>
            <strong>เงื่อนไขการถือครอง:</strong> อ้างอิงเลขบัตรประชาชน 13 หลักและเบอร์โทรศัพท์ สามารถมีหน้าต่างได้ไม่เกิน 2 บาน
            (บานประเทศไทย 1 บาน + บานภูมิภาค 1 บาน)
          </span>
        </div>

        <div className="flex-1 p-5 overflow-y-auto space-y-4">
          {thailand && (
            <div
              onClick={() => select(thailand.id)}
              className={`p-4 rounded-xl cursor-pointer transition-all border relative flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${activeRegion === thailand.id ? 'bg-gradient-to-r from-purple-950/60 via-[#161126] to-rose-950/40 border-rose-400/80 shadow-lg shadow-rose-500/10 ring-1 ring-rose-400/40' : 'bg-[#120f1e] hover:bg-[#181329] border-purple-900/40 hover:border-rose-400/60'}`}
            >
              <div className="flex items-center gap-3">
                <span className="text-3xl">{thailand.icon}</span>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-bold text-stone-100 text-sm sm:text-base font-['Prompt',sans-serif]">{thailand.name}</span>
                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gradient-to-r from-orange-400 to-rose-500 text-white font-mono">
                      โควตา 1 บาน
                    </span>
                  </div>
                  <p className="text-xs text-stone-400 mt-0.5 font-light">
                    รหัส {thailand.codePrefix}-001 ถึง {thailand.codePrefix}-500 · {thailand.description}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-3 shrink-0 sm:self-center">
                <div className="text-right">
                  <span className="text-xs font-mono font-bold text-rose-300 block">
                    ว่าง {regionalAvailableCounts[thailand.id] ?? 0} บาน
                  </span>
                  <span className="text-[10px] text-stone-500 font-mono">จากทั้งหมด 500 บาน</span>
                </div>
                {activeRegion === thailand.id ? (
                  <span className="px-2.5 py-1 rounded-lg bg-gradient-to-r from-orange-500 via-rose-500 to-purple-600 text-white font-bold text-xs flex items-center gap-1 font-['Prompt',sans-serif]">
                    <Check className="w-3.5 h-3.5" />
                    <span>เปิดอยู่</span>
                  </span>
                ) : (
                  <span className="px-2.5 py-1 rounded-lg bg-[#181329] text-stone-300 hover:text-white text-xs flex items-center gap-1 border border-purple-900/40 font-['Prompt',sans-serif]">
                    <span>เลือกชม</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </span>
                )}
              </div>
            </div>
          )}

          <div className="pt-2">
            <h3 className="text-xs font-bold text-stone-400 uppercase tracking-wider mb-2.5 flex items-center justify-between font-['Prompt',sans-serif]">
              <span>แยกตาม 6 ภูมิภาค (ภาคละ 500 บาน · โควตาสิทธิ์เลือกถือครองได้ 1 ภูมิภาค):</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              {regions.map((region) => {
                const isActive = activeRegion === region.id
                return (
                  <div
                    key={region.id}
                    onClick={() => select(region.id)}
                    className={`p-3.5 rounded-xl cursor-pointer transition-all border flex flex-col justify-between ${isActive ? 'bg-purple-950/40 border-rose-400 shadow-md ring-1 ring-rose-400/40' : 'bg-[#120f1e] hover:bg-[#181329] border-purple-900/30 hover:border-rose-400/50'}`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <span className="text-xl">{region.icon}</span>
                        <div>
                          <div className="font-bold text-stone-200 text-sm font-['Prompt',sans-serif]">{region.name}</div>
                          <span className="text-[10px] text-stone-400 font-mono">รหัส {region.codePrefix} · 500 บาน</span>
                        </div>
                      </div>
                      {isActive && (
                        <span className="px-1.5 py-0.5 rounded bg-gradient-to-r from-orange-400 to-rose-500 text-white font-bold text-[10px] flex items-center gap-0.5 font-['Prompt',sans-serif]">
                          <Check className="w-3 h-3" />
                          <span>เปิดอยู่</span>
                        </span>
                      )}
                    </div>
                    <p className="text-[11px] text-stone-400 line-clamp-1 mt-2 font-light">{region.provinces.slice(0, 4).join(', ')}...</p>
                    <div className="mt-2.5 pt-2 border-t border-stone-850 flex items-center justify-between text-xs">
                      <span className="font-mono text-rose-300 font-semibold text-[11px]">
                        ว่าง {regionalAvailableCounts[region.id] ?? 0} บาน
                      </span>
                      <span className="text-[10px] text-stone-400 flex items-center gap-0.5 font-['Prompt',sans-serif]">
                        <span>เปิดหน้าต่าง</span>
                        <ArrowRight className="w-3 h-3" />
                      </span>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
