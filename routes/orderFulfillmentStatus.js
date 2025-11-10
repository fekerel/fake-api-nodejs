// Get order fulfillment status summary
export default (app, router) => {
    const db = router.db;

    app.get('/orders/fulfillment-status', (req, res) => {
        const userId = req.query.userId ? Number(req.query.userId) : null;
        const sellerId = req.query.sellerId ? Number(req.query.sellerId) : null;
        const categoryId = req.query.categoryId ? Number(req.query.categoryId) : null;

        let orders = db.get('orders').value() || [];
        const products = db.get('products').value() || [];

        if (userId !== null) {
            if (!Number.isFinite(userId)) return res.status(400).json({ error: 'invalid userId' });
            orders = orders.filter(o => Number(o.userId) === userId);
        }

        if (sellerId !== null) {
            if (!Number.isFinite(sellerId)) return res.status(400).json({ error: 'invalid sellerId' });
            const sellerProductIds = products
                .filter(p => Number(p.sellerId) === sellerId)
                .map(p => Number(p.id));
            orders = orders.filter(o => {
                if (!o.items) return false;
                return o.items.some(item => sellerProductIds.includes(Number(item.productId)));
            });
        }

        if (categoryId !== null) {
            if (!Number.isFinite(categoryId)) return res.status(400).json({ error: 'invalid categoryId' });
            const categoryProductIds = products
                .filter(p => Number(p.categoryId) === categoryId)
                .map(p => Number(p.id));
            orders = orders.filter(o => {
                if (!o.items) return false;
                return o.items.some(item => categoryProductIds.includes(Number(item.productId)));
            });
        }

        const statusCounts = {
            pending: 0,
            processing: 0,
            shipped: 0,
            delivered: 0,
            cancelled: 0,
            returned: 0,
            failed: 0
        };

        const paymentStatusCounts = {
            pending: 0,
            processing: 0,
            shipped: 0,
            delivered: 0,
            cancelled: 0
        };

        let totalOrders = 0;
        let totalRevenue = 0;
        let totalItems = 0;
        const recentOrders = [];

        orders.forEach(order => {
            totalOrders++;
            totalRevenue += parseFloat(order.totalAmount) || 0;
            
            if (order.items) {
                order.items.forEach(item => {
                    totalItems += Number(item.quantity) || 0;
                });
            }

            if (order.status) {
                const status = order.status.toLowerCase();
                if (statusCounts.hasOwnProperty(status)) {
                    statusCounts[status]++;
                }
            }

            if (order.payment && order.payment.status) {
                const paymentStatus = order.payment.status.toLowerCase();
                if (paymentStatusCounts.hasOwnProperty(paymentStatus)) {
                    paymentStatusCounts[paymentStatus]++;
                }
            }

            if (order.createdAt) {
                recentOrders.push({
                    orderId: order.id,
                    userId: order.userId,
                    totalAmount: parseFloat(order.totalAmount) || 0,
                    status: order.status,
                    paymentStatus: order.payment ? order.payment.status : null,
                    createdAt: order.createdAt
                });
            }
        });

        recentOrders.sort((a, b) => b.createdAt - a.createdAt);

        const fulfillmentRate = totalOrders > 0 
            ? Number(((statusCounts.delivered / totalOrders) * 100).toFixed(2))
            : 0;

        res.json({
            filters: {
                userId: userId || null,
                sellerId: sellerId || null,
                categoryId: categoryId || null
            },
            summary: {
                totalOrders,
                totalRevenue: Number(totalRevenue.toFixed(2)),
                totalItems,
                fulfillmentRate
            },
            statusDistribution: statusCounts,
            paymentStatusDistribution: paymentStatusCounts,
            recentOrders: recentOrders.slice(0, 10)
        });
    });
};

export const openapi = {
    paths: {
        "/orders/fulfillment-status": {
            get: {
                summary: "Get order fulfillment status summary",
                parameters: [
                    { in: "query", name: "userId", schema: { type: "integer" }, description: "Filter by user", example: 1 },
                    { in: "query", name: "sellerId", schema: { type: "integer" }, description: "Filter by seller", example: 1 },
                    { in: "query", name: "categoryId", schema: { type: "integer" }, description: "Filter by category", example: 1 }
                ],
                responses: {
                    "200": {
                        description: "Order fulfillment status",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/OrderFulfillmentStatus" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            filters: {
                                                userId: null,
                                                sellerId: null,
                                                categoryId: null
                                            },
                                            summary: {
                                                totalOrders: 100,
                                                totalRevenue: 10000.50,
                                                totalItems: 250,
                                                fulfillmentRate: 60.00
                                            },
                                            statusDistribution: {
                                                pending: 20,
                                                processing: 10,
                                                shipped: 10,
                                                delivered: 60,
                                                cancelled: 0,
                                                returned: 0,
                                                failed: 0
                                            },
                                            paymentStatusDistribution: {
                                                pending: 15,
                                                processing: 10,
                                                shipped: 5,
                                                delivered: 60,
                                                cancelled: 10
                                            },
                                            recentOrders: [
                                                {
                                                    orderId: 100,
                                                    userId: 1,
                                                    totalAmount: 99.99,
                                                    status: "delivered",
                                                    paymentStatus: "delivered",
                                                    createdAt: 1738368000000
                                                }
                                            ]
                                        }
                                    }
                                }
                            }
                        }
                    },
                    "400": { description: "invalid filter parameters" }
                }
            }
        }
    },
    components: {
        schemas: {
            OrderFulfillmentStatus: {
                type: "object",
                properties: {
                    filters: {
                        type: "object",
                        properties: {
                            userId: { type: "integer", nullable: true, example: null },
                            sellerId: { type: "integer", nullable: true, example: null },
                            categoryId: { type: "integer", nullable: true, example: null }
                        }
                    },
                    summary: {
                        type: "object",
                        properties: {
                            totalOrders: { type: "integer", example: 100 },
                            totalRevenue: { type: "number", format: "float", example: 10000.50 },
                            totalItems: { type: "integer", example: 250 },
                            fulfillmentRate: { type: "number", format: "float", example: 60.00 }
                        }
                    },
                    statusDistribution: {
                        type: "object",
                        properties: {
                            pending: { type: "integer", example: 20 },
                            processing: { type: "integer", example: 10 },
                            shipped: { type: "integer", example: 10 },
                            delivered: { type: "integer", example: 60 },
                            cancelled: { type: "integer", example: 0 },
                            returned: { type: "integer", example: 0 },
                            failed: { type: "integer", example: 0 }
                        }
                    },
                    paymentStatusDistribution: {
                        type: "object",
                        properties: {
                            pending: { type: "integer", example: 15 },
                            processing: { type: "integer", example: 10 },
                            shipped: { type: "integer", example: 5 },
                            delivered: { type: "integer", example: 60 },
                            cancelled: { type: "integer", example: 10 }
                        }
                    },
                    recentOrders: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                orderId: { type: "integer", example: 100 },
                                userId: { type: "integer", example: 1 },
                                totalAmount: { type: "number", format: "float", example: 99.99 },
                                status: { type: "string", example: "delivered" },
                                paymentStatus: { type: "string", nullable: true, example: "delivered" },
                                createdAt: { type: "integer", format: "int64", example: 1738368000000 }
                            }
                        }
                    }
                }
            }
        }
    }
};