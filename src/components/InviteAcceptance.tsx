import { FormEvent, useState } from 'react';
import { Leaf, AlertCircle } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function InviteAcceptance({ token }: { token: string }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmation, setConfirmation] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError('');
    if (password.length < 8) {
      setError('A senha deve ter pelo menos 8 caracteres.');
      return;
    }
    if (password !== confirmation) {
      setError('As senhas não coincidem.');
      return;
    }
    setLoading(true);
    const { error: signUpError } = await supabase.auth.signUp({
      email: email.trim(),
      password,
      options: { data: { invite_token: token, display_name: email.trim().split('@')[0] } },
    });
    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }
    localStorage.setItem('bromelia-pending-invite', token);
    await supabase.auth.signOut();
    window.location.replace('/');
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'linear-gradient(145deg, #FEF7F1 0%, #F9E8EC 50%, #FDE0E2 100%)' }}>
      <div className="w-full max-w-sm rounded-3xl p-8" style={{ background: 'rgba(255,255,255,0.9)', border: '1px solid rgba(252,211,217,0.5)', boxShadow: '0 8px 40px rgba(214,109,129,0.12)' }}>
        <div className="flex flex-col items-center mb-7">
          <div className="w-14 h-14 rounded-2xl flex items-center justify-center mb-4" style={{ background: 'linear-gradient(135deg, #E28B9B, #D66D81)' }}><Leaf size={26} color="white" /></div>
          <h1 className="text-xl font-semibold" style={{ fontFamily: 'var(--font-display)', color: '#1C1C1E' }}>Convite Bromélia</h1>
          <p className="text-sm mt-1 text-center" style={{ color: '#A0A0A3' }}>Crie sua conta para entrar na equipe.</p>
        </div>
        <form onSubmit={submit} className="space-y-4">
            <input required type="email" placeholder="E-mail do convite" value={email} onChange={e => setEmail(e.target.value)} className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={{ background: '#FEF7F1', border: '1px solid rgba(252,211,217,0.6)' }} />
            <input required type="password" minLength={8} placeholder="Crie uma senha" value={password} onChange={e => setPassword(e.target.value)} className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={{ background: '#FEF7F1', border: '1px solid rgba(252,211,217,0.6)' }} />
            <input required type="password" minLength={8} placeholder="Confirme a senha" value={confirmation} onChange={e => setConfirmation(e.target.value)} className="w-full px-4 py-3 rounded-xl text-sm outline-none" style={{ background: '#FEF7F1', border: '1px solid rgba(252,211,217,0.6)' }} />
            {error && <div className="flex gap-2 rounded-xl px-3 py-2.5 text-xs" style={{ background: '#FDE0E2', color: '#C94B5F' }}><AlertCircle size={14} />{error}</div>}
            <button disabled={loading} className="w-full py-3 rounded-xl text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg, #E28B9B, #D66D81)' }}>{loading ? 'Criando conta...' : 'Aceitar convite'}</button>
        </form>
      </div>
    </div>
  );
}
