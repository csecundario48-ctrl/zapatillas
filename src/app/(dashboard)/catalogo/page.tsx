import { createClient } from '@/lib/supabase/server'
import { ProductTable } from '@/components/products/product-table'
import { ProductForm } from '@/components/products/product-form'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'

export default async function CatalogoPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: products }, { data: suppliers }, { data: profileData }] = await Promise.all([
    supabase
      .from('products')
      .select('*, suppliers(name)')
      .order('brand')
      .order('model'),
    supabase.from('suppliers').select('id, name').order('name'),
    supabase.from('user_profiles').select('role').eq('id', user!.id).single(),
  ])

  const profile = profileData as { role: string } | null
  const isAdmin = profile?.role === 'admin'

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Catálogo de Productos</h1>
          <p className="text-gray-500 text-sm">{products?.length ?? 0} SKUs cargados</p>
        </div>
        {isAdmin && (
          <Dialog>
            <DialogTrigger render={<Button />}>
              + Nuevo producto
            </DialogTrigger>
            <DialogContent className="max-w-2xl">
              <DialogHeader>
                <DialogTitle>Agregar producto</DialogTitle>
              </DialogHeader>
              <ProductForm suppliers={suppliers ?? []} />
            </DialogContent>
          </Dialog>
        )}
      </div>
      <div className="bg-white rounded-lg border">
        <ProductTable products={(products as any) ?? []} isAdmin={isAdmin} />
      </div>
    </div>
  )
}
