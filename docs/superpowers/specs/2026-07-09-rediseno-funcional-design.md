# Rediseño Funcional — Sistema de Gestión Zapatillería

**Fecha:** 2026-07-09
**Estado:** Aprobado por el usuario (dueño del negocio), pendiente de plan de implementación.

## Contexto

El sistema actual funciona técnicamente, pero tras cargar datos reales se detectaron problemas de experiencia de uso y modelado de datos:

1. No se puede eliminar un producto si tiene ventas/compras asociadas (viola FK).
2. Al crear un producto nuevo aparece stock duplicado (stock inicial + compra suman dos veces).
3. El stock solo se ve como total, sin desglose por talle.
4. El modelo de datos actual no tiene concepto de "variante": cada combinación talle/color es una fila de producto independiente, sin relación entre sí.

Este documento define el funcionamiento deseado de cada módulo, relevado mediante entrevista directa con el dueño del negocio. No es un plan de implementación — describe **qué** debe hacer el sistema, no **cómo** se construye.

**Principio general del proyecto:** simple, intuitivo, rápido, pocos clics. No es un ERP. Si una funcionalidad no aporta valor directo al día a día del negocio, no se agrega.

**Regla transversal (aplica a todos los módulos):** todo registro (productos, compras, ventas, ajustes) se puede editar después de creado. Cuando una edición afecta al stock, el stock se recalcula automáticamente — nunca queda desincronizado.

---

## Módulo: Productos

**Definición:** un "producto" es el modelo + color (ej. "Campus Total Black"). Dos colores del mismo modelo son productos distintos. El talle es una variante dentro del producto, no un producto aparte.

**Campos:**
- Obligatorios / usados activamente: marca, modelo, proveedor, precio de costo, precio de venta.
- Opcionales / ocultos del flujo normal (no se eliminan del sistema, quedan disponibles si algún producto puntual los necesita): género, precio con descuento, SKU/código, imagen, descripción.

**Eliminación:** el botón "eliminar" funciona siempre, sin restricciones, tenga o no historial de ventas/compras. Para lograrlo sin romper el historial ni bloquear por FK, cada línea de venta/compra debe guardar una copia propia de los datos relevantes del producto en ese momento (nombre, talle, precio) en vez de depender únicamente de una referencia viva al producto. Así, borrar el producto no afecta la lectura de ventas/compras pasadas.

**Mejora respecto al diseño anterior:** se elimina la necesidad de "desactivar/archivar" como workaround — el borrado directo cubre el caso de uso real (dejar de vender un modelo) sin fricción.

---

## Módulo: Talles / Variantes

**Definición:** el talle es una variante numérica entera del producto.

- Rango fijo: **35 a 45**, igual para todos los productos (configurable desde Configuración, pero con este valor por defecto).
- Sin medios talles.
- Carga: al crear/editar un producto se muestra una tabla con todos los talles del rango, y se ingresa la cantidad en cada uno (0 si no hay).
- Stock total del producto = suma del stock de todos sus talles.
- Visualización: talles con stock 0 se muestran (gris/tachado), no se ocultan — así se sabe que el talle existe para ese modelo aunque no haya stock ahora.

**Ejemplo de vista esperada:**
```
Campus Total Black — Stock total: 8
39 → 1
40 → 2
41 → 0 (agotado)
42 → 3
43 → 2
```

**Mejora respecto al diseño anterior:** hoy cada talle es una fila de producto sin relación entre sí (sin identidad compartida de "modelo"). El rediseño introduce el concepto de variante para que el stock por talle sea visible y coherente bajo un mismo producto.

---

## Módulo: Inventario / Stock

**Regla clave (resuelve el bug de stock duplicado):** cargar un producto nuevo con su stock inicial **es** la compra — no existe una compra separada que vuelva a sumar el mismo stock. La pantalla de "Compras" es exclusivamente para **reponer** stock de productos que ya existen.

**Alertas:** aviso de "stock bajo" cuando a un talle le queda **1 par**.

**Ajustes manuales:** motivos disponibles — ajuste manual, rotura, pérdida, devolución a proveedor. Se mantienen los 4 actuales, sin cambios.

**Edición directa:** además de los cambios vía venta/compra/ajuste, se permite editar el número de stock de un talle directamente a mano (para correcciones rápidas). Internamente debe quedar registrado como un ajuste (para mantener auditoría), aunque la experiencia del usuario sea "escribir el número y listo".

**Devoluciones:** al devolver una venta, el stock del talle devuelto **siempre** se restaura automáticamente.

---

## Módulo: Compras

**Alcance:** reponer stock de productos ya existentes (no la carga inicial, ver módulo Inventario) + llevar cuenta de pagos a proveedores.

