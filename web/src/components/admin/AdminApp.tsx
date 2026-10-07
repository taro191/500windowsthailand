import { useCallback, useEffect, useState } from 'react'
import { CircleAlert, CircleCheck, Loader2 } from 'lucide-react'
import type { User, WindowItem } from '@shared/types'
import { REGION_IDS } from '@shared/regions'
import { createEmptyWindows } from '@shared/seedWindows'
import { loadAdminOverview } from '@/lib/adminApi'
import { AdminLayout, PAGE_TITLES, type AdminPage } from './AdminLayout'
import type { AdminData, AdminPageProps } from './adminData'
import { DashboardPage } from './pages/DashboardPage'
import { ModerationPage, WindowsPage } from './pages/WindowsPage'
import { PromoPage } from './pages/PromoPage'
import { PaymentsPage } from './pages/PaymentsPage'
import { UsersPage } from './pages/UsersPage'
import { AuditPage, PayoutsPage, RevenuePage, TopUpsPage, TransactionsPage } from './pages/FinancePages'
import { ChannelsPage, EditSettingsPage, PriceCapsPage, RulesPage, TopUpSettingsPage } from './pages/SettingsPages'

/** The API sends only windows that changed; fill in the empty ones for all 3,500. */
function allWindows(changed: WindowItem[]): WindowItem[] {
  const byKey = new Map(changed.map((w) => [`${w.region}:${w.id}`, w]))
  return REGION_IDS.flatMap((region) => createEmptyWindows(region).map((w) => byKey.get(`${region}:${w.id}`) || w))
}

interface AdminAppProps {
  admin: User
  onExit: () => void
  onLogout: () => void
}

/** Back office (AdminLTE style). Reachable only for users with role "admin" (checked again by the API). */
export function AdminApp({ admin, onExit, onLogout }: AdminAppProps) {
  const [page, setPage] = useState<AdminPage>(() => {
    const fromHash = window.location.hash.replace('#admin/', '') as AdminPage
    return fromHash in PAGE_TITLES ? fromHash : 'dashboard'
  })
  const [data, setData] = useState<AdminData | null>(null)
  const [loadError, setLoadError] = useState('')
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'error' } | null>(null)

  const refresh = useCallback(async () => {
    const result = await loadAdminOverview()
    if (!result.success) return setLoadError(result.error)
    setLoadError('')
    setData({ ...result, windows: allWindows(result.windows) })
  }, [])
  const notify = useCallback((message: string, tone: 'success' | 'error' = 'success') => {
    setToast({ message, tone })
    setTimeout(() => setToast(null), tone === 'error' ? 6000 : 3500)
  }, [])

  useEffect(() => {
    window.location.hash = `admin/${page}`
    refresh()
  }, [page, refresh])

  const badges = data
    ? {
        payments: data.orders.filter((o) => o.status === 'pending' && o.slipUrl).length,
        promo: data.promoRequests.filter((r) => r.status === 'pending').length,
        users: data.users.filter((u) => u.role !== 'admin' && !u.isVerified).length,
      }
    : {}
  const props: AdminPageProps | null = data ? { admin, data, refresh, notify } : null

  return (
    <AdminLayout admin={admin} page={page} onNavigate={setPage} onExit={onExit} onLogout={onLogout} badges={badges}>
      {!props ? (
        <div className="py-16 flex flex-col items-center gap-3 text-[#6c757d] text-sm">
          {loadError ? (
            <>
              <CircleAlert className="w-8 h-8 text-[#dc3545]" />
              <span>{loadError}</span>
              <button type="button" onClick={refresh} className="text-[#007bff] hover:underline cursor-pointer">
                ลองใหม่
              </button>
            </>
          ) : (
            <>
              <Loader2 className="w-8 h-8 animate-spin" />
              <span>กำลังโหลดข้อมูล…</span>
            </>
          )}
        </div>
      ) : (
        <>
          {page === 'dashboard' && <DashboardPage {...props} onNavigate={setPage} />}
          {page === 'windows' && <WindowsPage {...props} />}
          {page === 'moderation' && <ModerationPage {...props} />}
          {page === 'promo' && <PromoPage {...props} />}
          {page === 'users' && <UsersPage {...props} />}
          {page === 'payments' && <PaymentsPage {...props} />}
          {page === 'transactions' && <TransactionsPage {...props} />}
          {page === 'topups' && <TopUpsPage {...props} />}
          {page === 'payouts' && <PayoutsPage {...props} />}
          {page === 'revenue' && <RevenuePage {...props} />}
          {page === 'price-caps' && <PriceCapsPage {...props} />}
          {page === 'channels' && <ChannelsPage {...props} />}
          {page === 'topup-settings' && <TopUpSettingsPage {...props} />}
          {page === 'edit-settings' && <EditSettingsPage {...props} />}
          {page === 'rules' && <RulesPage />}
          {page === 'audit' && <AuditPage {...props} />}
        </>
      )}

      {toast && (
        <div
          className={`fixed top-16 right-4 z-[70] max-w-sm ${toast.tone === 'error' ? 'bg-[#dc3545]' : 'bg-[#28a745]'} text-white rounded shadow-lg px-4 py-3 text-sm flex items-start gap-2`}
        >
          {toast.tone === 'error' ? <CircleAlert className="w-4 h-4 mt-0.5 shrink-0" /> : <CircleCheck className="w-4 h-4 mt-0.5 shrink-0" />}
          <span>{toast.message}</span>
        </div>
      )}
    </AdminLayout>
  )
}
