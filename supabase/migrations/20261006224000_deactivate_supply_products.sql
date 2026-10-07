update public.products
set active = false, updated_at = now()
where type = 'supply';

update public.categories
set active = false
where product_type = 'supply';
