// Get user activity summary with recent orders, favorite categories and purchase patterns
export default (app, router) => {
    const db = router.db;

    app.get('/users/:id/activity', (req, res) => {
        const userId = Number(req.params.id);
        
        if (!Number.isFinite(userId)) return res.status(400).json({ error: 'invalid id' });
        
        const user = db.get('users').find(u => Number(u.id) === userId).value();
        
        if (!user) return res.status(404).json({ error: 'user not found' });
        
        const orders = db.get('orders').filter(o => Number(o.userId) === userId).value() || [];
        
        // Son 5 sipariş
        const recentOrders = orders
            .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0))
            .slice(0, 5)
            .map(order => ({
                orderId: order.id,
                totalAmount: parseFloat(order.totalAmount) || 0,
                status: order.status,
                createdAt: order.createdAt || null
            }));
        
        // Kategori bazında sipariş sayısı
        const categoryActivity = {};
        orders.forEach(order => {
            if (order.items) {
                order.items.forEach(item => {
                    const product = db.get('products').find(p => Number(p.id) === Number(item.productId)).value();
                    if (product && product.categoryId) {
                        const catId = Number(product.categoryId);
                        categoryActivity[catId] = (categoryActivity[catId] || 0) + 1;
                    }
                });
            }
        });
        
        const topCategories = Object.keys(categoryActivity)
            .map(catId => {
                const category = db.get('categories').find(c => Number(c.id) === Number(catId)).value();
                return {
                    categoryId: Number(catId),
                    categoryName: category ? category.name : 'Unknown',
                    orderCount: categoryActivity[catId]
                };
            })
            .sort((a, b) => b.orderCount - a.orderCount)
            .slice(0, 3);
        
        // Toplam harcama
        const totalSpent = orders.reduce((acc, o) => acc + (parseFloat(o.totalAmount) || 0), 0);
        
        // Son aktivite tarihi
        const lastActivity = orders.length > 0 
            ? Math.max(...orders.map(o => o.createdAt || 0))
            : null;
        
        res.json({
            userId,
            userName: `${user.firstName} ${user.lastName}`,
            totalOrders: orders.length,
            totalSpent: Number(totalSpent.toFixed(2)),
            recentOrders,
            topCategories,
            lastActivity,
            isActive: orders.length > 0
        });
    });
};

export const openapi = {
    paths: {
        "/users/{id}/activity": {
            get: {
                summary: "Get user activity summary",
                parameters: [
                    { in: "path", name: "id", required: true, schema: { type: "integer" }, example: 1 }
                ],
                responses: {
                    "200": {
                        description: "User activity summary",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/UserActivity" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            userId: 1,
                                            userName: "John Doe",
                                            totalOrders: 10,
                                            totalSpent: 450.50,
                                            recentOrders: [
                                                { orderId: 5, totalAmount: 99.99, status: "delivered", createdAt: 1762406642107 }
                                            ],
                                            topCategories: [
                                                { categoryId: 1, categoryName: "Category A", orderCount: 5 }
                                            ],
                                            lastActivity: 1762406642107,
                                            isActive: true
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
            UserActivity: {
                type: "object",
                properties: {
                    userId: { type: "integer", example: 1 },
                    userName: { type: "string", example: "John Doe" },
                    totalOrders: { type: "integer", example: 10 },
                    totalSpent: { type: "number", format: "float", example: 450.50 },
                    recentOrders: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                orderId: { type: "integer", example: 5 },
                                totalAmount: { type: "number", format: "float", example: 99.99 },
                                status: { type: "string", example: "delivered" },
                                createdAt: { type: "integer", nullable: true, example: 1762406642107 }
                            }
                        }
                    },
                    topCategories: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                categoryId: { type: "integer", example: 1 },
                                categoryName: { type: "string", example: "Category A" },
                                orderCount: { type: "integer", example: 5 }
                            }
                        }
                    },
                    lastActivity: { type: "integer", nullable: true, example: 1762406642107 },
                    isActive: { type: "boolean", example: true }
                }
            }
        }
    }
};