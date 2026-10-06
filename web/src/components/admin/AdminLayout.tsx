import { useState, type ReactNode } from 'react'
import {
  BadgeDollarSign,
  BookOpen,
  ChartColumn,
  ChevronRight,
  CreditCard,
  ExternalLink,
  Gauge,
  HandCoins,
  History,
  ImageOff,
  LayoutGrid,
  LogOut,
  Megaphone,
  Menu,
  Receipt,
  Scale,
  Settings2,
  Users,
  Wallet,
  type LucideIcon,
} from 'lucide-react'
import type { User } from '@/types'
import { KapsulepLogo } from '../KapsulepLogo'

export type AdminPage =
  | 'dashboard'
  | 'windows'
  | 'moderation'
  | 'promo'
  | 'users'
  | 'transactions'
  | 'topups'
  | 'payouts'
  | 'revenue'
  | 'price-caps'
  | 'channels'
  | 'topup-settings'
  | 'rules'
  | 'audit'

interface NavItem {
  id: AdminPage
  label: string
  icon: LucideIcon
  badge?: number
}

interface NavSection {
  header: string
  items: NavItem[]
}

export const PAGE_TITLES: Record<AdminPage, string> = {
  dashboard: 'แดชบอร์ด',
  windows: 'จัดการหน้าต่าง',
  moderation: 'ตรวจสอบเนื้อหา',
  promo: 'พื้นที่โปรโมท',
  users: 'ผู้ใช้งาน & KYC',
  transactions: 'ธุรกรรมทั้งหมด',
  topups: 'การเติมเงิน',
  payouts: 'จ่ายเงินผู้ขาย',
  revenue: 'รายงานรายได้',
  'price-caps': 'เพดานราคาขายต่อ',
  channels: 'ช่องทางรับชำระเงิน',
  'topup-settings': 'ตั้งค่าการเติมเงิน',
  rules: 'กติกาทั่วไป',
  audit: 'บันทึกการใช้งาน',
}

interface AdminLayoutProps {
  admin: User
  page: AdminPage
  onNavigate: (page: AdminPage) => void
  onExit: () => void
  onLogout: () => void
  /** Pending counts shown as sidebar badges. */
  badges: Partial<Record<AdminPage, number>>
  children: ReactNode
}

