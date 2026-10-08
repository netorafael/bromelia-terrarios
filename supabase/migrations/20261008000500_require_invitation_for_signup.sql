-- New accounts must carry a valid invitation token in their signup metadata.
-- Existing accounts and memberships are not changed.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  invitation_token text := new.raw_user_meta_data->>'invite_token';
begin
  if invitation_token is null or length(invitation_token) < 32 then
    raise exception 'É necessário um convite válido para criar uma conta';
  end if;
  if not exists (
    select 1
    from public.store_invitations
    where token_hash = encode(extensions.digest(invitation_token, 'sha256'::text), 'hex')
      and lower(email) = lower(new.email)
      and status = 'pending'
      and expires_at > now()
  ) then
    raise exception 'Convite inválido, expirado ou incompatível com este e-mail';
  end if;
  insert into public.users (id, username, display_name, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.email
  )
  on conflict (id) do update
    set email = excluded.email, updated_at = now();
  return new;
end;
$$;
