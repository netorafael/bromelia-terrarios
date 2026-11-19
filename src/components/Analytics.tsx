import { useEffect, useState } from 'react';
import { BarChart3, CreditCard, Shapes, ShoppingBag, TrendingUp } from 'lucide-react';
import { Bar, BarChart, Cell, Pie, PieChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { supabase } from '../lib/supabase';

type Monthly = { mes: string; receita: number; lucro: number; pedidos: number };
type Breakdown = { name: string; value: number; amount: number; color: string };
const colors = ['#D66D81', '#E28B9B', '#FCD3D9', '#F9E8EC'];
const currency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

function TooltipContent({ active, payload, label }: any) {
  if (!active || !payload?.length) return null;
  return <div className="rounded-xl px-3 py-2 text-xs" style={{ background: 'rgba(255,255,255,.92)', border: '1px solid rgba(255,255,255,.8)', boxShadow: '0 10px 30px rgba(147,67,84,.14)' }}>
    <div className="font-semibold mb-1" style={{ color: '#1C1C1E' }}>{label}</div>
    {payload.map((item: any) => <div key={item.dataKey} style={{ color: item.color ?? '#D66D81' }}>{item.dataKey === 'pedidos' ? `${item.value} pedidos` : `${item.name === 'Lucro líquido' ? 'Lucro líquido' : 'Receita bruta'}: ${currency(Number(item.value))}`}</div>)}
  </div>;
}

function DonutPanel({ title, subtitle, icon: Icon, data }: { title: string; subtitle: string; icon: React.ElementType; data: Breakdown[] }) {
  return <div className="rounded-2xl p-5">
    <div className="flex items-center gap-2 mb-1"><Icon size={16} style={{ color: '#D66D81' }} /><div className="font-semibold text-sm" style={{ color: 'var(--app-text)' }}>{title}</div></div>
    <div className="text-xs mb-3" style={{ color: '#59595D' }}>{subtitle}</div>
    <div className="grid sm:grid-cols-[170px_1fr] items-center gap-3">
      <div className="flex justify-center"><PieChart width={160} height={160}><Pie data={data} dataKey="value" cx={80} cy={80} innerRadius={48} outerRadius={72} paddingAngle={3} strokeWidth={0}>{data.map((entry) => <Cell key={entry.name} fill={entry.color} />)}</Pie></PieChart></div>
      <div className="space-y-3">{data.map((item) => <div key={item.name} className="flex items-center gap-2"><div className="w-2.5 h-2.5 rounded-full" style={{ background: item.color }} /><span className="text-xs flex-1 truncate" style={{ color: '#454549' }}>{item.name}</span><span className="text-xs font-medium" style={{ color: 'var(--app-text)' }}>{item.value}%</span><span className="text-xs w-20 text-right" style={{ color: '#59595D' }}>{currency(item.amount)}</span></div>)}</div>
    </div>
  </div>;
}

export default function Analytics() {
  const [monthly, setMonthly] = useState<Monthly[]>([]);
  const [topProducts, setTopProducts] = useState<{ name: string; vendas: number; percentual: number }[]>([]);
  const [categories, setCategories] = useState<Breakdown[]>([]);
  const [payments, setPayments] = useState<Breakdown[]>([]);
  const [totals, setTotals] = useState({ revenue: 0, netRevenue: 0, orders: 0 });

  useEffect(() => {
    const load = async () => {
      const { data, error } = await supabase.from('sales').select('total, status, created_at, sale_items(product_name_snapshot, quantity, unit_price, unit_cost_snapshot), payments(method)').eq('status', 'paid').order('created_at');
      if (error) return;
      const productMap = new Map<string, number>();
      const categoryMap = new Map<string, number>();
      const paymentMap = new Map<string, number>();
      let revenue = 0;
      let netRevenue = 0;
      const now = new Date();
      const months = Array.from({ length: 6 }, (_, index) => {
        const date = new Date(now.getFullYear(), now.getMonth() - (5 - index), 1);
        return {
          key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`,
          mes: date.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', ''),
        };
      });
      const monthlyData = new Map(months.map(({ key, mes }) => [key, { mes, receita: 0, lucro: 0, pedidos: 0 }]));
      (data ?? []).forEach((sale: any) => {
        const total = Number(sale.total);
        revenue += total;
        const date = new Date(sale.created_at);
        const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}`;
        const current = monthlyData.get(key);
        let saleProfit = 0;
        (sale.sale_items ?? []).forEach((item: any) => {
          const quantity = Number(item.quantity) || 0;
          const profit = (Number(item.unit_price) - Number(item.unit_cost_snapshot)) * quantity;
          saleProfit += profit;
          netRevenue += profit;
          productMap.set(item.product_name_snapshot, (productMap.get(item.product_name_snapshot) ?? 0) + quantity);
        });
        if (current) {
          current.receita += total;
          current.lucro += saleProfit;
          current.pedidos += 1;
        }
        const payment = sale.payments?.[0]?.method ?? 'outro';
        paymentMap.set(payment, (paymentMap.get(payment) ?? 0) + total);
      });
      const totalUnits = [...productMap.values()].reduce((sum, value) => sum + value, 0);
      setTotals({ revenue, netRevenue, orders: data?.length ?? 0 });
      setMonthly(months.map(({ key }) => monthlyData.get(key) ?? { mes: '', receita: 0, lucro: 0, pedidos: 0 }));
      setTopProducts([...productMap].map(([name, vendas]) => ({ name, vendas, percentual: totalUnits ? Math.round(vendas / totalUnits * 100) : 0 })).sort((a, b) => b.vendas - a.vendas).slice(0, 5));
      setPayments([...paymentMap].map(([name, amount], index) => ({ name: name === 'card_credit' ? 'Crédito' : name === 'card_debit' ? 'Débito' : name === 'cash' ? 'Dinheiro' : 'Pix', amount, value: revenue ? Math.round(amount / revenue * 100) : 0, color: colors[index % colors.length] })));
      setCategories([]);
    };
    void load();
  }, []);

  return <div className="space-y-6">
    <div><h1 className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--app-text)' }}>Análises</h1><p className="text-sm mt-1" style={{ color: '#59595D' }}>Desempenho geral com base nas vendas pagas</p></div>
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">{[{ label: 'Receita Total', value: currency(totals.revenue), icon: TrendingUp }, { label: 'Total de Pedidos', value: `${totals.orders}`, icon: ShoppingBag }].map(({ label, value, icon: Icon }) => <div key={label} className="rounded-2xl p-4"><div className="w-8 h-8 rounded-xl flex items-center justify-center mb-3" style={{ background: '#FDE0E2' }}><Icon size={15} style={{ color: '#D66D81' }} /></div><div className="text-xl font-semibold" style={{ color: 'var(--app-text)' }}>{value}</div><div className="text-xs mt-1" style={{ color: '#59595D' }}>{label}</div><div className="text-xs mt-1" style={{ color: '#D66D81' }}>Vendas pagas</div></div>)}</div>
    <div className="rounded-2xl p-5">
      <div className="font-semibold text-sm mb-1" style={{ color: 'var(--app-text)' }}>Receita mensal bruta</div>
      <div className="text-xs mb-5" style={{ color: '#59595D' }}>Faturamento total</div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={monthly} barSize={24} margin={{ left: -20 }}>
          <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#59595D' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#59595D' }} axisLine={false} tickLine={false} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
          <Tooltip content={<TooltipContent />} />
          <Bar dataKey="receita" name="Receita bruta" fill="#E28B9B" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
    <div className="rounded-2xl p-5">
      <div className="font-semibold text-sm mb-1" style={{ color: 'var(--app-text)' }}>Receita mensal líquida</div>
      <div className="text-xs mb-5" style={{ color: '#59595D' }}>Lucro total</div>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={monthly} barSize={24} margin={{ left: -20 }}>
          <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#59595D' }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11, fill: '#59595D' }} axisLine={false} tickLine={false} tickFormatter={(value) => `${(value / 1000).toFixed(0)}k`} />
          <Tooltip content={<TooltipContent />} />
          <Bar dataKey="lucro" name="Lucro líquido" fill="#D66D81" radius={[8, 8, 0, 0]} />
        </BarChart>
      </ResponsiveContainer>
    </div>
    <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">{categories.length > 0 && <DonutPanel title="Vendas por categoria" subtitle="Participação na receita do período" data={categories} icon={Shapes} />}{payments.length > 0 && <DonutPanel title="Formas de pagamento" subtitle="Distribuição da receita por meio de pagamento" data={payments} icon={CreditCard} />}</div>
    <div className="rounded-2xl p-5"><div className="font-semibold text-sm mb-4" style={{ color: 'var(--app-text)' }}>Desempenho por produto</div><div className="space-y-4">{topProducts.map((product, index) => <div key={product.name} className="flex items-center gap-4"><div className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-medium" style={{ background: '#FDE0E2', color: '#D66D81' }}>{index + 1}</div><div className="flex-1 min-w-0"><div className="flex justify-between mb-1"><span className="text-xs font-medium truncate" style={{ color: 'var(--app-text)' }}>{product.name}</span><span className="text-xs ml-2" style={{ color: '#59595D' }}>{product.vendas} unidades</span></div><div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#FDE0E2' }}><div className="h-full rounded-full" style={{ width: `${product.percentual}%`, background: 'linear-gradient(90deg, #E28B9B, #D66D81)' }} /></div></div><span className="px-2 py-0.5 rounded-lg text-xs font-medium" style={{ background: '#F9E8EC', color: '#D66D81' }}>{product.percentual}%</span></div>)}</div></div>
  </div>;
}
