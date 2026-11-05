-- Run once in the existing Maha Duck Supabase SQL Editor before deploying the VAT update.
-- Existing orders retain their original totals and VAT 0. No orders are deleted.
begin;

drop function if exists public.order_status(text);
drop policy if exists "customers can place orders" on public.orders;
drop trigger if exists orders_validate_amounts on public.orders;
alter table public.orders add column if not exists vat_rate smallint not null default 0;
alter table public.orders add column if not exists vat_amount numeric(12,2) not null default 0;
alter table public.orders alter column total type numeric(12,2);
alter table public.orders alter column cash_received type numeric(12,2);
alter table public.orders drop constraint if exists orders_vat_rate_check;
alter table public.orders add constraint orders_vat_rate_check check (vat_rate in (0,7));
alter table public.orders drop constraint if exists orders_vat_amount_check;
alter table public.orders add constraint orders_vat_amount_check check (vat_amount >= 0);

create or replace function public.validate_order_amounts()
returns trigger language plpgsql as $$
declare
  item jsonb;
  qty integer;
  unit_price integer;
  line_total integer;
  calc_subtotal integer := 0;
begin
  if jsonb_typeof(new.items) <> 'array' or jsonb_array_length(new.items) < 1 or jsonb_array_length(new.items) > 60 then
    raise exception 'Order must include 1 to 60 items';
  end if;
  for item in select * from jsonb_array_elements(new.items) loop
    qty := (item ->> 'qty')::integer;
    unit_price := (item ->> 'unit_price')::integer;
    line_total := (item ->> 'line_total')::integer;
    if qty < 1 or qty > 99 or unit_price < 0 or line_total <> qty * unit_price then
      raise exception 'Invalid order line total';
    end if;
    calc_subtotal := calc_subtotal + line_total;
  end loop;
  if new.subtotal <> calc_subtotal then
    raise exception 'Invalid order subtotal';
  end if;
  if new.delivery_fee is not null and new.delivery_fee < 0 then
    raise exception 'Invalid delivery fee';
  end if;
  if tg_op = 'INSERT' then
    new.vat_rate := case when new.source = 'online' and new.order_type <> 'dinein' then 7 else 0 end;
  elsif new.vat_rate is distinct from old.vat_rate then
    raise exception 'VAT rate cannot be changed on an existing order';
  end if;
  if (new.source <> 'online' or new.order_type = 'dinein') and new.vat_rate <> 0 then
    raise exception 'VAT applies only to online pickup/delivery orders';
  end if;
  new.vat_amount := round(new.subtotal * new.vat_rate / 100.0, 2);
  if new.total <> new.subtotal + coalesce(new.delivery_fee, 0) + new.vat_amount then
    raise exception 'Invalid order total';
  end if;
  if new.cash_received is not null and new.cash_received < 0 then
    raise exception 'Invalid cash amount';
  end if;
  if new.payment_status = 'paid' and new.cash_received is not null and new.cash_received < new.total then
    raise exception 'Cash received is lower than order total';
  end if;
  return new;
exception when invalid_text_representation then
  raise exception 'Invalid order amount format';
end $$;

drop trigger if exists orders_validate_amounts on public.orders;
create trigger orders_validate_amounts before insert or update of items, subtotal, delivery_fee, total, cash_received, payment_status, vat_rate, vat_amount, source, order_type
  on public.orders for each row execute function public.validate_order_amounts();

drop policy if exists "customers can place orders" on public.orders;
create policy "customers can place orders" on public.orders
  for insert to anon, authenticated
  with check (status = 'new' and source = 'online' and payment_status = 'unpaid'
              and cash_received is null and has_slip = false
              and delivery_provider is null and delivery_started_at is null
              and vat_rate = case when order_type <> 'dinein' then 7 else 0 end
              and vat_amount = round(subtotal * vat_rate / 100.0, 2)
              and total = subtotal + coalesce(delivery_fee, 0) + vat_amount);

create function public.order_status(p_code text)
returns table (status text, total numeric, created_at timestamptz, payment_status text, order_type text, delivery_provider text, delivery_started_at timestamptz)
language sql stable security definer set search_path = public as $$
  select o.status, o.total, o.created_at, o.payment_status, o.order_type, o.delivery_provider, o.delivery_started_at
    from public.orders o where o.code = upper(trim(p_code)) limit 1;
$$;
revoke all on function public.order_status(text) from public;
grant execute on function public.order_status(text) to anon, authenticated;

notify pgrst, 'reload schema';
commit;
