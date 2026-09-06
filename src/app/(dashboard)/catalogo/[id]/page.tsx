import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { formatCurrency } from '@/lib/utils/format'
import { relatedProductIds } from '@/lib/outfits/related'
import { CreateOutfitButton } from '@/components/outfits/create-outfit-button'
import type { PickerProduct } from '@/components/outfits/outfit-product-picker'
import type { Product, ProductVariant } from '@/types/database'

function compareSizes(a: string, b: string): number {
  const na = Number(a), nb = Number(b)
  const aNum = !Number.isNaN(na), bNum = !Number.isNaN(nb)
  if (aNum && bNum) return na - nb
  if (aNum) return -1
  if (bNum) return 1
  return a.localeCompare(b)
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1)

interface OutfitItemRow {
  id: string
  outfit_id: string
  product_id: string
  sort_order: number
  product: { id: string; brand: string; model: string; color: string } | null
}
interface OutfitRow {
  id: string
  name: string
  favorite: boolean
  items: OutfitItemRow[]
}

export default async function ProductoDetallePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: productData }, { data: profileData }, { data: catalogProducts }] = await Promise.all([
    supabase
      .from('products')
      .select('*, suppliers(name), variants:product_variants(*), category:product_categories(name)')
      .eq('id', id)
      .single(),
    supabase.from('user_profiles').select('role').eq('id', user!.id).single(),
    supabase
      .from('products')
      .select('id, brand, model, color, category:product_categories(name)')
      .eq('active', true)
      .order('brand')
      .order('model'),
  ])

  if (!productData) notFound()
  const product = productData as Product & { category?: { name: string } | null }
  const isAdmin = (profileData as { role: string } | null)?.role === 'admin'

  type RawProduct = { id: string; brand: string; model: string; color: string; category: { name: string } | null }
  const pickerProducts: PickerProduct[] = ((catalogProducts as RawProduct[] | null) ?? []).map(p => ({
    id: p.id, brand: p.brand, model: p.model, color: p.color, categoryName: p.category?.name ?? null,
  }))

  // Outfits que incluyen este producto (con todos sus productos) para derivar
  // relacionados y listarlos.
  const { data: myItems } = await supabase.from('outfit_items').select('outfit_id').eq('product_id', id)
  const outfitIds = [...new Set(((myItems as { outfit_id: string }[] | null) ?? []).map(i => i.outfit_id))]

  let outfits: OutfitRow[] = []
  if (outfitIds.length > 0) {
    const { data } = await supabase
      .from('outfits')
      .select('id, name, favorite, items:outfit_items(id, outfit_id, product_id, sort_order, product:products(id, brand, model, color))')
      .in('id', outfitIds)
      .order('favorite', { ascending: false })
    outfits = (data as unknown as OutfitRow[] | null) ?? []
  }

  const allItems = outfits.flatMap(o => o.items ?? [])
  const productById = new Map<string, { id: string; brand: string; model: string; color: string }>()
  for (const it of allItems) if (it.product) productById.set(it.product_id, it.product)
  const related = relatedProductIds(
    allItems.map(i => ({ outfit_id: i.outfit_id, product_id: i.product_id })),
    id
  ).map(pid => productById.get(pid)).filter(Boolean) as { id: string; brand: string; model: string; color: string }[]

  const variants = [...(product.variants ?? [])].sort((a: ProductVariant, b: ProductVariant) => compareSizes(a.size, b.size))
  const totalStock = variants.reduce((s, v) => s + v.stock_quantity, 0)
  const attrs = Object.entries(product.attributes ?? {})

  return (
    <div className="space-y-7 max-w-4xl">
      <div>
        <Link href="/catalogo" className="text-xs text-indigo-400 hover:text-indigo-300">← Catálogo</Link>
      </div>

      {/* Cabecera */}
      <div className="flex flex-col sm:flex-row gap-6">
        <div className="w-full sm:w-52 shrink-0">
          {product.image_url ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={product.image_url} alt={`${product.brand} ${product.model}`} className="w-full aspect-square object-cover rounded-xl border border-foreground/[0.08]" />
          ) : (
            <div className="w-full aspect-square rounded-xl border border-foreground/[0.08] bg-card grid place-items-center text-foreground/30 text-xs">Sin foto</div>
          )}
        </div>
        <div className="flex-1 space-y-3">
          <div>
            <h1 className="text-2xl font-bold tracking-tight text-foreground">{product.brand} {product.model}</h1>
            <p className="text-sm text-foreground/55 mt-0.5">
              {product.color}
              {product.category?.name && <> · <span className="text-foreground/70">{product.category.name}</span></>}
              {!product.active && <span className="text-amber-500"> · inactivo</span>}
            </p>
          </div>

          {attrs.length > 0 && (
            <div className="flex flex-wrap gap-1.5">
              {attrs.map(([k, v]) => (
                <span key={k} className="inline-flex items-center gap-1 rounded-md border border-foreground/[0.08] bg-background/60 px-2 py-1 text-xs text-foreground/80">
                  <span className="text-foreground/45">{cap(k)}:</span> {v}
                </span>
              ))}
            </div>
          )}

          <div className="flex items-center gap-6">
            <div>
              <p className="font-mono text-[10px] text-foreground/50 uppercase tracking-[0.14em]">Precio</p>
              <p className="font-mono text-xl font-semibold text-foreground tabular-nums">{formatCurrency(product.sale_price)}</p>
            </div>
            <div>
              <p className="font-mono text-[10px] text-foreground/50 uppercase tracking-[0.14em]">Stock total</p>
              <p className={`font-mono text-xl font-semibold tabular-nums ${totalStock === 0 ? 'text-red-500' : 'text-emerald-600 dark:text-emerald-400'}`}>{totalStock}</p>
            </div>
          </div>

          <div className="flex flex-wrap gap-1.5">
            {variants.map(v => (
              <span
                key={v.id}
                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-mono tabular-nums border ${
                  v.stock_quantity === 0 ? 'border-foreground/10 text-foreground/35 line-through'
                    : v.stock_quantity === 1 ? 'border-amber-500/30 text-amber-600 dark:text-amber-400'
                    : 'border-emerald-500/25 text-emerald-600 dark:text-emerald-400'
                }`}
              >
                {v.size}<span className="opacity-60">·{v.stock_quantity}</span>
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* Productos relacionados */}
      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Productos relacionados</h2>
        {related.length === 0 ? (
          <p className="text-sm text-foreground/45">
            Todavía no combina con nada. {isAdmin ? 'Armá un outfit para relacionarlo con otros productos.' : ''}
          </p>
        ) : (
          <div className="flex flex-wrap gap-2">
            {related.map(p => (
              <Link
                key={p.id}
                href={`/catalogo/${p.id}`}
                className="inline-flex items-center rounded-lg border border-foreground/[0.08] bg-card px-3 py-2 text-sm text-foreground/85 hover:border-indigo-500/40 hover:text-indigo-400 transition-colors"
              >
                {p.brand} {p.model} <span className="text-foreground/50 text-xs ml-1">· {p.color}</span>
              </Link>
            ))}
          </div>
        )}
      </section>

      {/* Outfits con este producto */}
      <section className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-semibold text-foreground">Outfits con este producto</h2>
          {isAdmin && <CreateOutfitButton products={pickerProducts} initialProductId={id} />}
        </div>
        {outfits.length === 0 ? (
          <p className="text-sm text-foreground/45">Este producto no está en ningún outfit todavía.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {outfits.map(o => (
              <div key={o.id} className="rounded-xl border border-foreground/[0.08] bg-card p-4 space-y-2">
                <div className="flex items-center gap-1.5">
                  {o.favorite && <span className="text-amber-500 text-xs">★</span>}
                  <h3 className="text-sm font-medium text-foreground">{o.name}</h3>
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {[...(o.items ?? [])].sort((a, b) => a.sort_order - b.sort_order).map(it => (
                    <Link
                      key={it.id}
                      href={`/catalogo/${it.product_id}`}
                      className={`inline-flex items-center rounded-md border px-2 py-1 text-xs transition-colors ${
                        it.product_id === id
                          ? 'border-indigo-500/40 text-indigo-400 bg-indigo-500/5'
                          : 'border-foreground/[0.08] bg-background/60 text-foreground/80 hover:text-indigo-400 hover:border-indigo-500/40'
                      }`}
                    >
                      {it.product ? `${it.product.brand} ${it.product.model} · ${it.product.color}` : 'Producto'}
                    </Link>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <div className="pt-2">
        <Link href="/outfits" className="text-xs text-indigo-400 hover:text-indigo-300">Ver todos los outfits →</Link>
      </div>
    </div>
  )
}
