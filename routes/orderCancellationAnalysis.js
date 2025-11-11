// Get order cancellation analysis
export default (app, router) => {
    const db = router.db;

    app.get('/orders/cancellation-analysis', (req, res) => {
        const orders = db.get('orders').value() || [];
        const users = db.get('users').value() || [];
        const products = db.get('products').value() || [];
        const categories = db.get('categories').value() || [];

        const cancelledOrders = orders.filter(o => o.status === 'cancelled' || o.status === 'returned');
        const totalOrders = orders.length;
        const cancellationRate = totalOrders > 0 
            ? Number(((cancelledOrders.length / totalOrders) * 100).toFixed(2))
            : 0;

        const cancellationByReason = {};
        const cancellationByUser = {};
        const cancellationByCategory = {};
        const cancellationByPaymentMethod = {};
        const cancellationTimeline = {};

        cancelledOrders.forEach(order => {
            const userId = Number(order.userId);
            const user = users.find(u => Number(u.id) === userId);
            
            if (!cancellationByUser[userId]) {
                cancellationByUser[userId] = {
                    userId,
                    userName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Unknown',
                    cancellationCount: 0,
                    totalAmount: 0
                };
            }
            cancellationByUser[userId].cancellationCount++;
            cancellationByUser[userId].totalAmount += parseFloat(order.totalAmount) || 0;

            const paymentMethod = order.payment ? order.payment.method : 'unknown';
            cancellationByPaymentMethod[paymentMethod] = (cancellationByPaymentMethod[paymentMethod] || 0) + 1;

            if (order.items) {
                order.items.forEach(item => {
                    const product = products.find(p => Number(p.id) === Number(item.productId));
                    if (product) {
                        const categoryId = Number(product.categoryId);
                        const category = categories.find(c => Number(c.id) === categoryId);
                        cancellationByCategory[categoryId] = {
                            categoryId,
                            categoryName: category ? category.name : 'Unknown',
                            cancellationCount: (cancellationByCategory[categoryId]?.cancellationCount || 0) + 1,
                            totalAmount: (cancellationByCategory[categoryId]?.totalAmount || 0) + (parseFloat(item.price) || 0) * (Number(item.quantity) || 0)
                        };
                    }
                });
            }

            if (order.createdAt) {
                const orderDate = new Date(order.createdAt);
                const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
                cancellationTimeline[monthKey] = (cancellationTimeline[monthKey] || 0) + 1;
            }

            const reason = order.cancellationReason || 'not_specified';
            cancellationByReason[reason] = (cancellationByReason[reason] || 0) + 1;
        });

        const topCancellingUsers = Object.values(cancellationByUser)
            .map(user => ({
                ...user,
                totalAmount: Number(user.totalAmount.toFixed(2))
            }))
            .sort((a, b) => b.cancellationCount - a.cancellationCount)
            .slice(0, 10);

        const topCancelledCategories = Object.values(cancellationByCategory)
            .map(cat => ({
                ...cat,
                totalAmount: Number(cat.totalAmount.toFixed(2))
            }))
            .sort((a, b) => b.cancellationCount - a.cancellationCount)
            .slice(0, 5);

        const timeline = Object.keys(cancellationTimeline)
            .sort()
            .map(month => ({
                month,
                cancellationCount: cancellationTimeline[month]
            }));

        res.json({
            summary: {
                totalOrders,
                cancelledOrders: cancelledOrders.length,
                cancellationRate,
                totalCancelledAmount: Number(cancelledOrders.reduce((sum, o) => sum + (parseFloat(o.totalAmount) || 0), 0).toFixed(2))
            },
            cancellationByReason,
            cancellationByPaymentMethod,
            topCancellingUsers,
            topCancelledCategories,
            timeline
        });
    });
};

export const openapi = {
    paths: {
        "/orders/cancellation-analysis": {
            get: {
                summary: "Get order cancellation analysis",
                responses: {
                    "200": {
                        description: "Order cancellation analysis",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/OrderCancellationAnalysis" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            summary: {
                                                totalOrders: 100,
                                                cancelledOrders: 10,
                                                cancellationRate: 10.00,
                                                totalCancelledAmount: 1500.50
                                            },
                                            cancellationByReason: {
                                                "not_specified": 5,
                                                "out_of_stock": 3,
                                                "customer_request": 2
                                            },
                                            cancellationByPaymentMethod: {
                                                "credit_card": 6,
                                                "paypal": 3,
                                                "bank_transfer": 1
                                            },
                                            topCancellingUsers: [
                                                {
                                                    userId: 1,
                                                    userName: "John Doe",
                                                    cancellationCount: 3,
                                                    totalAmount: 450.75
                                                }
                                            ],
                                            topCancelledCategories: [
                                                {
                                                    categoryId: 1,
                                                    categoryName: "Category A",
                                                    cancellationCount: 5,
                                                    totalAmount: 750.25
                                                }
                                            ],
                                            timeline: [
                                                {
                                                    month: "2025-01",
                                                    cancellationCount: 5
                                                }
                                            ]
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    },
    components: {
        schemas: {
            OrderCancellationAnalysis: {
                type: "object",
                properties: {
                    summary: {
                        type: "object",
                        properties: {
                            totalOrders: { type: "integer", example: 100 },
                            cancelledOrders: { type: "integer", example: 10 },
                            cancellationRate: { type: "number", format: "float", example: 10.00 },
                            totalCancelledAmount: { type: "number", format: "float", example: 1500.50 }
                        }
                    },
                    cancellationByReason: {
                        type: "object",
                        additionalProperties: { type: "integer" }
                    },
                    cancellationByPaymentMethod: {
                        type: "object",
                        additionalProperties: { type: "integer" }
                    },
                    topCancellingUsers: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                userId: { type: "integer", example: 1 },
                                userName: { type: "string", example: "John Doe" },
                                cancellationCount: { type: "integer", example: 3 },
                                totalAmount: { type: "number", format: "float", example: 450.75 }
                            }
                        }
                    },
                    topCancelledCategories: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                categoryId: { type: "integer", example: 1 },
                                categoryName: { type: "string", example: "Category A" },
                                cancellationCount: { type: "integer", example: 5 },
                                totalAmount: { type: "number", format: "float", example: 750.25 }
                            }
                        }
                    },
                    timeline: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                month: { type: "string", example: "2025-01" },
                                cancellationCount: { type: "integer", example: 5 }
                            }
                        }
                    }
                }
            }
        }
    }
};