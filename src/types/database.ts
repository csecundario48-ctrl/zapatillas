export type Gender = 'hombre' | 'mujer' | 'nino' | 'unisex'
export type SaleChannel = 'fisica' | 'online'
export type PaymentMethod = 'efectivo' | 'transferencia' | 'tarjeta' | 'mercadopago'
export type SaleStatus = 'completada' | 'cancelada' | 'devolucion' | 'encargo'
export type PaymentStatus = 'pagado' | 'pendiente' | 'parcial'
export type DeliveryStatus = 'pedido' | 'recibido'
export type ExpenseCategory = string
export type ExpenseType = 'fijo' | 'variable'
export type AdjustmentReason = 'ajuste_manual' | 'rotura' | 'perdida' | 'devolucion_proveedor'
export type UserRole = 'admin' | 'vendedor'

export type AttributeType = 'text' | 'number' | 'select'

/** Rubro / línea de negocio (Zapatillas, Ropa). Agrupa categorías y separa la plata. */
export interface BusinessLine {
  id: string
  name: string
  slug: string
  sort_order: number
  created_at: string
}

/** Categoría de producto: define sus talles y sus atributos propios. */
export interface ProductCategory {
  id: string
  line_id: string | null
  name: string
  slug: string
  size_options: string[]
  sort_order: number
  active: boolean
  created_at: string
  line?: BusinessLine
  attributes?: CategoryAttribute[]
}

/** Campo propio de una categoría (motor del formulario dinámico). */
export interface CategoryAttribute {
  id: string
  category_id: string
  key: string
  label: string
  type: AttributeType
  options: string[]
  required: boolean
  filterable: boolean
  sort_order: number
  created_at: string
}

/** Valores de los atributos propios de un producto: { "tipo": "Cargo", "material": "Gabardina" } */
export type ProductAttributes = Record<string, string>

export interface Brand {
  id: string
  name: string
  created_at: string
}

/** Un outfit es un conjunto de productos con nombre (el "combina con"). */
export interface Outfit {
  id: string
  name: string
  notes: string | null
  favorite: boolean
  created_by: string | null
  created_at: string
  items?: OutfitItem[]
}

export interface OutfitItem {
  id: string
  outfit_id: string
  product_id: string
  sort_order: number
  created_at: string
  product?: Product
}

export interface Supplier {
  id: string
  name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  line_id: string | null
  created_at: string
}

export interface Product {
  id: string
  brand: string
  model: string
  color: string
  gender: Gender | null
  cost_price: number
  sale_price: number
  discount_price: number | null
  image_url: string | null
  description: string | null
  supplier_id: string | null
  category_id: string | null
  attributes: ProductAttributes
  active: boolean
  created_at: string
  suppliers?: Supplier
  variants?: ProductVariant[]
  category?: ProductCategory
}

export interface ProductVariant {
  id: string
  product_id: string
  size: string
  stock_quantity: number
  sku: string | null
  created_at: string
  products?: Product
}

export interface Customer {
  id: string
  name: string
  phone: string | null
  email: string | null
  instagram: string | null
  address: string | null
  created_at: string
}

export interface Sale {
  id: string
  customer_id: string | null
  sale_date: string
  channel: SaleChannel
  total_amount: number
  deposit_amount: number
  payment_method: PaymentMethod
  status: SaleStatus
  notes: string | null
  created_by: string | null
  created_at: string
  customers?: Customer
  sale_items?: SaleItem[]
}

export interface SaleItem {
  id: string
  sale_id: string
  variant_id: string | null
  product_label: string | null
  size_label: string | null
  line_id: string | null
  category_label: string | null
  quantity: number
  unit_price: number
  unit_cost: number
  discount: number
  subtotal: number
  variant?: ProductVariant
}

export interface Purchase {
  id: string
  supplier_id: string
  purchase_date: string
  total_amount: number
  payment_status: PaymentStatus
  delivery_status: DeliveryStatus
  payment_due_date: string | null
  notes: string | null
  created_by: string | null
  created_at: string
  suppliers?: Supplier
  purchase_items?: PurchaseItem[]
}

export interface PurchaseItem {
  id: string
  purchase_id: string
  variant_id: string | null
  product_label: string | null
  size_label: string | null
  line_id: string | null
  category_label: string | null
  quantity: number
  unit_cost: number
  subtotal: number
  variant?: ProductVariant
}

export interface Expense {
  id: string
  category: ExpenseCategory
  type: ExpenseType
  description: string | null
  amount: number
  expense_date: string
  payment_method: string | null
  recurring: boolean
  notes: string | null
  line_id: string | null
  created_by: string | null
  created_at: string
}

export interface BusinessSettings {
  id: number
  business_name: string
  logo_url: string | null
  size_min: number
  size_max: number
  updated_at: string
}

export interface ExpenseCategoryRow {
  id: string
  name: string
  created_at: string
}

export interface StockAdjustment {
  id: string
  variant_id: string
  quantity_change: number
  reason: AdjustmentReason
  notes: string | null
  created_by: string | null
  created_at: string
  variant?: ProductVariant
}

export interface UserProfile {
  id: string
  name: string | null
  role: UserRole
  created_at: string
}

