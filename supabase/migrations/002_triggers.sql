create or replace function handle_sale_item_insert()
returns trigger as $$
begin
  update products set stock_quantity = stock_quantity - new.quantity where id = new.product_id;
  return new;
end;
$$ language plpgsql security definer;

create or replace function handle_sale_item_delete()
returns trigger as $$
begin
  update products set stock_quantity = stock_quantity + old.quantity where id = old.product_id;
  return old;
end;
$$ language plpgsql security definer;

create or replace function handle_purchase_item_insert()
returns trigger as $$
begin
  update products set stock_quantity = stock_quantity + new.quantity where id = new.product_id;
  return new;
end;
$$ language plpgsql security definer;

create or replace function handle_stock_adjustment_insert()
returns trigger as $$
begin
  update products set stock_quantity = stock_quantity + new.quantity_change where id = new.product_id;
  return new;
end;
$$ language plpgsql security definer;

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into user_profiles (id, name) values (new.id, new.raw_user_meta_data->>'name');
  return new;
end;
$$ language plpgsql security definer;

create trigger on_sale_item_insert after insert on sale_items for each row execute function handle_sale_item_insert();
create trigger on_sale_item_delete after delete on sale_items for each row execute function handle_sale_item_delete();
create trigger on_purchase_item_insert after insert on purchase_items for each row execute function handle_purchase_item_insert();
create trigger on_stock_adjustment_insert after insert on stock_adjustments for each row execute function handle_stock_adjustment_insert();
create trigger on_auth_user_created after insert on auth.users for each row execute function handle_new_user();
