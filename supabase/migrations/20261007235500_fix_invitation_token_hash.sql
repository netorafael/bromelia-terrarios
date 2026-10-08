-- Supabase exposes pgcrypto functions through the extensions schema.
create extension if not exists pgcrypto schema extensions;

create or replace function public.create_store_invitation(
  p_store_id uuid,
  p_email text,
  p_role public.user_role,
  p_token text
)
returns uuid
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  invitation_id uuid;
begin
  if not public.is_store_admin(p_store_id) then
    raise exception 'Apenas administradores podem criar convites';
  end if;
  if p_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$' then
    raise exception 'E-mail inválido';
  end if;
  if length(p_token) < 32 then
    raise exception 'Token de convite inválido';
  end if;
  update public.store_invitations
  set status = 'revoked'
  where store_id = p_store_id
    and lower(email) = lower(p_email)
    and status = 'pending';
  insert into public.store_invitations (
    store_id, email, role, token_hash, expires_at, invited_by
  )
  values (
    p_store_id,
    lower(trim(p_email)),
    p_role,
    encode(extensions.digest(p_token, 'sha256'::text), 'hex'),
    now() + interval '48 hours',
    auth.uid()
  )
  returning id into invitation_id;
  return invitation_id;
end;
$$;

create or replace function public.accept_store_invitation(p_token text)
returns void
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  invitation record;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;
  select *
  into invitation
  from public.store_invitations
  where token_hash = encode(extensions.digest(p_token, 'sha256'::text), 'hex')
    and status = 'pending'
    and expires_at > now()
  for update;
  if not found then
    raise exception 'Convite inválido ou expirado';
  end if;
  if lower((select email from auth.users where id = auth.uid())) <> lower(invitation.email) then
    raise exception 'O e-mail da conta não corresponde ao convite';
  end if;
  insert into public.store_users (store_id, user_id, role)
  values (invitation.store_id, auth.uid(), invitation.role)
  on conflict (store_id, user_id) do update set role = excluded.role;
  update public.store_invitations
  set status = 'accepted', accepted_by = auth.uid(), accepted_at = now()
  where id = invitation.id;
end;
$$;

revoke all on function public.create_store_invitation(uuid, text, public.user_role, text) from public;
grant execute on function public.create_store_invitation(uuid, text, public.user_role, text) to authenticated;
revoke all on function public.accept_store_invitation(text) from public;
grant execute on function public.accept_store_invitation(text) to authenticated;
