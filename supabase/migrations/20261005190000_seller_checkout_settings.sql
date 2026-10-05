alter type public.payment_method add value if not exists 'card_credit';
alter type public.payment_method add value if not exists 'card_debit';

alter table public.sales
  add column if not exists seller_id uuid references public.users(id),
  add column if not exists seller_name varchar(160);

alter table public.store_settings
  add column if not exists dark_mode boolean not null default false;

update public.sales s
set seller_id = s.created_by,
    seller_name = coalesce(u.display_name, u.username, u.email)
from public.users u
where u.id = s.created_by
  and (s.seller_id is null or s.seller_name is null);

create or replace function public.finalize_sale(
  p_store_id uuid, p_payment_method public.payment_method,
  p_discount_percent numeric, p_items jsonb,
  p_final_total numeric default null
) returns uuid language plpgsql security definer set search_path = public as $$
declare
  current_user_id uuid := auth.uid();
  current_user_name text;
  sale_id uuid;
  item jsonb;
  product_row record;
  subtotal numeric(12,2) := 0;
  discount_amount numeric(12,2) := 0;
  sale_total numeric(12,2);
  before_quantity integer;
  available_quantity integer;
  requested_quantity integer;
begin
  if current_user_id is null or not public.is_store_member(p_store_id) then
    raise exception 'Usuário não autorizado para esta loja';
  end if;
  select coalesce(display_name, username, email)
    into current_user_name from public.users where id = current_user_id;
  if jsonb_array_length(p_items) = 0 then raise exception 'A venda precisa ter itens'; end if;
  if p_discount_percent < 0 or p_discount_percent > 100 then raise exception 'Desconto inválido'; end if;

  for item in select * from jsonb_array_elements(p_items) loop
    requested_quantity := (item->>'quantity')::integer;
    if requested_quantity <= 0 then raise exception 'Quantidade inválida'; end if;
    select p.* into product_row from public.products p
      where p.id = (item->>'product_id')::uuid and p.store_id = p_store_id and p.active and p.sellable
      for update;
    if not found then raise exception 'Produto não encontrado'; end if;
    select il.quantity into available_quantity from public.inventory_levels il
      where il.product_id = product_row.id for update;
    if not found or available_quantity < requested_quantity then
      raise exception 'Estoque insuficiente para %', product_row.name;
    end if;
    subtotal := subtotal + product_row.sale_price * requested_quantity;
  end loop;

  if p_final_total is null then
    discount_amount := round(subtotal * p_discount_percent / 100, 2);
    sale_total := subtotal - discount_amount;
  else
    sale_total := round(p_final_total, 2);
    if sale_total < 0 or sale_total > subtotal then raise exception 'Valor final inválido'; end if;
    discount_amount := subtotal - sale_total;
  end if;

  insert into public.sales (
    store_id, status, subtotal, discount_percent, discount_amount, total,
    created_by, seller_id, seller_name, paid_at
  ) values (
    p_store_id, 'paid', subtotal, 0, discount_amount, sale_total,
    current_user_id, current_user_id, current_user_name, now()
  ) returning id into sale_id;

  for item in select * from jsonb_array_elements(p_items) loop
    requested_quantity := (item->>'quantity')::integer;
    select p.*, il.quantity into product_row from public.products p
      join public.inventory_levels il on il.product_id = p.id
      where p.id = (item->>'product_id')::uuid and p.store_id = p_store_id
      for update;
    before_quantity := product_row.quantity;
    insert into public.sale_items (sale_id, product_id, product_name_snapshot, sku_snapshot, unit_price, unit_cost_snapshot, quantity, line_total)
    values (sale_id, product_row.id, product_row.name, product_row.sku, product_row.sale_price, product_row.cost_price, requested_quantity, product_row.sale_price * requested_quantity);
    update public.inventory_levels set quantity = quantity - requested_quantity, updated_at = now() where product_id = product_row.id;
    insert into public.stock_movements (store_id, product_id, type, quantity_delta, quantity_before, quantity_after, sale_id, created_by)
    values (p_store_id, product_row.id, 'sale', -requested_quantity, before_quantity, before_quantity - requested_quantity, sale_id, current_user_id);
  end loop;

  insert into public.payments (sale_id, method, amount, status, paid_at)
  values (sale_id, p_payment_method, sale_total, 'approved', now());
  return sale_id;
end $$;

revoke all on function public.finalize_sale(uuid, public.payment_method, numeric, jsonb, numeric) from public;
grant execute on function public.finalize_sale(uuid, public.payment_method, numeric, jsonb, numeric) to authenticated;
