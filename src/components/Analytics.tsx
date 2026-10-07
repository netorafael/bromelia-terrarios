import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, ShoppingBag } from 'lucide-react';
import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload?.length) {
    return (
      <div
        className="px-3 py-2 rounded-xl text-xs"
        style={{
          background: 'white',
          border: '1px solid rgba(252, 211, 217, 0.5)',
          boxShadow: '0 4px 16px rgba(214, 109, 129, 0.12)',
        }}
      >
        <div className="font-medium mb-1" style={{ color: '#6B6B6E' }}>{label}</div>
        {payload.map((p: any, i: number) => (
          <div key={i} style={{ color: p.color ?? '#D66D81' }}>
            {p.dataKey === 'receita'
              ? `R$ ${p.value.toLocaleString('pt-BR')}`
              : `${p.value} pedidos`}
          </div>
        ))}
      </div>
    );
  }
  return null;
};

export default function Analytics() {
  const [dadosMensais, setDadosMensais] = useState<{ mes: string; receita: number; pedidos: number }[]>([]);
  const [topProdutos, setTopProdutos] = useState<{ name: string; vendas: number; percentual: number }[]>([]);
  const [totalRevenue, setTotalRevenue] = useState(0);
  const [totalOrders, setTotalOrders] = useState(0);

  useEffect(() => {
    const loadAnalytics = async () => {
      const { data, error } = await supabase.from('sales').select('total, status, created_at, sale_items(product_name_snapshot, quantity, unit_price, unit_cost_snapshot)').order('created_at');
      if (error) return;
      const paid = (data ?? []).filter((sale: any) => sale.status === 'paid');
      setTotalRevenue(paid.reduce((sum: number, sale: any) => sum + Number(sale.total), 0));
      setTotalOrders(paid.length);
      const monthly = new Map<string, { receita: number; pedidos: number }>();
      const products = new Map<string, { vendas: number; revenue: number; cost: number }>();
      paid.forEach((sale: any) => {
        const month = new Date(sale.created_at).toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
        const current = monthly.get(month) ?? { receita: 0, pedidos: 0 };
        monthly.set(month, { receita: current.receita + Number(sale.total), pedidos: current.pedidos + 1 });
        (sale.sale_items ?? []).forEach((item: any) => {
          const currentProduct = products.get(item.product_name_snapshot) ?? { vendas: 0, revenue: 0, cost: 0 };
          products.set(item.product_name_snapshot, {
            vendas: currentProduct.vendas + Number(item.quantity),
            revenue: currentProduct.revenue + Number(item.unit_price) * Number(item.quantity),
            cost: currentProduct.cost + Number(item.unit_cost_snapshot) * Number(item.quantity),
          });
        });
      });
      const totalUnitsSold = [...products.values()].reduce((sum, product) => sum + product.vendas, 0);
      setDadosMensais(Array.from(monthly, ([mes, values]) => ({ mes, ...values })));
      setTopProdutos(
        Array.from(products, ([name, values]) => ({
          name,
          vendas: values.vendas,
          percentual: totalUnitsSold ? Math.round((values.vendas / totalUnitsSold) * 100) : 0,
        }))
          .sort((a, b) => b.vendas - a.vendas || a.name.localeCompare(b.name))
          .slice(0, 5),
      );
    };
    void loadAnalytics();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1
          className="text-2xl font-semibold"
          style={{ fontFamily: 'var(--font-display)', color: '#1C1C1E' }}
        >
          Análises
        </h1>
        <p className="text-sm mt-1" style={{ color: '#A0A0A3' }}>
          Desempenho geral — Jan a Set 2026
        </p>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {[
          { label: 'Receita Total', value: `R$ ${totalRevenue.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`, sub: 'Vendas pagas', icon: TrendingUp },
          { label: 'Total de Pedidos', value: `${totalOrders}`, sub: 'Vendas pagas', icon: ShoppingBag },
        ].map(({ label, value, sub, icon: Icon }) => (
          <div
            key={label}
            className="rounded-2xl p-4"
            style={{
              background: '#FFFFFF',
              border: '1px solid rgba(252, 211, 217, 0.4)',
              boxShadow: '0 1px 8px rgba(214, 109, 129, 0.06)',
            }}
          >
            <div
              className="w-8 h-8 rounded-xl flex items-center justify-center mb-3"
              style={{ background: '#FDE0E2' }}
            >
              <Icon size={15} style={{ color: '#D66D81' }} />
            </div>
            <div
              className="text-xl font-semibold"
              style={{ fontFamily: 'var(--font-display)', color: '#1C1C1E' }}
            >
              {value}
            </div>
            <div className="text-xs mt-0.5" style={{ color: '#A0A0A3' }}>{label}</div>
            <div className="text-xs mt-1" style={{ color: '#D66D81' }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Gráficos */}
      <div>
        <div
          className="rounded-2xl p-5"
          style={{
            background: '#FFFFFF',
            border: '1px solid rgba(252, 211, 217, 0.4)',
            boxShadow: '0 1px 8px rgba(214, 109, 129, 0.06)',
          }}
        >
          <div className="font-semibold text-sm mb-1" style={{ fontFamily: 'var(--font-display)', color: '#1C1C1E' }}>
            Receita Mensal
          </div>
          <div className="text-xs mb-5" style={{ color: '#A0A0A3' }}>Faturamento em R$</div>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={dadosMensais} barSize={20} margin={{ left: -20 }}>
              <XAxis dataKey="mes" tick={{ fontSize: 11, fill: '#A0A0A3' }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: '#A0A0A3' }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v/1000).toFixed(0)}k`} />
              <Tooltip content={<CustomTooltip />} />
              <Bar dataKey="receita" fill="#E28B9B" radius={[6, 6, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Top Produtos */}
      <div
        className="rounded-2xl p-5"
        style={{
          background: '#FFFFFF',
          border: '1px solid rgba(252, 211, 217, 0.4)',
          boxShadow: '0 1px 8px rgba(214, 109, 129, 0.06)',
        }}
      >
        <div className="font-semibold text-sm mb-4" style={{ fontFamily: 'var(--font-display)', color: '#1C1C1E' }}>
          Desempenho por Produto
        </div>
        <div className="space-y-4">
          {topProdutos.map((p, i) => (
            <div key={p.name} className="flex items-center gap-4">
              <div
                className="w-6 h-6 rounded-lg flex items-center justify-center text-xs font-medium flex-shrink-0"
                style={{ background: '#FDE0E2', color: '#D66D81' }}
              >
                {i + 1}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between mb-1">
                  <span className="text-xs font-medium truncate" style={{ color: '#1C1C1E' }}>{p.name}</span>
                  <span className="text-xs ml-2 flex-shrink-0" style={{ color: '#A0A0A3' }}>{p.vendas} vendas</span>
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: '#FDE0E2' }}>
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${p.percentual}%`,
                      background: 'linear-gradient(90deg, #E28B9B, #D66D81)',
                    }}
                  />
                </div>
              </div>
              <div
                className="flex-shrink-0 px-2 py-0.5 rounded-lg text-xs font-medium"
                style={{ background: '#F9E8EC', color: '#D66D81' }}
              >
                {p.percentual}%
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
