import { useEffect, useState } from 'react';
import { ShoppingBag, Plus, Minus, Trash2, CreditCard, Wallet, Banknote, CheckCircle, History } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { Product } from '../lib/types';

type PaymentMethod = 'pix' | 'card_credit' | 'card_debit' | 'cash';

interface CartItem {
  id: string;
  name: string;
  price: number;
  cost: number;
  sku: string;
  qty: number;
}

export default function Sales({ isAdmin, onViewHistory }: { isAdmin: boolean; onViewHistory: () => void }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadError, setLoadError] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [payment, setPayment] = useState<PaymentMethod>('pix');
  const [success, setSuccess] = useState(false);
  const [finalTotal, setFinalTotal] = useState('');
  const [todaySales, setTodaySales] = useState({ count: 0, total: 0 });

  useEffect(() => {
    const loadProducts = async () => {
      const { data, error } = await supabase
        .from('products')
        .select('*, categories(name), inventory_levels(quantity, minimum_quantity)')
        .eq('active', true)
        .eq('sellable', true)
        .order('name');
      if (error) setLoadError(error.message);
      else setProducts((data ?? []) as Product[]);
    };
    void loadProducts();
  }, []);

  useEffect(() => {
    const loadTodaySales = async () => {
      const start = new Date();
      start.setHours(0, 0, 0, 0);
      const { data } = await supabase
        .from('sales')
        .select('total')
        .eq('status', 'paid')
        .gte('created_at', start.toISOString());
      setTodaySales({
        count: data?.length ?? 0,
        total: (data ?? []).reduce((sum, sale) => sum + Number(sale.total), 0),
      });
    };
    void loadTodaySales();
  }, [success]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { id: product.id, name: product.name, price: Number(product.sale_price), cost: Number(product.cost_price), sku: product.sku, qty: 1 }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => i.id === id ? { ...i, qty: i.qty + delta } : i)
        .filter((i) => i.qty > 0)
    );
  };

  const removeItem = (id: number) => setCart((prev) => prev.filter((i) => i.id !== id));

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const total = finalTotal === '' ? subtotal : Math.max(0, Math.min(Number(finalTotal) || 0, subtotal));

  const finalizeSale = async () => {
    if (cart.length === 0) return;
    const { data: membership, error: membershipError } = await supabase
      .from('store_users')
      .select('store_id')
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
      .limit(1)
      .single();
    if (membershipError || !membership) {
      setLoadError(membershipError?.message ?? 'Usuário não está associado a uma loja.');
      return;
    }
    const { error } = await supabase.rpc('finalize_sale', {
      p_store_id: membership.store_id,
      p_payment_method: payment,
      p_discount_percent: 0,
      p_items: cart.map((item) => ({ product_id: item.id, quantity: item.qty })),
      p_final_total: total,
    });
    if (error) {
      setLoadError(error.message);
      return;
    }
    setSuccess(true);
    setTimeout(() => {
      setSuccess(false);
      setCart([]);
      setPayment('pix');
      setFinalTotal('');
    }, 2500);
  };

  const paymentOptions: { id: PaymentMethod; label: string; icon: React.ElementType }[] = [
    { id: 'pix', label: 'Pix', icon: Wallet },
    { id: 'card_credit', label: 'Crédito', icon: CreditCard },
    { id: 'card_debit', label: 'Débito', icon: CreditCard },
    { id: 'cash', label: 'Dinheiro', icon: Banknote },
  ];

  if (success) {
    return (
      <div className="flex flex-col items-center justify-center h-96 gap-4">
        <div
          className="w-16 h-16 rounded-2xl flex items-center justify-center"
          style={{ background: '#F9E8EC' }}
        >
          <CheckCircle size={32} style={{ color: '#D66D81' }} />
        </div>
        <div className="text-center">
          <div className="font-semibold text-lg" style={{ fontFamily: 'var(--font-display)', color: '#1C1C1E' }}>
            Venda Finalizada!
          </div>
          <div className="text-sm mt-1" style={{ color: '#A0A0A3' }}>
            R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} via{' '}
            {            payment === 'pix' ? 'Pix' : payment === 'card_credit' ? 'Cartão de crédito' : payment === 'card_debit' ? 'Cartão de débito' : 'Dinheiro'}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-3">
        <div>
        <h1
          className="text-2xl font-semibold"
          style={{ fontFamily: 'var(--font-display)', color: '#1C1C1E' }}
        >
          Vendas
        </h1>
        <p className="text-sm mt-1" style={{ color: '#A0A0A3' }}>
          Controle de caixa e vendas
        </p>
        </div>
        {isAdmin && <button onClick={onViewHistory} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium" style={{ background: '#FDE0E2', color: '#D66D81' }}>
          <History size={15} /> Histórico de vendas
        </button>}
      </div>
      {loadError && <div className="rounded-xl px-4 py-3 text-sm" style={{ background: '#FDE0E2', color: '#C94B5F' }}>{loadError}</div>}
      <div className="rounded-2xl p-4" style={{ background: '#FFFFFF', border: '1px solid rgba(252, 211, 217, 0.4)' }}>
        <div className="text-xs" style={{ color: '#A0A0A3' }}>Vendas realizadas hoje</div>
        <div className="text-xl font-semibold mt-1" style={{ fontFamily: 'var(--font-display)', color: '#1C1C1E' }}>
          {todaySales.count} vendas · R$ {todaySales.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Grade de Produtos */}
        <div className="lg:col-span-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {products.map((product) => {
              const inCart = cart.find((i) => i.id === product.id);
              return (
                <div
                  key={product.id}
                  className="rounded-2xl overflow-hidden cursor-pointer transition-all duration-150 hover:scale-[1.01] active:scale-[0.99]"
                  style={{
                    background: '#FFFFFF',
                    border: inCart ? '1.5px solid #D66D81' : '1px solid rgba(252, 211, 217, 0.4)',
                    boxShadow: inCart
                      ? '0 4px 16px rgba(214, 109, 129, 0.18)'
                      : '0 1px 8px rgba(214, 109, 129, 0.06)',
                  }}
                  onClick={() => addToCart(product)}
                >
                  <div className="relative">
                    <img
                      src={product.image_url ?? 'https://images.unsplash.com/photo-1485955900006-10f4d324d411?w=200&h=200&fit=crop&auto=format'}
                      alt={product.name}
                      className="w-full h-28 object-cover"
                      style={{ background: '#FDE0E2' }}
                    />
                    {inCart && (
                      <div
                        className="absolute top-2 right-2 w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold"
                        style={{ background: '#D66D81', color: 'white' }}
                      >
                        {inCart.qty}
                      </div>
                    )}
                  </div>
                  <div className="p-3">
                    <div className="font-medium text-xs leading-tight" style={{ color: '#1C1C1E' }}>
                      {product.name}
                    </div>
                    <div className="text-xs mt-0.5" style={{ color: '#A0A0A3' }}>
                      {product.categories?.name ?? 'Sem categoria'}
                    </div>
                    <div className="flex items-center justify-between mt-2">
                      <span className="text-sm font-semibold" style={{ color: '#D66D81' }}>
                        R$ {Number(product.sale_price).toLocaleString('pt-BR')}
                      </span>
                      <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center"
                        style={{ background: '#FDE0E2' }}
                      >
                        <Plus size={12} style={{ color: '#D66D81' }} />
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Carrinho */}
        <div
          className="rounded-2xl p-5 flex flex-col gap-4 h-fit sticky top-6"
          style={{
            background: '#FFFFFF',
            border: '1px solid rgba(252, 211, 217, 0.4)',
            boxShadow: '0 1px 8px rgba(214, 109, 129, 0.06)',
          }}
        >
          <div className="flex items-center gap-2">
            <ShoppingBag size={16} style={{ color: '#D66D81' }} />
            <span className="font-semibold text-sm" style={{ fontFamily: 'var(--font-display)', color: '#1C1C1E' }}>
              Carrinho
            </span>
            {cart.length > 0 && (
              <span
                className="ml-auto px-2 py-0.5 rounded-lg text-xs font-medium"
                style={{ background: '#FDE0E2', color: '#D66D81' }}
              >
                {cart.reduce((s, i) => s + i.qty, 0)} itens
              </span>
            )}
          </div>

          {cart.length === 0 ? (
            <div className="py-8 text-center text-sm" style={{ color: '#A0A0A3' }}>
              Toque nos produtos para adicionar
            </div>
          ) : (
            <div className="space-y-2 max-h-56 overflow-y-auto">
              {cart.map((item) => (
                <div
                  key={item.id}
                  className="flex items-center gap-2 py-2.5 border-b"
                  style={{ borderColor: 'rgba(252, 211, 217, 0.3)' }}
                >
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium truncate" style={{ color: '#1C1C1E' }}>
                      {item.name}
                    </div>
                    <div className="text-xs" style={{ color: '#A0A0A3' }}>
                      R$ {(item.price * item.qty).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    <button
                      className="w-6 h-6 rounded-lg flex items-center justify-center"
                      style={{ background: '#FDE0E2' }}
                      onClick={() => updateQty(item.id, -1)}
                    >
                      <Minus size={10} style={{ color: '#D66D81' }} />
                    </button>
                    <span className="w-5 text-center text-xs font-semibold" style={{ color: '#1C1C1E' }}>
                      {item.qty}
                    </span>
                    <button
                      className="w-6 h-6 rounded-lg flex items-center justify-center"
                      style={{ background: '#FDE0E2' }}
                      onClick={() => updateQty(item.id, 1)}
                    >
                      <Plus size={10} style={{ color: '#D66D81' }} />
                    </button>
                  </div>
                  <button onClick={() => removeItem(item.id)} className="flex-shrink-0">
                    <Trash2 size={13} style={{ color: '#C0C0C3' }} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Valor final */}
          <div>
            <div className="text-xs font-medium mb-2" style={{ color: '#6B6B6E' }}>
              Valor final da compra
            </div>
            <input type="number" min="0" max={subtotal} step="0.01" placeholder={subtotal.toFixed(2)} value={finalTotal} onChange={(e) => setFinalTotal(e.target.value)} className="w-full px-3 py-2.5 rounded-xl text-sm font-semibold outline-none" style={{ background: '#FEF7F1', border: '1px solid rgba(252, 211, 217, 0.5)', color: '#D66D81' }} />
          </div>

          {/* Forma de pagamento */}
          <div>
            <div className="text-xs font-medium mb-2" style={{ color: '#6B6B6E' }}>
              Forma de Pagamento
            </div>
            <div className="grid grid-cols-3 gap-1.5">
              {paymentOptions.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setPayment(id)}
                  className="flex flex-col items-center gap-1.5 py-2.5 rounded-xl text-xs font-medium transition-all duration-150"
                  style={{
                    background: payment === id ? '#F9E8EC' : '#FEF7F1',
                    border: payment === id ? '1.5px solid #D66D81' : '1px solid rgba(252, 211, 217, 0.4)',
                    color: payment === id ? '#D66D81' : '#A0A0A3',
                  }}
                >
                  <Icon size={15} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Total */}
          <div
            className="pt-3 border-t space-y-2"
            style={{ borderColor: 'rgba(252, 211, 217, 0.3)' }}
          >
            <div className="flex justify-between text-xs" style={{ color: '#6B6B6E' }}>
              <span>Subtotal</span>
              <span>R$ {subtotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span>
            </div>
            <div className="flex justify-between font-semibold text-base pt-1" style={{ color: '#1C1C1E' }}>
              <span>Total</span>
              <span style={{ color: '#D66D81' }}>
                R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Finalizar */}
          <button
            onClick={finalizeSale}
            className="w-full py-3.5 rounded-xl text-sm font-semibold transition-all duration-150 active:scale-[0.98]"
            style={{
              background: cart.length > 0
                ? 'linear-gradient(135deg, #E28B9B, #D66D81)'
                : '#FDE0E2',
              color: cart.length > 0 ? 'white' : '#C0C0C3',
              cursor: cart.length > 0 ? 'pointer' : 'not-allowed',
              boxShadow: cart.length > 0 ? '0 4px 16px rgba(214, 109, 129, 0.3)' : 'none',
            }}
          >
            Finalizar Venda
          </button>
        </div>
      </div>
    </div>
  );
}
