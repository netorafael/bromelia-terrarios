import { useState, useRef, useCallback, useEffect } from 'react';
import {
  Search, Plus, X, Camera, Image, ChevronDown, Check,
  Package, AlertTriangle,
  Trash2, Pencil,
} from 'lucide-react';
import { supabase } from '../lib/supabase';
import { productImage, productPlaceholder } from '../lib/productPlaceholder';

type Tipo = 'terrario';
type Status = 'Em Estoque' | 'Estoque Baixo' | 'Sem Estoque';
type Tab = 'terrario';

interface Item {
  id: string;
  tipo: Tipo;
  nome: string;
  categoria: string;
  categoriaId: string | null;
  sku: string;
  quantidade: number;
  minimo: number;
  custo: string;
  preco: string;
  status: Status;
  img: string;
}

const categoriasTerrario = ['Terrários pequenos', 'Terrários médios', 'Terrários grandes', 'Workshops', 'Outro'];

const categoriasPorTipo: Record<Tipo, string[]> = { terrario: categoriasTerrario };

const statusOpcoes: Status[] = ['Em Estoque', 'Estoque Baixo', 'Sem Estoque'];

function statusStyle(s: Status) {
  if (s === 'Em Estoque') return { background: '#F9E8EC', color: '#D66D81' };
  if (s === 'Estoque Baixo') return { background: '#FDE0E2', color: '#C94B5F' };
  return { background: '#E2E2E2', color: '#5A5A5A' };
}

function parseMoney(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return 0;

  const parsed = Number(digits) / 100;
  return Number.isFinite(parsed) ? parsed : 0;
}

function formatMoneyInput(value: string) {
  const digits = value.replace(/\D/g, '');
  if (!digits) return '';

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
  }).format(Number(digits) / 100);
}

// ─── Modal de Novo Produto ───────────────────────────────────────────────────

interface NovoModalProps {
  onClose: () => void;
  onSave: (item: Omit<Item, 'id'>) => boolean | Promise<boolean>;
  item?: Item | null;
}

const VAZIO = {
  tipo: 'terrario' as Tipo,
  nome: '',
  categoria: '',
  sku: '',
  quantidade: '' as unknown as number,
  minimo: '' as unknown as number,
  custo: '',
  preco: '',
  status: 'Em Estoque' as Status,
  img: '',
};

type NovoForm = typeof VAZIO;

interface ProductFieldProps {
  label: string;
  field: keyof NovoForm;
  placeholder?: string;
  type?: string;
  form: NovoForm;
  errors: Record<string, string>;
  onChange: (field: keyof NovoForm, value: string) => void;
}

function ProductField({ label, field, placeholder, type = 'text', form, errors, onChange }: ProductFieldProps) {
  const isMoneyField = field === 'custo' || field === 'preco';

  return (
    <div>
      <label className="block text-xs font-medium mb-1" style={{ color: '#454549' }}>{label}</label>
      <input
        type={isMoneyField ? 'text' : type}
        inputMode={field === 'custo' || field === 'preco' ? 'decimal' : undefined}
        placeholder={placeholder}
        value={String(form[field])}
        onChange={(event) => onChange(field, isMoneyField ? formatMoneyInput(event.target.value) : event.target.value)}
        className="w-full px-3 py-2 rounded-xl text-sm outline-none transition-all"
        style={{
          background: '#FEF7F1',
          border: errors[field] ? '1.5px solid #C94B5F' : '1px solid rgba(252, 211, 217, 0.5)',
          color: '#1C1C1E',
        }}
        onFocus={(event) => { event.currentTarget.style.borderColor = '#D66D81'; }}
        onBlur={(event) => {
          if (!errors[field]) event.currentTarget.style.borderColor = 'rgba(252, 211, 217, 0.5)';
        }}
      />
      {errors[field] && <p className="text-xs mt-1" style={{ color: '#C94B5F' }}>{errors[field]}</p>}
    </div>
  );
}

