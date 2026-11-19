import { useEffect, useRef, useState } from 'react';
import { ShoppingBag, ShoppingCart, Plus, Minus, Trash2, CreditCard, Wallet, Banknote, CheckCircle, History, Wrench, Search, ChevronDown, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { MaintenanceOrder, Product } from '../lib/types';
import { productImage, productPlaceholder } from '../lib/productPlaceholder';

type PaymentMethod = 'pix' | 'card_credit' | 'card_debit' | 'cash';

function formatMoneyInput(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(digits) / 100);
}

function parseMoney(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits ? Number(digits) / 100 : 0;
}

interface CartItem {
  id: string;
  name: string;
  price: number;
  cost: number;
  sku: string;
  qty: number;
  kind: 'product' | 'maintenance' | 'thumbnail';
}

interface SalesProps {
  isAdmin: boolean;
  onViewHistory: () => void;
  maintenance?: MaintenanceOrder | null;
  onBackToMaintenance?: () => void;
}

type PastDraftItem = { id: string; productId: string; quantity: string };

export default function Sales({ isAdmin, onViewHistory, maintenance = null, onBackToMaintenance }: SalesProps) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loadError, setLoadError] = useState('');
  const [cart, setCart] = useState<CartItem[]>([]);
  const [payment, setPayment] = useState<PaymentMethod>('pix');
  const [success, setSuccess] = useState(false);
  const [finalTotal, setFinalTotal] = useState('');
  const [todaySales, setTodaySales] = useState({ count: 0, total: 0 });
  const [maintenancePaid, setMaintenancePaid] = useState(false);
  const [cartVisible, setCartVisible] = useState(false);
  const cartRef = useRef<HTMLDivElement>(null);
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [showPastForm, setShowPastForm] = useState(false);
  const [pastItems, setPastItems] = useState<PastDraftItem[]>([{ id: 'past-1', productId: '', quantity: '1' }]);
  const [pastDate, setPastDate] = useState(new Date().toISOString().slice(0, 10));
  const [pastPayment, setPastPayment] = useState<PaymentMethod>('pix');
  const [pastFinalTotal, setPastFinalTotal] = useState('');
  const [savingPast, setSavingPast] = useState(false);
  const [showThumbnailPrice, setShowThumbnailPrice] = useState(false);
  const [thumbnailPrice, setThumbnailPrice] = useState('');

  useEffect(() => {
    if (maintenance) {
      setCart([{
        id: `maintenance-${maintenance.id}`,
        name: `Manutenção de ${maintenance.customer_name}`,
        price: Number(maintenance.amount),
        cost: 0,
        sku: maintenance.code,
        qty: 1,
        kind: 'maintenance',
      }]);
    }
  }, [maintenance]);

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

  useEffect(() => {
    const cartElement = cartRef.current;
    if (!cartElement) return;
    const observer = new IntersectionObserver(([entry]) => setCartVisible(entry.isIntersecting), { threshold: 0.35 });
    observer.observe(cartElement);
    return () => observer.disconnect();
  }, [maintenance, products.length]);

  const addToCart = (product: Product) => {
    setCart((prev) => {
      const existing = prev.find((i) => i.id === product.id);
      if (existing) {
        return prev.map((i) => i.id === product.id ? { ...i, qty: i.qty + 1 } : i);
      }
      return [...prev, { id: product.id, name: product.name, price: Number(product.sale_price), cost: Number(product.cost_price), sku: product.sku, qty: 1, kind: 'product' }];
    });
  };

  const updateQty = (id: string, delta: number) => {
    setCart((prev) =>
      prev
        .map((i) => i.id === id ? { ...i, qty: i.qty + delta } : i)
        .filter((i) => i.qty > 0)
    );
  };

  const removeItem = (id: string) => setCart((prev) => prev.filter((i) => i.id !== id));

  const addThumbnail = () => {
    const price = parseMoney(thumbnailPrice);
    if (price <= 0) {
      setLoadError('Informe o preço da miniatura.');
      return;
    }
    setCart((prev) => {
      const existing = prev.find((item) => item.kind === 'thumbnail');
      if (existing) return prev.map((item) => item.kind === 'thumbnail' ? { ...item, price, qty: item.qty + 1 } : item);
      return [...prev, {
        id: `thumbnail-${Date.now()}`,
        name: 'Miniatura',
        price,
        cost: 0,
        sku: 'MINIATURA',
        qty: 1,
        kind: 'thumbnail',
      }];
    });
    setThumbnailPrice('');
    setShowThumbnailPrice(false);
  };

  const pastSubtotal = pastItems.reduce((sum, item) => {
    const product = products.find((candidate) => candidate.id === item.productId);
    return sum + (product ? Number(product.sale_price) * (Number(item.quantity) || 0) : 0);
  }, 0);
  const pastEstimatedTotal = pastFinalTotal === '' ? pastSubtotal : Math.max(0, Math.min(Number(pastFinalTotal) || 0, pastSubtotal));

  const registerPastSale = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoadError('');
    setSavingPast(true);
    const { data: membership, error: membershipError } = await supabase
      .from('store_users')
      .select('store_id')
      .eq('user_id', (await supabase.auth.getUser()).data.user?.id ?? '')
      .limit(1)
      .single();
    if (membershipError || !membership) {
      setLoadError(membershipError?.message ?? 'Usuário não está associado a uma loja.');
      setSavingPast(false);
      return;
    }
    const date = new Date(`${pastDate}T12:00:00`).toISOString();
    const { error } = await supabase.rpc('record_historical_sale', {
      p_store_id: membership.store_id,
      p_payment_method: pastPayment,
      p_discount_percent: 0,
      p_sale_date: date,
      p_final_total: pastEstimatedTotal,
      p_items: pastItems.map((item) => ({ product_id: item.productId, quantity: Number(item.quantity) })),
    });
    setSavingPast(false);
    if (error) {
      setLoadError(error.message);
      return;
    }
    setShowPastForm(false);
    setPastItems([{ id: 'past-1', productId: '', quantity: '1' }]);
    setPastFinalTotal('');
  };

  const subtotal = cart.reduce((sum, i) => sum + i.price * i.qty, 0);
  const total = finalTotal === '' ? subtotal : Math.max(0, Math.min(parseMoney(finalTotal), subtotal));

  const finalizeSale = async () => {
    if (cart.length === 0) return;
    if (maintenance) {
      const { error } = await supabase.rpc('record_maintenance_payment', {
        p_maintenance_order_id: maintenance.id,
        p_payment_method: payment,
      });
      if (error) {
        setLoadError(error.message);
        return;
      }
      setMaintenancePaid(true);
      setSuccess(true);
      setTimeout(() => {
        setSuccess(false);
        setCart([]);
        setMaintenancePaid(false);
        onBackToMaintenance?.();
      }, 2500);
      return;
    }
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
      p_items: cart.map((item) => item.kind === 'thumbnail'
        ? { kind: 'thumbnail', name: item.name, price: item.price, quantity: item.qty }
        : { kind: 'product', product_id: item.id, quantity: item.qty }),
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
          <div className="text-sm mt-1" style={{ color: '#59595D' }}>
            {maintenancePaid ? 'Manutenção paga: ' : ''}R$ {total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })} via{' '}
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
        <p className="text-sm mt-1" style={{ color: '#59595D' }}>
          Controle de caixa e vendas
        </p>
        </div>
        {isAdmin && (
          <div className="flex flex-col items-end gap-2">
            <button onClick={() => setShowPastForm(true)} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-white" style={{ background: 'linear-gradient(135deg, #E28B9B, #D66D81)' }}>
              <Plus size={15} /> Adicionar venda passada
            </button>
            <button onClick={onViewHistory} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium" style={{ background: '#FDE0E2', color: '#D66D81' }}>
              <History size={15} /> Histórico de vendas
            </button>
          </div>
        )}
      </div>
      {loadError && <div className="rounded-xl px-4 py-3 text-sm" style={{ background: '#FDE0E2', color: '#C94B5F' }}>{loadError}</div>}
      {maintenance && <div className="rounded-2xl p-4 flex items-center gap-3" style={{ background: '#F9E8EC', border: '1px solid rgba(214, 109, 129, 0.25)' }}><div className="w-10 h-10 rounded-xl flex items-center justify-center" style={{ background: '#FDE0E2' }}><Wrench size={17} style={{ color: '#D66D81' }} /></div><div className="flex-1 min-w-0"><div className="text-sm font-semibold" style={{ color: '#1C1C1E' }}>Pagamento de manutenção</div><div className="text-xs mt-0.5 truncate" style={{ color: '#454549' }}>{maintenance.customer_name} · {maintenance.terrarium}</div></div><div className="text-sm font-semibold" style={{ color: '#D66D81' }}>R$ {Number(maintenance.amount).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</div></div>}
      <div className="rounded-2xl p-4" style={{ background: '#FFFFFF', border: '1px solid rgba(252, 211, 217, 0.4)' }}>
        <div className="text-xs" style={{ color: '#59595D' }}>Vendas realizadas hoje</div>
        <div className="text-xl font-semibold mt-1" style={{ fontFamily: 'var(--font-display)', color: '#1C1C1E' }}>
          {todaySales.count} vendas · R$ {todaySales.total.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}
        </div>
      </div>

      {!maintenance && (
        <div className="space-y-3">
          <div className="flex gap-3">
            <div className="flex-1 relative">
              <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#59595D' }} />
              <input type="text" placeholder="Buscar por nome..." value={busca} onChange={(event) => setBusca(event.target.value)} className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none" style={{ background: 'white', border: '1px solid rgba(252,211,217,0.5)', color: '#1C1C1E' }} />
            </div>
            <button type="button" onClick={() => setMostrarFiltros((current) => !current)} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium" style={{ background: mostrarFiltros || filtroCategoria ? '#F9E8EC' : 'white', border: mostrarFiltros || filtroCategoria ? '1.5px solid #D66D81' : '1px solid rgba(252,211,217,0.5)', color: mostrarFiltros || filtroCategoria ? '#D66D81' : '#454549' }}>
              <span className="hidden sm:inline">Filtros</span>
              {filtroCategoria && <span className="w-4 h-4 rounded-full text-xs flex items-center justify-center font-bold" style={{ background: '#D66D81', color: 'white' }}>1</span>}
              <ChevronDown size={13} className={`transition-transform ${mostrarFiltros ? 'rotate-180' : ''}`} />
            </button>
          </div>
          {mostrarFiltros && (
            <div className="rounded-2xl p-4 flex flex-wrap items-center gap-2" style={{ background: '#FFFFFF', border: '1px solid rgba(252,211,217,0.4)' }}>
              {[ 'Todas', ...Array.from(new Set(products.map((product) => product.categories?.name).filter((name): name is string => Boolean(name)))) ].map((category) => (
                <button key={category} type="button" onClick={() => setFiltroCategoria(category === 'Todas' ? '' : category)} className="px-3 py-1.5 rounded-full text-xs" style={{ background: (!filtroCategoria && category === 'Todas') || filtroCategoria === category ? '#F9E8EC' : '#FEF7F1', color: filtroCategoria === category || (!filtroCategoria && category === 'Todas') ? '#D66D81' : '#454549', border: filtroCategoria === category || (!filtroCategoria && category === 'Todas') ? '1px solid #D66D81' : '1px solid rgba(252,211,217,0.5)' }}>{category}</button>
              ))}
            </div>
          )}
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Grade de Produtos */}
        <div className="lg:col-span-2">
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
            {products.filter((product) => {
              if (maintenance) return false;
              const matchesSearch = !busca || product.name.toLowerCase().includes(busca.toLowerCase());
              const matchesCategory = !filtroCategoria || product.categories?.name === filtroCategoria;
              return matchesSearch && matchesCategory;
            }).map((product) => {
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
                      src={productImage(product.image_url, product.name, product.categories?.name)}
                      alt={product.name}
                      className="w-full h-28 object-cover"
                      style={{ background: '#FDE0E2' }}
                      onError={(event) => {
                        event.currentTarget.onerror = null;
                        event.currentTarget.src = productPlaceholder(product.name, product.categories?.name);
                      }}
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
                    <div className="text-xs mt-0.5" style={{ color: '#59595D' }}>
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
          ref={cartRef}
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
            <div className="py-8 text-center text-sm" style={{ color: '#59595D' }}>
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
                    <div className="text-xs" style={{ color: '#59595D' }}>
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
                    <Trash2 size={13} style={{ color: '#707074' }} />
                  </button>
                </div>
              ))}
            </div>
          )}

          {/* Miniatura */}
          {!maintenance && (
            <div className="space-y-2">
              <button type="button" onClick={() => setShowThumbnailPrice((current) => !current)} className="flex items-center gap-2 text-xs font-medium" style={{ color: '#D66D81' }}>
                <Plus size={14} /> Adicionar miniatura
              </button>
              {showThumbnailPrice && (
                <div className="space-y-2">
                  <input type="text" inputMode="decimal" placeholder="R$ 0,00" value={thumbnailPrice} onChange={(event) => setThumbnailPrice(formatMoneyInput(event.target.value))} className="w-full px-3 py-2.5 rounded-xl text-sm" style={{ background: '#FEF7F1', border: '1px solid rgba(252, 211, 217, 0.5)', color: '#1C1C1E' }} />
                  <button type="button" onClick={addThumbnail} className="w-full py-2.5 rounded-xl text-xs font-semibold text-white" style={{ background: 'linear-gradient(135deg, #E28B9B, #D66D81)' }}>Adicionar ao carrinho</button>
                </div>
              )}
            </div>
          )}

          {/* Valor final */}
          <div>
            <div className="text-xs font-medium mb-2" style={{ color: '#454549' }}>
              Valor final da compra
            </div>
            <input
              type="text"
              inputMode="decimal"
              placeholder={formatMoneyInput(String(Math.round(subtotal * 100)))}
              value={finalTotal}
              onChange={(event) => setFinalTotal(formatMoneyInput(event.target.value))}
              className="w-full px-3 py-2.5 rounded-xl text-sm font-semibold outline-none"
              style={{ background: '#FEF7F1', border: '1px solid rgba(252, 211, 217, 0.5)', color: '#D66D81' }}
            />
          </div>

          {/* Forma de pagamento */}
          <div>
            <div className="text-xs font-medium mb-2" style={{ color: '#454549' }}>
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
                    color: payment === id ? '#D66D81' : '#59595D',
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
            <div className="flex justify-between text-xs" style={{ color: '#454549' }}>
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
              color: cart.length > 0 ? 'white' : '#707074',
              cursor: cart.length > 0 ? 'pointer' : 'not-allowed',
              boxShadow: cart.length > 0 ? '0 4px 16px rgba(214, 109, 129, 0.3)' : 'none',
            }}
          >
            Finalizar Venda
          </button>
        </div>
      </div>
      {showPastForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20">
          <form onSubmit={registerPastSale} className="w-full max-w-lg rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto" style={{ background: '#FFFFFF' }}>
            <div className="flex items-center justify-between">
              <h2 className="font-semibold" style={{ color: '#1C1C1E' }}>Adicionar venda passada</h2>
              <button type="button" onClick={() => setShowPastForm(false)}><X size={18} style={{ color: '#59595D' }} /></button>
            </div>
            <label className="block text-xs" style={{ color: '#454549' }}>Data da venda
              <input required type="date" max={new Date().toISOString().slice(0, 10)} value={pastDate} onChange={(event) => setPastDate(event.target.value)} className="w-full mt-1 px-3 py-2.5 rounded-xl text-sm" />
            </label>
            <div className="space-y-2">
              <div className="flex items-center justify-between"><label className="text-xs" style={{ color: '#454549' }}>Produtos vendidos</label><button type="button" onClick={() => setPastItems((current) => [...current, { id: `past-${Date.now()}`, productId: '', quantity: '1' }])} className="text-xs font-medium" style={{ color: '#D66D81' }}>+ Adicionar item</button></div>
              {pastItems.map((item, index) => (
                <div key={item.id} className="flex gap-2">
                  <select required value={item.productId} onChange={(event) => setPastItems((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, productId: event.target.value } : entry))} className="flex-1 px-3 py-2.5 rounded-xl text-sm">
                    <option value="">Selecione o produto</option>
                    {products.map((product) => <option key={product.id} value={product.id}>{product.name} — R$ {Number(product.sale_price).toLocaleString('pt-BR')}</option>)}
                  </select>
                  <input required min="1" type="number" value={item.quantity} onChange={(event) => setPastItems((current) => current.map((entry, entryIndex) => entryIndex === index ? { ...entry, quantity: event.target.value } : entry))} className="w-20 px-3 py-2.5 rounded-xl text-sm" />
                  {pastItems.length > 1 && <button type="button" onClick={() => setPastItems((current) => current.filter((entry) => entry.id !== item.id))}><Trash2 size={15} style={{ color: '#C94B5F' }} /></button>}
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs" style={{ color: '#454549' }}>Valor final<input min="0" type="number" step="0.01" value={pastFinalTotal} onChange={(event) => setPastFinalTotal(event.target.value)} placeholder={pastSubtotal.toFixed(2)} className="w-full mt-1 px-3 py-2.5 rounded-xl text-sm" /></label>
              <label className="text-xs" style={{ color: '#454549' }}>Pagamento<select value={pastPayment} onChange={(event) => setPastPayment(event.target.value as PaymentMethod)} className="w-full mt-1 px-3 py-2.5 rounded-xl text-sm"><option value="pix">Pix</option><option value="card_credit">Cartão de crédito</option><option value="card_debit">Cartão de débito</option><option value="cash">Dinheiro</option></select></label>
            </div>
            <div className="flex justify-between text-sm font-semibold" style={{ color: '#D66D81' }}><span>Total estimado</span><span>R$ {pastEstimatedTotal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}</span></div>
            <button type="submit" disabled={savingPast} className="w-full py-3 rounded-xl text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg, #E28B9B, #D66D81)' }}>{savingPast ? 'Salvando...' : 'Registrar venda'}</button>
          </form>
        </div>
      )}
      {cart.length > 0 && !cartVisible && !maintenance && (
        <button
          type="button"
          onClick={() => cartRef.current?.scrollIntoView({ behavior: 'smooth', block: 'center' })}
          className="fixed bottom-5 right-5 z-20 w-14 h-14 rounded-full flex items-center justify-center text-white shadow-xl transition-transform hover:scale-105 active:scale-95"
          style={{ background: 'linear-gradient(135deg, #E28B9B, #D66D81)', boxShadow: '0 8px 24px rgba(214, 109, 129, 0.38)' }}
          aria-label="Ir para o carrinho"
        >
          <ShoppingCart size={22} />
          <span className="absolute -top-1 -right-1 min-w-5 h-5 px-1 rounded-full flex items-center justify-center text-[11px] font-bold" style={{ background: '#D66D81', color: 'white', border: '2px solid #FEF7F1' }}>
            {cart.reduce((sum, item) => sum + item.qty, 0)}
          </span>
        </button>
      )}
    </div>
  );
}
