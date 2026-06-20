alter table suppliers enable row level security;
alter table products enable row level security;
alter table customers enable row level security;
alter table sales enable row level security;
alter table sale_items enable row level security;
alter table purchases enable row level security;
alter table purchase_items enable row level security;
alter table expenses enable row level security;
alter table stock_adjustments enable row level security;
alter table user_profiles enable row level security;

create or replace function get_user_role() returns text as $$
  select role from user_profiles where id = auth.uid();
$$ language sql security definer stable;

create policy "auth_read" on suppliers for select to authenticated using (true);
create policy "admin_write" on suppliers for all to authenticated using (get_user_role() = 'admin');
create policy "auth_read" on products for select to authenticated using (true);
create policy "admin_write" on products for all to authenticated using (get_user_role() = 'admin');
create policy "auth_all" on customers for all to authenticated using (true);
create policy "auth_all" on sales for all to authenticated using (true);
create policy "auth_all" on sale_items for all to authenticated using (true);
create policy "admin_all" on purchases for all to authenticated using (get_user_role() = 'admin');
create policy "admin_all" on purchase_items for all to authenticated using (get_user_role() = 'admin');
create policy "admin_all" on expenses for all to authenticated using (get_user_role() = 'admin');
create policy "admin_all" on stock_adjustments for all to authenticated using (get_user_role() = 'admin');
create policy "own_profile" on user_profiles for select to authenticated using (id = auth.uid());
create policy "admin_profiles" on user_profiles for select to authenticated using (get_user_role() = 'admin');
