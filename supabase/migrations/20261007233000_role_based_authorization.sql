-- Keep existing memberships unchanged while making every privileged operation
-- depend on the member role.

create or replace function public.is_store_admin(target_store uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.store_users
    where store_id = target_store
      and user_id = auth.uid()
      and role = 'admin'::public.user_role
  );
$$;

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
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

create or replace function public.ensure_current_user_setup()
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  store_id uuid;
  user_email text;
begin
  if auth.uid() is null then
    raise exception 'Usuário não autenticado';
  end if;
  select email into user_email from auth.users where id = auth.uid();
  insert into public.users (id, username, display_name, email)
  values (
    auth.uid(),
    split_part(coalesce(user_email, 'usuario'), '@', 1),
    split_part(coalesce(user_email, 'usuario'), '@', 1),
    user_email
  )
  on conflict (id) do update
    set email = excluded.email, updated_at = now();
  select su.store_id into store_id
  from public.store_users su
  where su.user_id = auth.uid()
  limit 1;
  if store_id is not null then
    insert into public.store_settings (store_id)
    values (store_id)
    on conflict do nothing;
  end if;
  return store_id;
end;
$$;

create or replace function public.set_inventory_quantity(
  p_product_id uuid,
  p_quantity integer
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  product_store uuid;
  before_quantity integer;
begin
  if p_quantity < 0 then
    raise exception 'Quantidade inválida';
  end if;
  select store_id into product_store
  from public.products
  where id = p_product_id and active
  for update;
  if product_store is null or not public.is_store_admin(product_store) then
    raise exception 'Apenas administradores podem alterar o estoque';
  end if;
  select quantity into before_quantity
  from public.inventory_levels
  where product_id = p_product_id
  for update;
  if before_quantity is null then
    raise exception 'Estoque não encontrado';
  end if;
  update public.inventory_levels
  set quantity = p_quantity, updated_at = now()
  where product_id = p_product_id;
  if before_quantity <> p_quantity then
    insert into public.stock_movements (
      store_id, product_id, type, quantity_delta, quantity_before,
      quantity_after, notes, created_by
    )
    values (
      product_store, p_product_id, 'adjustment',
      p_quantity - before_quantity, before_quantity, p_quantity,
      'Ajuste manual por administrador', auth.uid()
    );
  end if;
end;
$$;

create or replace function public.delete_sale(p_sale_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  sale_row record;
  movement_row record;
begin
  select * into sale_row from public.sales where id = p_sale_id for update;
  if not found or not public.is_store_admin(sale_row.store_id) then
    raise exception 'Apenas administradores podem excluir vendas';
  end if;
  for movement_row in
    select product_id, quantity_delta
    from public.stock_movements
    where sale_id = p_sale_id
    for update
  loop
    update public.inventory_levels
    set quantity = quantity - movement_row.quantity_delta, updated_at = now()
    where product_id = movement_row.product_id;
  end loop;
  delete from public.stock_movements where sale_id = p_sale_id;
  delete from public.sales where id = p_sale_id;
end;
$$;

-- Replace broad policies with operation-specific policies.
drop policy if exists "members can read stores" on public.stores;
drop policy if exists "users can read own profile" on public.users;
drop policy if exists "members can read memberships" on public.store_users;
drop policy if exists "members manage categories" on public.categories;
drop policy if exists "members manage products" on public.products;
drop policy if exists "members manage inventory" on public.inventory_levels;
drop policy if exists "members manage sales" on public.sales;
drop policy if exists "members manage sale items" on public.sale_items;
drop policy if exists "members manage payments" on public.payments;
drop policy if exists "members manage movements" on public.stock_movements;
drop policy if exists "members manage settings" on public.store_settings;
drop policy if exists "users manage own preferences" on public.notification_preferences;

create policy "members select stores" on public.stores
for select using (public.is_store_member(id));
create policy "users select own profile" on public.users
for select using (id = auth.uid());
create policy "members select memberships" on public.store_users
for select using (user_id = auth.uid() or public.is_store_admin(store_id));
create policy "members select categories" on public.categories
for select using (auth.uid() is not null);
create policy "members select products" on public.products
for select using (public.is_store_member(store_id));
create policy "admins insert products" on public.products
for insert with check (public.is_store_admin(store_id));
create policy "admins update products" on public.products
for update using (public.is_store_admin(store_id)) with check (public.is_store_admin(store_id));
create policy "admins delete products" on public.products
for delete using (public.is_store_admin(store_id));
create policy "members select inventory" on public.inventory_levels
for select using (exists (
  select 1 from public.products p
  where p.id = product_id and public.is_store_member(p.store_id)
));
create policy "admins insert inventory" on public.inventory_levels
for insert with check (exists (
  select 1 from public.products p
  where p.id = product_id and public.is_store_admin(p.store_id)
));
create policy "admins update inventory" on public.inventory_levels
for update using (exists (
  select 1 from public.products p
  where p.id = product_id and public.is_store_admin(p.store_id)
)) with check (exists (
  select 1 from public.products p
  where p.id = product_id and public.is_store_admin(p.store_id)
));
create policy "admins delete inventory" on public.inventory_levels
for delete using (exists (
  select 1 from public.products p
  where p.id = product_id and public.is_store_admin(p.store_id)
));
create policy "members select sales" on public.sales
for select using (public.is_store_member(store_id));
create policy "admins update sales" on public.sales
for update using (public.is_store_admin(store_id)) with check (public.is_store_admin(store_id));
create policy "admins delete sales" on public.sales
for delete using (public.is_store_admin(store_id));
create policy "members select sale items" on public.sale_items
for select using (exists (
  select 1 from public.sales s
  where s.id = sale_id and public.is_store_member(s.store_id)
));
create policy "members select payments" on public.payments
for select using (exists (
  select 1 from public.sales s
  where s.id = sale_id and public.is_store_member(s.store_id)
));
create policy "members select movements" on public.stock_movements
for select using (public.is_store_member(store_id));
create policy "members select settings" on public.store_settings
for select using (public.is_store_member(store_id));
create policy "admins insert settings" on public.store_settings
for insert with check (public.is_store_admin(store_id));
create policy "admins update settings" on public.store_settings
for update using (public.is_store_admin(store_id)) with check (public.is_store_admin(store_id));
create policy "admins delete settings" on public.store_settings
for delete using (public.is_store_admin(store_id));
create policy "users select own preferences" on public.notification_preferences
for select using (user_id = auth.uid());
create policy "users insert own preferences" on public.notification_preferences
for insert with check (user_id = auth.uid() and public.is_store_member(store_id));
create policy "users update own preferences" on public.notification_preferences
for update using (user_id = auth.uid()) with check (user_id = auth.uid() and public.is_store_member(store_id));
create policy "users delete own preferences" on public.notification_preferences
for delete using (user_id = auth.uid());

revoke all on function public.set_inventory_quantity(uuid, integer) from public;
grant execute on function public.set_inventory_quantity(uuid, integer) to authenticated;
revoke all on function public.delete_sale(uuid) from public;
grant execute on function public.delete_sale(uuid) to authenticated;

create or replace function public.record_historical_sale(
  p_store_id uuid,
  p_payment_method public.payment_method,
  p_discount_percent numeric,
  p_sale_date timestamptz,
  p_items jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  current_user_id uuid := auth.uid();
  sale_id uuid;
  item jsonb;
  product_row record;
  subtotal numeric(12,2) := 0;
  discount_amount numeric(12,2);
  sale_total numeric(12,2);
  before_quantity integer;
  requested_quantity integer;
begin
  if current_user_id is null or not public.is_store_admin(p_store_id) then
    raise exception 'Apenas administradores podem registrar vendas históricas';
  end if;
  if p_sale_date is null or p_sale_date > now() then
    raise exception 'A data da venda deve ser válida e não pode estar no futuro';
  end if;
  if jsonb_array_length(p_items) = 0 then
    raise exception 'A venda precisa ter itens';
  end if;
  if p_discount_percent < 0 or p_discount_percent > 100 then
    raise exception 'Desconto inválido';
  end if;

  for item in select * from jsonb_array_elements(p_items) loop
    requested_quantity := (item->>'quantity')::integer;
    if requested_quantity <= 0 then
      raise exception 'Quantidade inválida';
    end if;
    select p.* into product_row
    from public.products p
    where p.id = (item->>'product_id')::uuid
      and p.store_id = p_store_id and p.active and p.sellable
    for update;
    if not found then
      raise exception 'Produto não encontrado';
    end if;
    select il.quantity into before_quantity
    from public.inventory_levels il
    where il.product_id = product_row.id
    for update;
    if before_quantity is null or before_quantity < requested_quantity then
      raise exception 'Estoque insuficiente para %', product_row.name;
    end if;
    subtotal := subtotal + product_row.sale_price * requested_quantity;
  end loop;

  discount_amount := round(subtotal * p_discount_percent / 100, 2);
  sale_total := subtotal - discount_amount;
  insert into public.sales (
    store_id, status, subtotal, discount_percent, discount_amount, total,
    created_by, paid_at, created_at, updated_at
  )
  values (
    p_store_id, 'paid', subtotal, p_discount_percent, discount_amount, sale_total,
    current_user_id, p_sale_date, p_sale_date, p_sale_date
  )
  returning id into sale_id;

  for item in select * from jsonb_array_elements(p_items) loop
    requested_quantity := (item->>'quantity')::integer;
    select p.*, il.quantity into product_row
    from public.products p
    join public.inventory_levels il on il.product_id = p.id
    where p.id = (item->>'product_id')::uuid and p.store_id = p_store_id
    for update;
    before_quantity := product_row.quantity;
    insert into public.sale_items (
      sale_id, product_id, product_name_snapshot, sku_snapshot, unit_price,
      unit_cost_snapshot, quantity, line_total
    )
    values (
      sale_id, product_row.id, product_row.name, product_row.sku,
      product_row.sale_price, product_row.cost_price, requested_quantity,
      product_row.sale_price * requested_quantity
    );
    update public.inventory_levels
    set quantity = quantity - requested_quantity, updated_at = now()
    where product_id = product_row.id;
    insert into public.stock_movements (
      store_id, product_id, type, quantity_delta, quantity_before,
      quantity_after, sale_id, created_by, created_at
    )
    values (
      p_store_id, product_row.id, 'sale', -requested_quantity,
      before_quantity, before_quantity - requested_quantity, sale_id,
      current_user_id, p_sale_date
    );
  end loop;

  insert into public.payments (sale_id, method, amount, status, paid_at, created_at)
  values (sale_id, p_payment_method, sale_total, 'approved', p_sale_date, p_sale_date);
  return sale_id;
end;
$$;

revoke all on function public.record_historical_sale(uuid, public.payment_method, numeric, timestamptz, jsonb) from public;
grant execute on function public.record_historical_sale(uuid, public.payment_method, numeric, timestamptz, jsonb) to authenticated;
