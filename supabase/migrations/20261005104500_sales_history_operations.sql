create or replace function public.record_historical_sale(
  p_store_id uuid,
  p_payment_method public.payment_method,
  p_discount_percent numeric,
  p_sale_date timestamptz,
  p_items jsonb
) returns uuid language plpgsql security definer set search_path = public as $$
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
  if current_user_id is null or not public.is_store_member(p_store_id) then
    raise exception 'Usuário não autorizado para esta loja';
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
    if requested_quantity <= 0 then raise exception 'Quantidade inválida'; end if;
    select p.*
      into product_row
      from public.products p
      where p.id = (item->>'product_id')::uuid
        and p.store_id = p_store_id and p.active and p.sellable
      for update;
    if not found then raise exception 'Produto não encontrado'; end if;
    if not exists (select 1 from public.inventory_levels il where il.product_id = product_row.id) then
      raise exception 'Estoque não encontrado para %', product_row.name;
    end if;
    select il.quantity into before_quantity
      from public.inventory_levels il
      where il.product_id = product_row.id
      for update;
    if before_quantity < requested_quantity then
      raise exception 'Estoque insuficiente para %', product_row.name;
    end if;
    subtotal := subtotal + product_row.sale_price * requested_quantity;
  end loop;

  discount_amount := round(subtotal * p_discount_percent / 100, 2);
  sale_total := subtotal - discount_amount;
  insert into public.sales (
    store_id, status, subtotal, discount_percent, discount_amount, total,
    created_by, paid_at, created_at, updated_at
  ) values (
    p_store_id, 'paid', subtotal, p_discount_percent, discount_amount, sale_total,
    current_user_id, p_sale_date, p_sale_date, p_sale_date
  ) returning id into sale_id;

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
    ) values (
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
    ) values (
      p_store_id, product_row.id, 'sale', -requested_quantity,
      before_quantity, before_quantity - requested_quantity, sale_id,
      current_user_id, p_sale_date
    );
  end loop;

  insert into public.payments (sale_id, method, amount, status, paid_at, created_at)
  values (sale_id, p_payment_method, sale_total, 'approved', p_sale_date, p_sale_date);
  return sale_id;
end $$;

create or replace function public.delete_sale(p_sale_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  sale_row record;
  movement_row record;
begin
  select * into sale_row from public.sales where id = p_sale_id for update;
  if not found or not public.is_store_member(sale_row.store_id) then
    raise exception 'Venda não encontrada ou usuário não autorizado';
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
end $$;

revoke all on function public.record_historical_sale(uuid, public.payment_method, numeric, timestamptz, jsonb) from public;
grant execute on function public.record_historical_sale(uuid, public.payment_method, numeric, timestamptz, jsonb) to authenticated;
revoke all on function public.delete_sale(uuid) from public;
grant execute on function public.delete_sale(uuid) to authenticated;
