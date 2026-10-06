import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  AuthMode,
  CategoryId,
  HubTab,
  PaymentBreakdown,
  PaymentChannel,
  PaymentSlip,
  PayoutAccount,
  Quota,
  RegionId,
  StatusCounts,
  StatusFilter,
  User,
  WindowContentInput,
  WindowItem,
  ZoomLevel,
} from '@/types'
import { REGION_IDS } from '@/data/regions'
import * as store from '@/lib/store'
import { isPromoSlot, OPEN_PROMO_EVENT } from '@/lib/promo'
import { hotLevel, likesToday, matchesEffectFilter } from '@/lib/windowBadges'
import { filterWindows } from '@/lib/boardFilter'
import { useToast } from '@/hooks/useToast'
import { useViewportHeight } from '@/hooks/useViewportHeight'
import { WelcomeScreen } from '@/components/WelcomeScreen'
import { Header } from '@/components/layout/Header'
import { WelcomeBanner } from '@/components/layout/WelcomeBanner'
import { Footer } from '@/components/layout/Footer'
import { Toast } from '@/components/layout/Toast'
import { MobileDrawer } from '@/components/layout/MobileDrawer'
import { RegionMenuModal } from '@/components/layout/RegionMenuModal'
import { WindowGrid } from '@/components/board/WindowGrid'
import { WindowDetailModal } from '@/components/window/WindowDetailModal'
import { ClaimWindowModal } from '@/components/window/ClaimWindowModal'
import { BuyResaleModal } from '@/components/window/BuyResaleModal'
import { EditWindowModal } from '@/components/window/EditWindowModal'
import { CheckoutModal } from '@/components/payment/CheckoutModal'
import { TopUpModal } from '@/components/payment/TopUpModal'
import { HubPanel } from '@/components/hub/HubPanel'
import { AuthModal } from '@/components/auth/AuthModal'
import { KycModal } from '@/components/auth/KycModal'
import { AdminApp } from '@/components/admin/AdminApp'

const EMPTY_QUOTA: Quota = {
  thailandCount: 0,
  regionalCount: 0,
  totalCount: 0,
  canAcquireThailand: true,
  canAcquireRegional: true,
  canAcquireTotal: true,
}

const countAvailable = (windows: WindowItem[]) =>
  windows.filter((w) => w.status === 'available' && !isPromoSlot(w.id)).length

interface PendingPayment {
  mode: 'claim' | 'resale'
  window: WindowItem
  amount: number
  /** Content entered in the claim form, applied once payment is approved. */
  claimContent?: WindowContentInput
}

