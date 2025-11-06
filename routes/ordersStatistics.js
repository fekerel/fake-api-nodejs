// Get overall order statistics with totals, averages and status distribution
export default (app, router) => {
    const db = router.db;

    app.get('/orders/statistics', (req, res) => {
        const orders = db.get('orders').value() || [];
        
        const totalOrders = orders.length;
        const totalRevenue = orders.reduce((acc, o) => acc + (parseFloat(o.totalAmount) || 0), 0);
        const averageOrderValue = totalOrders > 0 ? Number((totalRevenue / totalOrders).toFixed(2)) : 0;
        
        // Status dağılımı
        const statusDistribution = {};
        orders.forEach(order => {
            const status = order.status || 'unknown';
            statusDistribution[status] = (statusDistribution[status] || 0) + 1;
        });
        
        // Payment method dağılımı
        const paymentMethodDistribution = {};
        orders.forEach(order => {
            const method = order.payment?.method || 'unknown';
            paymentMethodDistribution[method] = (paymentMethodDistribution[method] || 0) + 1;
        });
        
        // Toplam item sayısı
        const totalItems = orders.reduce((acc, o) => {
            return acc + (o.items?.length || 0);
        }, 0);
        
        // En yüksek ve en düşük sipariş
        const orderAmounts = orders.map(o => parseFloat(o.totalAmount) || 0).filter(a => a > 0);
        const highestOrder = orderAmounts.length > 0 ? Number(Math.max(...orderAmounts).toFixed(2)) : 0;
        const lowestOrder = orderAmounts.length > 0 ? Number(Math.min(...orderAmounts).toFixed(2)) : 0;
        
        res.json({
            totalOrders,
            totalRevenue: Number(totalRevenue.toFixed(2)),
            averageOrderValue,
            totalItems,
            highestOrder,
            lowestOrder,
            statusDistribution,
            paymentMethodDistribution
        });
    });
};

export const openapi = {
    paths: {
        "/orders/statistics": {
            get: {
                summary: "Get overall order statistics",
                responses: {
                    "200": {
                        description: "Order statistics",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/OrderStatistics" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            totalOrders: 100,
                                            totalRevenue: 10000.50,
                                            averageOrderValue: 100.01,
                                            totalItems: 250,
                                            highestOrder: 500.00,
                                            lowestOrder: 10.00,
                                            statusDistribution: { delivered: 60, pending: 20, cancelled: 20 },
                                            paymentMethodDistribution: { credit_card: 50, paypal: 30, bank_transfer: 20 }
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
            OrderStatistics: {
                type: "object",
                properties: {
                    totalOrders: { type: "integer", example: 100 },
                    totalRevenue: { type: "number", format: "float", example: 10000.50 },
                    averageOrderValue: { type: "number", format: "float", example: 100.01 },
                    totalItems: { type: "integer", example: 250 },
                    highestOrder: { type: "number", format: "float", example: 500.00 },
                    lowestOrder: { type: "number", format: "float", example: 10.00 },
                    statusDistribution: { type: "object", example: { delivered: 60, pending: 20, cancelled: 20 } },
                    paymentMethodDistribution: { type: "object", example: { credit_card: 50, paypal: 30, bank_transfer: 20 } }
                }
            }
        }
    }
};