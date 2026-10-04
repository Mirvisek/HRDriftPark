export type WarehouseTabId =
  | 'dashboard'
  | 'products'
  | 'deliveries'
  | 'issues'
  | 'inventories'
  | 'categories'
  | 'history';

export type StatusMessage = { type: 'success' | 'error'; text: string };

export type BulkItem = {
  uid: string;
  productId: number | '';
  quantity: number;
  batchNumber: string;
  expiryDate: string;
};

export type AlertFilter = 'all' | 'low' | 'expiry';
