-- More 360 Lite — schema local (Postgres 15, Homebrew)
-- Cópia simplificada do More 360, focada em: Autenticação, Tabela de Preços,
-- Financeiro, Encomendas, Manutenção, Pessoas, Controle de Acesso, Estoque,
-- Compras e Garantias.

create extension if not exists pgcrypto;

-- ============================================================
-- AUTENTICAÇÃO
-- ============================================================

create table if not exists users (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  email         text not null unique,
  password_hash text not null,
  role          text not null default 'member' check (role in ('owner', 'member')),
  active        boolean not null default true,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

-- Coluna adicionada depois do schema original — idempotente pra quem já tinha
-- o banco criado antes de "active" existir.
alter table users add column if not exists active boolean not null default true;

create table if not exists access_logs (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid references users(id) on delete cascade,
  event_type text not null check (event_type in ('login_success', 'login_failed', 'logout')),
  email_tried text,
  created_at timestamptz not null default now()
);

create index if not exists idx_access_logs_user on access_logs(user_id);
create index if not exists idx_access_logs_created_at on access_logs(created_at desc);

create table if not exists password_reset_tokens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  token_hash text not null unique,
  expires_at timestamptz not null,
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

create index if not exists idx_password_reset_tokens_user on password_reset_tokens(user_id);

-- ============================================================
-- TABELA DE PREÇOS (precificação)
-- ============================================================

create table if not exists products (
  id             uuid primary key default gen_random_uuid(),
  sku            text,
  name           text not null,
  category       text,
  cost_price     numeric(12,2) not null default 0,
  margin_percent numeric(6,2) not null default 0,
  sale_price     numeric(12,2) not null default 0,
  active         boolean not null default true,
  notes          text,
  created_by     uuid references users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_products_category on products(category);
create index if not exists idx_products_active on products(active);

-- ============================================================
-- FINANCEIRO (fluxo de caixa simplificado)
-- ============================================================

create table if not exists financial_transactions (
  id             uuid primary key default gen_random_uuid(),
  type           text not null check (type in ('receita', 'despesa')),
  category       text not null,
  description    text not null,
  amount         numeric(12,2) not null check (amount >= 0),
  status         text not null default 'pendente' check (status in ('pendente', 'pago')),
  due_date       date,
  paid_date      date,
  payment_method text,
  created_by     uuid references users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_fin_tx_type on financial_transactions(type);
create index if not exists idx_fin_tx_status on financial_transactions(status);
create index if not exists idx_fin_tx_due_date on financial_transactions(due_date);

-- ============================================================
-- ENCOMENDAS
-- ============================================================

create table if not exists orders (
  id               uuid primary key default gen_random_uuid(),
  customer_name    text not null,
  customer_phone   text,
  product_desc     text not null,
  quantity         integer not null default 1 check (quantity > 0),
  unit_price       numeric(12,2) not null default 0,
  deposit_paid     numeric(12,2) not null default 0,
  status           text not null default 'aguardando' check (
                     status in ('aguardando', 'pago', 'chegou', 'entregue', 'cancelado')
                   ),
  expected_date    date,
  notes            text,
  created_by       uuid references users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_orders_status on orders(status);
create index if not exists idx_orders_expected_date on orders(expected_date);

-- ============================================================
-- MANUTENÇÃO (ordens de serviço)
-- ============================================================

create table if not exists maintenance_orders (
  id               uuid primary key default gen_random_uuid(),
  customer_name    text not null,
  customer_phone   text,
  device_desc      text not null,
  imei             text,
  problem_desc     text not null,
  status           text not null default 'aguardando' check (
                     status in ('aguardando', 'em_andamento', 'concluido', 'entregue', 'cancelado')
                   ),
  labor_cost       numeric(12,2) not null default 0,
  parts_cost       numeric(12,2) not null default 0,
  total_cost       numeric(12,2) not null default 0,
  finished_at      date,
  notes            text,
  created_by       uuid references users(id) on delete set null,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now()
);

create index if not exists idx_maint_orders_status on maintenance_orders(status);
create index if not exists idx_maint_orders_imei on maintenance_orders(imei);

-- ============================================================
-- PESSOAS (contatos: clientes, fornecedores, técnicos...)
-- ============================================================

create table if not exists contacts (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  phone        text,
  email        text,
  document     text,
  type         text not null default 'cliente' check (
                 type in ('cliente', 'fornecedor', 'tecnico', 'outro')
               ),
  address      text,
  notes        text,
  active       boolean not null default true,
  created_by   uuid references users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_contacts_type on contacts(type);
create index if not exists idx_contacts_active on contacts(active);

-- ============================================================
-- ESTOQUE
-- ============================================================

create table if not exists stock_items (
  id           uuid primary key default gen_random_uuid(),
  product_desc text not null,
  sku          text,
  imei         text,
  condition    text not null default 'novo' check (condition in ('novo', 'seminovo', 'usado')),
  -- 'em_manutencao' é setado automaticamente quando uma OS de Manutenção com
  -- o mesmo IMEI entra em andamento, e desfeito quando a OS termina (ver
  -- api/manutencao/[id]/route.ts) — não é escolhido manualmente no form.
  status       text not null default 'em_estoque' check (
                 status in ('em_estoque', 'reservado', 'vendido', 'defeito', 'em_manutencao')
               ),
  cost_price   numeric(12,2) not null default 0,
  location     text,
  entry_date   date not null default current_date,
  notes        text,
  created_by   uuid references users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_stock_items_status on stock_items(status);
create index if not exists idx_stock_items_imei on stock_items(imei);

-- ============================================================
-- COMPRAS (pedidos a fornecedor)
-- ============================================================

create table if not exists purchase_orders (
  id             uuid primary key default gen_random_uuid(),
  supplier_name  text not null,
  supplier_phone text,
  product_desc   text not null,
  quantity       integer not null default 1 check (quantity > 0),
  unit_cost      numeric(12,2) not null default 0,
  status         text not null default 'pedido' check (
                   status in ('pedido', 'enviado', 'recebido', 'cancelado')
                 ),
  expected_date  date,
  notes          text,
  created_by     uuid references users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_purchase_orders_status on purchase_orders(status);

-- ============================================================
-- GARANTIAS
-- ============================================================

create table if not exists warranties (
  id             uuid primary key default gen_random_uuid(),
  customer_name  text not null,
  customer_phone text,
  product_desc   text not null,
  imei           text,
  policy_type    text not null default 'loja' check (policy_type in ('fabricante', 'loja', 'seguro')),
  starts_at      date not null default current_date,
  expires_at     date not null,
  status         text not null default 'ativa' check (
                   status in ('ativa', 'acionada', 'resolvida')
                 ),
  notes          text,
  created_by     uuid references users(id) on delete set null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_warranties_status on warranties(status);
create index if not exists idx_warranties_expires_at on warranties(expires_at);

-- ============================================================
-- TAREFAS
-- ============================================================

create table if not exists tasks (
  id            uuid primary key default gen_random_uuid(),
  title         text not null,
  description   text,
  status        text not null default 'a_fazer' check (
                  status in ('a_fazer', 'em_andamento', 'concluida')
                ),
  priority      text not null default 'media' check (priority in ('baixa', 'media', 'alta')),
  due_date      date,
  assignee_name text,
  is_personal   boolean not null default false,
  created_by    uuid references users(id) on delete set null,
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_tasks_status on tasks(status);
create index if not exists idx_tasks_due_date on tasks(due_date);
create index if not exists idx_tasks_created_by on tasks(created_by);

-- ============================================================
-- AVISOS
-- ============================================================

create table if not exists announcements (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  content      text not null,
  display_mode text not null default 'feed' check (display_mode in ('feed', 'banner', 'modal')),
  audience     text not null default 'todos' check (audience in ('todos', 'owner', 'member')),
  pinned       boolean not null default false,
  active       boolean not null default true,
  created_by   uuid references users(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_announcements_active on announcements(active);

create table if not exists announcement_reads (
  id              uuid primary key default gen_random_uuid(),
  announcement_id uuid not null references announcements(id) on delete cascade,
  user_id         uuid not null references users(id) on delete cascade,
  read_at         timestamptz not null default now(),
  unique (announcement_id, user_id)
);

create index if not exists idx_announcement_reads_user on announcement_reads(user_id);

-- ============================================================
-- ACOMPANHAMENTO
-- ============================================================

create table if not exists tracking_projects (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  sector      text not null default 'operacao' check (
                sector in ('mkt', 'gestao', 'operacao', 'rh')
              ),
  status      text not null default 'no_prazo' check (
                status in ('no_prazo', 'em_risco', 'atrasado')
              ),
  owner_name  text,
  start_date  date not null default current_date,
  target_date date,
  notes       text,
  created_by  uuid references users(id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists idx_tracking_projects_status on tracking_projects(status);

create table if not exists tracking_entries (
  id               uuid primary key default gen_random_uuid(),
  project_id       uuid not null references tracking_projects(id) on delete cascade,
  entry_date       date not null default current_date,
  progress_percent numeric(5,2) not null default 0 check (progress_percent >= 0 and progress_percent <= 100),
  note             text,
  created_by       uuid references users(id) on delete set null,
  created_at       timestamptz not null default now()
);

create index if not exists idx_tracking_entries_project on tracking_entries(project_id);
create index if not exists idx_tracking_entries_date on tracking_entries(entry_date desc);

-- ============================================================
-- KNOWLEDGE
-- ============================================================

create table if not exists knowledge_entries (
  id         uuid primary key default gen_random_uuid(),
  title      text not null,
  type       text not null default 'nota' check (type in ('link', 'nota', 'aprendizado')),
  url        text,
  content    text,
  tags       text,
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists idx_knowledge_entries_type on knowledge_entries(type);

-- ============================================================
-- CONEXÕES ENTRE MÓDULOS
-- ============================================================
-- O Financeiro não guarda cópia de nada — ele LÊ orders/purchase_orders/
-- maintenance_orders direto (ver GET /api/financeiro). Uma versão anterior
-- deste schema tinha uma coluna `financeiro_tx_id` em cada uma dessas 3
-- tabelas pra linkar com um lançamento duplicado; removida (idempotente —
-- roda de novo sem erro mesmo em banco que nunca teve a coluna).
alter table orders drop column if exists financeiro_tx_id;
alter table purchase_orders drop column if exists financeiro_tx_id;
alter table maintenance_orders drop column if exists financeiro_tx_id;

-- Postgres não deixa só "adicionar um valor" num CHECK existente — recria a
-- constraint com o valor novo. Idempotente: roda de novo sem erro mesmo se
-- já tiver sido aplicada antes.
alter table stock_items drop constraint if exists stock_items_status_check;
alter table stock_items add constraint stock_items_status_check
  check (status in ('em_estoque', 'reservado', 'vendido', 'defeito', 'em_manutencao'));

-- ============================================================
-- trigger genérico: updated_at
-- ============================================================

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

drop trigger if exists trg_users_updated_at on users;
create trigger trg_users_updated_at before update on users
  for each row execute function set_updated_at();

drop trigger if exists trg_products_updated_at on products;
create trigger trg_products_updated_at before update on products
  for each row execute function set_updated_at();

drop trigger if exists trg_fin_tx_updated_at on financial_transactions;
create trigger trg_fin_tx_updated_at before update on financial_transactions
  for each row execute function set_updated_at();

drop trigger if exists trg_orders_updated_at on orders;
create trigger trg_orders_updated_at before update on orders
  for each row execute function set_updated_at();

drop trigger if exists trg_maint_orders_updated_at on maintenance_orders;
create trigger trg_maint_orders_updated_at before update on maintenance_orders
  for each row execute function set_updated_at();

drop trigger if exists trg_contacts_updated_at on contacts;
create trigger trg_contacts_updated_at before update on contacts
  for each row execute function set_updated_at();

drop trigger if exists trg_stock_items_updated_at on stock_items;
create trigger trg_stock_items_updated_at before update on stock_items
  for each row execute function set_updated_at();

drop trigger if exists trg_purchase_orders_updated_at on purchase_orders;
create trigger trg_purchase_orders_updated_at before update on purchase_orders
  for each row execute function set_updated_at();

drop trigger if exists trg_warranties_updated_at on warranties;
create trigger trg_warranties_updated_at before update on warranties
  for each row execute function set_updated_at();

drop trigger if exists trg_tasks_updated_at on tasks;
create trigger trg_tasks_updated_at before update on tasks
  for each row execute function set_updated_at();

drop trigger if exists trg_announcements_updated_at on announcements;
create trigger trg_announcements_updated_at before update on announcements
  for each row execute function set_updated_at();

drop trigger if exists trg_tracking_projects_updated_at on tracking_projects;
create trigger trg_tracking_projects_updated_at before update on tracking_projects
  for each row execute function set_updated_at();

drop trigger if exists trg_knowledge_entries_updated_at on knowledge_entries;
create trigger trg_knowledge_entries_updated_at before update on knowledge_entries
  for each row execute function set_updated_at();
