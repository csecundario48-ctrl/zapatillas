export type Gender = 'hombre' | 'mujer' | 'nino' | 'unisex'
export type SaleChannel = 'fisica' | 'online'
export type PaymentMethod = 'efectivo' | 'transferencia' | 'tarjeta' | 'mercadopago'
export type SaleStatus = 'completada' | 'cancelada' | 'devolucion'
export type PaymentStatus = 'pagado' | 'pendiente' | 'parcial'
export type ExpenseCategory = 'alquiler' | 'servicios' | 'marketing' | 'delivery' | 'salarios' | 'packaging' | 'otros'
export type ExpenseType = 'fijo' | 'variable'
export type AdjustmentReason = 'ajuste_manual' | 'rotura' | 'perdida' | 'devolucion_proveedor'
export type UserRole = 'admin' | 'vendedor'

export interface Supplier {
  id: string
  name: string
  contact_name: string | null
  phone: string | null
  email: string | null
  address: string | null
  notes: string | null
  created_at: string
}

export interface Product {
  id: string
  brand: string
  model: string
  color: string
  gender: Gender
  size: string
  cost_price: number
  sale_price: number
  stock_quantity: number
  supplier_id: string | null
  sku: string
  active: boolean
  created_at: string
  suppliers?: Supplier
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
  product_id: string
  quantity: number
  unit_price: number
  discount: number
  subtotal: number
  products?: Product
}

export interface Purchase {
  id: string
  supplier_id: string
  purchase_date: string
  total_amount: number
  payment_status: PaymentStatus
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
  product_id: string
  quantity: number
  unit_cost: number
  subtotal: number
  products?: Product
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
  created_by: string | null
  created_at: string
}

export interface StockAdjustment {
  id: string
  product_id: string
  quantity_change: number
  reason: AdjustmentReason
  notes: string | null
  created_by: string | null
  created_at: string
  products?: Product
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
        Row: Omit<Product, 'suppliers'>
        Insert: Omit<Product, 'id' | 'created_at' | 'suppliers'>
        Update: Partial<Omit<Product, 'id' | 'created_at' | 'suppliers'>>
        Relationships: {
          foreignKeyName: string
          columns: string[]
          referencedRelation: string
          referencedColumns: string[]
        }[]
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
        Row: Omit<SaleItem, 'products'>
        Insert: Omit<SaleItem, 'id' | 'products'>
        Update: Partial<Omit<SaleItem, 'id' | 'products'>>
        Relationships: {
          foreignKeyName: string
          columns: string[]
          referencedRelation: string
          referencedColumns: string[]
        }[]
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
        Row: Omit<PurchaseItem, 'products'>
        Insert: Omit<PurchaseItem, 'id' | 'products'>
        Update: Partial<Omit<PurchaseItem, 'id' | 'products'>>
        Relationships: {
          foreignKeyName: string
          columns: string[]
          referencedRelation: string
          referencedColumns: string[]
        }[]
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
        Row: Omit<StockAdjustment, 'products'>
        Insert: Omit<StockAdjustment, 'id' | 'created_at' | 'products'>
        Update: Partial<Omit<StockAdjustment, 'id' | 'created_at' | 'products'>>
        Relationships: {
          foreignKeyName: string
          columns: string[]
          referencedRelation: string
          referencedColumns: string[]
        }[]
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
