// Get product demand analysis based on orders and stock
export default (app, router) => {
    const db = router.db;

    app.get('/products/:id/demand-analysis', (req, res) => {
        const productId = Number(req.params.id);

        if (!Number.isFinite(productId)) return res.status(400).json({ error: 'invalid id' });

        const product = db.get('products').find(p => Number(p.id) === productId).value();
        if (!product) return res.status(404).json({ error: 'product not found' });

        const orders = db.get('orders').value() || [];
        const currentStock = Number(product.stock) || 0;
        const currentDate = Date.now();
        const daysToAnalyze = 30; // Son 30 gün
        const startDate = currentDate - (daysToAnalyze * 24 * 60 * 60 * 1000);

        let totalDemand = 0;
        let totalRevenue = 0;
        let orderCount = 0;
        const dailyDemand = {};
        const weeklyDemand = {};

        orders.forEach(order => {
            if (order.items && order.createdAt && order.createdAt >= startDate) {
                order.items.forEach(item => {
                    if (Number(item.productId) === productId) {
                        const quantity = Number(item.quantity) || 0;
                        const price = parseFloat(item.price) || 0;
                        
                        totalDemand += quantity;
                        totalRevenue += quantity * price;
                        orderCount++;

                        const orderDate = new Date(order.createdAt);
                        const dayKey = orderDate.toISOString().split('T')[0];
                        const weekStart = new Date(orderDate);
                        weekStart.setDate(orderDate.getDate() - orderDate.getDay());
                        const weekKey = weekStart.toISOString().split('T')[0];

                        dailyDemand[dayKey] = (dailyDemand[dayKey] || 0) + quantity;
                        weeklyDemand[weekKey] = (weeklyDemand[weekKey] || 0) + quantity;
                    }
                });
            }
        });

        const averageDailyDemand = daysToAnalyze > 0
            ? Number((totalDemand / daysToAnalyze).toFixed(2))
            : 0;

        const averageWeeklyDemand = Object.keys(weeklyDemand).length > 0
            ? Number((Object.values(weeklyDemand).reduce((a, b) => a + b, 0) / Object.keys(weeklyDemand).length).toFixed(2))
            : 0;

        const daysUntilStockout = averageDailyDemand > 0 && currentStock > 0
            ? Math.floor(currentStock / averageDailyDemand)
            : currentStock > 0 ? 999 : 0;

        const demandTrend = Object.keys(dailyDemand).length >= 2
            ? (Object.values(dailyDemand).slice(-1)[0] > Object.values(dailyDemand)[0] ? 'increasing' : 'decreasing')
            : 'stable';

        const demandLevel = averageDailyDemand > 10 ? 'high'
            : averageDailyDemand > 5 ? 'medium'
            : averageDailyDemand > 0 ? 'low'
            : 'very_low';

        const stockStatus = currentStock <= 10 ? 'critical'
            : currentStock <= 50 ? 'low'
            : currentStock <= 200 ? 'adequate'
            : 'high';

        res.json({
            productId,
            productName: product.name,
            currentStock,
            demandAnalysis: {
                totalDemand,
                totalRevenue: Number(totalRevenue.toFixed(2)),
                orderCount,
                averageDailyDemand,
                averageWeeklyDemand,
                demandLevel,
                demandTrend,
                daysUntilStockout
            },
            stockStatus,
            recommendations: [
                ...(daysUntilStockout < 7 ? ['urgent_restock'] : []),
                ...(daysUntilStockout < 14 && daysUntilStockout >= 7 ? ['restock_soon'] : []),
                ...(demandTrend === 'increasing' && currentStock < 100 ? ['increase_stock'] : []),
                ...(demandTrend === 'decreasing' && currentStock > 500 ? ['reduce_stock'] : [])
            ]
        });
    });
};

export const openapi = {
    paths: {
        "/products/{id}/demand-analysis": {
            get: {
                summary: "Get product demand analysis based on orders and stock",
                parameters: [
                    { in: "path", name: "id", required: true, schema: { type: "integer" }, example: 1 }
                ],
                responses: {
                    "200": {
                        description: "Product demand analysis",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ProductDemandAnalysis" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            productId: 1,
                                            productName: "Product A",
                                            currentStock: 100,
                                            demandAnalysis: {
                                                totalDemand: 50,
                                                totalRevenue: 1500.75,
                                                orderCount: 25,
                                                averageDailyDemand: 1.67,
                                                averageWeeklyDemand: 11.67,
                                                demandLevel: "low",
                                                demandTrend: "increasing",
                                                daysUntilStockout: 60
                                            },
                                            stockStatus: "adequate",
                                            recommendations: ["restock_soon"]
                                        }
                                    }
                                }
                            }
                        }
                    },
                    "400": { description: "invalid id" },
                    "404": { description: "product not found" }
                }
            }
        }
    },
    components: {
        schemas: {
            ProductDemandAnalysis: {
                type: "object",
                properties: {
                    productId: { type: "integer", example: 1 },
                    productName: { type: "string", example: "Product A" },
                    currentStock: { type: "integer", example: 100 },
                    demandAnalysis: {
                        type: "object",
                        properties: {
                            totalDemand: { type: "integer", example: 50 },
                            totalRevenue: { type: "number", format: "float", example: 1500.75 },
                            orderCount: { type: "integer", example: 25 },
                            averageDailyDemand: { type: "number", format: "float", example: 1.67 },
                            averageWeeklyDemand: { type: "number", format: "float", example: 11.67 },
                            demandLevel: { type: "string", enum: ["very_low", "low", "medium", "high"], example: "low" },
                            demandTrend: { type: "string", enum: ["increasing", "decreasing", "stable"], example: "increasing" },
                            daysUntilStockout: { type: "integer", example: 60 }
                        }
                    },
                    stockStatus: { type: "string", enum: ["critical", "low", "adequate", "high"], example: "adequate" },
                    recommendations: {
                        type: "array",
                        items: { type: "string" },
                        example: ["restock_soon"]
                    }
                }
            }
        }
    }
};