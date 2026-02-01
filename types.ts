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
}

export interface DashboardStats {
  totalSpent: number;
  fridgeValue: number;
  topSpender: string;
}