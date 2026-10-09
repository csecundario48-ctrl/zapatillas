-- Agrega la categoría de gasto 'envíos'. Idempotente.
-- (012 y 013 se revirtieron en el repo; se usa 014 para no chocar con el historial de prod.)

insert into expense_categories (name)
  values ('envíos')
  on conflict (name) do nothing;
