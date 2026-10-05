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
import { supabase } from './lib/supabase';

type View = 'dashboard' | 'inventory' | 'sales' | 'sales-history' | 'analytics' | 'weekly-report' | 'settings';

export default function App() {
  const [sessionReady, setSessionReady] = useState(false);
  const [loggedIn, setLoggedIn] = useState(false);
  const [activeView, setActiveView] = useState<View>('dashboard');
  const [mobileOpen, setMobileOpen] = useState(false);
  const [darkMode, setDarkMode] = useState(() => localStorage.getItem('bromelia-dark-mode') === 'true');

  useEffect(() => {
    document.documentElement.dataset.theme = darkMode ? 'dark' : 'light';
    localStorage.setItem('bromelia-dark-mode', String(darkMode));
  }, [darkMode]);

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (error) console.error('Não foi possível recuperar a sessão:', error);
      if (data.session) void supabase.rpc('ensure_current_user_setup');
      if (mounted) {
        setLoggedIn(Boolean(data.session));
        setSessionReady(true);
      }
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setLoggedIn(Boolean(session));
      setSessionReady(true);
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

  const renderView = () => {
    switch (activeView) {
      case 'dashboard':  return <Dashboard onViewReport={() => setActiveView('analytics')} />;
      case 'inventory':  return <Estoque />;
      case 'sales':      return <Sales onViewHistory={() => setActiveView('sales-history')} />;
      case 'sales-history': return <SalesHistory onBack={() => setActiveView('sales')} />;
      case 'analytics':  return <Analytics />;
      case 'weekly-report': return <WeeklyReport />;
      case 'settings':   return <SettingsView darkMode={darkMode} onDarkModeChange={setDarkMode} />;
    }
  };

  return (
    <div className="min-h-screen app-shell" style={{ background: 'var(--app-bg)' }}>
      <Sidebar
        activeView={activeView}
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