/** AdminLTE 3 layout: dark sidebar, white top navbar, content header with breadcrumb, footer. */
export function AdminLayout({ admin, page, onNavigate, onExit, onLogout, badges, children }: AdminLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const [mobileOpen, setMobileOpen] = useState(false)

  const sections: NavSection[] = [
    { header: 'ภาพรวม', items: [{ id: 'dashboard', label: PAGE_TITLES.dashboard, icon: Gauge }] },
    {
      header: 'หน้าต่าง & เนื้อหา',
      items: [
        { id: 'windows', label: PAGE_TITLES.windows, icon: LayoutGrid },
        { id: 'moderation', label: PAGE_TITLES.moderation, icon: ImageOff },
        { id: 'promo', label: PAGE_TITLES.promo, icon: Megaphone, badge: badges.promo },
      ],
    },
    { header: 'ผู้ใช้งาน', items: [{ id: 'users', label: PAGE_TITLES.users, icon: Users, badge: badges.users }] },
    {
      header: 'การเงิน',
      items: [
        { id: 'transactions', label: PAGE_TITLES.transactions, icon: Receipt },
        { id: 'topups', label: PAGE_TITLES.topups, icon: Wallet },
        { id: 'payouts', label: PAGE_TITLES.payouts, icon: HandCoins },
        { id: 'revenue', label: PAGE_TITLES.revenue, icon: ChartColumn },
      ],
    },
    {
      header: 'ตั้งค่าระบบ',
      items: [
        { id: 'price-caps', label: PAGE_TITLES['price-caps'], icon: Scale },
        { id: 'channels', label: PAGE_TITLES.channels, icon: CreditCard },
        { id: 'topup-settings', label: PAGE_TITLES['topup-settings'], icon: BadgeDollarSign },
        { id: 'rules', label: PAGE_TITLES.rules, icon: BookOpen },
      ],
    },
    { header: 'ระบบ', items: [{ id: 'audit', label: PAGE_TITLES.audit, icon: History }] },
  ]

  const navigate = (next: AdminPage) => {
    onNavigate(next)
    setMobileOpen(false)
  }

  const sidebar = (
    <aside className="h-full w-[250px] bg-[#343a40] text-[#c2c7d0] flex flex-col shadow-[0_14px_28px_rgba(0,0,0,.25)]">
      <button
        type="button"
        onClick={() => navigate('dashboard')}
        className="flex items-center gap-2.5 px-4 h-[57px] border-b border-[#4b545c] text-white text-left cursor-pointer shrink-0"
      >
        <KapsulepLogo size={33} />
        <span className="text-[1.15rem] font-light">
          <b className="font-semibold">500</b> Windows Admin
        </span>
      </button>

      <div className="flex items-center gap-2.5 px-4 py-3 border-b border-[#4b545c] shrink-0">
        <img src={admin.avatarUrl} alt="" className="w-[34px] h-[34px] rounded-full object-cover shadow" />
        <div className="min-w-0">
          <span className="block text-white text-sm truncate">{admin.name}</span>
          <span className="flex items-center gap-1 text-[0.75rem] text-[#c2c7d0]">
            <span className="w-2 h-2 rounded-full bg-[#28a745]" /> Online
          </span>
        </div>
      </div>

      <nav className="flex-1 overflow-y-auto px-2 py-2 text-[0.95rem]" aria-label="เมนูผู้ดูแลระบบ">
        {sections.map((section) => (
          <div key={section.header} className="mb-1">
            <div className="px-3 pt-3 pb-1 text-[0.75rem] uppercase tracking-wide text-[#d0d4db]/60">{section.header}</div>
            {section.items.map((item) => {
              const active = item.id === page
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => navigate(item.id)}
                  aria-current={active ? 'page' : undefined}
                  className={`w-full flex items-center gap-2.5 px-3 py-2 mb-0.5 rounded text-left cursor-pointer transition-colors ${active ? 'bg-[#007bff] text-white shadow-[0_1px_3px_rgba(0,0,0,.12),0_1px_2px_rgba(0,0,0,.24)]' : 'hover:bg-white/10 hover:text-white'}`}
                >
                  <item.icon className="w-[18px] h-[18px] shrink-0" />
                  <span className="flex-1 truncate">{item.label}</span>
                  {!!item.badge && (
                    <span className="px-1.5 py-0.5 rounded text-[0.7rem] font-bold leading-none bg-[#dc3545] text-white">
                      {item.badge}
                    </span>
                  )}
                </button>
              )
            })}
          </div>
        ))}
      </nav>
    </aside>
  )

  return (
    <div className="admin-shell h-dvh flex bg-[#f4f6f9] text-[#212529] font-['Source_Sans_3','Prompt',sans-serif] overflow-hidden">
      {/* Desktop sidebar (collapsible) */}
      <div className={`hidden lg:block shrink-0 transition-[width] duration-300 overflow-hidden ${sidebarOpen ? 'w-[250px]' : 'w-0'}`}>
        {sidebar}
      </div>
      {/* Mobile sidebar (off-canvas) */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-[60] flex">
          {sidebar}
          <button type="button" aria-label="ปิดเมนู" className="flex-1 bg-black/40" onClick={() => setMobileOpen(false)} />
        </div>
      )}

      <div className="flex-1 min-w-0 flex flex-col">
        <nav className="h-[57px] shrink-0 bg-white border-b border-[#dee2e6] flex items-center justify-between px-2 sm:px-4">
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label="เปิด/ปิดเมนู"
              onClick={() => (window.innerWidth >= 1024 ? setSidebarOpen(!sidebarOpen) : setMobileOpen(true))}
              className="p-2 text-[#6c757d] hover:text-[#212529] cursor-pointer"
            >
              <Menu className="w-5 h-5" />
            </button>
            <button type="button" onClick={() => navigate('dashboard')} className="hidden sm:block px-2 py-2 text-[#6c757d] hover:text-[#212529] text-sm cursor-pointer">
              หน้าหลัก
            </button>
            <button type="button" onClick={onExit} className="hidden sm:flex items-center gap-1 px-2 py-2 text-[#6c757d] hover:text-[#212529] text-sm cursor-pointer">
              ไปหน้าเว็บผู้ใช้ <ExternalLink className="w-3.5 h-3.5" />
            </button>
          </div>
          <div className="flex items-center gap-1">
            <button
              type="button"
              onClick={() => navigate('price-caps')}
              aria-label="ตั้งค่าระบบ"
              className="p-2 text-[#6c757d] hover:text-[#212529] cursor-pointer"
            >
              <Settings2 className="w-5 h-5" />
            </button>
            <button type="button" onClick={onLogout} className="flex items-center gap-1.5 px-2 py-2 text-[#6c757d] hover:text-[#dc3545] text-sm cursor-pointer">
              <LogOut className="w-4 h-4" /> <span className="hidden sm:inline">ออกจากระบบ</span>
            </button>
          </div>
        </nav>

        <div className="flex-1 overflow-y-auto">
          <div className="px-4 sm:px-6 pt-4 pb-2 flex flex-wrap items-center justify-between gap-2">
            <h1 className="text-[1.8rem] font-normal text-[#212529] m-0">{PAGE_TITLES[page]}</h1>
            <ol className="flex items-center gap-1 text-sm text-[#6c757d]" aria-label="breadcrumb">
              <li>
                <button type="button" onClick={() => navigate('dashboard')} className="text-[#007bff] hover:underline cursor-pointer">
                  Admin
                </button>
              </li>
              <ChevronRight className="w-3.5 h-3.5" />
              <li aria-current="page">{PAGE_TITLES[page]}</li>
            </ol>
          </div>
          <main className="px-4 sm:px-6 pb-4">{children}</main>
          <footer className="px-4 sm:px-6 py-3 bg-white border-t border-[#dee2e6] text-sm text-[#869099] flex flex-wrap justify-between gap-2">
            <span>
              <strong className="text-[#495057]">500 Windows to Thailand</strong> · ระบบผู้ดูแล
            </span>
            <span>Power by Kapsulep · v0.1 (demo)</span>
          </footer>
        </div>
      </div>
    </div>
  )
}
