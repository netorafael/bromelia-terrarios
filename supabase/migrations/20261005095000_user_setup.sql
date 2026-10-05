create or replace function public.ensure_current_user_setup() returns uuid
language plpgsql security definer set search_path = public as $$
declare store_id uuid; user_email text;
begin
  if auth.uid() is null then raise exception 'Usuário não autenticado'; end if;
  select email into user_email from auth.users where id = auth.uid();
  insert into public.users (id, username, display_name, email)
  values (auth.uid(), split_part(coalesce(user_email, 'usuario'), '@', 1), split_part(coalesce(user_email, 'usuario'), '@', 1), user_email)
  on conflict (id) do update set email = excluded.email, updated_at = now();
  select su.store_id into store_id from public.store_users su where su.user_id = auth.uid() limit 1;
  if store_id is null then
    select id into store_id from public.stores where cnpj = '12345678000199' limit 1;
    if store_id is null then
      insert into public.stores (name, cnpj, email, phone, address_line, city, state)
      values ('Bromélia Terrários', '12345678000199', 'ola@bromeliaterrarios.com.br', '(11) 99999-8888', 'Rua das Bromélias, 42', 'São Paulo', 'SP')
      returning id into store_id;
    end if;
    insert into public.store_users (store_id, user_id, role) values (store_id, auth.uid(), 'admin')
    on conflict do nothing;
  end if;
  insert into public.store_settings (store_id) values (store_id) on conflict do nothing;
  return store_id;
end $$;
grant execute on function public.ensure_current_user_setup() to authenticated;
