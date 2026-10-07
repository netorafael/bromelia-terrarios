import {
  TrendingUp,
  TrendingDown,
  Package,
  DollarSign,
  ArrowUpRight,
} from 'lucide-react';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

function MetricCard({
  label,
  value,
  change,
  positive,
  icon: Icon,
  accent,
  onClick,
}: {
  label: string;
  value: string;
  change: string;
  positive: boolean;
  icon: React.ElementType;
  accent?: boolean;
  onClick?: () => void;
}) {
  const isInteractive = Boolean(onClick);

  return (
    <div
      role={isInteractive ? 'button' : undefined}
      tabIndex={isInteractive ? 0 : undefined}
      onClick={onClick}
      onKeyDown={(event) => {
        if (isInteractive && (event.key === 'Enter' || event.key === ' ')) {
          event.preventDefault();
          onClick?.();
        }
      }}
      className="rounded-2xl p-5 flex flex-col gap-4"
      style={{
        background: accent ? 'linear-gradient(135deg, #E28B9B, #D66D81)' : '#FFFFFF',
        border: accent ? 'none' : '1px solid rgba(252, 211, 217, 0.4)',
        boxShadow: accent
          ? '0 4px 20px rgba(214, 109, 129, 0.3)'
          : '0 1px 8px rgba(214, 109, 129, 0.06)',
        cursor: isInteractive ? 'pointer' : undefined,
      }}
    >
      <div className="flex items-start justify-between">
        <div
          className="w-10 h-10 rounded-xl flex items-center justify-center"
          style={{ background: accent ? 'rgba(255,255,255,0.2)' : '#FDE0E2' }}
        >
          <Icon size={18} color={accent ? 'white' : '#D66D81'} strokeWidth={1.5} />
        </div>
        <div
          className="flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-lg"
          style={{
            background: accent ? 'rgba(255,255,255,0.2)' : (positive ? '#F9E8EC' : '#FDE0E2'),
            color: accent ? 'white' : (positive ? '#D66D81' : '#C94B5F'),
          }}
        >
          {positive ? <TrendingUp size={11} /> : <TrendingDown size={11} />}
          {change}
        </div>
      </div>
      <div>
        <div
          className="text-2xl font-semibold leading-tight"
          style={{ fontFamily: 'var(--font-display)', color: accent ? 'white' : '#1C1C1E' }}
        >
          {value}
        </div>
        <div className="text-xs mt-1" style={{ color: accent ? 'rgba(255,255,255,0.75)' : '#A0A0A3' }}>
          {label}
        </div>
      </div>
    </div>
  );
}

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div
        className="px-3 py-2 rounded-xl text-xs"
        style={{
          background: 'white',
          border: '1px solid rgba(252, 211, 217, 0.5)',
          boxShadow: '0 4px 16px rgba(214, 109, 129, 0.12)',
          color: '#1C1C1E',
        }}
      >
        <div className="font-medium">{label}</div>
        <div style={{ color: '#D66D81' }}>R$ {payload[0].value.toLocaleString('pt-BR')}</div>
      </div>
    );
  }
  return null;
};

interface DashboardProps {
  onViewReport: () => void;
}

