import {
  LayoutDashboard,
  Package,
  Boxes,
  ShoppingCart,
  ClipboardList,
  Truck,
  Receipt,
  TrendingUp,
  BarChart3,
  Users,
  Contact,
  type LucideIcon,
} from 'lucide-react'

export interface NavItem {
  href: string
  label: string
  icon: LucideIcon
}

export interface NavGroup {
  label: string
  items: NavItem[]
}

export const navGroups: NavGroup[] = [
  {
    label: 'Principal',
    items: [{ href: '/', label: 'Inicio', icon: LayoutDashboard }],
  },
  {
    label: 'Inventario',
    items: [
      { href: '/catalogo', label: 'Catálogo', icon: Package },
      { href: '/stock', label: 'Stock', icon: Boxes },
    ],
  },
  {
    label: 'Operaciones',
    items: [
      { href: '/ventas', label: 'Ventas', icon: ShoppingCart },
      { href: '/encargos', label: 'Encargos', icon: ClipboardList },
      { href: '/compras', label: 'Compras', icon: Truck },
      { href: '/egresos', label: 'Egresos', icon: Receipt },
    ],
  },
  {
    label: 'Relaciones',
    items: [
      { href: '/clientes', label: 'Clientes', icon: Users },
      { href: '/proveedores', label: 'Proveedores', icon: Contact },
    ],
  },
  {
    label: 'Análisis',
    items: [
      { href: '/finanzas', label: 'Finanzas', icon: TrendingUp },
      { href: '/reportes', label: 'Reportes', icon: BarChart3 },
    ],
  },
]
