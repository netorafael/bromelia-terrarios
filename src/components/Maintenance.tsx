import { useEffect, useMemo, useState } from 'react';
import { Camera, CheckCircle2, ChevronLeft, Clock3, Pencil, Plus, Trash2, Wrench, X } from 'lucide-react';
import { supabase } from '../lib/supabase';
import type { MaintenanceOrder, MaintenanceStatus } from '../lib/types';
import { productImage } from '../lib/productPlaceholder';
import ConfirmDialog from './ConfirmDialog';

const statusFlow: MaintenanceStatus[] = [
  'received',
  'in_maintenance',
  'delivered',
];

const statusLabels: Record<MaintenanceStatus, string> = {
  received: 'Recebido',
  awaiting_approval: 'Aguardando aprovação',
  in_maintenance: 'Em manutenção',
  ready_for_pickup: 'Pronto para retirada',
  delivered: 'Entregue',
};

function displayStatusIndex(status: MaintenanceStatus) {
  if (status === 'received') return 0;
  if (status === 'delivered' || status === 'ready_for_pickup') return 2;
  return 1;
}

type FormState = {
  customer_name: string;
  phone: string;
  terrarium: string;
  services: string[];
  due_date: string;
  amount: string;
  notes: string;
  image_url: string;
};

const initialForm: FormState = {
  customer_name: '',
  phone: '',
  terrarium: '',
  services: [],
  due_date: '',
  amount: '',
  notes: '',
  image_url: '',
};