export default function App() {
  useViewportHeight()
  const { toast, showToast } = useToast()

  // Open the admin page directly when the URL is #admin/... and an admin is signed in.
  const [view, setView] = useState<'welcome' | 'main' | 'admin'>(() =>
    window.location.hash.startsWith('#admin') && store.loadCurrentUser()?.role === 'admin' ? 'admin' : 'welcome',
  )
  const [activeRegion, setActiveRegion] = useState<RegionId>(() => store.loadActiveRegion())
  const [board, setBoard] = useState<WindowItem[]>(() => store.loadBoard(store.loadActiveRegion()))
  const [currentUser, setCurrentUser] = useState<User | null>(() => store.loadCurrentUser())
  const [users, setUsers] = useState<User[]>(() => store.loadUsers())
  const [transactions, setTransactions] = useState(() => store.loadTransactions())
  const [availableByRegion, setAvailableByRegion] = useState<Partial<Record<RegionId, number>>>(() =>
    Object.fromEntries(REGION_IDS.map((r) => [r, countAvailable(store.loadBoard(r))])),
  )

  const [statusFilter, setStatusFilter] = useState<StatusFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<CategoryId | 'all'>('all')
  const [searchQuery, setSearchQuery] = useState('')
  const [jumpNumber, setJumpNumber] = useState('')
  const [zoomLevel, setZoomLevel] = useState<ZoomLevel>('compact')

  const [selectedWindow, setSelectedWindow] = useState<WindowItem | null>(null)
  const [claimTarget, setClaimTarget] = useState<WindowItem | null>(null)
  const [resaleTarget, setResaleTarget] = useState<WindowItem | null>(null)
  const [editTarget, setEditTarget] = useState<WindowItem | null>(null)
  const [payment, setPayment] = useState<PendingPayment | null>(null)
  /** Window to open once the checkout dialog is closed after a successful purchase. */
  const [pendingSelection, setPendingSelection] = useState<WindowItem | null>(null)

  const [regionMenuOpen, setRegionMenuOpen] = useState(false)
  const [hubOpen, setHubOpen] = useState(false)
  const [hubTab, setHubTab] = useState<HubTab>('rules')
  const [authOpen, setAuthOpen] = useState(false)
  const [authMode, setAuthMode] = useState<AuthMode>('login')
  const [kycOpen, setKycOpen] = useState(false)
  const [kycReason, setKycReason] = useState('')
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [bannerVisible, setBannerVisible] = useState(true)
  const [topUpOpen, setTopUpOpen] = useState(false)

  // ------------------------------------------------------------ derived data

  const refreshBoard = useCallback((region: RegionId = activeRegion) => setBoard(store.loadBoard(region)), [activeRegion])
  const refreshUsers = () => setUsers(store.loadUsers())

  const selectRegion = useCallback((region: RegionId) => {
    setActiveRegion(region)
    store.saveActiveRegion(region)
    setBoard(store.loadBoard(region))
    setSelectedWindow(null)
  }, [])

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const quota = useMemo(() => (currentUser ? store.getQuota(currentUser.id) : EMPTY_QUOTA), [currentUser, board])

  useEffect(() => {
    setAvailableByRegion((counts) => ({ ...counts, [activeRegion]: countAvailable(board) }))
  }, [board, activeRegion])

  // Keep the open detail modal in sync after the board reloads.
  useEffect(() => {
    if (!selectedWindow) return
    const fresh = board.find((w) => w.id === selectedWindow.id && w.region === selectedWindow.region)
    if (fresh && fresh !== selectedWindow) setSelectedWindow(fresh)
  }, [board, selectedWindow])

  /** Every window in every region that matches `predicate` (active region from state). */
  const collectAcrossRegions = useCallback(
    (predicate: (w: WindowItem) => boolean) =>
      REGION_IDS.flatMap((region) => (region === activeRegion ? board : store.loadBoard(region)).filter(predicate)),
    [activeRegion, board],
  )
  const myWindows = useMemo(
    () => (currentUser ? collectAcrossRegions((w) => w.ownerId === currentUser.id) : []),
    [collectAcrossRegions, currentUser],
  )
  const followedWindows = useMemo(
    () => (currentUser ? collectAcrossRegions((w) => !!w.followerIds?.includes(currentUser.id)) : []),
    [collectAcrossRegions, currentUser],
  )

  const counts: StatusCounts = useMemo(
    () => ({
      all: board.length,
      available: countAvailable(board),
      for_resale: board.filter((w) => w.status === 'for_resale').length,
      occupied: board.filter((w) => w.status === 'occupied').length,
      my: currentUser ? board.filter((w) => w.ownerId === currentUser.id).length : 0,
      follow: followedWindows.length,
      fx_hot: board.filter((w) => matchesEffectFilter(w, 'fx_hot')).length,
      fx_new: board.filter((w) => matchesEffectFilter(w, 'fx_new')).length,
      fx_daily: board.filter((w) => matchesEffectFilter(w, 'fx_daily')).length,
      fx_star: board.filter((w) => matchesEffectFilter(w, 'fx_star')).length,
    }),
    [board, currentUser, followedWindows],
  )

  const hotTop = useMemo(
    () =>
      board
        .filter((w) => hotLevel(w) > 0)
        .sort((a, b) => likesToday(b) - likesToday(a))
        .slice(0, 10),
    [board],
  )

  const visibleWindows = useMemo(
    () =>
      filterWindows(statusFilter === 'follow' ? followedWindows : board, {
        status: statusFilter,
        category: categoryFilter,
        query: searchQuery,
        user: currentUser,
      }),
    [board, followedWindows, statusFilter, categoryFilter, searchQuery, currentUser],
  )

  // ------------------------------------------------------------ deep links: #window-<region>-<id> or #window-<id>

  const boardRef = useRef(board)
  boardRef.current = board
  const activeRegionRef = useRef(activeRegion)
  activeRegionRef.current = activeRegion

  useEffect(() => {
    const openFromHash = () => {
      const hash = window.location.hash
      if (!hash.startsWith('#window-')) return
      const parts = hash.replace('#window-', '').split('-')
      if (parts.length === 2 && REGION_IDS.includes(parts[0] as RegionId)) {
        const region = parts[0] as RegionId
        const id = parseInt(parts[1], 10)
        if (region !== activeRegionRef.current) selectRegion(region)
        const found = store.loadBoard(region).find((w) => w.id === id)
        if (found) setSelectedWindow(found)
      } else if (parts.length === 1) {
        const id = parseInt(parts[0], 10)
        const found = boardRef.current.find((w) => w.id === id)
        if (found) setSelectedWindow(found)
      }
    }
    openFromHash()
    window.addEventListener('hashchange', openFromHash)
    return () => window.removeEventListener('hashchange', openFromHash)
  }, [selectRegion])

  // ------------------------------------------------------------ dialogs

  const openHub = useCallback((tab: HubTab = 'rules') => {
    setHubTab(tab)
    setHubOpen(true)
  }, [])
  const openAuth = (mode: AuthMode = 'login') => {
    setAuthMode(mode)
    setAuthOpen(true)
  }
  const openKyc = (reason = '') => {
    setKycReason(reason)
    setKycOpen(true)
  }

  useEffect(() => {
    const onOpenPromo = () => openHub('rules')
    window.addEventListener(OPEN_PROMO_EVENT, onOpenPromo)
    return () => window.removeEventListener(OPEN_PROMO_EVENT, onOpenPromo)
  }, [openHub])

  const jumpToWindow = (id: number) => {
    const found = board.find((w) => w.id === id)
    if (!found) return
    setSelectedWindow(found)
    setTimeout(() => document.getElementById(`window-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 100)
  }

  const selectWindow = (window: WindowItem) => {
    if (window.region !== activeRegion) selectRegion(window.region)
    setSelectedWindow(window)
  }

  // ------------------------------------------------------------ account

  const handleLogin = (identifier: string, password: string) => {
    const result = store.login(identifier, password)
    if (result.success) {
      setCurrentUser(result.user)
      refreshUsers()
      showToast(`เข้าสู่ระบบสำเร็จ ยินดีต้อนรับคุณ ${result.user.name}`)
    }
    return result
  }

  const handleRegister = (input: store.SignupInput) => {
    const result = store.signup(input)
    if (result.success) {
      setCurrentUser(result.user)
      refreshUsers()
      showToast(`สมัครสมาชิกสำเร็จ! ยินดีต้อนรับคุณ ${result.user.name} (ได้รับโบนัส 10,000 ฿)`)
    }
    return result
  }

  const handleQuickSwitch = (userId: string) => {
    const user = store.loadUsers().find((u) => u.id === userId)
    if (!user) return
    store.saveCurrentUser(user)
    setCurrentUser(user)
    showToast(`สลับใช้งานเป็นบัญชี: ${user.name}`)
  }

  const handleLogout = () => {
    store.saveCurrentUser(null)
    setCurrentUser(null)
    showToast('ออกจากระบบเรียบร้อยแล้ว (สถานะแขกผู้เยี่ยมชม)', 'info')
  }

  const handleVerify = (citizenId: string, phone: string) => {
    if (!currentUser) return { success: false as const, error: 'กรุณาเข้าสู่ระบบก่อน' }
    const result = store.verifyIdentity(currentUser.id, citizenId, phone)
    if (result.success) {
      setCurrentUser(result.user)
      refreshUsers()
      showToast('ยืนยันตัวตนสำเร็จ! ปลดล็อกสิทธิ์ซื้อ-ขายต่อเรียบร้อยแล้ว')
    }
    return result
  }

  const handleTopUp = (amount: number, channel: PaymentChannel, slip: PaymentSlip) => {
    if (!currentUser) return { success: false as const, error: 'กรุณาเข้าสู่ระบบก่อน' }
    const result = store.topUpWallet(currentUser, amount, channel, slip)
    if (!result.success) return result
    setCurrentUser(result.updatedUser)
    refreshUsers()
    setTransactions(store.loadTransactions())
    showToast(`เติมเงิน +฿${amount.toLocaleString()} เข้ากระเป๋าสำเร็จ`)
    return { success: true as const }
  }

  const updateProfile = (changes: Partial<User>, message: string) => {
    if (!currentUser) return
    const result = store.updateUser(currentUser.id, changes)
    if (result.success) {
      setCurrentUser(result.user)
      refreshUsers()
      showToast(message)
    }
  }

  // ------------------------------------------------------------ claim, buy, pay

  const startClaim = (window: WindowItem) => {
    setSelectedWindow(null)
    if (isPromoSlot(window.id)) {
      showToast('หน้าต่างหมายเลข 481–486 ล็อกไว้เป็นพื้นที่โปรโมทของระบบ กดปุ่ม "โปรโมท" ใน Hub รวมข้อมูลเพื่อจองพื้นที่', 'info')
    } else if (!currentUser) {
      openAuth('login')
    } else if (!currentUser.isVerified) {
      openKyc('ต้องยืนยันตัวตนด้วยเลขบัตรประชาชน 13 หลักและเบอร์โทรศัพท์ก่อนจับจองหน้าต่าง')
    } else {
      setClaimTarget(window)
    }
  }

  const startBuyResale = (window: WindowItem) => {
    setSelectedWindow(null)
    if (!currentUser) openAuth('login')
    else if (!currentUser.isVerified) openKyc('ต้องยืนยันตัวตนด้วยเลขบัตรประชาชน 13 หลักและเบอร์โทรศัพท์ก่อนทำการซื้อต่อ')
    else setResaleTarget(window)
  }

  /** Claim form submitted → go to payment. */
  const handleClaimContent = (windowId: number, content: WindowContentInput) => {
    if (!currentUser) return openAuth('login')
    const window = board.find((w) => w.id === windowId) || claimTarget
    if (!window) return
    setPayment({ mode: 'claim', window, amount: window.claimPrice || 500, claimContent: content })
    setClaimTarget(null)
  }

  /** Resale confirmed → go to payment. */
  const handleConfirmBuy = (windowId: number) => {
    if (!currentUser) return openAuth('login')
    const window = board.find((w) => w.id === windowId) || resaleTarget
    if (!window) return
    setPayment({ mode: 'resale', window, amount: window.resalePrice || 500 })
    setResaleTarget(null)
  }

  /** Runs the purchase once checkout has collected the payment (wallet + optional channel). */
  const handleCheckout = (breakdown: PaymentBreakdown) => {
    if (!payment || !currentUser) return { success: false as const, error: 'กรุณาเข้าสู่ระบบก่อน' }
    const result =
      payment.mode === 'claim'
        ? store.claimWindow(payment.window.region, payment.window.id, currentUser, payment.claimContent!, breakdown)
        : store.buyResaleWindow(payment.window.region, payment.window.id, currentUser, breakdown)

    if (!result.success) {
      if (result.requiresKYC) {
        setPayment(null)
        openKyc(result.error)
      }
      return { success: false as const, error: result.error }
    }
    refreshBoard()
    setCurrentUser('updatedUser' in result ? result.updatedUser : result.updatedBuyer)
    refreshUsers()
    setTransactions(store.loadTransactions())
    showToast(`🎉 ชำระเงินสำเร็จ! บานที่ ${result.updatedWindow.code} พร้อมใช้งานทันที`)
    setPendingSelection(result.updatedWindow)
    return { success: true as const }
  }

  const closeCheckout = () => {
    setPayment(null)
    if (pendingSelection) {
      setSelectedWindow(pendingSelection)
      setPendingSelection(null)
    }
  }

  // ------------------------------------------------------------ owner actions

  const handleEdit = (windowId: number, input: store.WindowEditInput) => {
    if (!currentUser) return
    const result = store.editWindow(activeRegion, windowId, currentUser, input)
    if (result.success) {
      refreshBoard()
      setEditTarget(null)
      showToast(`แก้ไขบานที่ ${result.updatedWindow.code} สำเร็จ! สิทธิ์แก้ไขถัดไปในอีก 24 ชั่วโมง`)
      setSelectedWindow(result.updatedWindow)
    } else {
      showToast(result.error || 'ไม่สามารถแก้ไขได้', 'error')
    }
  }

  const handleListForResale = (window: WindowItem, price: number) => {
    if (!currentUser) return
    const result = store.listForResale(activeRegion, window.id, currentUser, price)
    if (result.success) {
      refreshBoard()
      showToast(`เปิดขายต่อบานที่ ${window.code} ในราคา ฿${price.toLocaleString()} สำเร็จ!`)
    } else if (result.requiresKYC) {
      openKyc(result.error)
    } else {
      showToast(result.error || 'ไม่สามารถเปิดขายต่อได้', 'error')
    }
  }

  const handleCancelResale = (window: WindowItem) => {
    if (!currentUser) return
    const result = store.cancelResale(activeRegion, window.id, currentUser)
    if (result.success) {
      refreshBoard()
      showToast(`ยกเลิกการเปิดขายต่อบานที่ ${window.code} เรียบร้อยแล้ว`)
    } else {
      showToast(result.error || 'ไม่สามารถยกเลิกได้', 'error')
    }
  }

  const handleSkipEditCooldown = (windowId: number) => {
    if (store.demoSkipEditCooldown(activeRegion, windowId)) {
      refreshBoard()
      showToast('เร่งเวลา 24 ชั่วโมงสำเร็จ! ปลดล็อกสิทธิ์แก้ไขรูปภาพและข้อความทันที')
    }
  }

  const handleSimulateHolding = (windowId: number, days: number) => {
    const updated = store.demoBackdateOwnership(activeRegion, windowId, days)
    if (!updated) return
    refreshBoard()
    setSelectedWindow(updated)
    showToast(
      days >= 730
        ? 'จำลองอายุถือครอง 2.1 ปี สำเร็จ! (ปลดล็อกตั้งราคาเสรีตามกลไกตลาด)'
        : days >= 365
          ? 'จำลองอายุถือครอง 1.4 ปี สำเร็จ! (ตั้งราคาได้สูงสุด 20 เท่า)'
          : 'จำลองอายุถือครอง 35 วัน สำเร็จ! (ปลดล็อกสิทธิ์ขายต่อ)',
    )
  }

  // ------------------------------------------------------------ social

  const handleLike = (windowId: number) => {
    const before = board.find((w) => w.id === windowId)
    const wasHot = before ? hotLevel(before) > 0 : false
    const updated = store.likeWindow(activeRegion, windowId)
    if (!updated) return
    refreshBoard()
    if (!wasHot && hotLevel(updated) > 0) showToast(`🔥 บาน ${updated.code} กำลังฮอต! ไลค์วันนี้ครบ 10 ครั้งแล้ว`)
  }

  const handleToggleFollow = (windowId: number) => {
    if (!currentUser) return openAuth('login')
    if (store.toggleFollow(activeRegion, windowId, currentUser)) refreshBoard()
  }

  const handleRotate = (forceRandom: boolean) => {
    setBoard(store.loadBoard(activeRegion, forceRandom))
    showToast(forceRandom ? 'สุ่มสลับตำแหน่งหน้าต่างทั้ง 500 บานสำเร็จ!' : 'จำลองการกลับสู่ตำแหน่งมาตรฐาน 1-500 สำเร็จ!')
  }

  // ------------------------------------------------------------ render

  const isAdmin = currentUser?.role === 'admin'

  if (view === 'admin' && currentUser && isAdmin) {
    return (
      <AdminApp
        admin={currentUser}
        onExit={() => {
          window.location.hash = ''
          refreshBoard()
          setCurrentUser(store.loadCurrentUser())
          setUsers(store.loadUsers())
          setTransactions(store.loadTransactions())
          setView('main')
        }}
        onLogout={() => {
          window.location.hash = ''
          handleLogout()
          setView('main')
        }}
      />
    )
  }

  if (view === 'welcome') {
    return (
      <WelcomeScreen
        windowCount={500}
        onEnter={() => {
          setView('main')
          window.scrollTo({ top: 0, behavior: 'smooth' })
        }}
      />
    )
  }

  return (
    <div className="min-h-screen bg-[#09080e] text-stone-100 flex flex-col font-['Plus_Jakarta_Sans','Prompt',sans-serif]">
      <Toast toast={toast} />

      <Header
        activeRegion={activeRegion}
        onOpenRegionMenu={() => setRegionMenuOpen(true)}
        onOpenHub={openHub}
        currentUser={currentUser}
        quota={quota}
        onOpenAuth={openAuth}
        onOpenKyc={() => openKyc()}
        onLogout={handleLogout}
        onBackToWelcome={() => setView('welcome')}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        zoomLevel={zoomLevel}
        setZoomLevel={setZoomLevel}
        onOpenMobileDrawer={() => setDrawerOpen(true)}
        onOpenTopUp={() => setTopUpOpen(true)}
        onOpenAdmin={isAdmin ? () => setView('admin') : undefined}
      />

      {bannerVisible && currentUser && (
        <WelcomeBanner
          user={currentUser}
          quota={quota}
          onOpenKyc={() => openKyc('ยืนยันตัวตนเพื่อเปิดสิทธิ์ซื้อ-ขายต่อ')}
          onDismiss={() => setBannerVisible(false)}
        />
      )}

      <main className="flex-1 pb-16">
        <WindowGrid
          windows={visibleWindows}
          selectedWindow={selectedWindow}
          onSelectWindow={(w) => {
            if (w.region !== activeRegion) selectRegion(w.region)
            // Empty promo windows open the promo booking dialog instead of the detail view.
            if (isPromoSlot(w.id) && w.status === 'available') {
              openHub('rules')
              window.dispatchEvent(new Event(OPEN_PROMO_EVENT))
            } else {
              setSelectedWindow(w)
            }
          }}
          zoomLevel={zoomLevel}
          setZoomLevel={setZoomLevel}
          totalCount={board.length}
          activeRegion={activeRegion}
          onSelectRegion={selectRegion}
          statusFilter={statusFilter}
          setStatusFilter={setStatusFilter}
          searchQuery={searchQuery}
          setSearchQuery={setSearchQuery}
          currentUser={currentUser}
          counts={counts}
          hotTop={hotTop}
        />
      </main>

      <Footer currentUser={currentUser} onBackToWelcome={() => setView('welcome')} onOpenHub={openHub} onOpenAuth={openAuth} />

      <WindowDetailModal
        windowItem={selectedWindow}
        currentUser={currentUser}
        quota={quota}
        onClose={() => setSelectedWindow(null)}
        onClaim={startClaim}
        onBuyResale={startBuyResale}
        onOpenEditor={(w) => {
          setSelectedWindow(null)
          setEditTarget(w)
        }}
        onListForResale={handleListForResale}
        onCancelResale={handleCancelResale}
        onSimulatePass24Hours={handleSkipEditCooldown}
        onSimulateHolding={handleSimulateHolding}
        onLike={handleLike}
        onToggleFollow={handleToggleFollow}
        onShowFollowing={() => {
          setSelectedWindow(null)
          setStatusFilter('follow')
        }}
        onOpenKyc={() => openKyc('การทำธุรกรรมเปิดขายต่อหรือโอนสิทธิ์ต้องยืนยันตัวตนก่อน')}
      />

      {claimTarget && (
        <ClaimWindowModal
          windowItem={claimTarget}
          currentUser={currentUser}
          quota={quota}
          onClose={() => setClaimTarget(null)}
          onSubmitClaim={handleClaimContent}
          onOpenAuth={openAuth}
          onOpenKyc={() => openKyc('ต้องยืนยันตัวตนด้วยเลขบัตรประชาชน 13 หลักและเบอร์โทรศัพท์ก่อนจับจอง')}
        />
      )}

      {resaleTarget && (
        <BuyResaleModal
          windowItem={resaleTarget}
          currentUser={currentUser}
          quota={quota}
          onClose={() => setResaleTarget(null)}
          onConfirmBuy={handleConfirmBuy}
          onOpenAuth={openAuth}
          onOpenKyc={() => openKyc('ต้องยืนยันตัวตนด้วยเลขบัตรประชาชน 13 หลักและเบอร์โทรศัพท์ก่อนซื้อต่อ')}
        />
      )}

      <CheckoutModal
        isOpen={!!payment}
        onClose={closeCheckout}
        mode={payment?.mode ?? 'claim'}
        windowItem={payment?.window ?? null}
        currentUser={currentUser}
        amount={payment?.amount ?? 500}
        onConfirm={handleCheckout}
        onOpenTopUp={() => setTopUpOpen(true)}
      />


      {editTarget && <EditWindowModal windowItem={editTarget} onClose={() => setEditTarget(null)} onSubmitEdit={handleEdit} />}

      <RegionMenuModal
        isOpen={regionMenuOpen}
        onClose={() => setRegionMenuOpen(false)}
        activeRegion={activeRegion}
        onSelectRegion={selectRegion}
        regionalAvailableCounts={availableByRegion}
      />

      <HubPanel
        isOpen={hubOpen}
        onClose={() => setHubOpen(false)}
        initialTab={hubTab}
        currentUser={currentUser}
        myWindows={myWindows}
        transactions={transactions}
        activeRegion={activeRegion}
        windows={board}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        categoryFilter={categoryFilter}
        setCategoryFilter={setCategoryFilter}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
        jumpNumber={jumpNumber}
        setJumpNumber={setJumpNumber}
        onJumpToWindow={jumpToWindow}
        onSelectWindow={selectWindow}
        onOpenTopUp={() => setTopUpOpen(true)}
        onUpdateUserName={(name) => updateProfile({ name }, 'อัปเดตชื่อผู้ใช้เรียบร้อยแล้ว')}
        onUpdatePayoutAccount={(account: PayoutAccount) =>
          updateProfile({ payoutAccount: account }, 'บันทึกข้อมูลบัญชีเพื่อรับเงินเรียบร้อยแล้ว (พร้อมรับเงินสุทธิ 95%)')
        }
        onRotateWindows={handleRotate}
        onOpenAuth={openAuth}
        followCount={followedWindows.length}
        onUserUpdated={(user) => {
          setCurrentUser(user)
          refreshUsers()
          setTransactions(store.loadTransactions())
          showToast(`ชำระค่าโปรโมทแล้ว ยอดคงเหลือ ฿${user.balance.toLocaleString()}`)
        }}
      />

      <AuthModal
        isOpen={authOpen}
        onClose={() => setAuthOpen(false)}
        initialMode={authMode}
        currentUser={currentUser}
        registeredUsers={users}
        onLogin={handleLogin}
        onRegister={handleRegister}
        onQuickSwitch={handleQuickSwitch}
      />

      {kycOpen && (
        <KycModal
          key={currentUser?.id}
          isOpen
          currentUser={currentUser}
          onClose={() => setKycOpen(false)}
          onSuccess={() => showToast('ยืนยันตัวตนสำเร็จ! คุณได้รับสิทธิ์ซื้อ-ขายต่อครบถ้วน')}
          onVerify={handleVerify}
          reasonNotice={kycReason}
        />
      )}

      <MobileDrawer
        isOpen={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        activeRegion={activeRegion}
        onSelectRegion={selectRegion}
        currentUser={currentUser}
        onOpenAuth={openAuth}
        onOpenKyc={() => openKyc()}
        onLogout={handleLogout}
        onOpenHub={openHub}
        onBackToWelcome={() => setView('welcome')}
        onOpenTopUp={() => setTopUpOpen(true)}
        onOpenAdmin={isAdmin ? () => setView('admin') : undefined}
        statusFilter={statusFilter}
        setStatusFilter={setStatusFilter}
        counts={counts}
      />

      {/* Last so it stacks above the Hub and checkout, which can both open it. */}
      <TopUpModal isOpen={topUpOpen} onClose={() => setTopUpOpen(false)} currentUser={currentUser} onTopUp={handleTopUp} />
    </div>
  )
}
