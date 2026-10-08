import { useState } from 'react';
import { Leaf, Eye, EyeOff, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface LoginProps {
  onLogin: () => void;
}

export default function Login({ onLogin }: LoginProps) {
  const [user, setUser] = useState('');
  const [pass, setPass] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    const { error: authError } = await supabase.auth.signInWithPassword({ email: user.trim(), password: pass });
    if (authError) {
      setError(authError.message);
      setLoading(false);
      return;
    }
    const pendingInvite = localStorage.getItem('bromelia-pending-invite');
    if (pendingInvite) {
      const { error: inviteError } = await supabase.rpc('accept_store_invitation', { p_token: pendingInvite });
      if (inviteError) {
        await supabase.auth.signOut();
        setError(inviteError.message);
        setLoading(false);
        return;
      }
      localStorage.removeItem('bromelia-pending-invite');
    }
    onLogin();
  };

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4"
      style={{ background: 'linear-gradient(145deg, #FEF7F1 0%, #F9E8EC 50%, #FDE0E2 100%)' }}
    >
      {/* Decorative blobs */}
      <div
        className="fixed top-0 right-0 w-96 h-96 rounded-full opacity-30 pointer-events-none"
        style={{
          background: 'radial-gradient(circle, #E28B9B, transparent 70%)',
          transform: 'translate(30%, -30%)',
        }}
      />
      <div
        className="fixed bottom-0 left-0 w-72 h-72 rounded-full opacity-20 pointer-events-none"
        style={{
          background: 'radial-gradient(circle, #D66D81, transparent 70%)',
          transform: 'translate(-30%, 30%)',
        }}
      />

      <div
        className="w-full max-w-sm relative"
        style={{
          background: 'rgba(255,255,255,0.85)',
          backdropFilter: 'blur(24px)',
          WebkitBackdropFilter: 'blur(24px)',
          borderRadius: '24px',
          border: '1px solid rgba(252, 211, 217, 0.5)',
          boxShadow: '0 8px 40px rgba(214, 109, 129, 0.12)',
          padding: '40px 36px',
        }}
      >
        {/* Logo */}
        <div className="flex flex-col items-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4"
            style={{ background: 'linear-gradient(135deg, #E28B9B, #D66D81)' }}
          >
            <Leaf size={26} color="white" strokeWidth={1.5} />
          </div>
          <h1
            className="text-xl font-semibold text-center"
            style={{ fontFamily: 'var(--font-display)', color: '#1C1C1E' }}
          >
            Bromélia Terrários
          </h1>
          <p className="text-sm mt-1 text-center" style={{ color: '#A0A0A3' }}>
            Acesse o painel de gestão
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Usuário */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#6B6B6E' }}>
              E-mail
            </label>
            <input
              type="text"
              value={user}
              onChange={(e) => { setUser(e.target.value); setError(''); }}
              placeholder="voce@exemplo.com"
              autoComplete="email"
              className="w-full px-4 py-3 rounded-xl text-sm outline-none transition-all"
              style={{
                background: '#FEF7F1',
                border: error ? '1.5px solid #C94B5F' : '1px solid rgba(252, 211, 217, 0.6)',
                color: '#1C1C1E',
              }}
              onFocus={(e) => { if (!error) e.currentTarget.style.borderColor = '#D66D81'; }}
              onBlur={(e) => { if (!error) e.currentTarget.style.borderColor = 'rgba(252, 211, 217, 0.6)'; }}
            />
          </div>

          {/* Senha */}
          <div>
            <label className="block text-xs font-medium mb-1.5" style={{ color: '#6B6B6E' }}>
              Senha
            </label>
            <div className="relative">
              <input
                type={showPass ? 'text' : 'password'}
                value={pass}
                onChange={(e) => { setPass(e.target.value); setError(''); }}
                placeholder="Digite sua senha"
                autoComplete="current-password"
                className="w-full px-4 py-3 pr-11 rounded-xl text-sm outline-none transition-all"
                style={{
                  background: '#FEF7F1',
                  border: error ? '1.5px solid #C94B5F' : '1px solid rgba(252, 211, 217, 0.6)',
                  color: '#1C1C1E',
                }}
                onFocus={(e) => { if (!error) e.currentTarget.style.borderColor = '#D66D81'; }}
                onBlur={(e) => { if (!error) e.currentTarget.style.borderColor = 'rgba(252, 211, 217, 0.6)'; }}
              />
              <button
                type="button"
                onClick={() => setShowPass(!showPass)}
                className="absolute right-3 top-1/2 -translate-y-1/2 p-1"
              >
                {showPass
                  ? <EyeOff size={15} style={{ color: '#A0A0A3' }} />
                  : <Eye size={15} style={{ color: '#A0A0A3' }} />
                }
              </button>
            </div>
          </div>

          {/* Erro */}
          {error && (
            <div
              className="flex items-center gap-2 px-3 py-2.5 rounded-xl text-xs"
              style={{ background: '#FDE0E2', color: '#C94B5F' }}
            >
              <AlertCircle size={13} />
              {error === 'Invalid login credentials' ? 'E-mail ou senha incorretos. Tente novamente.' : error}
            </div>
          )}

          {/* Botão */}
          <button
            type="submit"
            disabled={loading || !user || !pass}
            className="w-full py-3 rounded-xl text-sm font-semibold mt-2 transition-opacity"
            style={{
              background: user && pass ? 'linear-gradient(135deg, #E28B9B, #D66D81)' : '#FDE0E2',
              color: user && pass ? 'white' : '#C0C0C3',
              cursor: user && pass ? 'pointer' : 'not-allowed',
            }}
          >
            {loading ? 'Entrando...' : 'Entrar'}
          </button>
        </form>

        <p className="text-center text-xs mt-6" style={{ color: '#C0C0C3' }}>
          Sistema exclusivo Bromélia Terrários
        </p>
      </div>
    </div>
  );
}
