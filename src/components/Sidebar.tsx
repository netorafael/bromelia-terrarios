import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  BarChart3,
  Settings,
  FileBarChart,
  Leaf,
  Menu,
  X,
  LogOut,
} from 'lucide-react';

const navItems = [
  { id: 'dashboard', label: 'Visão Geral', icon: LayoutDashboard },
  { id: 'inventory', label: 'Estoque', icon: Package },
  { id: 'sales', label: 'Vendas & PDV', icon: ShoppingCart },
  { id: 'analytics', label: 'Análises', icon: BarChart3 },
  { id: 'weekly-report', label: 'Relatório semanal', icon: FileBarChart },
  { id: 'settings', label: 'Configurações', icon: Settings },
];

interface SidebarProps {
  activeView: string;
  setActiveView: (view: string) => void;
  mobileOpen: boolean;
  setMobileOpen: (open: boolean) => void;
  onLogout: () => void;
}

export default function Sidebar({ activeView, setActiveView, mobileOpen, setMobileOpen, onLogout }: SidebarProps) {
  const handleNav = (id: string) => {
    setActiveView(id);
    setMobileOpen(false);
  };

  return (
    <>
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm md:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      <aside
        className={`
          fixed top-0 left-0 h-full z-50 flex flex-col
          w-64 transition-transform duration-300 ease-out
          md:translate-x-0
          ${mobileOpen ? 'translate-x-0' : '-translate-x-full'}
        `}
        style={{
          background: 'rgba(253, 241, 238, 0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderRight: '1px solid rgba(252, 211, 217, 0.5)',
        }}
      >
        {/* Logo */}
        <div className="flex items-center gap-3 px-6 py-6 border-b" style={{ borderColor: 'rgba(252, 211, 217, 0.4)' }}>
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, #E28B9B, #D66D81)' }}
          >
            <Leaf size={18} color="white" strokeWidth={2} />
          </div>
          <div>
            <div className="font-semibold text-sm leading-tight" style={{ fontFamily: 'var(--font-display)', color: '#1C1C1E' }}>
              Bromélia
            </div>
            <div className="text-xs" style={{ color: '#A0A0A3' }}>Terrários</div>
          </div>
          <button
            className="ml-auto md:hidden p-1 rounded-lg hover:bg-pink-100 transition-colors"
            onClick={() => setMobileOpen(false)}
          >
            <X size={16} style={{ color: '#6B6B6E' }} />
          </button>
        </div>

        {/* Botão PDV destacado */}
        <div className="px-4 py-4 pb-3">
          <button
            onClick={() => handleNav('sales')}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-semibold transition-all duration-150 hover:opacity-90 active:scale-95"
            style={{
              background: 'linear-gradient(135deg, #E28B9B, #D66D81)',
              color: 'white',
              boxShadow: '0 4px 16px rgba(214, 109, 129, 0.35)',
            }}
          >
            <ShoppingCart size={16} />
            Abrir PDV
          </button>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-4 py-2 space-y-1 overflow-y-auto">
          {navItems.map(({ id, label, icon: Icon }) => {
            const active = activeView === id;
            return (
              <button
                key={id}
                onClick={() => handleNav(id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm transition-all duration-150 text-left"
                style={{
                  background: active ? '#F9E8EC' : 'transparent',
                  color: active ? '#D66D81' : '#6B6B6E',
                  fontWeight: active ? 500 : 400,
                }}
              >
                <Icon size={18} strokeWidth={active ? 2 : 1.5} />
                {label}
              </button>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="px-4 py-5 border-t space-y-3" style={{ borderColor: 'rgba(252, 211, 217, 0.4)' }}>
          <div className="flex items-center gap-3 px-2">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold flex-shrink-0"
              style={{ background: '#FDE0E2', color: '#D66D81' }}
            >
              AD
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-medium" style={{ color: '#1C1C1E' }}>Administrador</div>
              <div className="text-xs truncate" style={{ color: '#A0A0A3' }}>Loja Principal</div>
            </div>
          </div>
          <button
            onClick={onLogout}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-xl text-sm transition-colors hover:bg-pink-50"
            style={{ color: '#A0A0A3' }}
          >
            <LogOut size={15} />
            Sair
          </button>
        </div>
      </aside>
    </>
  );
}

export function MobileTopBar({
  activeView,
  onMenuClick,
  onPdv,
}: {
  activeView: string;
  onMenuClick: () => void;
  onPdv: () => void;
}) {
  return (
    <header
      className="fixed top-0 left-0 right-0 z-30 flex items-center gap-3 px-4 py-3 md:hidden"
      style={{
        background: 'rgba(253, 241, 238, 0.92)',
        backdropFilter: 'blur(20px)',
        WebkitBackdropFilter: 'blur(20px)',
        borderBottom: '1px solid rgba(252, 211, 217, 0.4)',
      }}
    >
      <button
        onClick={onMenuClick}
        className="p-2 rounded-xl"
        style={{ background: '#FDE0E2' }}
      >
        <Menu size={18} style={{ color: '#D66D81' }} />
      </button>
      <div className="flex items-center gap-2 flex-1">
        <Leaf size={16} style={{ color: '#D66D81' }} />
        <span className="font-semibold text-sm" style={{ fontFamily: 'var(--font-display)', color: '#1C1C1E' }}>
          Bromélia Terrários
        </span>
      </div>
      {/* PDV rápido mobile */}
      <button
        onClick={onPdv}
        className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-semibold"
        style={{ background: 'linear-gradient(135deg, #E28B9B, #D66D81)', color: 'white' }}
      >
        <ShoppingCart size={13} />
        PDV
      </button>
    </header>
  );
}
