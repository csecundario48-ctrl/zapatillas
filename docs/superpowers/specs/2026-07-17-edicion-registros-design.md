# Edición de registros en todas las secciones

**Fecha:** 2026-07-17
**Estado:** aprobado, pendiente de plan de implementación

## Problema

Hoy, si una venta se anota con la fecha equivocada, el único camino es eliminarla y volver a cargarla entera: cliente, productos, cantidades, precios. Lo mismo en egresos, encargos y compras. Es lento y invita al error — al rehacerla se puede olvidar un ítem o cargar otro precio.

Las secciones de catálogo, clientes, proveedores y configuración ya se editan. Faltan justamente las cuatro que mueven stock y plata, que son las que más se usan y donde más caro sale el error.

## Alcance

Se agrega editar en **ventas, encargos, compras y egresos**, con edición completa: los datos de cabecera y también los productos (agregar, quitar, cambiar cantidad y precio).

Repaso de las 12 secciones del menú, para dejar constancia de que ninguna queda afuera:

| Sección | Situación |
|---|---|
| Inicio, Finanzas, Reportes | Solo lectura. Muestran datos derivados; se corrigen editando el registro de origen. Sin cambios. |
| Catálogo, Clientes, Proveedores, Configuración | Ya tienen editar. Solo cambia por dónde se entra (ver *Interfaz*). |
| Stock | Se corrige con el formulario de ajuste que ya existe, que además deja registro del motivo. Sin cambios. |
| **Ventas, Encargos, Compras, Egresos** | **Sin editar hoy. Es lo que construye este spec.** |

### Fuera de alcance

- **Cambiar el estado desde el formulario de edición.** Ver *Editar no cambia el estado*.
- **Historial de cambios / auditoría.** Nadie pidió saber quién editó qué. YAGNI.
- **Edición de ajustes de stock ya aplicados.** Un ajuste es un asiento histórico; se corrige con otro ajuste.
- **Limpiar `nav-items.ts`,** que quedó huérfano (solo se usa `nav-config.ts`). No es de este trabajo.

## Concepto central: stock retenido

Un registro **retiene** stock cuando sus unidades ya están aplicadas sobre `product_variants.stock_quantity`:

| Registro | Estado | ¿Retiene? | Efecto sobre el stock |
|---|---|---|---|
| Venta | `completada` | Sí | Restado |
| Venta | `encargo`, `devolucion`, `cancelada` | No | Ninguno |
| Compra | `recibido` | Sí | Sumado |
| Compra | `pedido` | No | Ninguno |
| Egreso | — | No | Nunca toca stock |

Los estados que no retienen ya están explicados en el código actual (`deleteSale`): un `encargo` todavía no descontó, una `devolucion` ya repuso, una `cancelada` nunca descontó.

**Regla de edición:** al guardar, se devuelve lo que el registro retenía antes y se aplica lo que retiene ahora. Como editar no cambia el estado, un registro que no retenía sigue sin retener, y su edición no mueve stock en absoluto.

Para un registro que sí retiene, el cambio neto de stock por variante es:

```
delta = signo × (cantidad_nueva − cantidad_vieja)
```

con `signo = -1` para ventas (los ítems restan stock) y `signo = +1` para compras (los ítems suman).

Consecuencias, todas ya cubiertas por esa única fórmula:

- Cambiar solo la fecha de una venta completada → `cantidad_nueva == cantidad_vieja` → delta 0, el stock no se mueve.
- Pasar de 2 a 3 pares en una venta completada → delta −1 → se resta uno más.
- Quitar un producto de una venta completada → sus unidades vuelven al stock.
- Editar cualquier encargo, devolución, cancelada o compra en estado pedido → no retiene → sin movimiento de stock.

### Validación: nunca dejar stock negativo

Antes de escribir nada, se calculan los deltas, se lee el stock actual de las variantes afectadas y se verifica que ninguna quede por debajo de cero. Si alguna quedaría negativa, la edición **se rechaza entera** y no se guarda ningún cambio, con un mensaje que nombra el talle y los números concretos:

> `No hay stock para editar: talle 42 tiene 1 y se necesitan 3. Registrá la compra o ajustá el stock antes de editar.`

Es la misma protección y el mismo tono que ya usan `completeEncargo` y `deletePurchase`.

## Editar no cambia el estado

El formulario de edición no incluye el check de "es encargo" ni ningún selector de estado. Las transiciones siguen siendo responsabilidad de los botones que ya existen: *Devolver*, *Completar entrega*, *Cancelar*, *Marcar recibida*.

El motivo: si editar pudiera cambiar el estado, habría que resolver combinaciones como "venta completada → encargo" (¿se repone el stock?) o "encargo → completada" (¿se descuenta, y si no alcanza?). Esas transiciones ya están resueltas, probadas y con sus propias validaciones en las acciones existentes. Duplicar esa lógica dentro del formulario sería reimplementarla peor.

`delivery_status` de compras es un estado, así que **no** se edita. `payment_status` no lo es —es un dato de la compra— y sí se edita.