// Supabase Database type for typed client
export type Database = {
  public: {
    Tables: {
      suppliers: {
        Row: Supplier
        Insert: Omit<Supplier, 'id' | 'created_at'>
        Update: Partial<Omit<Supplier, 'id' | 'created_at'>>
        Relationships: {
          foreignKeyName: string
          columns: string[]
          referencedRelation: string
          referencedColumns: string[]
        }[]
      }
      products: {
        Row: Omit<Product, 'suppliers' | 'variants'>
        Insert: Omit<Product, 'id' | 'created_at' | 'suppliers' | 'variants'>
        Update: Partial<Omit<Product, 'id' | 'created_at' | 'suppliers' | 'variants'>>
        Relationships: []
      }
      product_variants: {
        Row: Omit<ProductVariant, 'products'>
        Insert: Omit<ProductVariant, 'id' | 'created_at' | 'products'>
        Update: Partial<Omit<ProductVariant, 'id' | 'created_at' | 'products'>>
        Relationships: []
      }
      customers: {
        Row: Customer
        Insert: Omit<Customer, 'id' | 'created_at'>
        Update: Partial<Omit<Customer, 'id' | 'created_at'>>
        Relationships: {
          foreignKeyName: string
          columns: string[]
          referencedRelation: string
          referencedColumns: string[]
        }[]
      }
      sales: {
        Row: Omit<Sale, 'customers' | 'sale_items'>
        Insert: Omit<Sale, 'id' | 'created_at' | 'customers' | 'sale_items'>
        Update: Partial<Omit<Sale, 'id' | 'created_at' | 'customers' | 'sale_items'>>
        Relationships: {
          foreignKeyName: string
          columns: string[]
          referencedRelation: string
          referencedColumns: string[]
        }[]
      }
      sale_items: {
        Row: Omit<SaleItem, 'variant'>
        Insert: Omit<SaleItem, 'id' | 'variant'>
        Update: Partial<Omit<SaleItem, 'id' | 'variant'>>
        Relationships: []
      }
      purchases: {
        Row: Omit<Purchase, 'suppliers' | 'purchase_items'>
        Insert: Omit<Purchase, 'id' | 'created_at' | 'suppliers' | 'purchase_items'>
        Update: Partial<Omit<Purchase, 'id' | 'created_at' | 'suppliers' | 'purchase_items'>>
        Relationships: {
          foreignKeyName: string
          columns: string[]
          referencedRelation: string
          referencedColumns: string[]
        }[]
      }
      purchase_items: {
        Row: Omit<PurchaseItem, 'variant'>
        Insert: Omit<PurchaseItem, 'id' | 'variant'>
        Update: Partial<Omit<PurchaseItem, 'id' | 'variant'>>
        Relationships: []
      }
      expenses: {
        Row: Expense
        Insert: Omit<Expense, 'id' | 'created_at'>
        Update: Partial<Omit<Expense, 'id' | 'created_at'>>
        Relationships: {
          foreignKeyName: string
          columns: string[]
          referencedRelation: string
          referencedColumns: string[]
        }[]
      }
      stock_adjustments: {
        Row: Omit<StockAdjustment, 'variant'>
        Insert: Omit<StockAdjustment, 'id' | 'created_at' | 'variant'>
        Update: Partial<Omit<StockAdjustment, 'id' | 'created_at' | 'variant'>>
        Relationships: []
      }
      business_settings: {
        Row: BusinessSettings
        Insert: Partial<BusinessSettings> & { id?: number }
        Update: Partial<Omit<BusinessSettings, 'id'>>
        Relationships: []
      }
      expense_categories: {
        Row: ExpenseCategoryRow
        Insert: Omit<ExpenseCategoryRow, 'id' | 'created_at'>
        Update: Partial<Omit<ExpenseCategoryRow, 'id' | 'created_at'>>
        Relationships: []
      }
      business_lines: {
        Row: BusinessLine
        Insert: Omit<BusinessLine, 'id' | 'created_at'>
        Update: Partial<Omit<BusinessLine, 'id' | 'created_at'>>
        Relationships: []
      }
      product_categories: {
        Row: Omit<ProductCategory, 'line' | 'attributes'>
        Insert: Omit<ProductCategory, 'id' | 'created_at' | 'line' | 'attributes'>
        Update: Partial<Omit<ProductCategory, 'id' | 'created_at' | 'line' | 'attributes'>>
        Relationships: []
      }
      category_attributes: {
        Row: CategoryAttribute
        Insert: Omit<CategoryAttribute, 'id' | 'created_at'>
        Update: Partial<Omit<CategoryAttribute, 'id' | 'created_at'>>
        Relationships: []
      }
      brands: {
        Row: Brand
        Insert: Omit<Brand, 'id' | 'created_at'>
        Update: Partial<Omit<Brand, 'id' | 'created_at'>>
        Relationships: []
      }
      outfits: {
        Row: Omit<Outfit, 'items'>
        Insert: Omit<Outfit, 'id' | 'created_at' | 'items'>
        Update: Partial<Omit<Outfit, 'id' | 'created_at' | 'items'>>
        Relationships: []
      }
      outfit_items: {
        Row: Omit<OutfitItem, 'product'>
        Insert: Omit<OutfitItem, 'id' | 'created_at' | 'product'>
        Update: Partial<Omit<OutfitItem, 'id' | 'created_at' | 'product'>>
        Relationships: []
      }
      user_profiles: {
        Row: UserProfile
        Insert: Omit<UserProfile, 'created_at'>
        Update: Partial<Omit<UserProfile, 'created_at'>>
        Relationships: {
          foreignKeyName: string
          columns: string[]
          referencedRelation: string
          referencedColumns: string[]
        }[]
      }
    }
    Views: Record<string, never>
    Functions: {
      get_user_role: { Args: Record<PropertyKey, never>; Returns: string }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