function formatCurrency(value: number) {
  return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function parseCurrency(value: string) {
  const digits = value.replace(/\D/g, '');
  return digits ? Number(digits) / 100 : 0;
}

function formatBrazilianDateInput(value: string) {
  const digits = value.replace(/\D/g, '').slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

function parseBrazilianDate(value: string) {
  const match = /^(\d{2})\/(\d{2})\/(\d{4})$/.exec(value);
  if (!match) return null;
  const [, day, month, year] = match;
  const date = new Date(Number(year), Number(month) - 1, Number(day));
  if (date.getFullYear() !== Number(year) || date.getMonth() !== Number(month) - 1 || date.getDate() !== Number(day)) return null;
  return `${year}-${month}-${day}`;
}

function formatDate(value: string) {
  return new Date(`${value}T12:00:00`).toLocaleDateString('pt-BR');
}

function formatIsoDateAsBrazilian(value: string) {
  const [year, month, day] = value.slice(0, 10).split('-');
  return day && month && year ? `${day}/${month}/${year}` : '';
}

interface MaintenanceProps {
  onSendToCheckout: (order: MaintenanceOrder) => void;
  isAdmin: boolean;
}

export default function Maintenance({ onSendToCheckout, isAdmin }: MaintenanceProps) {
  const [orders, setOrders] = useState<MaintenanceOrder[]>([]);
  const [form, setForm] = useState<FormState>(initialForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [orderToDelete, setOrderToDelete] = useState<MaintenanceOrder | null>(null);
  const [editingOrder, setEditingOrder] = useState<MaintenanceOrder | null>(null);
  const [showPastForm, setShowPastForm] = useState(false);
  const [pastReceivedDate, setPastReceivedDate] = useState(new Date().toISOString().slice(0, 10));

  const loadOrders = async () => {
    setLoading(true);
    const { data, error: loadError } = await supabase
      .from('maintenance_orders')
      .select('*')
      .order('created_at', { ascending: false });
    if (loadError) setError(loadError.message);
    else setOrders((data ?? []) as MaintenanceOrder[]);
    setLoading(false);
  };

  useEffect(() => {
    void loadOrders();
  }, []);

  const counts = useMemo(() => ({
    received: orders.filter((order) => order.status === 'received' || order.status === 'awaiting_approval').length,
    active: orders.filter((order) => order.status === 'in_maintenance').length,
    delivered: orders.filter((order) => order.status === 'delivered').length,
  }), [orders]);

  const closeForm = () => {
    setShowForm(false);
    setEditingOrder(null);
    setForm(initialForm);
  };

  const openEdit = (order: MaintenanceOrder) => {
    setEditingOrder(order);
    setForm({
      customer_name: order.customer_name,
      phone: order.phone ?? '',
      terrarium: order.terrarium,
      services: order.services ?? [],
      due_date: formatIsoDateAsBrazilian(order.due_date),
      amount: new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(Number(order.amount)),
      notes: order.notes ?? '',
      image_url: order.image_url ?? '',
    });
    setShowForm(true);
  };

  const createOrder = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const dueDate = parseBrazilianDate(form.due_date);
    if (!dueDate) {
      setError('Informe um prazo válido no formato dd/mm/aaaa.');
      return;
    }
    setSaving(true);
    const { data: membership, error: membershipError } = await supabase
      .from('store_users')
      .select('store_id')
      .limit(1)
      .single();
    if (membershipError || !membership) {
      setError(membershipError?.message ?? 'Loja não encontrada.');
      setSaving(false);
      return;
    }
    const { data: user } = await supabase.auth.getUser();
    const payload = {
      customer_name: form.customer_name.trim(),
      phone: form.phone.trim() || null,
      terrarium: form.terrarium.trim(),
      services: [],
      due_date: dueDate,
      amount: parseCurrency(form.amount),
      notes: form.notes.trim() || null,
      image_url: form.image_url || null,
    };
    let saveError = null;
    if (editingOrder) {
      const { error } = await supabase.from('maintenance_orders').update(payload).eq('id', editingOrder.id);
      saveError = error;
    } else {
      const { count } = await supabase
        .from('maintenance_orders')
        .select('id', { count: 'exact', head: true })
        .eq('store_id', membership.store_id);
      const code = `MAN-${String((count ?? 0) + 1).padStart(3, '0')}`;
      const { error } = await supabase.from('maintenance_orders').insert({
        store_id: membership.store_id,
        created_by: user.user?.id,
        code,
        ...payload,
      });
      saveError = error;
    }
    setSaving(false);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    closeForm();
    await loadOrders();
  };

  const updateOrder = async (id: string, patch: Partial<MaintenanceOrder>) => {
    const { error: updateError } = await supabase.from('maintenance_orders').update(patch).eq('id', id);
    if (updateError) setError(updateError.message);
    else setOrders((current) => current.map((order) => order.id === id ? { ...order, ...patch } : order));
  };

  const advanceStatus = (order: MaintenanceOrder) => {
    const currentIndex = displayStatusIndex(order.status);
    const next = statusFlow[Math.min(currentIndex + 1, statusFlow.length - 1)];
    if (next !== order.status) void updateOrder(order.id, { status: next });
  };

  const retreatStatus = (order: MaintenanceOrder) => {
    const currentIndex = displayStatusIndex(order.status);
    const previous = statusFlow[Math.max(currentIndex - 1, 0)];
    if (previous !== order.status) void updateOrder(order.id, { status: previous });
  };

  const deleteOrder = async (order: MaintenanceOrder) => {
    const { error: deleteError } = await supabase.from('maintenance_orders').delete().eq('id', order.id);
    if (deleteError) {
      setError(deleteError.message);
      return;
    }
    setOrders((current) => current.filter((item) => item.id !== order.id));
    setOrderToDelete(null);
  };

  const registerPastMaintenance = async (event: React.FormEvent) => {
    event.preventDefault();
    setError('');
    const dueDate = parseBrazilianDate(form.due_date);
    if (!dueDate) {
      setError('Informe um prazo válido no formato dd/mm/aaaa.');
      return;
    }
    setSaving(true);
    const { data: membership, error: membershipError } = await supabase
      .from('store_users')
      .select('store_id')
      .limit(1)
      .single();
    if (membershipError || !membership) {
      setError(membershipError?.message ?? 'Loja não encontrada.');
      setSaving(false);
      return;
    }
    const { data: user } = await supabase.auth.getUser();
    const { count } = await supabase
      .from('maintenance_orders')
      .select('id', { count: 'exact', head: true })
      .eq('store_id', membership.store_id);
    const receivedDate = new Date(`${pastReceivedDate}T12:00:00`).toISOString();
    const { error: insertError } = await supabase.from('maintenance_orders').insert({
      store_id: membership.store_id,
      created_by: user.user?.id,
      code: `MAN-${String((count ?? 0) + 1).padStart(3, '0')}`,
      customer_name: form.customer_name.trim(),
      phone: form.phone.trim() || null,
      terrarium: form.terrarium.trim(),
      services: [],
      received_date: pastReceivedDate,
      due_date: dueDate,
      amount: parseCurrency(form.amount),
      status: 'delivered',
      payment_status: 'paid',
      notes: form.notes.trim() || null,
      image_url: form.image_url || null,
      created_at: receivedDate,
    });
    setSaving(false);
    if (insertError) {
      setError(insertError.message);
      return;
    }
    setShowPastForm(false);
    setForm(initialForm);
    setPastReceivedDate(new Date().toISOString().slice(0, 10));
    await loadOrders();
  };

  return (
    <div className="space-y-5">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-display)', color: 'var(--app-text)' }}>Manutenção</h1>
          <p className="text-sm mt-1" style={{ color: '#59595D' }}>Acompanhe os terrários recebidos de clientes</p>
        </div>
        <div className="flex flex-col items-end gap-2">
          <button type="button" onClick={() => { setEditingOrder(null); setForm(initialForm); setShowForm(true); }} className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold text-white" style={{ background: 'linear-gradient(135deg, #E28B9B, #D66D81)' }}>
            <Plus size={16} /> Nova manutenção
          </button>
          <button type="button" onClick={() => { setForm(initialForm); setShowPastForm(true); }} className="flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-medium" style={{ background: '#FDE0E2', color: '#D66D81' }}>
            <Plus size={14} /> Adicionar manutenção passada
          </button>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-3">
        {[
          { label: 'Recebidos', value: counts.received, icon: Clock3 },
          { label: 'Em manutenção', value: counts.active, icon: Wrench },
          { label: 'Entregues', value: counts.delivered, icon: CheckCircle2 },
        ].map(({ label, value, icon: Icon }) => (
          <div key={label} className="rounded-2xl p-4" style={{ background: 'var(--app-surface)', border: '1px solid rgba(252, 211, 217, 0.4)' }}>
            <div className="flex items-center justify-between gap-2"><span className="text-xs" style={{ color: '#59595D' }}>{label}</span><Icon size={15} style={{ color: '#D66D81' }} /></div>
            <div className="text-2xl font-semibold mt-2" style={{ fontFamily: 'var(--font-display)', color: 'var(--app-text)' }}>{value}</div>
          </div>
        ))}
      </div>

      {error && <div className="rounded-xl px-4 py-3 text-sm" style={{ background: '#FDE0E2', color: '#C94B5F' }}>{error}</div>}
      {loading ? <div className="py-12 text-center text-sm" style={{ color: '#59595D' }}>Carregando manutenções...</div> : orders.length === 0 ? <div className="rounded-2xl p-10 text-center text-sm" style={{ background: 'var(--app-surface)', color: '#59595D' }}>Nenhuma manutenção registrada.</div> : (
        <div className="space-y-3">
          {orders.map((order) => {
            const currentStep = displayStatusIndex(order.status);
            return (
              <div key={order.id} className="rounded-2xl p-4 sm:p-5" style={{ background: 'var(--app-surface)', border: '1px solid rgba(252, 211, 217, 0.4)', boxShadow: '0 8px 26px rgba(214, 109, 129, 0.08)' }}>
                <div className="flex items-start px-1 sm:px-8 mb-5">
                  {statusFlow.map((step, index) => (
                    <div key={step} className="relative flex-1 text-center">
                      <div className="flex items-center">
                        {index > 0 && <div className="h-0.5 flex-1" style={{ background: index <= currentStep ? '#E28B9B' : '#FCD3D9' }} />}
                        <div className="w-3 h-3 rounded-full border-2 flex-shrink-0" style={{ background: index === currentStep ? '#D66D81' : index < currentStep ? '#E28B9B' : '#FCD3D9', borderColor: index <= currentStep ? '#D66D81' : '#FCD3D9', boxShadow: index === currentStep ? '0 0 0 4px #F9E8EC' : undefined }} />
                        {index < statusFlow.length - 1 && <div className="h-0.5 flex-1" style={{ background: index < currentStep ? '#E28B9B' : '#FCD3D9' }} />}
                      </div>
                      <div className="text-[11px] mt-2 truncate" style={{ color: index === currentStep ? '#D66D81' : '#5A5A5A', fontWeight: index === currentStep ? 600 : 400 }}>{step === 'in_maintenance' ? 'Manutenção' : statusLabels[step]}</div>
                    </div>
                  ))}
                </div>
                <div className="flex flex-wrap items-start gap-4">
                  <img src={productImage(order.image_url, order.terrarium)} alt="" className="w-20 h-20 rounded-2xl object-cover flex-shrink-0" />
                  <div className="flex-1 min-w-[180px]">
                    <div className="font-semibold" style={{ color: 'var(--app-text)' }}>{order.customer_name}</div>
                    <div className="text-xs mt-1" style={{ color: '#454549' }}>{order.terrarium}</div>
                    <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs mt-4" style={{ color: '#5A5A5A' }}>
                      {order.phone && <span>☎ {order.phone}</span>}
                      <span>Recebido em {formatDate(order.received_date)}</span>
                      <span>Prazo: {formatDate(order.due_date)}</span>
                    </div>
                  </div>
                  <div className="text-right ml-auto">
                    <div className="font-semibold" style={{ color: '#D66D81' }}>{formatCurrency(Number(order.amount))}</div>
                    <div className="text-xs mt-1" style={{ color: '#59595D' }}>{order.payment_status === 'paid' ? 'Pago' : 'Pagamento pendente'}</div>
                  </div>
                </div>
                {order.notes && <div className="rounded-xl px-3 py-2.5 mt-4 text-xs" style={{ background: '#FEF7F1', color: '#454549' }}>{order.notes}</div>}
                <div className="flex flex-wrap justify-end gap-2 border-t mt-4 pt-3" style={{ borderColor: 'rgba(252, 211, 217, 0.35)' }}>
                  {order.payment_status === 'pending' && <button type="button" onClick={() => onSendToCheckout(order)} className="rounded-full px-3 py-1.5 text-xs font-medium" style={{ background: '#FDE0E2', color: '#D66D81' }}>Receber no caixa</button>}
                  {order.status !== 'received' && <button type="button" onClick={() => retreatStatus(order)} className="rounded-full px-3 py-1.5 text-xs font-medium" style={{ background: '#FFF8F4', color: '#454549', border: '1px solid #FCD3D9' }}><ChevronLeft size={12} className="inline mr-1" />Voltar etapa</button>}
                  {order.status !== 'delivered' && <button type="button" onClick={() => advanceStatus(order)} className="rounded-full px-3 py-1.5 text-xs font-medium text-white" style={{ background: '#D66D81' }}>Avançar etapa <span className="ml-1">→</span></button>}
                  {isAdmin && <button type="button" onClick={() => openEdit(order)} className="rounded-full p-1.5 hover:bg-pink-50" title="Editar manutenção" aria-label={`Editar manutenção de ${order.customer_name}`}><Pencil size={15} style={{ color: '#D66D81' }} /></button>}
                  {isAdmin && <button type="button" onClick={() => setOrderToDelete(order)} className="rounded-full p-1.5 hover:bg-pink-50" title="Excluir manutenção" aria-label={`Excluir manutenção de ${order.customer_name}`}><Trash2 size={15} style={{ color: '#C94B5F' }} /></button>}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {showForm && <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20">
        <form onSubmit={createOrder} className="w-full max-w-lg rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto" style={{ background: 'var(--app-surface)' }}>
          <div className="flex items-center justify-between"><h2 className="font-semibold" style={{ color: 'var(--app-text)' }}>{editingOrder ? 'Editar manutenção' : 'Nova manutenção'}</h2><button type="button" onClick={closeForm}><X size={18} style={{ color: '#59595D' }} /></button></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs" style={{ color: '#454549' }}>Cliente<input required value={form.customer_name} onChange={(event) => setForm((current) => ({ ...current, customer_name: event.target.value }))} placeholder="Nome do cliente" className="w-full mt-1 px-3 py-2.5 rounded-xl text-sm" style={{ background: '#FEF7F1', border: '1px solid #F9E8EC' }} /></label>
            <label className="text-xs" style={{ color: '#454549' }}>Telefone ou WhatsApp (opcional)<input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} placeholder="(61) 99999-9999" className="w-full mt-1 px-3 py-2.5 rounded-xl text-sm" style={{ background: '#FEF7F1', border: '1px solid #F9E8EC' }} /></label>
            <label className="text-xs sm:col-span-2" style={{ color: '#454549' }}>Terrário<input required value={form.terrarium} onChange={(event) => setForm((current) => ({ ...current, terrarium: event.target.value }))} placeholder="Ex.: Terrário médio fechado" className="w-full mt-1 px-3 py-2.5 rounded-xl text-sm" style={{ background: '#FEF7F1', border: '1px solid #F9E8EC' }} /></label>
            <label className="text-xs" style={{ color: '#454549' }}>Prazo<input required value={form.due_date} onChange={(event) => setForm((current) => ({ ...current, due_date: formatBrazilianDateInput(event.target.value) }))} placeholder="dd/mm/aaaa" inputMode="numeric" maxLength={10} className="w-full mt-1 px-3 py-2.5 rounded-xl text-sm" style={{ background: '#FEF7F1', border: '1px solid #F9E8EC' }} /></label>
            <label className="text-xs" style={{ color: '#454549' }}>Valor<input required value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value.replace(/\D/g, '') ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseCurrency(event.target.value)) : '' }))} placeholder="R$ 0,00" className="w-full mt-1 px-3 py-2.5 rounded-xl text-sm" style={{ background: '#FEF7F1', border: '1px solid #F9E8EC' }} /></label>
          </div>
          <label className="text-xs" style={{ color: '#454549' }}>Foto do terrário
            <span className="mt-1 flex items-center justify-center gap-2 rounded-xl border border-dashed py-3 text-xs cursor-pointer" style={{ borderColor: '#E28B9B', color: '#D66D81', background: '#FEF7F1' }}>
              <Camera size={15} /> {form.image_url ? 'Trocar foto' : 'Adicionar foto'}
              <input type="file" accept="image/*" onChange={(event) => { const file = event.target.files?.[0]; if (!file) return; const reader = new FileReader(); reader.onload = () => setForm((current) => ({ ...current, image_url: String(reader.result) })); reader.readAsDataURL(file); }} className="sr-only" />
            </span>
          </label>
          {form.image_url && <img src={form.image_url} alt="Prévia do terrário" className="w-20 h-20 rounded-xl object-cover" />}
          <label className="text-xs" style={{ color: '#454549' }}>Observações<textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="w-full mt-1 px-3 py-2.5 rounded-xl text-sm" rows={3} style={{ background: '#FEF7F1', border: '1px solid #F9E8EC' }} /></label>
          <button type="submit" disabled={saving} className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60" style={{ background: 'linear-gradient(135deg, #E28B9B, #D66D81)' }}>{saving ? 'Salvando...' : 'Cadastrar manutenção'}</button>
        </form>
      </div>}
      {showPastForm && <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/20">
        <form onSubmit={registerPastMaintenance} className="w-full max-w-lg rounded-2xl p-5 space-y-4 max-h-[90vh] overflow-y-auto" style={{ background: 'var(--app-surface)' }}>
          <div className="flex items-center justify-between"><h2 className="font-semibold" style={{ color: 'var(--app-text)' }}>Adicionar manutenção passada</h2><button type="button" onClick={() => { setShowPastForm(false); setForm(initialForm); }}><X size={18} style={{ color: '#59595D' }} /></button></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <label className="text-xs" style={{ color: '#454549' }}>Cliente<input required value={form.customer_name} onChange={(event) => setForm((current) => ({ ...current, customer_name: event.target.value }))} className="w-full mt-1 px-3 py-2.5 rounded-xl text-sm" /></label>
            <label className="text-xs" style={{ color: '#454549' }}>Telefone ou WhatsApp (opcional)<input value={form.phone} onChange={(event) => setForm((current) => ({ ...current, phone: event.target.value }))} className="w-full mt-1 px-3 py-2.5 rounded-xl text-sm" /></label>
            <label className="text-xs sm:col-span-2" style={{ color: '#454549' }}>Terrário<input required value={form.terrarium} onChange={(event) => setForm((current) => ({ ...current, terrarium: event.target.value }))} className="w-full mt-1 px-3 py-2.5 rounded-xl text-sm" /></label>
            <label className="text-xs" style={{ color: '#454549' }}>Recebido em<input required type="date" max={new Date().toISOString().slice(0, 10)} value={pastReceivedDate} onChange={(event) => setPastReceivedDate(event.target.value)} className="w-full mt-1 px-3 py-2.5 rounded-xl text-sm" /></label>
            <label className="text-xs" style={{ color: '#454549' }}>Prazo<input required value={form.due_date} onChange={(event) => setForm((current) => ({ ...current, due_date: formatBrazilianDateInput(event.target.value) }))} placeholder="dd/mm/aaaa" inputMode="numeric" maxLength={10} className="w-full mt-1 px-3 py-2.5 rounded-xl text-sm" /></label>
            <label className="text-xs sm:col-span-2" style={{ color: '#454549' }}>Valor pago<input required value={form.amount} onChange={(event) => setForm((current) => ({ ...current, amount: event.target.value.replace(/\D/g, '') ? new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(parseCurrency(event.target.value)) : '' }))} placeholder="R$ 0,00" className="w-full mt-1 px-3 py-2.5 rounded-xl text-sm" /></label>
          </div>
          <label className="text-xs" style={{ color: '#454549' }}>Observações<textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} className="w-full mt-1 px-3 py-2.5 rounded-xl text-sm" rows={3} /></label>
          <button type="submit" disabled={saving} className="w-full py-3 rounded-xl text-sm font-semibold text-white disabled:opacity-60" style={{ background: 'linear-gradient(135deg, #E28B9B, #D66D81)' }}>{saving ? 'Salvando...' : 'Cadastrar manutenção passada'}</button>
        </form>
      </div>}
      {orderToDelete && <ConfirmDialog title="Excluir manutenção?" message={`A manutenção de ${orderToDelete.customer_name} e a venda vinculada serão removidas permanentemente.`} confirmLabel="Excluir" onCancel={() => setOrderToDelete(null)} onConfirm={() => void deleteOrder(orderToDelete)} />}
    </div>
  );
}
