import { HashRouter, Navigate, Route, Routes } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext'
import { LangProvider, useLang } from './context/LangContext'
import { Button, FullScreenLoader, Page } from './components/ui'
import Icon from './components/Icon'
import Login from './pages/Login'
import Home from './pages/Home'
import Users from './pages/Users'
import Roles from './pages/Roles'
import Settings from './pages/Settings'
import ComingSoon from './pages/ComingSoon'

function RequirePerm({ perm, children }) {
  const { can } = useAuth()
  const { t } = useLang()
  if (!can(perm)) {
    return (
      <Page title={t('appName')}>
        <div className="mt-16 flex flex-col items-center gap-3 text-center text-muted">
          <Icon name="lock" size={40} />
          <p>{t('noAccess')}</p>
        </div>
      </Page>
    )
  }
  return children
}

function Blocked() {
  const { t } = useLang()
  const { logout } = useAuth()
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 px-6 text-center">
      <div className="rounded-full bg-danger-50 p-4 text-danger">
        <Icon name="lock" size={36} />
      </div>
      <h1 className="text-xl font-bold">{t('accountInactiveTitle')}</h1>
      <p className="max-w-sm text-muted">{t('accountInactiveBody')}</p>
      <Button variant="secondary" onClick={logout}>
        <Icon name="logout" size={18} /> {t('signOut')}
      </Button>
    </div>
  )
}

function Shell() {
  const { user, loading, blocked } = useAuth()
  if (loading) return <FullScreenLoader />
  if (!user) return <Login />
  if (blocked) return <Blocked />
  return (
    <Routes>
      <Route path="/" element={<Home />} />
      <Route path="/users" element={<RequirePerm perm="manage_users"><Users /></RequirePerm>} />
      <Route path="/roles" element={<RequirePerm perm="manage_roles"><Roles /></RequirePerm>} />
      <Route path="/settings" element={<Settings />} />
      <Route path="/soon/:key" element={<ComingSoon />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}

export default function App() {
  return (
    <LangProvider>
      <AuthProvider>
        <HashRouter>
          <Shell />
        </HashRouter>
      </AuthProvider>
    </LangProvider>
  )
}
