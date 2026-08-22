import assert from 'node:assert/strict';
import { ItemStatus, GroceryItem, DormExpense } from '../types';
import { markGroceryItemsPaid } from '../services/groceryService';
import { markRentalExpensesPaid } from '../services/rentalService';

const groceryItems: GroceryItem[] = [
  {
    id: 'grocery-1',
    name: 'Milk',
    quantity: 1,
    unit: 'pcs',
    totalPrice: 10,
    unitPrice: 10,
    status: ItemStatus.USED,
    sharedBy: ['real-user', 'roommate'],
    paidBy: [],
    dateAdded: new Date().toISOString(),
  },
  {
    id: 'grocery-2',
    name: 'Rice',
    quantity: 1,
    unit: 'pack',
    totalPrice: 8,
    unitPrice: 8,
    status: ItemStatus.USED,
    sharedBy: ['real-user'],
    paidBy: ['real-user'],
    dateAdded: new Date().toISOString(),
  },
];

const settledGroceries = markGroceryItemsPaid(groceryItems, 'real-user');
assert.deepEqual(settledGroceries[0].paidBy, ['real-user']);
assert.deepEqual(settledGroceries[1].paidBy, ['real-user']);
assert.deepEqual(markGroceryItemsPaid(groceryItems, 'missing-user'), groceryItems);

const rentalExpenses: DormExpense[] = [
  {
    id: 'rent-1',
    title: 'August rent',
    amount: 100,
    date: '2026-08-01',
    splitWithIds: ['real-user', 'roommate'],
    paidByUserIds: [],
    createdAt: new Date().toISOString(),
  },
];

const settledRentals = markRentalExpensesPaid(rentalExpenses, 'real-user');
assert.deepEqual(settledRentals[0].paidByUserIds, ['real-user']);
assert.deepEqual(markRentalExpensesPaid(rentalExpenses, 'missing-user'), rentalExpenses);

console.log('Payment logic verification passed.');
