-- ==============================
-- EFE — Supabase Schema (Shared Mode)
-- No auth required — shared data for all users
-- Run this in Supabase SQL Editor
-- ==============================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ==============================
-- WALLETS
-- ==============================
create table if not exists wallets (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  emoji text default '💰',
  color text default '#8B9D83',
  monthly_budget numeric(12,2) default 0,
  wallet_type text check (wallet_type in ('personal','business')) default 'personal',
  created_at timestamptz default now()
);

-- ==============================
-- CATEGORIES
-- ==============================
create table if not exists categories (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid references wallets(id) on delete cascade,
  name text not null,
  icon text default '📁',
  type text check (type in ('income','expense')) not null,
  sort_order int default 0
);

-- ==============================
-- TRANSACTIONS
-- ==============================
create table if not exists transactions (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid references wallets(id) on delete cascade,
  category_id uuid references categories(id),
  type text check (type in ('income','expense')) not null,
  amount numeric(12,2) not null,
  description text,
  date date not null default current_date,
  account text,
  is_recurring boolean default false,
  recurrence_rule text,
  tags text[],
  notes text,
  created_at timestamptz default now()
);

-- ==============================
-- DEBTS
-- ==============================
create table if not exists debts (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid references wallets(id) on delete cascade,
  name text not null,
  total_amount numeric(12,2) not null,
  paid_amount numeric(12,2) default 0,
  monthly_payment numeric(12,2),
  interest_rate numeric(5,2) default 0,
  due_date date,
  status text check (status in ('active','paid','paused')) default 'active',
  notes text,
  created_at timestamptz default now()
);

-- ==============================
-- FIAT ACCOUNTS
-- ==============================
create table if not exists fiat_accounts (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  balance numeric(12,2) default 0,
  currency text default 'MXN',
  institution text,
  color text,
  created_at timestamptz default now()
);

-- ==============================
-- BUDGETS (per category per month)
-- ==============================
create table if not exists budgets (
  id uuid primary key default gen_random_uuid(),
  wallet_id uuid references wallets(id) on delete cascade,
  category_id uuid references categories(id),
  month date not null,
  amount numeric(12,2) not null,
  unique(wallet_id, category_id, month)
);

-- ==============================
-- DISABLE RLS (shared mode — no auth)
-- ==============================
alter table wallets disable row level security;
alter table categories disable row level security;
alter table transactions disable row level security;
alter table debts disable row level security;
alter table fiat_accounts disable row level security;
alter table budgets disable row level security;

-- ==============================
-- INDEXES
-- ==============================
create index if not exists idx_transactions_wallet_date on transactions(wallet_id, date);
create index if not exists idx_transactions_type on transactions(type);
create index if not exists idx_categories_wallet on categories(wallet_id);
create index if not exists idx_debts_wallet on debts(wallet_id);
create index if not exists idx_budgets_wallet_month on budgets(wallet_id, month);

-- ==============================
-- SEED: Default Wallets
-- ==============================
insert into wallets (name, emoji, color, wallet_type, monthly_budget) values
  ('Hogar', '🧡', '#E8956E', 'personal', 20000),
  ('Random', '💚', '#5B8C5A', 'business', 5000),
  ('Dhash', '💜', '#9B7EC8', 'business', 10000)
on conflict do nothing;

-- ==============================
-- SEED: Default Categories
-- ==============================
do $$
declare
  w_hogar uuid;
  w_random uuid;
  w_dhash uuid;
begin
  select id into w_hogar from wallets where name = 'Hogar' limit 1;
  select id into w_random from wallets where name = 'Random' limit 1;
  select id into w_dhash from wallets where name = 'Dhash' limit 1;

  -- Hogar categories
  insert into categories (wallet_id, name, icon, type, sort_order) values
    (w_hogar, 'Renta', '🏠', 'expense', 1),
    (w_hogar, 'Comida', '🍽️', 'expense', 2),
    (w_hogar, 'Salud', '💊', 'expense', 3),
    (w_hogar, 'Bebé', '👶', 'expense', 4),
    (w_hogar, 'Mantenimiento', '🔧', 'expense', 5),
    (w_hogar, 'Transporte', '🚗', 'expense', 6),
    (w_hogar, 'Servicios', '💡', 'expense', 7),
    (w_hogar, 'Personal', '🧑', 'expense', 8),
    (w_hogar, 'Mascotas', '🐾', 'expense', 9),
    (w_hogar, 'Suscripciones', '📱', 'expense', 10),
    (w_hogar, 'Entretenimiento', '🎬', 'expense', 11),
    (w_hogar, 'Otro Ingreso', '💰', 'income', 12)
  on conflict do nothing;

  -- Random categories
  insert into categories (wallet_id, name, icon, type, sort_order) values
    (w_random, 'Servicios', '🎨', 'income', 1),
    (w_random, 'Comisiones', '🤝', 'income', 2),
    (w_random, 'Ventas', '📦', 'income', 3),
    (w_random, 'Renta', '🏢', 'expense', 4),
    (w_random, 'Contabilidad', '📊', 'expense', 5),
    (w_random, 'Servicios Op.', '⚡', 'expense', 6),
    (w_random, 'Suscripciones', '📱', 'expense', 7),
    (w_random, 'Marketing', '📣', 'expense', 8),
    (w_random, 'Materiales', '🎨', 'expense', 9),
    (w_random, 'Otros', '📁', 'expense', 10)
  on conflict do nothing;

  -- Dhash categories
  insert into categories (wallet_id, name, icon, type, sort_order) values
    (w_dhash, 'Cuadros', '🖼️', 'income', 1),
    (w_dhash, 'Murales', '🎨', 'income', 2),
    (w_dhash, 'Tattoo', '✒️', 'income', 3),
    (w_dhash, 'Diseño', '🎯', 'income', 4),
    (w_dhash, 'Materiales', '🎨', 'expense', 5),
    (w_dhash, 'Sueldos', '👥', 'expense', 6),
    (w_dhash, 'Gastos Operativos', '⚡', 'expense', 7),
    (w_dhash, 'Suscripciones', '📱', 'expense', 8),
    (w_dhash, 'Transporte', '🚗', 'expense', 9),
    (w_dhash, 'Otros', '📁', 'expense', 10)
  on conflict do nothing;
end $$;

-- ==============================
-- SEED: Default Accounts
-- ==============================
insert into fiat_accounts (name, institution, balance, currency) values
  ('Mercado Pago (Hogar)', 'Mercado Pago', 0, 'MXN'),
  ('Mercado Pago (Dhash)', 'Mercado Pago', 0, 'MXN'),
  ('Mercado Pago (Random)', 'Mercado Pago', 0, 'MXN'),
  ('BBVA', 'BBVA', 0, 'MXN')
on conflict do nothing;