**Datos de una compra:**
- Proveedor, fecha
- Productos + talles + cantidades
- Costo unitario y costo total
- Forma de pago
- Estado de pago: Pagado / Parcial / Pendiente (sin historial de pagos individuales — en la práctica el pago se resuelve al momento del pedido, así que un campo de estado alcanza, no hace falta un libro de pagos parciales)

**Estado de entrega:** Pedido (no suma stock) → Recibido (suma stock al confirmarse). El pedido siempre llega completo — no hay recepción parcial ni estado "cancelado".

**Historial:** se puede ver todo lo comprado a un proveedor específico a lo largo del tiempo.

**Relación con Caja:** cuando se paga una compra, ese pago resta del saldo de Caja (ver módulo Caja).

---

## Módulo: Ventas

**Ítems:** una venta puede incluir varios talles/modelos (no es lo más común, pero debe soportarse).

**Cliente:** toda venta requiere un cliente asociado — no existen ventas anónimas. El cliente se carga previamente desde su propia sección (Clientes), no desde la pantalla de venta.

**Precio:** siempre el precio de lista cargado en el producto — no se negocia en el momento de la venta.

**Formas de pago:** efectivo, transferencia, tarjeta.

**Anulación / devolución:** son el mismo concepto — cancelar una venta (por error o porque el cliente devuelve el producto) restaura el stock automáticamente. No se distingue el motivo a nivel de flujo.

---

## Módulo: Encargos

**Definición:** una venta especial donde el cliente paga una seña por un producto que no está en stock. No es una entidad separada de "Ventas" a nivel de historial: es un **estado** dentro del flujo de venta.

**Flujo:**
1. Cliente pide algo sin stock → paga una seña → se registra el encargo (pendiente de entrega).
2. Llega el producto (vía Compras) → el cliente paga el resto → el encargo se marca completado.
3. Al completarse, pasa a formar parte del historial de ventas normal — no queda separado en una sección aparte.

**Relación con Caja:** la seña **no** cuenta como ingreso en Caja el día que se cobra. El ingreso se registra recién cuando el encargo se completa y se convierte en venta (pago total).

---

## Módulo: Clientes

**Datos:** nombre y teléfono. Nada más (sin email, dirección, Instagram).

**Perfil del cliente:** historial de ventas realizadas a ese cliente.

**Alta:** se cargan desde la sección Clientes, no desde el flujo de venta (aunque toda venta requiera cliente, el alta es un paso previo separado).

---

## Módulo: Caja

**Definición:** listado simple de ingresos y egresos de dinero con saldo — no hay apertura/cierre diario tipo arqueo.

**Ingresos:** únicamente ventas con pago completo (no cuenta la seña de un encargo hasta que se completa).

**Egresos:**
- Gastos operativos (alquiler, sueldos, servicios, etc.)
- Nuevas categorías a agregar: **publicidad** y **packaging**
- Pagos a proveedores por compras de mercadería

**Vista:** listado de movimientos filtrable por rango de fechas, con saldo.

**Relación con Finanzas:** Caja es el día a día (plata que entra/sale). Finanzas (ver siguiente módulo) es la vista de rentabilidad — son pantallas distintas, no se unifican.

---

## Módulo: Finanzas

**Contenido:**
- Ganancia **bruta** (venta − costo del producto) y **neta** (bruta − gastos operativos), mostradas juntas.
- Comparación entre períodos, con selección de rango de fechas libre (no fijo a mensual).
- Ranking de productos/modelos más rentables (no solo los más vendidos en cantidad, sino los que más ganancia dejan).

---

## Módulo: Dashboard

Sin cambios respecto al diseño actual. Las nuevas alertas (stock bajo, encargos pendientes) **no** se agregan acá — quedan visibles únicamente en sus propias secciones (Inventario/Stock y Encargos respectivamente).

---

## Módulo: Reportes

Sin cambios respecto al diseño actual.

---

## Módulo: Configuración

**Usuarios y permisos:** se mantienen los 2 roles actuales (admin, vendedor), sin agregar más granularidad.

**Datos del negocio:** nombre del negocio y logo.

**Categorías de gastos:** el dueño debe poder agregar/editar categorías de gastos (ej. publicidad, packaging) por sí mismo, sin depender de un cambio de código.

**Rango de talles:** el rango 35-45 usado en Talles/Variantes debe poder ajustarse desde acá si el negocio lo necesita en el futuro.

---

## Fuera de alcance / no se construye

- Apertura/cierre de caja tipo arqueo diario.
- Historial de pagos parciales a proveedores (alcanza con un estado: pagado/parcial/pendiente).
- Recepción parcial de pedidos de compra o estado "cancelado" en compras.
- Distinción entre "anular venta" y "devolución" — son el mismo flujo.
- Entidad separada de "Encargos" fuera del historial de ventas.
- Roles de usuario más allá de admin/vendedor.
- Precio negociable en el punto de venta.
- Ventas sin cliente asociado.