## Qué se edita en cada sección

**Ventas y encargos** (`sales`) — fecha, cliente, canal, medio de pago, ítems (agregar/quitar/cantidad/precio) y, solo si el estado es `encargo`, la seña.

**Compras** (`purchases`) — proveedor, fecha, estado de pago, vencimiento, notas e ítems (agregar/quitar/cantidad/costo).

**Egresos** (`expenses`) — todos sus campos: categoría, tipo, descripción, monto, fecha, medio de pago y recurrente.

### Reglas de datos al reescribir ítems

Guardar una edición borra los ítems viejos e inserta los nuevos. Los campos *snapshot* (los que congelan el estado del producto al momento de la operación) necesitan cuidado:

- **`unit_cost` en `sale_items`:** para una variante que ya estaba en la venta, se **preserva el costo original**. Para una recién agregada, se toma el `cost_price` actual del producto. Recalcular todo contra el costo de hoy reescribiría el margen histórico de una venta vieja y ensuciaría los reportes.
- **`product_label` y `size_label`:** se recalculan para los ítems nuevos y se preservan para los que ya estaban, por el mismo motivo — un producto pudo haberse renombrado desde entonces.
- **`total_amount`:** siempre se recalcula desde los ítems nuevos.
- **`deposit_amount`:** editable solo en estado `encargo`. En una venta `completada` que viene de un encargo, la seña se **preserva** intacta. En cualquier caso, si hay seña se valida con `isValidDeposit(total, seña)`, de modo que bajar el total por debajo de una seña ya cobrada se rechaza.

## Interfaz

### Entrada única: el menú de 3 puntitos

Hoy conviven dos patrones. Catálogo, clientes y proveedores usan íconos sueltos (lápiz + tacho); compras usa solo el tacho; ventas, encargos y egresos usan el menú de 3 puntitos. Se unifica todo en el menú, con *Editar* arriba y *Eliminar* abajo:

```
15/07   Nike Air Max T42   $85.000   [↩]  [⋮]
                                           │
                                           ├─ ✎ Editar venta
                                           └─ 🗑 Eliminar venta
```

Las acciones propias de cada estado que hoy son botones visibles (*Devolver*, *Completar entrega*, *Marcar recibida*) **se quedan como están**, fuera del menú. Son el trabajo cotidiano y merecen estar a un clic; editar y eliminar son excepciones.

### Dónde se edita: igual que donde se crea

La edición reusa el formulario de creación y respeta la forma que ya tiene cada sección:

| Sección | Crear (hoy) | Editar (nuevo) |
|---|---|---|
| Egresos | Modal | Modal |
| Ventas / Encargos | Página `/ventas/nueva` | Página `/ventas/[id]/editar` |
| Compras | Página `/compras/nueva` | Página `/compras/[id]/editar` |

Ventas y compras van a página propia porque el buscador de productos más la tabla de ítems no entran cómodos en un modal. Los encargos no necesitan página propia: un encargo *es* una fila de `sales`, así que su edición usa `/ventas/[id]/editar` y al guardar vuelve a `/encargos`.

Al guardar, cada formulario vuelve a la lista de donde salió y muestra un toast (`"Venta actualizada"`). Si la edición movió stock, el toast lo dice: `"Venta actualizada — stock ajustado"`.

## Arquitectura

### Cálculo de deltas: función pura y testeable

`src/lib/utils/purchase-stock.ts` ya tiene `sumByVariant`, que agrupa cantidades por variante. Se le suma al lado una función que compara dos conjuntos de ítems, y el archivo pasa a llamarse `stock-delta.ts` para reflejar que ya no es solo de compras:

```ts
export type ItemQty = { variant_id: string | null; quantity: number }

/**
 * Cuánto hay que sumarle al stock de cada variante para pasar de `before` a
 * `after`. `direction` es 'venta' cuando los ítems restan stock y 'compra'
 * cuando lo suman. Omite las variantes cuyo delta da 0.
 */
export function stockDelta(
  before: ItemQty[],
  after: ItemQty[],
  direction: 'venta' | 'compra'
): Map<string, number>
```

Toda la aritmética de la edición vive acá: sin base de datos, sin red, testeable con un objeto literal. Las acciones quedan con la responsabilidad de leer, validar y escribir.

### Acciones de servidor

Dos acciones nuevas, junto a las que ya existen y siguiendo su forma (`{ error?: string }` como retorno, `revalidatePath` al final):

- `updateSale(saleId, input)` en `src/app/actions/sales.ts`
- `updatePurchase(purchaseId, input)` en `src/app/actions/purchases.ts`

Ambas con la misma secuencia, que pone **toda la validación antes de la primera escritura**:

