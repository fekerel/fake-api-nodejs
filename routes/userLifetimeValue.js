// Get user lifetime value and segmentation
export default (app, router) => {
    const db = router.db;

    app.get('/users/:id/lifetime-value', (req, res) => {
        const userId = Number(req.params.id);

        if (!Number.isFinite(userId)) return res.status(400).json({ error: 'invalid id' });

        const user = db.get('users').find(u => Number(u.id) === userId).value();
        if (!user) return res.status(404).json({ error: 'user not found' });

        const orders = db.get('orders').filter(o => Number(o.userId) === userId).value() || [];
        
        let totalSpent = 0;
        let totalItems = 0;
        const orderDates = [];
        const categorySpending = {};

        orders.forEach(order => {
            totalSpent += parseFloat(order.totalAmount) || 0;
            if (order.createdAt) orderDates.push(order.createdAt);
            
            if (order.items) {
                order.items.forEach(item => {
                    totalItems += Number(item.quantity) || 0;
                    
                    const product = db.get('products').find(p => Number(p.id) === Number(item.productId)).value();
                    if (product) {
                        const categoryId = Number(product.categoryId);
                        if (!categorySpending[categoryId]) {
                            const category = db.get('categories').find(c => Number(c.id) === categoryId).value();
                            categorySpending[categoryId] = {
                                categoryId,
                                categoryName: category ? category.name : 'Unknown',
                                totalSpent: 0,
                                orderCount: 0
                            };
                        }
                        categorySpending[categoryId].totalSpent += parseFloat(item.price) * (Number(item.quantity) || 0);
                    }
                });
            }
        });

        orderDates.sort((a, b) => a - b);
        const firstOrderDate = orderDates.length > 0 ? orderDates[0] : null;
        const lastOrderDate = orderDates.length > 0 ? orderDates[orderDates.length - 1] : null;
        
        const daysActive = firstOrderDate && lastOrderDate 
            ? Math.ceil((lastOrderDate - firstOrderDate) / (1000 * 60 * 60 * 24))
            : 0;

        const averageOrderValue = orders.length > 0 ? Number((totalSpent / orders.length).toFixed(2)) : 0;
        const orderFrequency = daysActive > 0 ? Number((orders.length / daysActive * 30).toFixed(2)) : 0; // orders per month

        let segment = 'new';
        if (orders.length >= 10 && totalSpent >= 1000) {
            segment = 'vip';
        } else if (orders.length >= 5 && totalSpent >= 500) {
            segment = 'loyal';
        } else if (orders.length >= 2) {
            segment = 'regular';
        }

        const topCategories = Object.values(categorySpending)
            .sort((a, b) => b.totalSpent - a.totalSpent)
            .slice(0, 3);

        res.json({
            userId,
            userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
            lifetimeValue: {
                totalSpent: Number(totalSpent.toFixed(2)),
                totalOrders: orders.length,
                totalItems,
                averageOrderValue,
                orderFrequency,
                daysActive,
                firstOrderDate,
                lastOrderDate
            },
            segment,
            topCategories
        });
    });
};

export const openapi = {
    paths: {
        "/users/{id}/lifetime-value": {
            get: {
                summary: "Get user lifetime value and segmentation",
                parameters: [
                    { in: "path", name: "id", required: true, schema: { type: "integer" }, example: 1 }
                ],
                responses: {
                    "200": {
                        description: "User lifetime value",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/UserLifetimeValue" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            userId: 1,
                                            userName: "John Doe",
                                            lifetimeValue: {
                                                totalSpent: 1599.42,
                                                totalOrders: 10,
                                                totalItems: 25,
                                                averageOrderValue: 159.94,
                                                orderFrequency: 2.5,
                                                daysActive: 120,
                                                firstOrderDate: 1735689600000,
                                                lastOrderDate: 1738368000000
                                            },
                                            segment: "loyal",
                                            topCategories: [
                                                {
                                                    categoryId: 1,
                                                    categoryName: "Category A",
                                                    totalSpent: 800.50,
                                                    orderCount: 5
                                                }
                                            ]
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
            UserLifetimeValue: {
                type: "object",
                properties: {
                    userId: { type: "integer", example: 1 },
                    userName: { type: "string", example: "John Doe" },
                    lifetimeValue: {
                        type: "object",
                        properties: {
                            totalSpent: { type: "number", format: "float", example: 1599.42 },
                            totalOrders: { type: "integer", example: 10 },
                            totalItems: { type: "integer", example: 25 },
                            averageOrderValue: { type: "number", format: "float", example: 159.94 },
                            orderFrequency: { type: "number", format: "float", example: 2.5 },
                            daysActive: { type: "integer", example: 120 },
                            firstOrderDate: { type: "integer", format: "int64", nullable: true, example: 1735689600000 },
                            lastOrderDate: { type: "integer", format: "int64", nullable: true, example: 1738368000000 }
                        }
                    },
                    segment: { type: "string", enum: ["new", "regular", "loyal", "vip"], example: "loyal" },
                    topCategories: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                categoryId: { type: "integer", example: 1 },
                                categoryName: { type: "string", example: "Category A" },
                                totalSpent: { type: "number", format: "float", example: 800.50 },
                                orderCount: { type: "integer", example: 5 }
                            }
                        }
                    }
                }
            }
        }
    }
};