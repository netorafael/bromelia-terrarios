export type ProductType = 'terrarium' | 'workshop';
export type SaleStatus = 'pending' | 'paid' | 'cancelled' | 'refunded';
export type PaymentMethod = 'pix' | 'card' | 'cash';

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
