-- =============================================================================
-- 011_categoria_publicidad.sql
-- Agrega la categoría de gasto 'publicidad'. Aparece sola en el desplegable de
-- Egresos -> Nuevo egreso -> Categoría (el form las lee de expense_categories)
-- y en Configuración, donde se puede renombrar o borrar.
-- Idempotente.
-- =============================================================================

insert into expense_categories (name)
  values ('publicidad')
  on conflict (name) do nothing;
