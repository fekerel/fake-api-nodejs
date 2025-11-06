// Get detailed order information with user, items, products and payment details
export default (app, router) => {
    const db = router.db;

    app.get('/orders/:id/details', (req, res) => {
        const orderId = Number(req.params.id);
        
        if (!Number.isFinite(orderId)) return res.status(400).json({ error: 'invalid id' });
        
        const order = db.get('orders').find(o => Number(o.id) === orderId).value();
        
        if (!order) return res.status(404).json({ error: 'order not found' });
        
        const user = db.get('users').find(u => Number(u.id) === Number(order.userId)).value();
        
        const itemsWithProducts = order.items.map(item => {
            const product = db.get('products').find(p => Number(p.id) === Number(item.productId)).value();
            const category = product ? db.get('categories').find(c => Number(c.id) === Number(product.categoryId)).value() : null;
            
            return {
                productId: item.productId,
                productName: product ? product.name : 'Unknown',
                categoryName: category ? category.name : null,
                variantId: item.variantId,
                quantity: Number(item.quantity) || 0,
                price: parseFloat(item.price) || 0,
                subtotal: (Number(item.quantity) || 0) * (parseFloat(item.price) || 0)
            };
        });
        
        res.json({
            orderId: order.id,
            user: user ? {
                id: user.id,
                name: `${user.firstName} ${user.lastName}`,
                email: user.email
            } : null,
            items: itemsWithProducts,
            totalAmount: parseFloat(order.totalAmount) || 0,
            shippingAddress: order.shippingAddress || null,
            payment: order.payment || null,
            status: order.status,
            createdAt: order.createdAt || null,
            modifiedAt: order.modifiedAt || null
        });
    });
};

export const openapi = {
    paths: {
        "/orders/{id}/details": {
            get: {
                summary: "Get detailed order information",
                parameters: [
                    { in: "path", name: "id", required: true, schema: { type: "integer" }, example: 1 }
                ],
                responses: {
                    "200": {
                        description: "Order details",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/OrderDetails" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            orderId: 1,
                                            user: { id: 1, name: "John Doe", email: "john@example.com" },
                                            items: [
                                                { productId: 1, productName: "Product A", categoryName: "Category 1", variantId: "var1", quantity: 2, price: 50.00, subtotal: 100.00 }
                                            ],
                                            totalAmount: 100.00,
                                            shippingAddress: { street: "123 St", city: "City", country: "Country", zipCode: "12345" },
                                            payment: { method: "credit_card", status: "pending" },
                                            status: "pending",
                                            createdAt: 1762406642107,
                                            modifiedAt: 1762406642107
                                        }
                                    }
                                }
                            }
                        }
                    },
                    "400": { description: "invalid id" },
                    "404": { description: "order not found" }
                }
            }
        }
    },
    components: {
        schemas: {
            OrderDetails: {
                type: "object",
                properties: {
                    orderId: { type: "integer", example: 1 },
                    user: {
                        type: "object",
                        nullable: true,
                        properties: {
                            id: { type: "integer", example: 1 },
                            name: { type: "string", example: "John Doe" },
                            email: { type: "string", example: "john@example.com" }
                        }
                    },
                    items: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                productId: { type: "integer", example: 1 },
                                productName: { type: "string", example: "Product A" },
                                categoryName: { type: "string", nullable: true, example: "Category 1" },
                                variantId: { type: "string", example: "var1" },
                                quantity: { type: "integer", example: 2 },
                                price: { type: "number", format: "float", example: 50.00 },
                                subtotal: { type: "number", format: "float", example: 100.00 }
                            }
                        }
                    },
                    totalAmount: { type: "number", format: "float", example: 100.00 },
                    shippingAddress: { type: "object", nullable: true },
                    payment: { type: "object", nullable: true },
                    status: { type: "string", example: "pending" },
                    createdAt: { type: "integer", nullable: true, example: 1762406642107 },
                    modifiedAt: { type: "integer", nullable: true, example: 1762406642107 }
                }
            }
        }
    }
};