create extension if not exists "uuid-ossp";

create table suppliers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  contact_name text,
  phone text,
  email text,
  notes text,
  created_at timestamptz default now()
);

create table products (
  id uuid primary key default uuid_generate_v4(),
  brand text not null,
  model text not null,
  color text not null,
  gender text not null check (gender in ('hombre', 'mujer', 'nino', 'unisex')),
  size text not null,
  cost_price numeric(10,2) not null check (cost_price >= 0),
  sale_price numeric(10,2) not null check (sale_price >= 0),
  stock_quantity integer not null default 0 check (stock_quantity >= 0),
  supplier_id uuid references suppliers(id) on delete set null,
  sku text unique not null,
  active boolean default true,
  created_at timestamptz default now()
);

create table customers (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  phone text,
  email text,
  address text,
  created_at timestamptz default now()
);

create table sales (
  id uuid primary key default uuid_generate_v4(),
  customer_id uuid references customers(id) on delete set null,
  sale_date date not null default current_date,
  channel text not null check (channel in ('fisica', 'online')),
  total_amount numeric(10,2) not null,
  payment_method text not null check (payment_method in ('efectivo', 'transferencia', 'tarjeta', 'mercadopago')),
  status text not null default 'completada' check (status in ('completada', 'cancelada', 'devolucion')),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table sale_items (
  id uuid primary key default uuid_generate_v4(),
  sale_id uuid references sales(id) on delete cascade not null,
  product_id uuid references products(id) not null,
  quantity integer not null check (quantity > 0),
  unit_price numeric(10,2) not null,
  discount numeric(10,2) default 0,
  subtotal numeric(10,2) not null
);

create table purchases (
  id uuid primary key default uuid_generate_v4(),
  supplier_id uuid references suppliers(id) not null,
  purchase_date date not null default current_date,
  total_amount numeric(10,2) not null,
  payment_status text not null default 'pendiente' check (payment_status in ('pagado', 'pendiente', 'parcial')),
  payment_due_date date,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table purchase_items (
  id uuid primary key default uuid_generate_v4(),
  purchase_id uuid references purchases(id) on delete cascade not null,
  product_id uuid references products(id) not null,
  quantity integer not null check (quantity > 0),
  unit_cost numeric(10,2) not null,
  subtotal numeric(10,2) not null
);

create table expenses (
  id uuid primary key default uuid_generate_v4(),
  category text not null check (category in ('alquiler','servicios','marketing','delivery','salarios','packaging','otros')),
  type text not null check (type in ('fijo', 'variable')),
  description text,
  amount numeric(10,2) not null check (amount > 0),
  expense_date date not null default current_date,
  payment_method text,
  recurring boolean default false,
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table stock_adjustments (
  id uuid primary key default uuid_generate_v4(),
  product_id uuid references products(id) not null,
  quantity_change integer not null,
  reason text not null check (reason in ('ajuste_manual','rotura','perdida','devolucion_proveedor')),
  notes text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

create table user_profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text,
  role text not null default 'vendedor' check (role in ('admin', 'vendedor')),
  created_at timestamptz default now()
);
