import { useEffect, useMemo, useRef, useState } from 'react';
import { ArrowLeft, CalendarDays, CreditCard, Plus, Trash2, Wallet, Banknote, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Product } from '../lib/types';

type PaymentMethod = 'pix' | 'card_credit' | 'card_debit' | 'cash';
type Sale = { id: string; sale_number: number; total: number; created_at: string; seller_name: string | null; sale_items: { product_name_snapshot: string; quantity: number }[]; payments: { method: PaymentMethod }[] };
type DraftItem = { id: string; productId: string; quantity: string };

export default function SalesHistory({ onBack }: { onBack: () => void }) {
  const [sales, setSales] = useState<Sale[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [showForm, setShowForm] = useState(false);
  const nextItemId = useRef(2);
  const [items, setItems] = useState<DraftItem[]>([{ id: 'item-1', productId: '', quantity: '1' }]);
  const [saleDate, setSaleDate] = useState(new Date().toISOString().slice(0, 10));
  const [payment, setPayment] = useState<PaymentMethod>('pix');
  const [finalTotal, setFinalTotal] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const load = async () => {
    const [{ data: saleData, error: saleError }, { data: productData }] = await Promise.all([
      supabase.from('sales').select('id, sale_number, total, created_at, seller_name, sale_items(product_name_snapshot, quantity), payments(method)').order('created_at', { ascending: false }),
      supabase.from('products').select('*, categories(name), inventory_levels(quantity, minimum_quantity)').eq('active', true).eq('sellable', true).order('name'),
    ]);
    if (saleError) setError(saleError.message);
    else setSales((saleData ?? []) as Sale[]);
    setProducts((productData ?? []) as Product[]);
  };

  useEffect(() => { void load(); }, []);

  const estimatedTotal = useMemo(() => {
    const subtotal = items.reduce((sum, item) => {
      const product = products.find((candidate) => candidate.id === item.productId);
      return sum + (product ? Number(product.sale_price) * (Number(item.quantity) || 0) : 0);
    }, 0);
    return finalTotal === '' ? subtotal : Math.max(0, Math.min(Number(finalTotal) || 0, subtotal));
  }, [items, products, finalTotal]);

  const addItem = () => setItems((current) => [...current, { id: `item-${nextItemId.current++}`, productId: '', quantity: '1' }]);
  const updateItem = (index: number, patch: Partial<DraftItem>) => setItems((current) => current.map((item, itemIndex) => itemIndex === index ? { ...item, ...patch } : item));

  const registerPastSale = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    setLoading(true);
    const { data: membership, error: membershipError } = await supabase.from('store_users').select('store_id').limit(1).single();
    if (membershipError || !membership) {
      setError(membershipError?.message ?? 'Loja não encontrada.');
      setLoading(false);
      return;
    }
    const date = new Date(`${saleDate}T12:00:00`).toISOString();
    const { error: insertError } = await supabase.rpc('record_historical_sale', {
      p_store_id: membership.store_id, p_payment_method: payment,
      p_discount_percent: 0, p_sale_date: date, p_final_total: estimatedTotal,
      p_items: items.map((item) => ({ product_id: item.productId, quantity: Number(item.quantity) })),
    });
    setLoading(false);
    if (insertError) { setError(insertError.message); return; }
    setShowForm(false);
    setMessage('Venda passada adicionada com sucesso.');
    setItems([{ id: 'item-1', productId: '', quantity: '1' }]);
    await load();
  };

  const removeSale = async (id: string) => {
    if (!window.confirm('Excluir esta venda? O estoque será devolvido automaticamente.')) return;
    const { error: deleteError } = await supabase.rpc('delete_sale', { p_sale_id: id });
    if (deleteError) setError(deleteError.message);
    else { setMessage('Venda excluída e estoque restaurado.'); await load(); }
  };

  const paymentLabel = (method?: PaymentMethod) => method === 'card' ? 'Cartão' : method === 'cash' ? 'Dinheiro' : 'Pix';

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
          <button onClick={onBack} className="flex items-center gap-1 text-xs mb-3" style={{ color: '#D66D81' }}><ArrowLeft size={14} /> Voltar para Vendas & PDV</button>
          <h1 className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-display)', color: '#1C1C1E' }}>Histórico de vendas</h1>
          <p className="text-sm mt-1" style={{ color: '#A0A0A3' }}>Consulte, registre vendas antigas ou exclua lançamentos de teste.</p>
        </div>
        <button onClick={() => { setShowForm(true); setMessage(''); setError(''); }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg, #E28B9B, #D66D81)' }}><Plus size={16} /> Adicionar venda passada</button>
      </div>
      {message && <div className="rounded-xl px-4 py-3 text-sm" style={{ background: '#F9E8EC', color: '#D66D81' }}>{message}</div>}
      {error && <div className="rounded-xl px-4 py-3 text-sm" style={{ background: '#FDE0E2', color: '#C94B5F' }}>{error}</div>}

      <div className="rounded-2xl overflow-hidden" style={{ background: '#FFFFFF', border: '1px solid rgba(252, 211, 217, 0.4)' }}>
        {sales.length === 0 ? <div className="p-10 text-center text-sm" style={{ color: '#A0A0A3' }}>Nenhuma venda registrada.</div> : sales.map((sale) => (
          <div key={sale.id} className="flex items-center gap-4 p-4 border-b last:border-b-0" style={{ borderColor: 'rgba(252, 211, 217, 0.3)' }}>
            <div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#FDE0E2', color: '#D66D81' }}><CalendarDays size={17} /></div>
            <div className="flex-1 min-w-0"><div className="text-sm font-semibold" style={{ color: '#1C1C1E' }}>Venda #{sale.sale_number}</div><div className="text-xs truncate" style={{ color: '#A0A0A3' }}>{new Date(sale.created_at).toLocaleDateString('pt-BR')} · {sale.sale_items?.map((item) => `${item.product_name_snapshot} (${item.quantity})`).join(', ')}</div><div className="text-xs mt-0.5" style={{ color: '#A0A0A3' }}>Vendedor: {sale.seller_name ?? 'Não informado'}</div></div>
            <div className="hidden sm:block text-xs" style={{ color: '#6B6B6E' }}>{paymentLabel(sale.payments?.[0]?.method)}</div>
            <div className="text-sm font-semibold" style={{ color: '#D66D81' }}>R$ {Number(sale.total).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div>
            <button onClick={() => void removeSale(sale.id)} className="p-2 rounded-lg hover:bg-pink-50" title="Excluir venda"><Trash2 size={15} style={{ color: '#C94B5F' }} /></button>
          </div>
        ))}
      </div>

      {showForm && <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20">
        <form onSubmit={registerPastSale} className="w-full max-w-lg rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto" style={{ background: '#FFFFFF' }}>
          <div className="flex items-center justify-between"><h2 className="font-semibold" style={{ color: '#1C1C1E' }}>Adicionar venda passada</h2><button type="button" onClick={() => setShowForm(false)}><X size={18} style={{ color: '#A0A0A3' }} /></button></div>
          <div><label className="text-xs" style={{ color: '#6B6B6E' }}>Data da venda</label><input required type="date" max={new Date().toISOString().slice(0, 10)} value={saleDate} onChange={(event) => setSaleDate(event.target.value)} className="w-full mt-1 px-3 py-2.5 rounded-xl text-sm" style={{ background: '#FEF7F1', border: '1px solid #F9E8EC' }} /></div>
          <div className="space-y-2"><div className="flex items-center justify-between"><label className="text-xs" style={{ color: '#6B6B6E' }}>Produtos vendidos</label><button type="button" onClick={addItem} className="text-xs font-medium" style={{ color: '#D66D81' }}>+ Adicionar item</button></div>
            {items.map((item, index) => <div key={item.id} className="flex gap-2"><select required value={item.productId} onChange={(event) => updateItem(index, { productId: event.target.value })} className="flex-1 px-3 py-2.5 rounded-xl text-sm" style={{ background: '#FEF7F1', border: '1px solid #F9E8EC' }}><option value="">Selecione o produto</option>{products.map((product) => <option key={product.id} value={product.id}>{product.name} — R$ {Number(product.sale_price).toLocaleString('pt-BR')}</option>)}</select><input required min="1" type="number" value={item.quantity} onChange={(event) => updateItem(index, { quantity: event.target.value })} className="w-20 px-3 py-2.5 rounded-xl text-sm" style={{ background: '#FEF7F1', border: '1px solid #F9E8EC' }} />{items.length > 1 && <button type="button" onClick={() => setItems((current) => current.filter((candidate) => candidate.id !== item.id))}><Trash2 size={15} style={{ color: '#C94B5F' }} /></button>}</div>)}
          </div>
          <div className="grid grid-cols-2 gap-3"><div><label className="text-xs" style={{ color: '#6B6B6E' }}>Valor final</label><input min="0" type="number" step="0.01" value={finalTotal} onChange={(event) => setFinalTotal(event.target.value)} placeholder={estimatedTotal.toFixed(2)} className="w-full mt-1 px-3 py-2.5 rounded-xl text-sm" style={{ background: '#FEF7F1', border: '1px solid #F9E8EC' }} /></div><div><label className="text-xs" style={{ color: '#6B6B6E' }}>Pagamento</label><select value={payment} onChange={(event) => setPayment(event.target.value as PaymentMethod)} className="w-full mt-1 px-3 py-2.5 rounded-xl text-sm" style={{ background: '#FEF7F1', border: '1px solid #F9E8EC' }}><option value="pix">Pix</option><option value="card_credit">Cartão de crédito</option><option value="card_debit">Cartão de débito</option><option value="cash">Dinheiro</option></select></div></div>
          <div className="flex justify-between text-sm font-semibold pt-2" style={{ color: '#D66D81' }}><span>Total estimado</span><span>R$ {estimatedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
          <button disabled={loading} className="w-full py-3 rounded-xl text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg, #E28B9B, #D66D81)' }}>{loading ? 'Salvando...' : 'Registrar venda'}</button>
        </form>
      </div>}
    </div>
  );
}
