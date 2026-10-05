-- =========================================================================
-- MAHA DUCK — Supabase database setup
-- Supabase Dashboard → SQL Editor → New query → ဒီ file တစ်ခုလုံး paste → Run
-- (အောက်ဆုံးက staff email ကို ကိုယ့် email နဲ့ အရင်ပြောင်းပါ)
-- Version 4 (POS + PromptPay + Slip + delivery tracking). ယခင် version run ပြီးသားဆိုရင်လည်း ဒီ file ကို ထပ် run လို့ရပါတယ်။
-- =========================================================================

-- 1) Orders ----------------------------------------------------------------
create table if not exists public.orders (
  id            uuid primary key default gen_random_uuid(),
  code          text not null unique,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz,
  status        text not null default 'new'
                check (status in ('new','preparing','ready','out_for_delivery','completed','cancelled')),
  order_type    text not null check (order_type in ('delivery','pickup','dinein')),
  table_no      text,
  customer_name text not null check (char_length(customer_name) between 1 and 60),
  phone         text check (phone is null or char_length(phone) <= 20),
  address       text check (address is null or char_length(address) <= 300),
  map_link      text check (map_link is null or char_length(map_link) <= 300),
  pickup_time   text,
  payment       text not null default 'cash',
  note          text check (note is null or char_length(note) <= 300),
  items         jsonb not null check (jsonb_typeof(items) = 'array' and jsonb_array_length(items) between 1 and 60),
  subtotal      integer not null check (subtotal >= 0),
  delivery_fee  integer,
  total         integer not null check (total >= 0),
  lang          text
);
create index if not exists orders_created_at_idx on public.orders (created_at desc);

-- v2: POS + payment tracking (safe to re-run on an existing database)
alter table public.orders add column if not exists source text not null default 'online';
alter table public.orders add column if not exists payment_status text not null default 'unpaid';
alter table public.orders add column if not exists cash_received integer;
alter table public.orders drop constraint if exists orders_source_check;
alter table public.orders add constraint orders_source_check check (source in ('online','pos'));
alter table public.orders drop constraint if exists orders_payment_status_check;
alter table public.orders add constraint orders_payment_status_check check (payment_status in ('unpaid','claimed','paid'));

-- v4: delivery handoff tracking
alter table public.orders add column if not exists delivery_provider text check (delivery_provider is null or char_length(delivery_provider) <= 80);
alter table public.orders add column if not exists delivery_started_at timestamptz;
alter table public.orders drop constraint if exists orders_status_check;
alter table public.orders add constraint orders_status_check check (status in ('new','preparing','ready','out_for_delivery','completed','cancelled'));

-- v3: payment slip (customer attaches the transfer slip; staff see it on the dashboard)
alter table public.orders add column if not exists has_slip boolean not null default false;
create table if not exists public.order_slips (
  code       text primary key references public.orders(code) on delete cascade,
  image      text not null check (char_length(image) <= 700000),
  created_at timestamptz not null default now()
);

-- 2) Shop settings (open / pause online orders, notice banner) -----------
create table if not exists public.settings (
  id               int primary key default 1 check (id = 1),
  accepting_orders boolean not null default true,
  notice           text default ''
);
insert into public.settings (id) values (1) on conflict (id) do nothing;

-- 3) Staff list — only these emails can see / update orders --------------
create table if not exists public.staff (
  email text primary key
);

create or replace function public.is_staff()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.staff where lower(email) = lower(auth.jwt() ->> 'email'));
$$;

-- 4) Row Level Security ----------------------------------------------------
alter table public.orders   enable row level security;
alter table public.settings enable row level security;
alter table public.staff    enable row level security;

drop policy if exists "customers can place orders" on public.orders;
create policy "customers can place orders" on public.orders
  for insert to anon, authenticated
  with check (status = 'new' and source = 'online' and payment_status = 'unpaid'
              and cash_received is null and has_slip = false
              and delivery_provider is null and delivery_started_at is null
              and total = subtotal + coalesce(delivery_fee, 0));

