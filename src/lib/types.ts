export type ProductType = 'terrarium' | 'workshop';
export type SaleStatus = 'pending' | 'paid' | 'cancelled' | 'refunded';
export type PaymentMethod = 'pix' | 'card' | 'card_credit' | 'card_debit' | 'cash';

export interface Product {
  id: string;
  store_id: string;
  category_id: string | null;
  type: ProductType;
  name: string;
  sku: string;
  cost_price: number;
  sale_price: number | null;
  cost_unit: string;
  sellable: boolean;
  image_url: string | null;
  active: boolean;
  categories?: { name: string } | null;
  inventory_levels?: { quantity: number; minimum_quantity: number } | null;
}

export interface StoreContext {
  storeId: string;
  userId: string;
}

export type MaintenanceStatus =
  | 'received'
  | 'awaiting_approval'
  | 'in_maintenance'
  | 'ready_for_pickup'
  | 'delivered';

export type MaintenancePaymentStatus = 'pending' | 'paid';

export interface MaintenanceOrder {
  id: string;
  store_id: string;
  code: string;
  customer_name: string;
  phone: string | null;
  terrarium: string;
  services: string[];
  received_date: string;
  due_date: string;
  amount: number;
  status: MaintenanceStatus;
  payment_status: MaintenancePaymentStatus;
  payment_method: PaymentMethod | null;
  notes: string | null;
  image_url: string | null;
}
