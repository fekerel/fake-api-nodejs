// import { Low } from 'lowdb';
// import { JSONFile } from 'lowdb/node';
// import { faker } from '@faker-js/faker';

// const adapter = new JSONFile('./database.json');
// const defaultData = {
//   users: [],
//   categories: [],
//   products: [],
//   orders: []
// };
// const db = new Low(adapter, defaultData);

// async function generateData() {
//   await db.read();

//   db.data = db.data || defaultData;

//   // Generate data
//   db.data.users = Array.from({ length: 50 }, (_, index) => ({
//     id: index + 1,
//     email: faker.internet.email(),
//     password: faker.internet.password(),
//     firstName: faker.person.firstName(),
//     lastName: faker.person.lastName(),
//     role: faker.helpers.arrayElement(['customer', 'seller', 'admin']),
//     address: {
//       street: faker.location.street(),
//       city: faker.location.city(),
//       country: faker.location.country(),
//       zipCode: faker.location.zipCode()
//     },
//     phone: faker.phone.number(),
//     createdAt: faker.date.past(),
//     status: faker.helpers.arrayElement(['active', 'inactive', 'suspended'])
//   }));

//   db.data.categories = Array.from({ length: 10 }, (_, index) => ({
//     id: index + 1,
//     name: faker.commerce.department(),
//     description: faker.commerce.productDescription(),
//     parentId: index > 5 ? faker.number.int({ min: 1, max: 5 }) : null,
//     status: faker.helpers.arrayElement(['active', 'inactive'])
//   }));

//   db.data.products = Array.from({ length: 100 }, (_, index) => ({
//     id: index + 1,
//     sellerId: faker.number.int({ min: 1, max: 20 }),
//     categoryId: faker.number.int({ min: 1, max: 10 }),
//     name: faker.commerce.productName(),
//     description: faker.commerce.productDescription(),
//     price: Number(faker.commerce.price()),
//     stock: faker.number.int({ min: 0, max: 1000 }),
//     variants: Array.from({ length: faker.number.int({ min: 1, max: 4 }) }, () => ({
//       id: faker.string.uuid(),
//       color: faker.color.human(),
//       size: faker.helpers.arrayElement(['XS', 'S', 'M', 'L', 'XL']),
//       price: faker.commerce.price(),
//       stock: faker.number.int({ min: 0, max: 100 })
//     })),
//     tags: faker.helpers.arrayElements(['new', 'sale', 'trending', 'seasonal'], 
//       faker.number.int({ min: 1, max: 3 })),
//     status: faker.helpers.arrayElement(['active', 'inactive', 'out_of_stock'])
//   }));

//   db.data.orders = Array.from({ length: 200 }, (_, index) => ({
//     id: index + 1,
//     userId: faker.number.int({ min: 1, max: 30 }),
//     items: Array.from({ length: faker.number.int({ min: 1, max: 5 }) }, () => ({
//       productId: faker.number.int({ min: 1, max: 100 }),
//       variantId: faker.string.uuid(),
//       quantity: faker.number.int({ min: 1, max: 5 }),
//       price: faker.commerce.price()
//     })),
//     totalAmount: faker.commerce.price(),
//     shippingAddress: {
//       street: faker.location.street(),
//       city: faker.location.city(),
//       country: faker.location.country(),
//       zipCode: faker.location.zipCode()
//     },
//     payment: {
//       method: faker.helpers.arrayElement(['credit_card', 'paypal', 'bank_transfer']),
//       status: faker.helpers.arrayElement(['pending', 'completed', 'failed'])
//     },
//     status: faker.helpers.arrayElement(['pending', 'processing', 'shipped', 'delivered', 'cancelled']),
//     createdAt: faker.date.past()
//   }));

//   // Save generated data
//   await db.write();
//   console.log('Sample data generated successfully!');
// }

// // Run the generator
// generateData().catch(console.error);