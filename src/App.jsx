import { HashRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { LangProvider, useLang } from './context/LangContext'
import { Button, EmptyState, FullScreenLoader, Page } from './components/ui'
import Icon from './components/Icon'
import Login from './pages/Login'
import Home from './pages/Home'
import Users from './pages/Users'
import Roles from './pages/Roles'
import Settings from './pages/Settings'
import ComingSoon from './pages/ComingSoon'
import SellPreview from './pages/SellPreview'
import Items from './pages/Items'
import ItemDetail from './pages/ItemDetail'
import ItemForm from './pages/ItemForm'
import Categories from './pages/Categories'
import LowStock from './pages/LowStock'
import { CatalogProvider } from './lib/catalog'
import Buy from './pages/Buy'
import Suppliers from './pages/Suppliers'
import SupplierDetail from './pages/SupplierDetail'
import { PurchaseDetail, PurchasesList } from './pages/Purchases'

function RequirePerm({ perm, children }) {
  const { can } = useAuth()
  const { t } = useLang()
  if (!can(perm)) {
    return (
      <Page title={t('appName')}>
        <EmptyState icon="lock" body={t('noAccess')} />
      </Page>
    )
  }
  return children
}

function RequireAny({ perms, children }) {
  const { can } = useAuth()
  return perms.some((p) => can(p)) ? children : <RequirePerm perm={perms[0]}>{children}</RequirePerm>
}

function Blocked() {
  const { t } = useLang()
  const { logout } = useAuth()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-white px-6 text-center">
      <img src="./logo-mark.png" alt="Book Mart" className="mb-2 h-16 w-16 object-contain" />
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-danger-50 text-danger">
        <Icon name="lock" size={28} />
      </div>
      <h1 className="text-xl font-bold text-charcoal">{t('accountInactiveTitle')}</h1>
      <p className="max-w-sm text-muted">{t('accountInactiveBody')}</p>
      <Button variant="secondary" onClick={logout}>
        <Icon name="logout" size={18} /> {t('signOut')}
      </Button>
    </div>
  )
}

export function Shell() {
  const { user, loading, blocked } = useAuth()
  const { pathname } = useLocation()
  // Public link for the client to try the Sell design without logging in (sample data only)
  if (pathname === '/demo/sell') return <SellPreview demo />
  if (loading) return <FullScreenLoader />
  if (!user) return <Login />
  if (blocked) return <Blocked />
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/users" element={<RequirePerm perm="manage_users"><Users /></RequirePerm>} />
      <Route path="/roles" element={<RequirePerm perm="manage_roles"><Roles /></RequirePerm>} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/items" element={<RequirePerm perm="view_items"><Items /></RequirePerm>} />
      <Route path="/items/new" element={<RequirePerm perm="manage_items"><ItemForm /></RequirePerm>} />
      <Route path="/items/:id" element={<RequirePerm perm="view_items"><ItemDetail /></RequirePerm>} />
      <Route path="/items/:id/edit" element={<RequirePerm perm="manage_items"><ItemForm /></RequirePerm>} />
      <Route path="/categories" element={<RequirePerm perm="manage_items"><Categories /></RequirePerm>} />
      <Route path="/low-stock" element={<RequirePerm perm="low_stock"><LowStock /></RequirePerm>} />
      <Route path="/buy" element={<RequirePerm perm="buy"><Buy /></RequirePerm>} />
      <Route path="/purchases" element={<RequireAny perms={['buy', 'manage_suppliers', 'view_reports']}><PurchasesList /></RequireAny>} />
      <Route path="/purchases/:id" element={<RequireAny perms={['buy', 'manage_suppliers', 'view_reports']}><PurchaseDetail /></RequireAny>} />
      <Route path="/suppliers" element={<RequireAny perms={['manage_suppliers', 'buy', 'pay_suppliers']}><Suppliers /></RequireAny>} />
      <Route path="/suppliers/:id" element={<RequireAny perms={['manage_suppliers', 'buy', 'pay_suppliers']}><SupplierDetail /></RequireAny>} />
      <Route path="/sell" element={<RequirePerm perm="sell"><SellPreview /></RequirePerm>} />
      <Route path="/soon/:key" element={<ComingSoon />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <LangProvider>
      <AuthProvider>
        <CatalogProvider>
          <HashRouter>
            <Shell />
          </HashRouter>
        </CatalogProvider>
      </AuthProvider>
    </LangProvider>
  )
}
