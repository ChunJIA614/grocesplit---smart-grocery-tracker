export enum ItemStatus {
  FRIDGE = 'FRIDGE',
  USED = 'USED'
}

export interface User {
  id: string;
  name: string;
  avatarColor: string;
}

export interface GroceryItem {
  id: string;
  name: string;
  quantity: number;
  unit: string; // e.g., 'kg', 'pcs', 'pack'
  totalPrice: number;
  unitPrice: number; // Calculated or manually entered
  status: ItemStatus;
  sharedBy: string[]; // Array of User IDs
  paidBy: string[]; // Array of User IDs who have paid their share
  dateAdded: string;
  createdById?: string;
  createdByName?: string;
}

export type PaymentHistoryType = 'BILL_CREATED' | 'PAYMENT_MADE';

export interface PaymentHistoryEntry {
  id: string;
  type: PaymentHistoryType;
  itemId: string;
  itemName: string;
  actorId: string;
  actorName: string;
  amount: number;
  shareCount: number;
  totalOutstanding: number;
  latestBillAmount: number;
  createdAt: string;
  message: string;
}

export interface PushTokenRecord {
  token: string;
  userId: string;
  userName: string;
  createdAt: string;
  platform: string;
  isPwaInstalled: boolean;
}

export interface DashboardStats {
  totalSpent: number;
  fridgeValue: number;
  topSpender: string;
}