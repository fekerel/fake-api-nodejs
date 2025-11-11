// Get seller customer retention analysis
export default (app, router) => {
    const db = router.db;

    app.get('/sellers/:id/customer-retention', (req, res) => {
        const sellerId = Number(req.params.id);

        if (!Number.isFinite(sellerId)) return res.status(400).json({ error: 'invalid id' });

        const seller = db.get('users').find(u => Number(u.id) === sellerId && u.role === 'seller').value();
        if (!seller) return res.status(404).json({ error: 'seller not found' });

        const products = db.get('products').filter(p => Number(p.sellerId) === sellerId).value() || [];
        const productIds = products.map(p => Number(p.id));
        const orders = db.get('orders').value() || [];

        const customerOrders = {};
        const customerFirstOrder = {};
        const customerLastOrder = {};

        orders.forEach(order => {
            if (order.items && order.userId) {
                const hasSellerProduct = order.items.some(item => productIds.includes(Number(item.productId)));
                if (hasSellerProduct) {
                    const userId = Number(order.userId);
                    if (!customerOrders[userId]) {
                        customerOrders[userId] = [];
                        customerFirstOrder[userId] = order.createdAt;
                    }
                    customerOrders[userId].push({
                        orderId: order.id,
                        date: order.createdAt,
                        amount: parseFloat(order.totalAmount) || 0
                    });
                    customerLastOrder[userId] = order.createdAt;
                }
            }
        });

        let newCustomers = 0;
        let returningCustomers = 0;
        let totalCustomers = Object.keys(customerOrders).length;
        let totalRevenue = 0;
        let repeatPurchaseRate = 0;

        Object.keys(customerOrders).forEach(userId => {
            const orders = customerOrders[userId];
            if (orders.length === 1) {
                newCustomers++;
            } else {
                returningCustomers++;
            }
            orders.forEach(order => {
                totalRevenue += order.amount;
            });
        });

        repeatPurchaseRate = totalCustomers > 0
            ? Number(((returningCustomers / totalCustomers) * 100).toFixed(2))
            : 0;

        const averageOrdersPerCustomer = totalCustomers > 0
            ? Number((Object.values(customerOrders).reduce((sum, orders) => sum + orders.length, 0) / totalCustomers).toFixed(2))
            : 0;

        const averageCustomerValue = totalCustomers > 0
            ? Number((totalRevenue / totalCustomers).toFixed(2))
            : 0;

        const retentionRate = totalCustomers > 0
            ? Number(((returningCustomers / totalCustomers) * 100).toFixed(2))
            : 0;

        const topCustomers = Object.keys(customerOrders)
            .map(userId => {
                const orders = customerOrders[userId];
                const totalSpent = orders.reduce((sum, o) => sum + o.amount, 0);
                return {
                    userId: Number(userId),
                    orderCount: orders.length,
                    totalSpent: Number(totalSpent.toFixed(2)),
                    firstOrderDate: customerFirstOrder[userId],
                    lastOrderDate: customerLastOrder[userId]
                };
            })
            .sort((a, b) => b.totalSpent - a.totalSpent)
            .slice(0, 5);

        res.json({
            sellerId,
            sellerName: `${seller.firstName || ''} ${seller.lastName || ''}`.trim() || seller.email,
            retention: {
                totalCustomers,
                newCustomers,
                returningCustomers,
                retentionRate,
                repeatPurchaseRate
            },
            metrics: {
                averageOrdersPerCustomer,
                averageCustomerValue,
                totalRevenue: Number(totalRevenue.toFixed(2))
            },
            topCustomers
        });
    });
};

export const openapi = {
    paths: {
        "/sellers/{id}/customer-retention": {
            get: {
                summary: "Get seller customer retention analysis",
                parameters: [
                    { in: "path", name: "id", required: true, schema: { type: "integer" }, example: 1 }
                ],
                responses: {
                    "200": {
                        description: "Seller customer retention",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/SellerCustomerRetention" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            sellerId: 1,
                                            sellerName: "John Seller",
                                            retention: {
                                                totalCustomers: 50,
                                                newCustomers: 20,
                                                returningCustomers: 30,
                                                retentionRate: 60.00,
                                                repeatPurchaseRate: 60.00
                                            },
                                            metrics: {
                                                averageOrdersPerCustomer: 2.5,
                                                averageCustomerValue: 150.25,
                                                totalRevenue: 7512.50
                                            },
                                            topCustomers: [
                                                {
                                                    userId: 10,
                                                    orderCount: 5,
                                                    totalSpent: 750.50,
                                                    firstOrderDate: 1735689600000,
                                                    lastOrderDate: 1738368000000
                                                }
                                            ]
                                        }
                                    }
                                }
                            }
                        }
                    },
                    "400": { description: "invalid id" },
                    "404": { description: "seller not found" }
                }
            }
        }
    },
    components: {
        schemas: {
            SellerCustomerRetention: {
                type: "object",
                properties: {
                    sellerId: { type: "integer", example: 1 },
                    sellerName: { type: "string", example: "John Seller" },
                    retention: {
                        type: "object",
                        properties: {
                            totalCustomers: { type: "integer", example: 50 },
                            newCustomers: { type: "integer", example: 20 },
                            returningCustomers: { type: "integer", example: 30 },
                            retentionRate: { type: "number", format: "float", example: 60.00 },
                            repeatPurchaseRate: { type: "number", format: "float", example: 60.00 }
                        }
                    },
                    metrics: {
                        type: "object",
                        properties: {
                            averageOrdersPerCustomer: { type: "number", format: "float", example: 2.5 },
                            averageCustomerValue: { type: "number", format: "float", example: 150.25 },
                            totalRevenue: { type: "number", format: "float", example: 7512.50 }
                        }
                    },
                    topCustomers: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                userId: { type: "integer", example: 10 },
                                orderCount: { type: "integer", example: 5 },
                                totalSpent: { type: "number", format: "float", example: 750.50 },
                                firstOrderDate: { type: "integer", format: "int64", example: 1735689600000 },
                                lastOrderDate: { type: "integer", format: "int64", example: 1738368000000 }
                            }
                        }
                    }
                }
            }
        }
    }
};