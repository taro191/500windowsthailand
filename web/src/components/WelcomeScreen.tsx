import { KapsulepLogo } from './KapsulepLogo'

interface WelcomeScreenProps {
  onEnter: () => void
  windowCount?: number
}

export function WelcomeScreen({ onEnter, windowCount = 500 }: WelcomeScreenProps) {
  return (
    <div className="relative min-h-screen w-full flex flex-col justify-between items-center bg-[#09080e] text-stone-100 overflow-hidden px-4 py-8 select-none font-['Plus_Jakarta_Sans','Prompt',sans-serif]">
      <div className="absolute inset-0 pointer-events-none">
        <div
          className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] sm:w-[750px] h-[400px] sm:h-[550px] rounded-full blur-[120px] opacity-25 animate-window-glow"
          style={{
            background:
              'radial-gradient(circle, rgba(249,115,22,0.7) 0%, rgba(244,63,94,0.5) 45%, rgba(139,92,246,0.3) 80%, transparent 100%)',
          }}
        />
        <div
          className="absolute bottom-10 left-1/2 -translate-x-1/2 w-[600px] h-[350px] rounded-full blur-[140px] opacity-20"
          style={{
            background: 'radial-gradient(circle, rgba(168,85,247,0.5) 0%, rgba(99,102,241,0.3) 60%, transparent 100%)',
          }}
        />
        <div
          className="absolute inset-0 opacity-[0.05]"
          style={{
            backgroundImage:
              'linear-gradient(to right, rgba(255,255,255,0.08) 1px, transparent 1px), linear-gradient(to bottom, rgba(255,255,255,0.08) 1px, transparent 1px)',
            backgroundSize: '40px 40px',
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#09080e] via-transparent to-[#09080e]/90" />
        <div className="absolute inset-0 bg-gradient-to-r from-[#09080e]/80 via-transparent to-[#09080e]/80" />
      </div>

      <header className="relative z-10 w-full max-w-5xl flex items-center justify-between text-xs text-stone-400">
        <div className="flex items-center gap-2.5">
          <KapsulepLogo size={26} />
          <span className="font-['Outfit',sans-serif] font-semibold text-stone-200 tracking-wider text-xs">KAPSULEP</span>
          <span className="text-stone-600">·</span>
          <span className="text-[11px] text-stone-400 font-light">Thailand Windows Platform</span>
        </div>
        <div className="flex items-center gap-2 font-mono text-[11px] text-stone-300 bg-stone-900/60 px-3 py-1 rounded-full border border-stone-800 backdrop-blur-sm">
          <span className="w-1.5 h-1.5 rounded-full bg-rose-500 animate-pulse" />
          <span>{windowCount} Windows</span>
          <span className="text-stone-600">·</span>
          <span className="text-stone-400">77 Provinces</span>
        </div>
      </header>

      <main className="relative z-10 flex flex-col items-center justify-center text-center max-w-3xl my-auto py-8">
        <div className="relative mb-7 sm:mb-8 transition-transform duration-300 hover:scale-105">
          <div
            className="absolute -inset-4 rounded-full blur-xl opacity-50 -z-10 animate-pulse"
            style={{
              background:
                'radial-gradient(circle, rgba(249,115,22,0.6) 0%, rgba(217,70,239,0.5) 50%, rgba(99,102,241,0.3) 100%)',
            }}
          />
          <KapsulepLogo size={88} showGlow />
        </div>
        <h1 className="font-['Outfit','Plus_Jakarta_Sans',sans-serif] text-4xl sm:text-6xl md:text-7xl font-bold tracking-tight leading-[1.08] mb-3">
          <span className="bg-gradient-to-r from-white via-rose-100 to-amber-200 bg-clip-text text-transparent">
            500 Windows
          </span>
          <br />
          <span className="bg-gradient-to-r from-orange-400 via-rose-400 to-purple-400 bg-clip-text text-transparent font-extrabold tracking-tight">
            to Thailand
          </span>
        </h1>
        <p className="text-sm sm:text-base md:text-lg font-light text-stone-300 tracking-wide font-['Prompt',sans-serif] mt-1 mb-2.5">
          500 หน้าต่างสู่ประเทศไทย
        </p>
        <p className="text-xs sm:text-sm text-stone-400 font-light italic mb-8 max-w-md mx-auto leading-relaxed">
          “ ประกาศให้โลกรู้ ฉันอยู่ตรงนี้ ”
        </p>

        <div className="relative group">
          <div
            className="absolute -inset-0.5 rounded-full blur-sm opacity-60 group-hover:opacity-100 transition duration-300"
            style={{ background: 'linear-gradient(90deg, #ff6b2b, #f43f5e, #d946ef, #8b5cf6)' }}
          />
          <button
            onClick={onEnter}
            type="button"
            className="relative px-6 py-2.5 sm:px-7 sm:py-2.5 rounded-full bg-stone-900/95 hover:bg-stone-850 text-white font-medium text-xs sm:text-sm tracking-wide transition-all duration-200 cursor-pointer flex items-center gap-2.5 group-hover:scale-[1.02] active:scale-[0.98] border border-white/10"
          >
            <span className="w-2 h-2 rounded-full bg-gradient-to-r from-orange-400 to-rose-500" />
            <span className="font-['Prompt',sans-serif] font-medium text-stone-100">เปิดหน้าต่าง</span>
            <svg
              className="w-3.5 h-3.5 text-stone-400 group-hover:text-white transition-transform duration-200 group-hover:translate-x-0.5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 text-[11px] text-stone-500 mt-6 font-mono">
          <span className="text-stone-400">🇹🇭 500 หน้าต่างเปิดทุกบาน</span>
          <span className="text-stone-700">·</span>
          <span className="text-stone-400">🗺️ 6 ภูมิภาค</span>
          <span className="text-stone-700">·</span>
          <span className="text-stone-400">สลับตำแหน่งทุก 6 ชม.</span>
        </div>
      </main>

      <footer className="relative z-10 w-full max-w-5xl flex flex-col sm:flex-row items-center justify-between gap-2 pt-6 border-t border-stone-900 text-xs">
        <div className="flex items-center gap-2 text-stone-500 text-[11px]">
          <span>© 2026 500 Windows to Thailand</span>
          <span>·</span>
          <span className="text-stone-400 font-mono">kapsulep.com</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className="text-[11px] text-stone-400 tracking-wider uppercase font-mono">Power by</span>
          <div className="flex items-center gap-1.5">
            <KapsulepLogo size={18} />
            <span className="font-['Outfit',sans-serif] font-bold bg-gradient-to-r from-orange-400 via-rose-400 to-purple-400 bg-clip-text text-transparent text-sm tracking-wide">
              Kapsulep
            </span>
          </div>
        </div>
      </footer>
    </div>
  )
}