export default function Dashboard({ onViewReport }: DashboardProps) {
  const [salesTrend, setSalesTrend] = useState<{ mes: string; receita: number }[]>([]);
  const [categoryData, setCategoryData] = useState<{ name: string; value: number; color: string }[]>([]);
  const [vendasRecentes, setVendasRecentes] = useState<{ id: string; item: string; qty: number; total: string; status: string }[]>([]);
  const [metrics, setMetrics] = useState({ revenue: 0, orders: 0, inventoryValue: 0, availableStock: 0 });

  useEffect(() => {
    const loadDashboard = async () => {
      const [{ data: sales }, { data: products }] = await Promise.all([
        supabase.from('sales').select('id, sale_number, total, status, created_at, sale_items(product_name_snapshot, quantity, products(categories(name)))').order('created_at', { ascending: false }).limit(100),
        supabase.from('products').select('cost_price, inventory_levels(quantity, minimum_quantity)').eq('active', true),
      ]);
      const paidSales = (sales ?? []).filter((sale: any) => sale.status === 'paid');
      const today = new Date();
      const salesToday = paidSales.filter((sale: any) => {
        const saleDate = new Date(sale.created_at);
        return saleDate.getFullYear() === today.getFullYear()
          && saleDate.getMonth() === today.getMonth()
          && saleDate.getDate() === today.getDate();
      });
      const revenueToday = salesToday.reduce((sum: number, sale: any) => sum + Number(sale.total), 0);
      const trend = new Map<string, number>();
      paidSales.forEach((sale: any) => {
        const month = new Date(sale.created_at).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
        trend.set(month, (trend.get(month) ?? 0) + Number(sale.total));
      });
      setSalesTrend(Array.from(trend, ([mes, receita]) => ({ mes, receita })).slice(-6));
      const categoryTotals = new Map<string, number>();
      paidSales.forEach((sale: any) => (sale.sale_items ?? []).forEach((item: any) => {
        const name = item.products?.categories?.name ?? 'Sem categoria';
        categoryTotals.set(name, (categoryTotals.get(name) ?? 0) + item.quantity);
      }));
      const categoryColors = ['#D66D81', '#E28B9B', '#FCD3D9', '#F9E8EC'];
      const totalCategoryItems = [...categoryTotals.values()].reduce((sum, value) => sum + value, 0);
      setCategoryData([...categoryTotals].map(([name, value], index) => ({
        name, value: totalCategoryItems ? Math.round(value / totalCategoryItems * 100) : 0, color: categoryColors[index % categoryColors.length],
      })));
      setVendasRecentes((sales ?? []).slice(0, 4).map((sale: any) => ({
        id: `#${String(sale.sale_number).padStart(3, '0')}`,
        item: sale.sale_items?.[0]?.product_name_snapshot ?? 'Venda',
        qty: sale.sale_items?.reduce((sum: number, item: any) => sum + item.quantity, 0) ?? 0,
        total: `R$ ${Number(sale.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
        status: sale.status === 'paid' ? 'Pago' : sale.status === 'pending' ? 'Pendente' : sale.status,
      })));
      const inventoryValue = (products ?? []).reduce((sum: number, product: any) => {
        const inventory = Array.isArray(product.inventory_levels) ? product.inventory_levels[0] : product.inventory_levels;
        return sum + Number(product.cost_price) * Number(inventory?.quantity ?? 0);
      }, 0);
      const availableStock = (products ?? []).reduce((sum: number, product: any) => {
        const inventory = Array.isArray(product.inventory_levels) ? product.inventory_levels[0] : product.inventory_levels;
        return sum + Number(inventory?.quantity ?? 0);
      }, 0);
      setMetrics({ revenue: revenueToday, orders: salesToday.length, inventoryValue, availableStock });
    };
    void loadDashboard();
  }, []);
  return (
    <div className="space-y-6">
      {/* Cabeçalho */}
      <div className="flex items-start justify-between">
        <div>
          <h1
            className="text-2xl font-semibold"
            style={{ fontFamily: 'var(--font-display)', color: '#1C1C1E' }}
          >
            Visão Geral
          </h1>
          <p className="text-sm mt-1" style={{ color: '#A0A0A3' }}>
            Dados reais da sua loja
          </p>
        </div>
        <button
          type="button"
          onClick={onViewReport}
          className="flex items-center gap-2 px-3 sm:px-4 py-2 rounded-xl text-sm font-medium transition-all hover:opacity-80 active:scale-95"
          style={{ background: '#FDE0E2', color: '#D66D81' }}
        >
          <ArrowUpRight size={14} />
          <span className="hidden sm:inline">Ver Relatório</span>
          <span className="sm:hidden">Relatório</span>
        </button>
      </div>

      {/* Cards de Métricas */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricCard label="Receita do dia" value={`R$ ${metrics.revenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} change="Ver detalhes" positive icon={DollarSign} accent onClick={onViewReport} />
        <MetricCard label="Vendas realizadas hoje" value={`${metrics.orders}`} change="Hoje" positive icon={Package} />
        <MetricCard label="Valor em Estoque" value={`R$ ${metrics.inventoryValue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`} change="Atual" positive icon={TrendingUp} />
        <MetricCard label="Estoque disponível" value={`${metrics.availableStock} itens`} change="Atual" positive icon={Package} />
      </div>

      {/* Gráficos */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Gráfico de Área */}
        <div
          className="lg:col-span-2 rounded-2xl p-5"
          style={{
            background: '#FFFFFF',
            border: '1px solid rgba(252, 211, 217, 0.4)',
            boxShadow: '0 1px 8px rgba(214, 109, 129, 0.06)',
          }}
        >
          <div className="mb-5">
            <div className="font-semibold text-sm" style={{ fontFamily: 'var(--font-display)', color: '#1C1C1E' }}>
              Tendência de Vendas
            </div>
            <div className="text-xs mt-0.5" style={{ color: '#A0A0A3' }}>Últimos 6 meses</div>
          </div>
          <ResponsiveContainer width="100%" height={180}>
            <AreaChart data={salesTrend} margin={{ top: 4, right: 0, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="pinkGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#D66D81" stopOpacity={0.25} />
                  <stop offset="100%" stopColor="#FDE0E2" stopOpacity={0.05} />
                </linearGradient>
              </defs>
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#A0A0A3' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#A0A0A3' }} axisLine={false} tickLine={false} tickFormatter={(v) => `R$${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Area
                type="monotone"
                dataKey="receita"
                stroke="#D66D81"
                strokeWidth={2}
                fill="url(#pinkGradient)"
                dot={{ fill: '#D66D81', r: 3, strokeWidth: 0 }}
                activeDot={{ r: 5, fill: '#D66D81', strokeWidth: 0 }}
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Gráfico Donut */}
        <div
          className="rounded-2xl p-5"
          style={{
            background: '#FFFFFF',
            border: '1px solid rgba(252, 211, 217, 0.4)',
            boxShadow: '0 1px 8px rgba(214, 109, 129, 0.06)',
          }}
        >
          <div className="font-semibold text-sm mb-1" style={{ fontFamily: 'var(--font-display)', color: '#1C1C1E' }}>
            Categorias
          </div>
          <div className="text-xs mb-3" style={{ color: '#A0A0A3' }}>Top vendas por tipo</div>
          <div className="flex justify-center">
            <PieChart width={150} height={150}>
              <Pie
                data={categoryData}
                cx={75} cy={75}
                innerRadius={48} outerRadius={70}
                paddingAngle={3}
                dataKey="value"
                strokeWidth={0}
              >
                {categoryData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
              </Pie>
            </PieChart>
          </div>
          <div className="space-y-2 mt-1">
            {categoryData.map((cat) => (
              <div key={cat.name} className="flex items-center gap-2 text-xs">
                <div className="w-2 h-2 rounded-full flex-shrink-0" style={{ background: cat.color }} />
                <span className="flex-1 truncate" style={{ color: '#6B6B6E' }}>{cat.name}</span>
                <span className="font-medium" style={{ color: '#1C1C1E' }}>{cat.value}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Vendas Recentes */}
      <div
        className="rounded-2xl"
        style={{
          background: '#FFFFFF',
          border: '1px solid rgba(252, 211, 217, 0.4)',
          boxShadow: '0 1px 8px rgba(214, 109, 129, 0.06)',
        }}
      >
        <div className="px-5 py-4 border-b" style={{ borderColor: 'rgba(252, 211, 217, 0.3)' }}>
          <div className="font-semibold text-sm" style={{ fontFamily: 'var(--font-display)', color: '#1C1C1E' }}>
            Vendas Recentes
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(252, 211, 217, 0.3)' }}>
                {['Pedido', 'Produto', 'Qtd', 'Total', 'Status'].map(h => (
                  <th key={h} className="px-5 py-3 text-left text-xs font-medium" style={{ color: '#A0A0A3' }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {vendasRecentes.map((venda) => (
                <tr
                  key={venda.id}
                  className="transition-colors hover:bg-pink-50"
                  style={{ borderBottom: '1px solid rgba(252, 211, 217, 0.2)' }}
                >
                  <td className="px-5 py-3 text-xs font-mono" style={{ color: '#A0A0A3' }}>{venda.id}</td>
                  <td className="px-5 py-3 font-medium" style={{ color: '#1C1C1E' }}>{venda.item}</td>
                  <td className="px-5 py-3" style={{ color: '#6B6B6E' }}>{venda.qty}</td>
                  <td className="px-5 py-3 font-medium" style={{ color: '#1C1C1E' }}>{venda.total}</td>
                  <td className="px-5 py-3">
                    <span
                      className="px-2.5 py-1 rounded-lg text-xs font-medium"
                      style={{
                        background: venda.status === 'Pago' ? '#F9E8EC' : '#FDE0E2',
                        color: venda.status === 'Pago' ? '#D66D81' : '#C94B5F',
                      }}
                    >
                      {venda.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
