insert into public.categories (name, slug, product_type, sellable, sort_order, active)
values
  ('Terrários pequenos', 'terrarios-pequenos', 'terrarium', true, 1, true),
  ('Terrários médios', 'terrarios-medios', 'terrarium', true, 2, true),
  ('Terrários grandes', 'terrarios-grandes', 'terrarium', true, 3, true),
  ('Workshops', 'workshops', 'workshop', true, 4, true),
  ('Outro', 'outro', 'terrarium', true, 99, true)
on conflict (slug) do update set
  name = excluded.name,
  product_type = excluded.product_type,
  sellable = excluded.sellable,
  sort_order = excluded.sort_order,
  active = true;

update public.products
set category_id = (select id from public.categories where slug = 'outro' limit 1),
    updated_at = now()
where category_id is null
  and type in ('terrarium', 'workshop');
