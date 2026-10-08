import { useEffect, useState } from 'react';
import Login from './components/Login';
import Sidebar, { MobileTopBar } from './components/Sidebar';
import Dashboard from './components/Dashboard';
import Estoque from './components/Inventory';
import Sales from './components/Sales';
import SalesHistory from './components/SalesHistory';
import Analytics from './components/Analytics';
import SettingsView from './components/SettingsView';
import WeeklyReport from './components/WeeklyReport';
import InviteAcceptance from './components/InviteAcceptance';
import { supabase } from './lib/supabase';

type View = 'dashboard' | 'inventory' | 'sales' | 'sales-history' | 'analytics' | 'weekly-report' | 'settings';
export type UserRole = 'admin' | 'seller';

export default function App() {
  const inviteToken = new URLSearchParams(window.location.search).get('invite');
  const [sessionReady, setSessionReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [role, setRole] = useState<UserRole | null>(null);
  const [accessReady, setAccessReady] = useState(false);
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('bromelia-dark-mode') === 'true');

  if (inviteToken) {
    return <InviteAcceptance token={inviteToken} />;
  }

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
    localStorage.setItem('bromelia-dark-mode', String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    let mounted = true;
    const loadAccess = async (session: { user: { id: string } } | null) => {
      if (!session) {
        if (mounted) {
          setRole(null);
          setLoggedIn(false);
          setAccessReady(true);
        }
        return;
      }
      await supabase.rpc('ensure_current_user_setup');
      const { data: membership } = await supabase
        .from('store_users')
        .select('role')
        .eq('user_id', session.user.id)
        .limit(1)
        .maybeSingle();
      if (mounted) {
        setRole((membership?.role as UserRole | null) ?? null);
        setLoggedIn(true);
        setAccessReady(true);
      }
    };
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.error('Não foi possível recuperar a sessão:', error);
      void loadAccess(data.session);
      if (mounted) setSessionReady(true);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setTimeout(() => void loadAccess(session), 0);
    });
    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  if (!sessionReady) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: '#FEF7F1', color: '#D66D81' }}>Carregando...</div>;
  }
  if (!loggedIn) {
    return <Login onLogin={() => setLoggedIn(true)} />;
  }
  if (!accessReady || !role) {
    return <div className="min-h-screen flex items-center justify-center" style={{ background: '#FEF7F1', color: '#D66D81' }}>Acesso aguardando aprovação administrativa.</div>;
  }

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':  return role === 'admin' ? <Dashboard onViewReport={() => setActiveView('analytics')} /> : <Sales isAdmin={false} onViewHistory={() => setActiveView('sales-history')} />;
      case 'inventory':  return role === 'admin' ? <Estoque /> : <Sales isAdmin={false} onViewHistory={() => setActiveView('sales-history')} />;
      case 'sales':      return <Sales isAdmin={role === 'admin'} onViewHistory={() => setActiveView('sales-history')} />;
      case 'sales-history': return role === 'admin' ? <SalesHistory onBack={() => setActiveView('sales')} /> : <Sales isAdmin={false} onViewHistory={() => setActiveView('sales-history')} />;
      case 'analytics':  return role === 'admin' ? <Analytics /> : <Sales isAdmin={false} onViewHistory={() => setActiveView('sales-history')} />;
      case 'weekly-report': return role === 'admin' ? <WeeklyReport /> : <Sales isAdmin={false} onViewHistory={() => setActiveView('sales-history')} />;
      case 'settings':   return role === 'admin' ? <SettingsView darkMode={darkMode} onDarkModeChange={setDarkMode} /> : <Sales isAdmin={false} onViewHistory={() => setActiveView('sales-history')} />;
    }
  };

  return (
    <div className="min-h-screen app-shell" style={{ background: 'var(--app-bg)' }}>
      <Sidebar
        activeView={activeView}
        role={role}
        setActiveView={(v) => setActiveView(v as View)}
        mobileOpen={mobileOpen}
        setMobileOpen={setMobileOpen}
        onLogout={async () => {
          const { error } = await supabase.auth.signOut();
          if (error) console.error('Não foi possível sair:', error);
          setLoggedIn(false);
          setActiveView('dashboard');
        }}
      />

      <MobileTopBar
        activeView={activeView}
        onMenuClick={() => setMobileOpen(true)}
        onPdv={() => { setActiveView('sales'); setMobileOpen(false); }}
      />

      <main className="md:ml-64 px-4 md:px-8 pt-20 md:pt-8 pb-8 min-h-screen">
        {renderView()}
      </main>
    </div>
  );
}