drop policy if exists "staff create orders (POS)" on public.orders;
create policy "staff create orders (POS)" on public.orders
  for insert to authenticated with check (public.is_staff());

drop policy if exists "staff read orders" on public.orders;
create policy "staff read orders" on public.orders
  for select to authenticated using (public.is_staff());

drop policy if exists "staff update orders" on public.orders;
create policy "staff update orders" on public.orders
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

drop policy if exists "anyone reads settings" on public.settings;
create policy "anyone reads settings" on public.settings
  for select to anon, authenticated using (true);

drop policy if exists "staff update settings" on public.settings;
create policy "staff update settings" on public.settings
  for update to authenticated using (public.is_staff()) with check (public.is_staff());

-- 5) Customers can check status and delivery handoff for their order code --
drop function if exists public.order_status(text);
create function public.order_status(p_code text)
returns table (status text, total integer, created_at timestamptz, payment_status text, order_type text, delivery_provider text, delivery_started_at timestamptz)
language sql stable security definer set search_path = public as $$
  select o.status, o.total, o.created_at, o.payment_status, o.order_type, o.delivery_provider, o.delivery_started_at from public.orders o where o.code = upper(trim(p_code)) limit 1;
$$;
revoke all on function public.order_status(text) from public;
grant execute on function public.order_status(text) to anon, authenticated;

-- Customer taps "I've paid" (PromptPay) → staff sees it and checks the bank app
create or replace function public.claim_paid(p_code text)
returns boolean language sql volatile security definer set search_path = public as $$
  with u as (
    update public.orders set payment_status = 'claimed', updated_at = now()
    where code = upper(trim(p_code)) and payment = 'promptpay' and payment_status = 'unpaid'
    returning 1)
  select exists (select 1 from u);
$$;
revoke all on function public.claim_paid(text) from public;
grant execute on function public.claim_paid(text) to anon, authenticated;

-- Payment slips: only staff can read them; customers add one through attach_slip()
alter table public.order_slips enable row level security;
drop policy if exists "staff read slips" on public.order_slips;
create policy "staff read slips" on public.order_slips
  for select to authenticated using (public.is_staff());

create or replace function public.attach_slip(p_code text, p_image text)
returns boolean language plpgsql volatile security definer set search_path = public as $$
declare
  v_code text := upper(trim(p_code));
begin
  if p_image is null or char_length(p_image) > 700000
     or p_image !~ '^data:image/(jpeg|png|webp);base64,' then
    raise exception 'Invalid slip image';
  end if;
  if not exists (select 1 from public.orders
                 where code = v_code and payment = 'promptpay'
                   and payment_status <> 'paid' and status <> 'cancelled') then
    return false;
  end if;
  insert into public.order_slips (code, image) values (v_code, p_image)
    on conflict (code) do update set image = excluded.image, created_at = now();
  update public.orders set has_slip = true, payment_status = 'claimed', updated_at = now() where code = v_code;
  -- keep the database small: slips older than 60 days are removed automatically
  with gone as (delete from public.order_slips where created_at < now() - interval '60 days' returning code)
  update public.orders set has_slip = false where code in (select code from gone);
  return true;
end $$;
revoke all on function public.attach_slip(text, text) from public;
grant execute on function public.attach_slip(text, text) to anon, authenticated;

-- Block online orders while the shop has paused them
create or replace function public.check_accepting()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if new.source = 'online' and not (select accepting_orders from public.settings where id = 1) then
    raise exception 'Shop is not accepting online orders right now';
  end if;
  return new;
end $$;
drop trigger if exists orders_check_accepting on public.orders;
create trigger orders_check_accepting before insert on public.orders
  for each row execute function public.check_accepting();

-- 6) ▼▼▼ ကိုယ့်ဝန်ထမ်း email တွေကို ဒီမှာထည့်ပါ (Authentication → Users မှာ ဖန်တီးထားတဲ့ email) ▼▼▼
insert into public.staff (email) values
  ('info@yehtet.com')
on conflict do nothing;
