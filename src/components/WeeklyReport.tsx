import { useEffect, useState } from 'react';
import { BarChart3, CalendarDays } from 'lucide-react';
import { supabase } from '../lib/supabase';

export default function WeeklyReport() {
  const [sales, setSales] = useState<{ total: number; created_at: string }[]>([]);
  const [error, setError] = useState('');
  const now = new Date();
  const isAvailable = now.getDay() === 0 && now.getHours() >= 20;

  useEffect(() => {
    const load = async () => {
      const start = new Date(now);
      start.setDate(now.getDate() - 7);
      const { data, error: loadError } = await supabase.from('sales').select('total, created_at').eq('status', 'paid').gte('created_at', start.toISOString()).order('created_at', { ascending: false });
      if (loadError) setError(loadError.message);
      else setSales(data ?? []);
    };
    if (isAvailable) void load();
  }, [isAvailable]);

  const revenue = sales.reduce((sum, sale) => sum + Number(sale.total), 0);
  return (
    <div className="space-y-5 max-w-3xl">
      <div><h1 className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-display)', color: '#1C1C1E' }}>Relatório semanal</h1><p className="text-sm mt-1" style={{ color: '#A0A0A3' }}>Resumo atualizado dentro do sistema</p></div>
      {error && <div className="rounded-xl px-4 py-3 text-sm" style={{ background: '#FDE0E2', color: '#C94B5F' }}>{error}</div>}
      {!isAvailable ? <div className="rounded-2xl p-8 text-center" style={{ background: '#FFFFFF', border: '1px solid rgba(252, 211, 217, 0.4)' }}><CalendarDays size={28} className="mx-auto mb-3" style={{ color: '#D66D81' }} /><p className="text-sm" style={{ color: '#6B6B6E' }}>O relatório semanal estará disponível aos domingos a partir das 20h.</p></div> : <div className="grid grid-cols-2 gap-4"><div className="rounded-2xl p-5" style={{ background: '#FFFFFF' }}><BarChart3 size={18} style={{ color: '#D66D81' }} /><div className="text-2xl font-semibold mt-3" style={{ color: '#1C1C1E' }}>{sales.length}</div><div className="text-xs" style={{ color: '#A0A0A3' }}>Vendas pagas</div></div><div className="rounded-2xl p-5" style={{ background: '#FFFFFF' }}><div className="text-2xl font-semibold" style={{ color: '#D66D81' }}>R$ {revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div><div className="text-xs mt-2" style={{ color: '#A0A0A3' }}>Receita dos últimos 7 dias</div></div></div>}
    </div>
  );
}
