// Get product sales forecast based on historical data
export default (app, router) => {
    const db = router.db;

    app.get('/products/:id/sales-forecast', (req, res) => {
        const productId = Number(req.params.id);

        if (!Number.isFinite(productId)) return res.status(400).json({ error: 'invalid id' });

        const product = db.get('products').find(p => Number(p.id) === productId).value();
        if (!product) return res.status(404).json({ error: 'product not found' });

        const orders = db.get('orders').value() || [];
        const salesHistory = [];
        const currentDate = Date.now();
        const daysToAnalyze = 90; // Son 90 gün
        const startDate = currentDate - (daysToAnalyze * 24 * 60 * 60 * 1000);

        orders.forEach(order => {
            if (order.items && order.createdAt && order.createdAt >= startDate) {
                order.items.forEach(item => {
                    if (Number(item.productId) === productId) {
                        salesHistory.push({
                            date: order.createdAt,
                            quantity: Number(item.quantity) || 0,
                            revenue: (parseFloat(item.price) || 0) * (Number(item.quantity) || 0)
                        });
                    }
                });
            }
        });

        salesHistory.sort((a, b) => a.date - b.date);

        let totalSales = 0;
        let totalRevenue = 0;
        const weeklySales = {};
        const monthlySales = {};

        salesHistory.forEach(sale => {
            totalSales += sale.quantity;
            totalRevenue += sale.revenue;

            const saleDate = new Date(sale.date);
            const weekKey = `${saleDate.getFullYear()}-W${Math.ceil((saleDate.getDate() + new Date(saleDate.getFullYear(), saleDate.getMonth(), 0).getDay()) / 7)}`;
            const monthKey = `${saleDate.getFullYear()}-${String(saleDate.getMonth() + 1).padStart(2, '0')}`;

            weeklySales[weekKey] = (weeklySales[weekKey] || 0) + sale.quantity;
            monthlySales[monthKey] = (monthlySales[monthKey] || 0) + sale.quantity;
        });

        const averageDailySales = salesHistory.length > 0 
            ? Number((totalSales / daysToAnalyze).toFixed(2))
            : 0;

        const averageWeeklySales = Object.keys(weeklySales).length > 0
            ? Number((Object.values(weeklySales).reduce((a, b) => a + b, 0) / Object.keys(weeklySales).length).toFixed(2))
            : 0;

        const averageMonthlySales = Object.keys(monthlySales).length > 0
            ? Number((Object.values(monthlySales).reduce((a, b) => a + b, 0) / Object.keys(monthlySales).length).toFixed(2))
            : 0;

        const forecast = {
            nextWeek: Number((averageWeeklySales).toFixed(2)),
            nextMonth: Number((averageMonthlySales).toFixed(2)),
            nextQuarter: Number((averageMonthlySales * 3).toFixed(2))
        };

        const trend = salesHistory.length >= 2 
            ? (salesHistory[salesHistory.length - 1].quantity > salesHistory[0].quantity ? 'increasing' : 'decreasing')
            : 'stable';

        res.json({
            productId,
            productName: product.name,
            analysisPeriod: {
                days: daysToAnalyze,
                startDate,
                endDate: currentDate
            },
            historicalData: {
                totalSales,
                totalRevenue: Number(totalRevenue.toFixed(2)),
                averageDailySales,
                averageWeeklySales,
                averageMonthlySales,
                dataPoints: salesHistory.length
            },
            forecast,
            trend,
            confidence: salesHistory.length > 10 ? 'high' : salesHistory.length > 5 ? 'medium' : 'low'
        });
    });
};

export const openapi = {
    paths: {
        "/products/{id}/sales-forecast": {
            get: {
                summary: "Get product sales forecast based on historical data",
                parameters: [
                    { in: "path", name: "id", required: true, schema: { type: "integer" }, example: 1 }
                ],
                responses: {
                    "200": {
                        description: "Product sales forecast",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ProductSalesForecast" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            productId: 1,
                                            productName: "Product A",
                                            analysisPeriod: {
                                                days: 90,
                                                startDate: 1735689600000,
                                                endDate: 1738368000000
                                            },
                                            historicalData: {
                                                totalSales: 150,
                                                totalRevenue: 4500.75,
                                                averageDailySales: 1.67,
                                                averageWeeklySales: 11.67,
                                                averageMonthlySales: 50.00,
                                                dataPoints: 25
                                            },
                                            forecast: {
                                                nextWeek: 11.67,
                                                nextMonth: 50.00,
                                                nextQuarter: 150.00
                                            },
                                            trend: "increasing",
                                            confidence: "high"
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
            ProductSalesForecast: {
                type: "object",
                properties: {
                    productId: { type: "integer", example: 1 },
                    productName: { type: "string", example: "Product A" },
                    analysisPeriod: {
                        type: "object",
                        properties: {
                            days: { type: "integer", example: 90 },
                            startDate: { type: "integer", format: "int64", example: 1735689600000 },
                            endDate: { type: "integer", format: "int64", example: 1738368000000 }
                        }
                    },
                    historicalData: {
                        type: "object",
                        properties: {
                            totalSales: { type: "integer", example: 150 },
                            totalRevenue: { type: "number", format: "float", example: 4500.75 },
                            averageDailySales: { type: "number", format: "float", example: 1.67 },
                            averageWeeklySales: { type: "number", format: "float", example: 11.67 },
                            averageMonthlySales: { type: "number", format: "float", example: 50.00 },
                            dataPoints: { type: "integer", example: 25 }
                        }
                    },
                    forecast: {
                        type: "object",
                        properties: {
                            nextWeek: { type: "number", format: "float", example: 11.67 },
                            nextMonth: { type: "number", format: "float", example: 50.00 },
                            nextQuarter: { type: "number", format: "float", example: 150.00 }
                        }
                    },
                    trend: { type: "string", enum: ["increasing", "decreasing", "stable"], example: "increasing" },
                    confidence: { type: "string", enum: ["low", "medium", "high"], example: "high" }
                }
            }
        }
    }
};