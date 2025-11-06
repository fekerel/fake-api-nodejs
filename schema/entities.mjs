import { faker } from '@faker-js/faker';

export const entitySchemas = {
  users: {
    id: { type: 'integer', primary: true },
    email: { type: 'string', unique: true, generator: () => faker.internet.email({ provider: 'example.com' }) },
    password: { type: 'string', generator: () => faker.internet.password({ length: 12 }) },
    firstName: { type: 'string', nullable: true, generator: () => faker.person.firstName() },
    lastName: { type: 'string', nullable: true, generator: () => faker.person.lastName() },
    role: { type: 'enum', values: ['superadmin','admin','manager','support','seller','buyer','warehouse'] },
    address: {
      type: 'object',
      fields: {
        street: { type: 'string', nullable: true, generator: () => `${faker.number.int({ min: 100, max: 999 })} ${faker.location.street()}` },
        city: { type: 'string', nullable: true, generator: () => faker.location.city() },
        country: { type: 'string', nullable: true, generator: () => faker.location.country() },
        zipCode: { type: 'string', nullable: true, generator: () => faker.location.zipCode() }
      }
    },
    phone: { type: 'string', nullable: true, generator: () => faker.phone.number({ style: 'international' }) },
    status: { type: 'enum', values: ['active','inactive','pending','banned'] },
    createdAt: { type: 'timestamp', generator: () => Date.now() },
    modifiedAt: { type: 'timestamp', generator: (_ctx, current) => current.createdAt }
  },

  categories: {
    id: { type: 'integer', primary: true },
    name: { type: 'string', generator: () => `${faker.commerce.department()} ${faker.string.alphanumeric(8)}` },
    description: { type: 'string', generator: () => faker.commerce.productDescription() },
    parentId: { type: 'integer', nullable: true, relation: { entity: 'categories', field: 'id', optional: true } },
    status: { type: 'enum', values: ['active','inactive'] },
    createdAt: { type: 'timestamp', generator: () => Date.now() },
    modifiedAt: { type: 'timestamp', generator: (_ctx, current) => current.createdAt }
  },

  products: {
    id: { type: 'integer', primary: true },
    sellerId: { type: 'integer', relation: { entity: 'users', field: 'id', where: { role: 'seller' } } },
    categoryId: { type: 'integer', relation: { entity: 'categories', field: 'id' } },
    name: { type: 'string', generator: () => `api-test ${faker.date.recent({ days: 2 }).toLocaleString()}` },
    description: { type: 'string', generator: () => faker.commerce.productDescription() },
    price: { type: 'number', generator: () => Number(faker.commerce.price({ min: 0.5, max: 100, dec: 2 })) },
    stock: { type: 'integer', generator: () => faker.number.int({ min: 0, max: 1000 }) },
    variants: {
      type: 'array',
      of: {
        type: 'object',
        fields: {
          id: { type: 'string', generator: () => `VAR-${faker.string.alphanumeric(12)}` },
          color: { type: 'string', generator: () => faker.color.human() },
          size: { type: 'enum', values: ['XS','S','M','L','XL','XXL'] },
          price: { type: 'number', generator: () => Number(faker.commerce.price({ min: 1, max: 100, dec: 2 })) },
          stock: { type: 'integer', generator: () => faker.number.int({ min: 0, max: 1000 }) }
        }
      },
      min: 1,
      max: 3
    },
    tags: {
      type: 'array',
      of: { type: 'enum', values: ['featured','bestseller','limited','exclusive','recommended','premium'] },
      min: 1,
      max: 2
    },
    status: { type: 'enum', values: ['active','inactive'] },
    createdAt: { type: 'timestamp', generator: () => Date.now() },
    modifiedAt: { type: 'timestamp', generator: (_ctx, current) => current.createdAt }
  },

  orders: {
    id: { type: 'integer', primary: true },
    userId: { type: 'integer', relation: { entity: 'users', field: 'id' } },
    items: {
      type: 'array',
      of: {
        type: 'object',
        fields: {
          productId: { type: 'integer', relation: { entity: 'products', field: 'id' } },
          variantId: { type: 'string', generator: (ctx) => ctx.pickVariantId() },
          quantity: { type: 'integer', generator: () => faker.number.int({ min: 1, max: 5 }) },
          price: { type: 'number', generator: (ctx) => ctx.peekProductPrice() }
        }
      },
      min: 1,
      max: 3
    },
    totalAmount: { type: 'number', generator: (ctx, current) => current.items.reduce((s,i)=>s + (i.price*i.quantity), 0) },
    shippingAddress: {
      type: 'object',
      fields: {
        street: { type: 'string', generator: () => `${faker.number.int({ min: 100, max: 999 })} ${faker.location.street()}` },
        city: { type: 'string', generator: () => faker.location.city() },
        country: { type: 'string', generator: () => faker.location.country() },
        zipCode: { type: 'string', generator: () => faker.location.zipCode() }
      }
    },
    payment: {
      type: 'object',
      fields: {
        method: { type: 'enum', values: ['credit_card','paypal','bank_transfer'] },
        status: { type: 'enum', values: ['pending','processing','shipped','delivered','cancelled'] }
      }
    },
    status: { type: 'enum', values: ['pending','failed','cancelled','returned','delivered'] },
    createdAt: { type: 'timestamp', generator: () => Date.now() },
    modifiedAt: { type: 'timestamp', generator: (_ctx, current) => current.createdAt }
  },

  // Örnek yeni tablo: reviews (test senaryoları için faydalı)
  reviews: {
    id: { type: 'integer', primary: true },
    productId: { type: 'integer', relation: { entity: 'products', field: 'id' } },
    userId: { type: 'integer', relation: { entity: 'users', field: 'id' } },
    rating: { type: 'integer', generator: () => faker.number.int({ min: 1, max: 5 }) },
    comment: { type: 'string', nullable: true, generator: () => faker.lorem.sentence() },
    createdAt: { type: 'timestamp', generator: () => Date.now() }
  }
};