1. Verificar autenticación.
2. Leer el registro y sus ítems actuales. Si no existe, error.
3. Validar la entrada nueva (ítems no vacíos, cliente/proveedor presente, cantidades ≥ 1, precios ≥ 0, seña válida).
4. Si el estado retiene stock: calcular deltas con `stockDelta`, leer el stock actual de las variantes afectadas y verificar que ninguna quede negativa. Si alguna queda, cortar acá — no se escribió nada.
5. Actualizar la fila de cabecera con el total recalculado.
6. Borrar los ítems viejos e insertar los nuevos, preservando los snapshots según las reglas de arriba.
7. Aplicar los deltas de stock.
8. `revalidatePath` de las rutas afectadas.

Los egresos no llevan acción de servidor: `ExpenseForm` ya escribe directo con el cliente de Supabase y no toca stock, así que su edición es un `update` en lugar de un `insert`, sin cambiar de patrón.

**Sobre fallas parciales:** los pasos 5 a 7 no son una transacción. Es la misma característica que ya tienen `createSale`, `createPurchase` y `deletePurchase`, que ante una falla a mitad de camino devuelven un error descriptivo (`"Venta registrada, pero falló actualizar el stock: ..."`) para que la persona corrija a mano. Las acciones nuevas siguen esa convención. Envolver todo en una función RPC de Postgres sería más sólido, pero el proyecto no usa RPC en ningún lado y meterlo solo acá dejaría dos patrones conviviendo. Queda anotado como deuda conocida, para el día que se migre todo junto.

### Componentes

**`RowMenu`** (`src/components/common/row-menu.tsx`) suma dos props opcionales: `onEdit?: () => void` y `editHref?: string` — la primera para abrir un modal, la segunda para navegar a una página. Si no se pasa ninguna, el menú se comporta exactamente como hoy y muestra solo *Eliminar*, así que las llamadas actuales no se rompen.

**Formularios en modo edición.** Cada uno recibe el registro a editar como prop opcional; su ausencia significa "modo crear" y el comportamiento actual no cambia:

- `SaleForm` → `sale?: SaleWithItems`
- `PurchaseForm` → `purchase?: PurchaseWithItems`
- `ExpenseForm` → `expense?: Expense`

En modo edición cada formulario arranca con los valores del registro, oculta el check de "es encargo" (`SaleForm`) y el selector de `delivery_status` (`PurchaseForm`), muestra la seña solo si el estado es `encargo`, y al enviar llama a la acción de update en vez de la de create. El texto del botón acompaña: *"Guardar cambios"* en vez de *"Confirmar venta"*.

`SaleForm` tiene una particularidad: en modo edición, el filtro que hoy esconde las variantes sin stock debe **incluir siempre las variantes que ya están en el registro**. Si no, un producto vendido hasta agotar stock desaparecería de su propia venta al editarla.

**Páginas nuevas:** `/ventas/[id]/editar` y `/compras/[id]/editar`, server components que cargan el registro con sus ítems y las mismas listas (variantes, clientes/proveedores) que ya arman las páginas `/nueva`, y se lo pasan al formulario. Si el id no existe, `notFound()`.

**Row actions:** `SaleRowActions`, `EncargoRowActions`, `ExpenseRowActions` y `PurchaseRowActions` pasan a ofrecer *Editar*. `ProductRowActions`, `PurchaseRowActions` y las tablas de clientes y proveedores migran de los íconos sueltos al `RowMenu`. Si tras la migración `ConfirmDelete` queda sin usarse en ningún lado, se borra; `deleteErrorMessage`, que vive en el mismo archivo y sí se sigue usando, se conserva.

## Tests

El proyecto usa Vitest sobre las utilidades puras (`src/lib/utils/*.test.ts`) y ahí es donde vive el riesgo real de este trabajo: la aritmética del stock. `stock-delta.test.ts` cubre:

- Ítem sin cambios → delta 0 (la edición de solo-fecha, el caso que motivó todo esto).
- Cantidad que sube y que baja, en venta y en compra, con los signos correctos.
- Ítem agregado; ítem quitado (devuelve todas sus unidades).
- Reemplazo completo de un ítem por otro.
- Mismo variante repetido en varios ítems → se agrupa antes de comparar.
- `variant_id` nulo (producto borrado) → se ignora, sin romper.
- Conjuntos vacíos de los dos lados → mapa vacío.

La validación de "no dejar negativo" se prueba a nivel de la función que decide, separada de la lectura de la base.

## Criterios de aceptación

1. En ventas, encargos, compras y egresos, el menú de 3 puntitos ofrece *Editar*, y editar abre el registro con todos sus datos ya cargados.
2. Corregir la fecha de una venta completada y guardar no altera el stock de ninguna variante. *(El caso original.)*
3. Cambiar cantidades o productos de una venta completada ajusta el stock por la diferencia exacta, nunca por el total.
4. Editar un encargo, una devolución, una venta cancelada o una compra en estado pedido no mueve stock.
5. Una edición que dejaría stock negativo se rechaza entera, con un mensaje que nombra el talle y los números, y el registro queda igual que antes.
6. El margen histórico de una venta no cambia al editarle un dato que no es el precio.
7. El formulario de edición no permite cambiar el estado de ningún registro.
8. Crear ventas, compras y egresos sigue funcionando igual que antes.