function NovoModal({ onClose, onSave, item = null }: NovoModalProps) {
  const [form, setForm] = useState({ ...VAZIO });
  const [imgPreview, setImgPreview] = useState('');
  const [erros, setErros] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement>(null);
  const cameraRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!item) {
      setForm({ ...VAZIO });
      setImgPreview('');
      return;
    }
    setForm({
      tipo: item.tipo,
      nome: item.nome,
      categoria: item.categoria,
      sku: item.sku,
      quantidade: item.quantidade,
      minimo: item.minimo,
      custo: item.custo,
      preco: item.preco,
      status: item.status,
      img: item.img,
    });
    setImgPreview(item.img);
  }, [item]);

  const set = (k: keyof typeof form, v: any) => {
    setForm(prev => ({ ...prev, [k]: v }));
    setErros(prev => { const e = { ...prev }; delete e[k]; return e; });
  };

  const handleImgFile = (file: File) => {
    const url = URL.createObjectURL(file);
    setImgPreview(url);
    set('img', url);
  };

  const validar = () => {
    const e: Record<string, string> = {};
    if (!form.nome.trim()) e.nome = 'Nome obrigatório';
    if (!form.categoria) e.categoria = 'Selecione uma categoria';
    if (!String(form.quantidade)) e.quantidade = 'Informe a quantidade';
    if (!form.custo.trim()) e.custo = 'Informe o custo';
    return e;
  };

  const handleSalvar = async () => {
    const e = validar();
    if (Object.keys(e).length) { setErros(e); return; }
    const saved = await onSave({
      ...form,
      quantidade: Number(form.quantidade),
      minimo: Number(form.minimo),
      categoriaId: null,
      img: imgPreview || productPlaceholder(form.nome, form.categoria),
    });
    if (saved) onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4"
      style={{ background: 'rgba(0,0,0,0.3)', backdropFilter: 'blur(4px)' }}
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div
        className="w-full sm:max-w-lg max-h-[95dvh] overflow-y-auto"
        style={{
          background: 'white',
          borderRadius: '24px 24px 0 0',
          boxShadow: '0 -8px 40px rgba(214,109,129,0.15)',
        }}
      >
        {/* Cabeçalho */}
        <div
          className="flex items-center justify-between px-6 py-5 border-b sticky top-0 bg-white z-10"
          style={{ borderColor: 'rgba(252,211,217,0.4)', borderRadius: '24px 24px 0 0' }}
        >
          <div>
            <div className="font-semibold" style={{ fontFamily: 'var(--font-display)', color: '#1C1C1E' }}>
              {item ? 'Editar Produto' : 'Novo Produto'}
            </div>
            <div className="text-xs mt-0.5" style={{ color: '#59595D' }}>{item ? 'Atualize as informações do produto' : 'Preencha todas as informações'}</div>
          </div>
          <button onClick={onClose} className="w-8 h-8 rounded-xl flex items-center justify-center" style={{ background: '#FDE0E2' }}>
            <X size={15} style={{ color: '#D66D81' }} />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Foto */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: '#454549' }}>Foto do Produto</label>
            <div className="flex gap-3">
              {/* Preview */}
              <div
                className="w-20 h-20 rounded-2xl flex-shrink-0 overflow-hidden flex items-center justify-center"
                style={{ background: '#FEF7F1', border: '1px solid rgba(252,211,217,0.5)' }}
              >
                {imgPreview
                  ? <img src={imgPreview} alt="preview" className="w-full h-full object-cover" />
                  : <img src={productPlaceholder(form.nome || 'Novo produto', form.categoria)} alt="Prévia padrão do produto" className="w-full h-full object-cover" />
                }
              </div>
              <div className="flex flex-col gap-2 flex-1">
                {/* Câmera */}
                <button
                  onClick={() => cameraRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all hover:opacity-90"
                  style={{ background: 'linear-gradient(135deg, #E28B9B, #D66D81)', color: 'white' }}
                >
                  <Camera size={15} />
                  Tirar Foto
                </button>
                {/* Galeria */}
                <button
                  onClick={() => fileRef.current?.click()}
                  className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium"
                  style={{ background: '#FDE0E2', color: '#D66D81' }}
                >
                  <Image size={15} />
                  Escolher da Galeria
                </button>
                <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden"
                  onChange={e => e.target.files?.[0] && handleImgFile(e.target.files[0])} />
                <input ref={fileRef} type="file" accept="image/*" className="hidden"
                  onChange={e => e.target.files?.[0] && handleImgFile(e.target.files[0])} />
              </div>
            </div>
          </div>

          {/* Tipo */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: '#454549' }}>Tipo de Produto</label>
            <div className="grid grid-cols-2 gap-2">
              {([['terrario', 'Terrário', Package]] as const).map(([val, label, Icon]) => (
                <button
                  key={val}
                  onClick={() => { set('tipo', val); set('categoria', ''); }}
                  className="flex items-center gap-2 px-4 py-3 rounded-xl text-sm font-medium transition-all"
                  style={{
                    background: form.tipo === val ? '#F9E8EC' : '#FEF7F1',
                    border: form.tipo === val ? '1.5px solid #D66D81' : '1px solid rgba(252,211,217,0.4)',
                    color: form.tipo === val ? '#D66D81' : '#454549',
                  }}
                >
                  <Icon size={15} />
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Nome */}
          <ProductField label="Nome do Produto" field="nome" placeholder="Ex: Fittonia Ecosystem" form={form} errors={erros} onChange={set} />

          {/* Categoria */}
          <div>
            <label className="block text-xs font-medium mb-1" style={{ color: '#454549' }}>Categoria</label>
            <div className="relative">
              <select
                value={form.categoria}
                onChange={e => set('categoria', e.target.value)}
                className="w-full appearance-none px-3 py-2 rounded-xl text-sm outline-none transition-all pr-9"
                style={{
                  background: '#FEF7F1',
                  border: erros.categoria ? '1.5px solid #C94B5F' : '1px solid rgba(252,211,217,0.5)',
                  color: form.categoria ? '#1C1C1E' : '#59595D',
                }}
              >
                <option value="" disabled>Selecione uma categoria</option>
                {categoriasPorTipo[form.tipo].map(c => <option key={c} value={c}>{c}</option>)}
              </select>
              <ChevronDown size={14} className="absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" style={{ color: '#59595D' }} />
            </div>
            {erros.categoria && <p className="text-xs mt-1" style={{ color: '#C94B5F' }}>{erros.categoria}</p>}
          </div>

          {/* Quantidade */}
          <ProductField label="Quantidade em Estoque" field="quantidade" placeholder="0" type="number" form={form} errors={erros} onChange={set} />

          {/* Custo e Preço */}
          <div className="grid grid-cols-2 gap-3">
            <ProductField label="Preço de Custo" field="custo" placeholder="R$ 0,00" form={form} errors={erros} onChange={set} />
            <ProductField
              label={form.tipo === 'terrario' ? 'Preço de Venda' : 'Preço de Venda (opcional)'}
              field="preco"
              placeholder="R$ 0,00"
              form={form}
              errors={erros}
              onChange={set}
            />
          </div>

          {/* Status */}
          <div>
            <label className="block text-xs font-medium mb-2" style={{ color: '#454549' }}>Status</label>
            <div className="flex gap-2 flex-wrap">
              {statusOpcoes.map(s => (
                <button
                  key={s}
                  onClick={() => set('status', s)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-medium transition-all"
                  style={{
                    ...statusStyle(s),
                    border: form.status === s ? '1.5px solid #D66D81' : '1px solid transparent',
                    opacity: form.status === s ? 1 : 0.6,
                  }}
                >
                  {form.status === s && <Check size={11} />}
                  {s}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Rodapé */}
        <div
          className="flex gap-3 px-6 py-5 border-t sticky bottom-0 bg-white"
          style={{ borderColor: 'rgba(252,211,217,0.4)' }}
        >
          <button
            onClick={onClose}
            className="flex-1 py-3 rounded-xl text-sm font-medium"
            style={{ background: '#FDE0E2', color: '#D66D81' }}
          >
            Cancelar
          </button>
          <button
            onClick={handleSalvar}
            className="flex-1 py-3 rounded-xl text-sm font-semibold"
            style={{ background: 'linear-gradient(135deg, #E28B9B, #D66D81)', color: 'white', boxShadow: '0 4px 16px rgba(214,109,129,0.3)' }}
          >
            {item ? 'Salvar Alterações' : 'Salvar Produto'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Painel de Filtros ──────────────────────────────────────────────────────

interface FiltrosPanelProps {
  tab: Tab;
  filtroCategoria: string;
  setFiltroCategoria: (v: string) => void;
  filtroStatus: string;
  setFiltroStatus: (v: string) => void;
  onLimpar: () => void;
  onFechar: () => void;
  categorias: string[];
}

function FiltrosPanel({
  filtroCategoria, setFiltroCategoria,
  filtroStatus, setFiltroStatus,
  onLimpar, onFechar, categorias,
}: FiltrosPanelProps) {
  return (
    <div
      className="rounded-2xl p-4 space-y-4"
      style={{ background: 'white', border: '1px solid rgba(252,211,217,0.4)', boxShadow: '0 4px 20px rgba(214,109,129,0.1)' }}
    >
      <div className="flex items-center justify-between">
        <span className="text-sm font-semibold" style={{ color: '#1C1C1E' }}>Filtros</span>
        <div className="flex gap-2">
          <button onClick={onLimpar} className="text-xs px-3 py-1.5 rounded-lg" style={{ color: '#59595D', background: '#FEF7F1' }}>
            Limpar
          </button>
          <button onClick={onFechar} className="w-7 h-7 rounded-lg flex items-center justify-center" style={{ background: '#FDE0E2' }}>
            <X size={13} style={{ color: '#D66D81' }} />
          </button>
        </div>
      </div>

      <div>
        <p className="text-xs font-medium mb-2" style={{ color: '#454549' }}>Categoria</p>
        <div className="flex flex-wrap gap-1.5">
          {['Todas', ...categorias].map(c => (
            <button
              key={c}
              onClick={() => setFiltroCategoria(c === 'Todas' ? '' : c)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: (c === 'Todas' ? filtroCategoria === '' : filtroCategoria === c) ? '#F9E8EC' : '#FEF7F1',
                border: (c === 'Todas' ? filtroCategoria === '' : filtroCategoria === c) ? '1.5px solid #D66D81' : '1px solid rgba(252,211,217,0.4)',
                color: (c === 'Todas' ? filtroCategoria === '' : filtroCategoria === c) ? '#D66D81' : '#454549',
              }}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div>
        <p className="text-xs font-medium mb-2" style={{ color: '#454549' }}>Status</p>
        <div className="flex flex-wrap gap-1.5">
          {(['Todos', ...statusOpcoes] as const).map(s => (
            <button
              key={s}
              onClick={() => setFiltroStatus(s === 'Todos' ? '' : s)}
              className="px-3 py-1.5 rounded-lg text-xs font-medium transition-all"
              style={{
                background: (s === 'Todos' ? filtroStatus === '' : filtroStatus === s) ? '#F9E8EC' : '#FEF7F1',
                border: (s === 'Todos' ? filtroStatus === '' : filtroStatus === s) ? '1.5px solid #D66D81' : '1px solid rgba(252,211,217,0.4)',
                color: (s === 'Todos' ? filtroStatus === '' : filtroStatus === s) ? '#D66D81' : '#454549',
              }}
            >
              {s}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Componente Principal ──────────────────────────────────────────────────

export default function Estoque() {
  const [itens, setItens] = useState<Item[]>([]);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState<Tab>('terrario');
  const [busca, setBusca] = useState('');
  const [filtroCategoria, setFiltroCategoria] = useState('');
  const [filtroStatus, setFiltroStatus] = useState('');
  const [mostrarFiltros, setMostrarFiltros] = useState(false);
  const [mostrarModal, setMostrarModal] = useState(false);
  const [produtoEmEdicao, setProdutoEmEdicao] = useState<Item | null>(null);
  const [produtoExpandido, setProdutoExpandido] = useState<string | null>(null);

  useEffect(() => {
    const carregar = async () => {
      const { data, error } = await supabase
        .from('products')
        .select('id, type, name, sku, category_id, cost_price, sale_price, image_url, categories(id, name), inventory_levels(quantity, minimum_quantity)')
        .eq('active', true)
        .order('name');
      if (error) {
        setLoadError(error.message);
        return;
      }
      setItens((data ?? []).map((product: any) => {
        const quantity = product.inventory_levels?.quantity ?? 0;
        const minimum = product.inventory_levels?.minimum_quantity ?? 0;
        if (product.type === 'supply') return null;
        return {
          id: product.id,
          tipo: 'terrario',
          nome: product.name,
          categoria: product.categories?.name ?? 'Outro',
          categoriaId: product.categories?.id ?? null,
          sku: product.sku,
          quantidade: quantity,
          minimo: minimum,
          custo: `R$ ${Number(product.cost_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          preco: product.sale_price == null ? '—' : `R$ ${Number(product.sale_price).toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`,
          status: quantity === 0 ? 'Sem Estoque' : quantity <= minimum ? 'Estoque Baixo' : 'Em Estoque',
          img: productImage(product.image_url, product.name, product.categories?.name),
        };
      }).filter(Boolean) as Item[]);
    };
    void carregar();
  }, []);

  const adicionarItem = useCallback(async (novo: Omit<Item, 'id'>) => {
    const { data: membership } = await supabase.from('store_users').select('store_id').limit(1).single();
    if (!membership) {
      setLoadError('Usuário não está associado a uma loja.');
      return false;
    }
    const categorySlug = novo.categoria.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
    const { data: category } = await supabase.from('categories').select('id').eq('slug', categorySlug).eq('active', true).maybeSingle();
    if (!category) {
      setLoadError('Não foi possível localizar a categoria selecionada.');
      return false;
    }
    const generatedSku = `TER-${Date.now().toString(36).toUpperCase()}`;
    const { data, error } = await supabase.from('products').insert({
      store_id: membership.store_id,
      category_id: category.id,
      type: novo.categoria === 'Workshops' ? 'workshop' : 'terrarium',
      name: novo.nome, sku: generatedSku, cost_price: parseMoney(novo.custo),
      sale_price: novo.preco === '—' || !novo.preco.trim() ? null : parseMoney(novo.preco),
      sellable: true, image_url: novo.img || null,
    }).select('id').single();
    if (error || !data) {
      setLoadError(error?.message ?? 'Não foi possível criar o produto.');
      return false;
    }
    const { error: inventoryError } = await supabase.from('inventory_levels').insert({ product_id: data.id, quantity: novo.quantidade, minimum_quantity: 0 });
    if (inventoryError) {
      setLoadError(inventoryError.message);
      return false;
    }
    setItens(prev => [...prev, { ...novo, id: data.id, sku: generatedSku, categoriaId: category.id, minimo: 0 }]);
    return true;
  }, [tab]);

  const editarItem = useCallback(async (novo: Omit<Item, 'id'>) => {
    if (!produtoEmEdicao) return false;
    const categorySlug = novo.categoria.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select('id, name')
      .eq('slug', categorySlug)
      .eq('active', true)
      .maybeSingle();
    if (categoryError || !category) {
      setLoadError(categoryError?.message ?? 'Não foi possível localizar a categoria selecionada.');
      return false;
    }

    const { error } = await supabase.from('products').update({
      category_id: category.id,
      name: novo.nome,
      cost_price: parseMoney(novo.custo),
      sale_price: novo.preco === '—' || !novo.preco.trim() ? null : parseMoney(novo.preco),
      image_url: novo.img || null,
    }).eq('id', produtoEmEdicao.id);
    if (error) {
      setLoadError(error.message);
      return false;
    }

    const { error: inventoryError } = await supabase.rpc('set_inventory_quantity', {
      p_product_id: produtoEmEdicao.id,
      p_quantity: Math.max(0, Math.floor(Number(novo.quantidade) || 0)),
    });
    if (inventoryError) {
      setLoadError(inventoryError.message);
      return false;
    }

    const quantidade = Math.max(0, Math.floor(Number(novo.quantidade) || 0));
    setItens(prev => prev.map(item => item.id === produtoEmEdicao.id ? {
      ...novo,
      id: item.id,
      sku: item.sku,
      categoriaId: category.id,
      quantidade,
      minimo: item.minimo,
      status: quantidade === 0 ? 'Sem Estoque' : quantidade <= item.minimo ? 'Estoque Baixo' : 'Em Estoque',
    } : item));
    return true;
  }, [produtoEmEdicao]);

  const atualizarCategoria = async (item: Item, categoria: string) => {
    const slug = categoria.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, '-');
    const { data: category, error: categoryError } = await supabase
      .from('categories')
      .select('id, name')
      .eq('slug', slug)
      .eq('active', true)
      .maybeSingle();
    if (categoryError || !category) {
      setLoadError(categoryError?.message ?? 'Não foi possível localizar a categoria.');
      return;
    }
    const { error } = await supabase.from('products').update({ category_id: category.id }).eq('id', item.id);
    if (error) {
      setLoadError(error.message);
      return;
    }
    setItens(prev => prev.map(entry => entry.id === item.id ? { ...entry, categoria: category.name, categoriaId: category.id } : entry));
  };

  const atualizarQuantidade = async (id: string, quantidade: number) => {
    const item = itens.find((entry) => entry.id === id);
    if (!item) return;
    const novaQtd = Math.max(0, Math.floor(Number.isFinite(quantidade) ? quantidade : 0));
    const { error } = await supabase.rpc('set_inventory_quantity', {
      p_product_id: id,
      p_quantity: novaQtd,
    });
    if (error) {
      setLoadError(error.message);
      return;
    }
    setItens(prev => prev.map(item => {
      if (item.id !== id) return item;
      const novoStatus: Status =
        novaQtd === 0 ? 'Sem Estoque' :
        novaQtd <= item.minimo ? 'Estoque Baixo' : 'Em Estoque';
      return { ...item, quantidade: novaQtd, status: novoStatus };
    }));
  };

  const removerProduto = async (item: Item) => {
    if (!window.confirm(`Excluir o produto "${item.nome}"?`)) return;
    const { error } = await supabase.from('products').update({ active: false }).eq('id', item.id);
    if (error) {
      setLoadError(error.message);
      return;
    }
    setItens(prev => prev.filter(entry => entry.id !== item.id));
  };

  const itensDaAba = itens.filter(i => i.tipo === tab);
  const categoriasDisponiveis = [...new Set(itensDaAba.map(i => i.categoria))];

  const filtrados = itensDaAba.filter(item => {
    const matchBusca = !busca ||
      item.nome.toLowerCase().includes(busca.toLowerCase()) ||
      item.nome.toLowerCase().includes(busca.toLowerCase());
    const matchCategoria = !filtroCategoria || item.categoria === filtroCategoria;
    const matchStatus = !filtroStatus || item.status === filtroStatus;
    return matchBusca && matchCategoria && matchStatus;
  });

  const filtrosAtivos = [filtroCategoria, filtroStatus].filter(Boolean).length;
  const inventoryValue = itens.reduce((total, item) => total + parseMoney(item.custo) * item.quantidade, 0);

  return (
    <div className="space-y-5">
      {loadError && <div className="rounded-xl px-4 py-3 text-sm" style={{ background: '#FDE0E2', color: '#C94B5F' }}>{loadError}</div>}
      {/* Cabeçalho */}
      <div className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-display)', color: '#1C1C1E' }}>
            Estoque
          </h1>
          <p className="text-sm mt-1" style={{ color: '#59595D' }}>
            Gestão de produtos
          </p>
        </div>
        <button
          onClick={() => setMostrarModal(true)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-semibold transition-all hover:opacity-90 active:scale-95 flex-shrink-0"
          style={{ background: 'linear-gradient(135deg, #E28B9B, #D66D81)', color: 'white', boxShadow: '0 4px 16px rgba(214,109,129,0.25)' }}
        >
          <Plus size={15} />
          <span className="hidden sm:inline">Novo Produto</span>
          <span className="sm:hidden">Novo</span>
        </button>
      </div>

      <div
        className="rounded-2xl p-5 flex items-start justify-between"
        style={{
          background: '#FFFFFF',
          border: '1px solid rgba(252, 211, 217, 0.4)',
          boxShadow: '0 1px 8px rgba(214, 109, 129, 0.06)',
        }}
      >
        <div>
          <div className="w-10 h-10 rounded-full flex items-center justify-center mb-5" style={{ background: '#FDE0E2' }}>
            <Package size={18} style={{ color: '#D66D81' }} />
          </div>
          <div className="text-2xl font-semibold" style={{ fontFamily: 'var(--font-display)', color: '#1C1C1E' }}>
            {inventoryValue.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })}
          </div>
          <div className="text-sm mt-1" style={{ color: '#59595D' }}>Valor em Estoque</div>
        </div>
        <span className="px-3 py-1 rounded-full text-xs font-medium" style={{ background: '#F9E8EC', color: '#D66D81' }}>Atual</span>
      </div>

      {/* Abas */}
      <div className="flex gap-1 p-1 rounded-xl w-fit" style={{ background: '#FDE0E2' }}>
        {([['terrario', 'Terrários Prontos', Package]] as const).map(([id, label, Icon]) => (
          <button
            key={id}
            onClick={() => { setTab(id); setFiltroCategoria(''); setFiltroStatus(''); }}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all duration-150"
            style={{
              background: tab === id ? 'white' : 'transparent',
              color: tab === id ? '#D66D81' : '#59595D',
              boxShadow: tab === id ? '0 1px 4px rgba(214,109,129,0.15)' : 'none',
            }}
          >
            <Icon size={14} />
            <span className="hidden sm:inline">{label}</span>
            <span className="sm:hidden">Terrários</span>
          </button>
        ))}
      </div>

      {/* Busca e Filtros */}
      <div className="space-y-3">
        <div className="flex gap-3">
          <div className="flex-1 relative">
            <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2" style={{ color: '#59595D' }} />
            <input
              type="text"
              placeholder="Buscar por nome..."
              value={busca}
              onChange={e => setBusca(e.target.value)}
              className="w-full pl-9 pr-4 py-2.5 rounded-xl text-sm outline-none transition-all"
              style={{
                background: 'white',
                border: '1px solid rgba(252,211,217,0.5)',
                color: '#1C1C1E',
              }}
              onFocus={e => e.currentTarget.style.borderColor = '#D66D81'}
              onBlur={e => e.currentTarget.style.borderColor = 'rgba(252,211,217,0.5)'}
            />
          </div>
          <button
            onClick={() => setMostrarFiltros(v => !v)}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl text-sm font-medium transition-all"
            style={{
              background: mostrarFiltros || filtrosAtivos > 0 ? '#F9E8EC' : 'white',
              border: mostrarFiltros || filtrosAtivos > 0 ? '1.5px solid #D66D81' : '1px solid rgba(252,211,217,0.5)',
              color: mostrarFiltros || filtrosAtivos > 0 ? '#D66D81' : '#454549',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <line x1="1" y1="3.5" x2="13" y2="3.5" /><line x1="3" y1="7" x2="11" y2="7" /><line x1="5" y1="10.5" x2="9" y2="10.5" />
            </svg>
            <span className="hidden sm:inline">Filtros</span>
            {filtrosAtivos > 0 && (
              <span className="w-4 h-4 rounded-full text-xs flex items-center justify-center font-bold" style={{ background: '#D66D81', color: 'white' }}>
                {filtrosAtivos}
              </span>
            )}
            <ChevronDown size={13} className={`transition-transform ${mostrarFiltros ? 'rotate-180' : ''}`} />
          </button>
        </div>

        {mostrarFiltros && (
          <FiltrosPanel
            tab={tab}
            filtroCategoria={filtroCategoria}
            setFiltroCategoria={setFiltroCategoria}
            filtroStatus={filtroStatus}
            setFiltroStatus={setFiltroStatus}
            onLimpar={() => { setFiltroCategoria(''); setFiltroStatus(''); }}
            onFechar={() => setMostrarFiltros(false)}
            categorias={categoriasDisponiveis}
          />
        )}
      </div>

      {/* Contagem */}
      <div className="flex items-center justify-between">
        <span className="text-xs" style={{ color: '#59595D' }}>
          {filtrados.length} {filtrados.length === 1 ? 'item' : 'itens'} encontrado{filtrados.length === 1 ? '' : 's'}
        </span>
        {(busca || filtroCategoria || filtroStatus) && (
          <button
            onClick={() => { setBusca(''); setFiltroCategoria(''); setFiltroStatus(''); }}
            className="text-xs"
            style={{ color: '#D66D81' }}
          >
            Limpar busca
          </button>
        )}
      </div>

      {/* Tabela */}
      <div
        className="rounded-2xl overflow-hidden"
        style={{
          background: '#FFFFFF',
          border: '1px solid rgba(252,211,217,0.4)',
          boxShadow: '0 1px 8px rgba(214,109,129,0.06)',
        }}
      >
        <div className="hidden md:block">
          <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr style={{ borderBottom: '1px solid rgba(252,211,217,0.3)', background: '#FEF7F1' }}>
                {['Produto', 'Categoria', 'Qtd.', 'Custo', 'Preço de Venda', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-3 text-left text-xs font-medium whitespace-nowrap" style={{ color: '#59595D' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtrados.map(item => (
                <tr key={item.id} className="transition-colors hover:bg-pink-50 cursor-pointer" style={{ borderBottom: '1px solid rgba(252,211,217,0.2)' }}>
                  <td className="px-4 py-3"><div className="flex items-center gap-3"><img src={item.img} alt={item.nome} className="w-9 h-9 rounded-xl object-cover flex-shrink-0" style={{ background: '#FDE0E2' }} /><span className="font-medium whitespace-nowrap" style={{ color: '#1C1C1E' }}>{item.nome}</span></div></td>
                  <td className="px-4 py-3 whitespace-nowrap"><select value={item.categoria} onChange={event => void atualizarCategoria(item, event.target.value)} className="bg-transparent text-sm outline-none cursor-pointer" style={{ color: '#454549' }} aria-label={`Categoria de ${item.nome}`}>{categoriasTerrario.map(categoria => <option key={categoria} value={categoria}>{categoria}</option>)}</select></td>
                  <td className="px-4 py-3 whitespace-nowrap"><input type="number" min="0" step="1" value={item.quantidade} onChange={event => { const quantidade = Number(event.target.value); if (!Number.isFinite(quantidade) || quantidade < 0) return; setItens(prev => prev.map(entry => entry.id === item.id ? { ...entry, quantidade: Math.floor(quantidade) } : entry)); }} onBlur={event => void atualizarQuantidade(item.id, Number(event.target.value))} className="w-20 rounded-lg px-2 py-1 text-sm font-semibold outline-none" style={{ color: item.quantidade <= item.minimo ? '#C94B5F' : '#1C1C1E', border: '1px solid rgba(252,211,217,0.6)', background: '#FFF9F6' }} aria-label={`Quantidade em estoque de ${item.nome}`} /></td>
                  <td className="px-4 py-3 whitespace-nowrap" style={{ color: '#454549' }}>{item.custo}</td>
                  <td className="px-4 py-3 font-medium whitespace-nowrap" style={{ color: '#1C1C1E' }}>{item.preco}</td>
                  <td className="px-4 py-3"><span className="px-2.5 py-1 rounded-lg text-xs font-medium whitespace-nowrap" style={statusStyle(item.status)}>{item.status}</span></td>
                  <td className="px-4 py-3 text-right"><button type="button" onClick={() => { setProdutoEmEdicao(item); setMostrarModal(true); }} className="p-2 rounded-lg transition-colors hover:bg-pink-50" title="Editar produto" aria-label={`Editar ${item.nome}`}><Pencil size={15} style={{ color: '#D66D81' }} /></button><button type="button" onClick={() => void removerProduto(item)} className="p-2 rounded-lg transition-colors hover:bg-pink-50" title="Excluir produto" aria-label={`Excluir ${item.nome}`}><Trash2 size={15} style={{ color: '#C94B5F' }} /></button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        </div>
        <div className="md:hidden divide-y" style={{ borderColor: 'rgba(252,211,217,0.3)' }}>
        {filtrados.map(item => {
          const aberto = produtoExpandido === item.id;
          return (
            <div key={item.id}>
              <button type="button" onClick={() => setProdutoExpandido(aberto ? null : item.id)} className="w-full flex items-center gap-3 px-4 py-3 text-left" aria-expanded={aberto}>
                <img src={item.img} alt="" className="w-10 h-10 rounded-xl object-cover flex-shrink-0" style={{ background: '#FDE0E2' }} />
                <span className="flex-1 min-w-0 font-medium truncate" style={{ color: '#1C1C1E' }}>{item.nome}</span>
                <ChevronDown size={16} className={`transition-transform ${aberto ? 'rotate-180' : ''}`} style={{ color: '#D66D81' }} />
              </button>
              {aberto && (
                <div className="px-4 pb-4 space-y-3">
                  <div className="grid grid-cols-2 gap-3 text-sm">
                    <div><div className="text-xs mb-1" style={{ color: '#59595D' }}>Categoria</div><div style={{ color: '#454549' }}>{item.categoria}</div></div>
                    <div><div className="text-xs mb-1" style={{ color: '#59595D' }}>Quantidade</div><div className="font-semibold" style={{ color: item.quantidade <= item.minimo ? '#C94B5F' : '#1C1C1E' }}>{item.quantidade}</div></div>
                    <div><div className="text-xs mb-1" style={{ color: '#59595D' }}>Custo</div><div style={{ color: '#454549' }}>{item.custo}</div></div>
                    <div><div className="text-xs mb-1" style={{ color: '#59595D' }}>Preço de venda</div><div className="font-medium" style={{ color: '#1C1C1E' }}>{item.preco}</div></div>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="px-2.5 py-1 rounded-lg text-xs font-medium" style={statusStyle(item.status)}>{item.status}</span>
                    <div className="flex items-center">
                      <button type="button" onClick={() => { setProdutoEmEdicao(item); setMostrarModal(true); }} className="p-2 rounded-lg hover:bg-pink-50" title="Editar produto" aria-label={`Editar ${item.nome}`}><Pencil size={15} style={{ color: '#D66D81' }} /></button>
                      <button type="button" onClick={() => void removerProduto(item)} className="p-2 rounded-lg hover:bg-pink-50" title="Excluir produto" aria-label={`Excluir ${item.nome}`}><Trash2 size={15} style={{ color: '#C94B5F' }} /></button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filtrados.length === 0 && (
          <div className="py-16 text-center space-y-2">
            <div className="text-2xl">🌿</div>
            <div className="text-sm" style={{ color: '#59595D' }}>Nenhum item encontrado.</div>
            {(busca || filtroCategoria || filtroStatus) && (
              <button onClick={() => { setBusca(''); setFiltroCategoria(''); setFiltroStatus(''); }}
                className="text-xs font-medium" style={{ color: '#D66D81' }}>
                Limpar filtros
              </button>
            )}
          </div>
        )}
      </div>
      </div>

      {/* Modal */}
      {mostrarModal && (
        <NovoModal
          item={produtoEmEdicao}
          onClose={() => { setMostrarModal(false); setProdutoEmEdicao(null); }}
          onSave={produtoEmEdicao ? editarItem : adicionarItem}
        />
      )}
    </div>
  );
}
