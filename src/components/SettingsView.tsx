import { useEffect, useState } from 'react';
import { Store, Users, Edit3, Check, X, Moon, Copy, Send, UserPlus } from 'lucide-react';
import { supabase } from '../lib/supabase';

interface StoreInfo {
  nome: string;
  cnpj: string;
  email: string;
  telefone: string;
  endereco: string;
  cidade: string;
}

function EditableField({
  label,
  value,
  onChange,
  editing,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  editing: boolean;
}) {
  return (
    <div className="flex items-center justify-between gap-3">
      <span className="text-xs flex-shrink-0 w-24" style={{ color: '#6B6B6E' }}>{label}</span>
      {editing ? (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 px-3 py-1.5 rounded-lg text-xs outline-none transition-all"
          style={{
            background: '#FEF7F1',
            border: '1.5px solid #D66D81',
            color: '#1C1C1E',
          }}
        />
      ) : (
        <span
          className="flex-1 text-xs font-medium px-3 py-1.5 rounded-lg text-right"
          style={{ background: '#FEF7F1', color: '#1C1C1E' }}
        >
          {value}
        </span>
      )}
    </div>
  );
}

export default function SettingsView({ darkMode, onDarkModeChange }: { darkMode: boolean; onDarkModeChange: (enabled: boolean) => void }) {
  const [editingStore, setEditingStore] = useState(false);
  const [store, setStore] = useState<StoreInfo>({ nome: '', cnpj: '', email: '', telefone: '', endereco: '', cidade: '' });
  const [storeTemp, setStoreTemp] = useState<StoreInfo>(store);
  const [storeId, setStoreId] = useState('');
  const [error, setError] = useState('');
  const [settingsId, setSettingsId] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState<'seller' | 'admin'>('seller');
  const [inviteLink, setInviteLink] = useState('');
  const [inviteMessage, setInviteMessage] = useState('');
  const [inviteLoading, setInviteLoading] = useState(false);

  useEffect(() => {
    const loadStore = async () => {
      const { data: membership, error: membershipError } = await supabase.from('store_users').select('store_id').limit(1).single();
      if (membershipError || !membership) {
        setError(membershipError?.message ?? 'Loja não encontrada.');
        return;
      }
      setStoreId(membership.store_id);
      const { data: settings } = await supabase.from('store_settings').select('store_id, dark_mode').eq('store_id', membership.store_id).maybeSingle();
      setSettingsId(settings?.store_id ?? membership.store_id);
      if (settings?.dark_mode !== undefined) onDarkModeChange(settings.dark_mode);
      const { data, error: storeError } = await supabase.from('stores').select('name, cnpj, email, phone, address_line, city, state').eq('id', membership.store_id).single();
      if (storeError || !data) {
        setError(storeError?.message ?? 'Não foi possível carregar a loja.');
        return;
      }
      const loaded = { nome: data.name, cnpj: data.cnpj ?? '', email: data.email, telefone: data.phone, endereco: data.address_line, cidade: `${data.city} — ${data.state}` };
      setStore(loaded);
      setStoreTemp(loaded);
    };

    const toggleDarkMode = async () => {
      const enabled = !darkMode;
      onDarkModeChange(enabled);
      const { error: settingsError } = await supabase.from('store_settings').upsert({ store_id: settingsId || storeId, dark_mode: enabled }, { onConflict: 'store_id' });
      if (settingsError) setError(settingsError.message);
    };
    void loadStore();
  }, []);

  const startEdit = () => {
    setStoreTemp({ ...store });
    setEditingStore(true);
  };

  const saveEdit = async () => {
    const [cidade, estado = 'SP'] = storeTemp.cidade.split('—').map((part) => part.trim());
    const { error: saveError } = await supabase.from('stores').update({
      name: storeTemp.nome, cnpj: storeTemp.cnpj, email: storeTemp.email, phone: storeTemp.telefone,
      address_line: storeTemp.endereco, city: cidade, state: estado,
    }).eq('id', storeId);
    if (saveError) {
      setError(saveError.message);
      return;
    }
    setStore({ ...storeTemp });
    setEditingStore(false);
  };

  const cancelEdit = () => {
    setStoreTemp({ ...store });
    setEditingStore(false);
  };

  const storeFields: { label: string; key: keyof StoreInfo }[] = [
    { label: 'Nome', key: 'nome' },
    { label: 'CNPJ', key: 'cnpj' },
    { label: 'E-mail', key: 'email' },
    { label: 'Telefone', key: 'telefone' },
    { label: 'Endereço', key: 'endereco' },
    { label: 'Cidade', key: 'cidade' },
  ];

  const createInvitation = async () => {
    setInviteMessage('');
    setInviteLink('');
    if (!inviteEmail.trim() || !storeId) return;
    setInviteLoading(true);
    const tokenBytes = new Uint8Array(24);
    crypto.getRandomValues(tokenBytes);
    const token = Array.from(tokenBytes, byte => byte.toString(16).padStart(2, '0')).join('');
    const { error: inviteError } = await supabase.rpc('create_store_invitation', {
      p_store_id: storeId,
      p_email: inviteEmail.trim().toLowerCase(),
      p_role: inviteRole,
      p_token: token,
    });
    if (inviteError) {
      setInviteMessage(inviteError.message);
      setInviteLoading(false);
      return;
    }
    const link = `${window.location.origin}/?invite=${token}`;
    setInviteLink(link);
    setInviteMessage('Convite criado. Copie o link ou envie pelo seu aplicativo de e-mail.');
    setInviteLoading(false);
  };

  return (
    <div className="space-y-6 max-w-2xl">
      {error && <div className="rounded-xl px-4 py-3 text-sm" style={{ background: '#FDE0E2', color: '#C94B5F' }}>{error}</div>}
      <div>
        <h1
          className="text-2xl font-semibold"
          style={{ fontFamily: 'var(--font-display)', color: '#1C1C1E' }}
        >
          Configurações
        </h1>
        <p className="text-sm mt-1" style={{ color: '#A0A0A3' }}>
          Gerencie sua loja e preferências
        </p>
      </div>

      {/* Informações da Loja */}
      <div
        className="rounded-2xl p-5"
        style={{
          background: '#FFFFFF',
          border: '1px solid rgba(252, 211, 217, 0.4)',
          boxShadow: '0 1px 8px rgba(214, 109, 129, 0.06)',
        }}
      >
        <div className="flex items-center gap-3 mb-5">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: '#FDE0E2' }}
          >
            <Store size={16} style={{ color: '#D66D81' }} />
          </div>
          <div className="flex-1">
            <div className="font-semibold text-sm" style={{ color: '#1C1C1E' }}>Informações da Loja</div>
            <div className="text-xs" style={{ color: '#A0A0A3' }}>Dados cadastrais e de contato</div>
          </div>
          {editingStore ? (
            <div className="flex gap-2">
              <button
                onClick={cancelEdit}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors hover:bg-pink-50"
                style={{ border: '1px solid rgba(252, 211, 217, 0.5)' }}
              >
                <X size={14} style={{ color: '#A0A0A3' }} />
              </button>
              <button
                onClick={saveEdit}
                className="w-8 h-8 rounded-xl flex items-center justify-center transition-colors"
                style={{ background: 'linear-gradient(135deg, #E28B9B, #D66D81)' }}
              >
                <Check size={14} color="white" />
              </button>
            </div>
          ) : (
            <button
              onClick={startEdit}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-medium transition-colors hover:bg-pink-50"
              style={{
                border: '1px solid rgba(252, 211, 217, 0.5)',
                color: '#D66D81',
              }}
            >
              <Edit3 size={12} />
              Editar
            </button>
          )}
        </div>

        <div className="space-y-3">
          {storeFields.map(({ label, key }) => (
            <EditableField
              key={key}
              label={label}
              value={editingStore ? storeTemp[key] : store[key]}
              onChange={(v) => setStoreTemp((prev) => ({ ...prev, [key]: v }))}
              editing={editingStore}
            />
          ))}
        </div>

        {editingStore && (
          <div
            className="mt-4 px-3 py-2.5 rounded-xl text-xs"
            style={{ background: '#F9E8EC', color: '#D66D81' }}
          >
            Clique em ✓ para salvar as alterações ou × para cancelar.
          </div>
        )}
      </div>

      {/* Preferências */}
      <div
        className="rounded-2xl p-5"
        style={{
          background: '#FFFFFF',
          border: '1px solid rgba(252, 211, 217, 0.4)',
          boxShadow: '0 1px 8px rgba(214, 109, 129, 0.06)',
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: '#FDE0E2' }}
          >
            <Moon size={16} style={{ color: '#D66D81' }} />
          </div>
          <div>
            <div className="font-semibold text-sm" style={{ color: '#1C1C1E' }}>Aparência</div>
            <div className="text-xs" style={{ color: '#A0A0A3' }}>Preferências visuais da aplicação</div>
          </div>
        </div>
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <span className="text-xs" style={{ color: '#6B6B6E' }}>Tema escuro</span>
            <button type="button" onClick={() => void toggleDarkMode()} className="px-3 py-1.5 rounded-lg text-xs font-medium" style={{ background: darkMode ? '#D66D81' : '#FEF7F1', color: darkMode ? '#FFFFFF' : '#1C1C1E' }}>
              {darkMode ? 'Ativado' : 'Desativado'}
            </button>
          </div>
        </div>
      </div>

      {/* Usuários */}
      <div
        className="rounded-2xl p-5"
        style={{
          background: '#FFFFFF',
          border: '1px solid rgba(252, 211, 217, 0.4)',
          boxShadow: '0 1px 8px rgba(214, 109, 129, 0.06)',
        }}
      >
        <div className="flex items-center gap-3 mb-4">
          <div
            className="w-9 h-9 rounded-xl flex items-center justify-center"
            style={{ background: '#FDE0E2' }}
          >
            <Users size={16} style={{ color: '#D66D81' }} />
          </div>
          <div>
            <div className="font-semibold text-sm" style={{ color: '#1C1C1E' }}>Usuários & Acesso</div>
            <div className="text-xs" style={{ color: '#A0A0A3' }}>Permissões da equipe</div>
          </div>
        </div>
        <div className="space-y-3">
          {[
            { label: 'Administrador', value: 'Conta atual' },
            { label: 'Vendedor', value: 'Nenhum usuário adicional' },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-xs" style={{ color: '#6B6B6E' }}>{label}</span>
              <span
                className="text-xs font-medium px-3 py-1.5 rounded-lg"
                style={{ background: '#FEF7F1', color: '#1C1C1E' }}
              >
                {value}
              </span>
            </div>
          ))}
        </div>
        <div className="mt-5 pt-5 border-t" style={{ borderColor: 'rgba(252,211,217,0.4)' }}>
          <div className="flex items-center gap-2 mb-3">
            <UserPlus size={15} style={{ color: '#D66D81' }} />
            <span className="text-sm font-semibold" style={{ color: '#1C1C1E' }}>Convidar usuário</span>
          </div>
          <div className="grid sm:grid-cols-[1fr_auto] gap-2">
            <input type="email" value={inviteEmail} onChange={e => setInviteEmail(e.target.value)} placeholder="email@equipe.com" className="px-3 py-2.5 rounded-xl text-xs outline-none" style={{ background: '#FEF7F1', border: '1px solid rgba(252,211,217,0.6)' }} />
            <select value={inviteRole} onChange={e => setInviteRole(e.target.value as 'seller' | 'admin')} className="px-3 py-2.5 rounded-xl text-xs outline-none" style={{ background: '#FEF7F1', border: '1px solid rgba(252,211,217,0.6)' }}>
              <option value="seller">Vendedor</option>
              <option value="admin">Administrador</option>
            </select>
          </div>
          <button onClick={() => void createInvitation()} disabled={inviteLoading || !inviteEmail.trim()} className="mt-2 flex items-center gap-2 px-3 py-2 rounded-xl text-xs font-semibold text-white disabled:opacity-50" style={{ background: 'linear-gradient(135deg, #E28B9B, #D66D81)' }}>
            <Send size={13} /> {inviteLoading ? 'Gerando...' : 'Gerar convite'}
          </button>
          {inviteMessage && <div className="mt-3 text-xs" style={{ color: inviteLink ? '#D66D81' : '#C94B5F' }}>{inviteMessage}</div>}
          {inviteLink && <div className="mt-2 flex gap-2 items-center"><input readOnly value={inviteLink} className="min-w-0 flex-1 px-3 py-2 rounded-lg text-xs" style={{ background: '#FEF7F1', color: '#6B6B6E' }} /><button onClick={() => void navigator.clipboard.writeText(inviteLink)} className="p-2 rounded-lg" title="Copiar link"><Copy size={14} style={{ color: '#D66D81' }} /></button><a href={`mailto:${inviteEmail}?subject=Convite Bromélia Terrários&body=Você foi convidado para acessar o sistema. Use este link: ${encodeURIComponent(inviteLink)}`} className="p-2 rounded-lg" title="Enviar por e-mail"><Send size={14} style={{ color: '#D66D81' }} /></a></div>}
        </div>
      </div>
    </div>
  );
}
