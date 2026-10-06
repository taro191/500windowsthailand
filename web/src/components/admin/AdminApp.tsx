import { useCallback, useEffect, useState } from 'react'
import { CircleCheck } from 'lucide-react'
import type { User } from '@/types'
import { loadAllWindows, loadAuditLog } from '@/lib/adminStore'
import { loadPromoRequests } from '@/lib/promo'
import { loadTransactions, loadUsers } from '@/lib/store'
import { AdminLayout, PAGE_TITLES, type AdminPage } from './AdminLayout'
import type { AdminData, AdminPageProps } from './adminData'
import { DashboardPage } from './pages/DashboardPage'
import { ModerationPage, WindowsPage } from './pages/WindowsPage'
import { PromoPage } from './pages/PromoPage'
import { UsersPage } from './pages/UsersPage'
import { AuditPage, PayoutsPage, RevenuePage, TopUpsPage, TransactionsPage } from './pages/FinancePages'
import { ChannelsPage, PriceCapsPage, RulesPage, TopUpSettingsPage } from './pages/SettingsPages'

const loadData = (): AdminData => ({
  users: loadUsers(),
  windows: loadAllWindows(),
  transactions: loadTransactions(),
  promoRequests: loadPromoRequests(),
  auditLog: loadAuditLog(),
})

interface AdminAppProps {
  admin: User
  onExit: () => void
  onLogout: () => void
}

/** Back office (AdminLTE style). Reachable only for users with role "admin". */
export function AdminApp({ admin, onExit, onLogout }: AdminAppProps) {
  const [page, setPage] = useState<AdminPage>(() => {
    const fromHash = window.location.hash.replace('#admin/', '') as AdminPage
    return fromHash in PAGE_TITLES ? fromHash : 'dashboard'
  })
  const [data, setData] = useState<AdminData>(loadData)
  const [toast, setToast] = useState<string | null>(null)

  const refresh = useCallback(() => setData(loadData()), [])
  const notify = useCallback((message: string) => {
    setToast(message)
    setTimeout(() => setToast(null), 3500)
  }, [])

  useEffect(() => {
    window.location.hash = `admin/${page}`
    refresh()
  }, [page, refresh])

  const props: AdminPageProps = { admin, data, refresh: () => { refresh() }, notify }
  const badges = {
    promo: data.promoRequests.filter((r) => r.status === 'pending').length,
    users: data.users.filter((u) => u.role !== 'admin' && !u.isVerified).length,
  }

  return (
    <AdminLayout admin={admin} page={page} onNavigate={setPage} onExit={onExit} onLogout={onLogout} badges={badges}>
      {page === 'dashboard' && <DashboardPage {...props} onNavigate={setPage} />}
      {page === 'windows' && <WindowsPage {...props} />}
      {page === 'moderation' && <ModerationPage {...props} />}
      {page === 'promo' && <PromoPage {...props} />}
      {page === 'users' && <UsersPage {...props} />}
      {page === 'transactions' && <TransactionsPage {...props} />}
      {page === 'topups' && <TopUpsPage {...props} />}
      {page === 'payouts' && <PayoutsPage {...props} />}
      {page === 'revenue' && <RevenuePage {...props} />}
      {page === 'price-caps' && <PriceCapsPage {...props} />}
      {page === 'channels' && <ChannelsPage {...props} />}
      {page === 'topup-settings' && <TopUpSettingsPage {...props} />}
      {page === 'rules' && <RulesPage />}
      {page === 'audit' && <AuditPage {...props} />}

      {toast && (
        <div className="fixed top-16 right-4 z-[70] max-w-sm bg-[#28a745] text-white rounded shadow-lg px-4 py-3 text-sm flex items-start gap-2">
          <CircleCheck className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{toast}</span>
        </div>
      )}
    </AdminLayout>
  )
}
