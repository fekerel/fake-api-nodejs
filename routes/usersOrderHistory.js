export default (app, router) => { 
    const db = router.db;  // ← Bu satırı eklemen gerekiyor!
    app.get('/users/:id/order-history', (req, res) => {
        // Get user order history with favorite category
        const userId = Number(req.params.id);
        
        if (!Number.isFinite(userId)) return res.status(400).json({ error: 'invalid id' });
        
        const user = db.get('users').find(u => Number(u.id) === userId).value();
        
        if (!user) return res.status(404).json({ error: 'user not found' });
        
        const orders = db.get('orders').filter(o => Number(o.userId) === userId).value() || [];
        
        const ordersList = orders.map(order => ({
            id: order.id,
            totalAmount: parseFloat(order.totalAmount) || 0,
            status: order.status,
            paymentMethod: order.payment?.method || null,
            createdAt: order.createdAt || null,
            itemsCount: order.items?.length || 0
        }));
        
        const totalSpent = orders.reduce((acc, o) => acc + (parseFloat(o.totalAmount) || 0), 0);
        
        // En çok sipariş verilen kategoriyi bul
        const categoryCounts = {};
        orders.forEach(order => {
            if (order.items) {
                order.items.forEach(item => {
                    const product = db.get('products').find(p => Number(p.id) === Number(item.productId)).value();
                    if (product && product.categoryId) {
                        const catId = Number(product.categoryId);
                        categoryCounts[catId] = (categoryCounts[catId] || 0) + 1;
                    }
                });
            }
        });
        
        let favoriteCategory = null;
        if (Object.keys(categoryCounts).length > 0) {
            const maxCategoryId = Object.keys(categoryCounts).reduce((a, b) => 
                categoryCounts[a] > categoryCounts[b] ? a : b
            );
            const category = db.get('categories').find(c => Number(c.id) === Number(maxCategoryId)).value();
            favoriteCategory = category ? category.name : null;
        }
        
        res.json({
            userId,
            userName: `${user.firstName} ${user.lastName}`,
            totalOrders: orders.length,
            orders: ordersList,
            totalSpent: Number(totalSpent.toFixed(2)),
            favoriteCategory
        });
    });
}


export const openapi = {
    paths: {
        "/users/{id}/order-history": {
            get: {
                summary: "Get user order history",
                parameters: [
                    { in: "path", name: "id", required: true, schema: { type: "integer" }, example: 1 }
                ],
                responses: {
                    "200": {
                        description: "User order history",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/UserOrderHistory" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            userId: 1,
                                            userName: "John Doe",
                                            totalOrders: 5,
                                            orders: [
                                                { id: 1, totalAmount: 99.99, status: "delivered", paymentMethod: "credit_card", createdAt: 1762406642107, itemsCount: 2 }
                                            ],
                                            totalSpent: 450.50,
                                            favoriteCategory: "Meyve & Sebze"
                                        }
                                    }
                                }
                            }
                        }
                    },
                    "400": { description: "invalid id" },
                    "404": { description: "user not found" }
                }
            }
        }
    },
    components: {
        schemas: {
            UserOrderHistory: {
                type: "object",
                properties: {
                    userId: { type: "integer", example: 1 },
                    userName: { type: "string", example: "John Doe" },
                    totalOrders: { type: "integer", example: 5 },
                    orders: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                id: { type: "integer", example: 1 },
                                totalAmount: { type: "number", format: "float", example: 99.99 },
                                status: { type: "string", example: "delivered" },
                                paymentMethod: { type: "string", example: "credit_card" },
                                createdAt: { type: "integer", example: 1762406642107 },
                                itemsCount: { type: "integer", example: 2 }
                            }
                        }
                    },
                    totalSpent: { type: "number", format: "float", example: 450.50 },
                    favoriteCategory: { type: "string", nullable: true, example: "Meyve & Sebze" }
                }
            }
        }
    }
};