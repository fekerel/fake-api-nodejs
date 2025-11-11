// Get seller revenue forecast based on historical performance
export default (app, router) => {
    const db = router.db;

    app.get('/sellers/:id/revenue-forecast', (req, res) => {
        const sellerId = Number(req.params.id);

        if (!Number.isFinite(sellerId)) return res.status(400).json({ error: 'invalid id' });

        const seller = db.get('users').find(u => Number(u.id) === sellerId && u.role === 'seller').value();
        if (!seller) return res.status(404).json({ error: 'seller not found' });

        const products = db.get('products').filter(p => Number(p.sellerId) === sellerId).value() || [];
        const productIds = products.map(p => Number(p.id));
        const orders = db.get('orders').value() || [];

        const monthlyRevenue = {};
        const monthlySales = {};
        const productPerformance = {};

        orders.forEach(order => {
            if (order.items && order.createdAt) {
                const orderDate = new Date(order.createdAt);
                const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;

                order.items.forEach(item => {
                    if (productIds.includes(Number(item.productId))) {
                        if (!monthlyRevenue[monthKey]) {
                            monthlyRevenue[monthKey] = 0;
                            monthlySales[monthKey] = 0;
                        }

                        const quantity = Number(item.quantity) || 0;
                        const price = parseFloat(item.price) || 0;
                        const revenue = quantity * price;

                        monthlyRevenue[monthKey] += revenue;
                        monthlySales[monthKey] += quantity;

                        const productId = Number(item.productId);
                        if (!productPerformance[productId]) {
                            productPerformance[productId] = {
                                productId,
                                totalSales: 0,
                                totalRevenue: 0
                            };
                        }
                        productPerformance[productId].totalSales += quantity;
                        productPerformance[productId].totalRevenue += revenue;
                    }
                });
            }
        });

        const months = Object.keys(monthlyRevenue).sort();
        const averageMonthlyRevenue = months.length > 0
            ? Number((Object.values(monthlyRevenue).reduce((a, b) => a + b, 0) / months.length).toFixed(2))
            : 0;

        const totalRevenue = Number(Object.values(monthlyRevenue).reduce((a, b) => a + b, 0).toFixed(2));
        const totalSales = Object.values(monthlySales).reduce((a, b) => a + b, 0);

        let revenueGrowthRate = 0;
        if (months.length >= 2) {
            const firstRevenue = monthlyRevenue[months[0]];
            const lastRevenue = monthlyRevenue[months[months.length - 1]];
            revenueGrowthRate = firstRevenue > 0
                ? Number((((lastRevenue - firstRevenue) / firstRevenue) * 100).toFixed(2))
                : 0;
        }

        const forecast = {
            nextMonth: Number((averageMonthlyRevenue * (1 + revenueGrowthRate / 100)).toFixed(2)),
            nextQuarter: Number((averageMonthlyRevenue * 3 * (1 + revenueGrowthRate / 100)).toFixed(2)),
            nextYear: Number((averageMonthlyRevenue * 12 * (1 + revenueGrowthRate / 100)).toFixed(2))
        };

        const topProducts = Object.values(productPerformance)
            .map(p => ({
                ...p,
                totalRevenue: Number(p.totalRevenue.toFixed(2))
            }))
            .sort((a, b) => b.totalRevenue - a.totalRevenue)
            .slice(0, 5);

        res.json({
            sellerId,
            sellerName: `${seller.firstName || ''} ${seller.lastName || ''}`.trim() || seller.email,
            historicalData: {
                totalRevenue,
                totalSales,
                averageMonthlyRevenue,
                revenueGrowthRate,
                monthsAnalyzed: months.length
            },
            forecast,
            topProducts,
            portfolio: {
                totalProducts: products.length,
                activeProducts: products.filter(p => p.status === 'active').length
            }
        });
    });
};

export const openapi = {
    paths: {
        "/sellers/{id}/revenue-forecast": {
            get: {
                summary: "Get seller revenue forecast based on historical performance",
                parameters: [
                    { in: "path", name: "id", required: true, schema: { type: "integer" }, example: 1 }
                ],
                responses: {
                    "200": {
                        description: "Seller revenue forecast",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/SellerRevenueForecast" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            sellerId: 1,
                                            sellerName: "John Seller",
                                            historicalData: {
                                                totalRevenue: 15000.75,
                                                totalSales: 500,
                                                averageMonthlyRevenue: 5000.25,
                                                revenueGrowthRate: 15.50,
                                                monthsAnalyzed: 3
                                            },
                                            forecast: {
                                                nextMonth: 5775.79,
                                                nextQuarter: 17327.37,
                                                nextYear: 69309.48
                                            },
                                            topProducts: [
                                                {
                                                    productId: 5,
                                                    totalSales: 100,
                                                    totalRevenue: 3000.50
                                                }
                                            ],
                                            portfolio: {
                                                totalProducts: 15,
                                                activeProducts: 12
                                            }
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
            SellerRevenueForecast: {
                type: "object",
                properties: {
                    sellerId: { type: "integer", example: 1 },
                    sellerName: { type: "string", example: "John Seller" },
                    historicalData: {
                        type: "object",
                        properties: {
                            totalRevenue: { type: "number", format: "float", example: 15000.75 },
                            totalSales: { type: "integer", example: 500 },
                            averageMonthlyRevenue: { type: "number", format: "float", example: 5000.25 },
                            revenueGrowthRate: { type: "number", format: "float", example: 15.50 },
                            monthsAnalyzed: { type: "integer", example: 3 }
                        }
                    },
                    forecast: {
                        type: "object",
                        properties: {
                            nextMonth: { type: "number", format: "float", example: 5775.79 },
                            nextQuarter: { type: "number", format: "float", example: 17327.37 },
                            nextYear: { type: "number", format: "float", example: 69309.48 }
                        }
                    },
                    topProducts: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                productId: { type: "integer", example: 5 },
                                totalSales: { type: "integer", example: 100 },
                                totalRevenue: { type: "number", format: "float", example: 3000.50 }
                            }
                        }
                    },
                    portfolio: {
                        type: "object",
                        properties: {
                            totalProducts: { type: "integer", example: 15 },
                            activeProducts: { type: "integer", example: 12 }
                        }
                    }
                }
            }
        }
    }
};