// @ts-check
/// <reference path="../types/schema-types.d.ts" />
import { defineFilterConfig } from './typed-config.js';

// Configure which query operators are exposed per collection field.
// Only valid fields and ops will be suggested by IDE thanks to schema-types.d.ts.
export const filterConfig = defineFilterConfig({
  users: {
    email: ['eq', 'like'],
    firstName: ['eq', 'like'],
    lastName: ['eq', 'like'],
    role: ['eq'],
    status: ['eq'],
    'address.zipCode': ['eq', 'like'],
    phone: ['eq', 'like'],
    createdAt: ['eq', 'gte', 'lte'],
    modifiedAt: ['eq', 'gte', 'lte']
  },
  products: {
    name: ['eq', 'like'],
    description: ['like'],
    categoryId: ['eq'],
    sellerId: ['eq'],
    price: ['eq', 'gte', 'lte'],
    stock: ['eq', 'gte', 'lte'],
    status: ['eq'],
    createdAt: ['eq', 'gte', 'lte']
  },
  categories: {
    name: ['eq', 'like'],
    status: ['eq'],
    parentId: ['eq']
  },
  orders: {
    userId: ['eq'],
    totalAmount: ['eq', 'gte', 'lte'],
    'payment.status': ['eq'],
    createdAt: ['eq', 'gte', 'lte']
  },
  reviews: {
    productId: ['eq'],
    userId: ['eq'],
    rating: ['eq', 'gte', 'lte']
  }
});
