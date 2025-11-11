// Get category growth rate analysis
export default (app, router) => {
    const db = router.db;

    app.get('/categories/:id/growth-rate', (req, res) => {
        const categoryId = Number(req.params.id);

        if (!Number.isFinite(categoryId)) return res.status(400).json({ error: 'invalid id' });

        const category = db.get('categories').find(c => Number(c.id) === categoryId).value();
        if (!category) return res.status(404).json({ error: 'category not found' });

        const products = db.get('products').filter(p => Number(p.categoryId) === categoryId).value() || [];
        const orders = db.get('orders').value() || [];
        const productIds = products.map(p => Number(p.id));

        const monthlyRevenue = {};
        const monthlySales = {};
        const monthlyOrders = {};

        orders.forEach(order => {
            if (order.items && order.createdAt) {
                const orderDate = new Date(order.createdAt);
                const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
                
                let hasCategoryItem = false;
                let monthRevenue = 0;
                let monthSales = 0;

                order.items.forEach(item => {
                    if (productIds.includes(Number(item.productId))) {
                        hasCategoryItem = true;
                        const quantity = Number(item.quantity) || 0;
                        const price = parseFloat(item.price) || 0;
                        monthSales += quantity;
                        monthRevenue += quantity * price;
                    }
                });

                if (hasCategoryItem) {
                    if (!monthlyRevenue[monthKey]) {
                        monthlyRevenue[monthKey] = 0;
                        monthlySales[monthKey] = 0;
                        monthlyOrders[monthKey] = 0;
                    }
                    monthlyRevenue[monthKey] += monthRevenue;
                    monthlySales[monthKey] += monthSales;
                    monthlyOrders[monthKey]++;
                }
            }
        });

        const months = Object.keys(monthlyRevenue).sort();
        
        let revenueGrowthRate = 0;
        let salesGrowthRate = 0;
        let ordersGrowthRate = 0;

        if (months.length >= 2) {
            const firstMonth = months[0];
            const lastMonth = months[months.length - 1];
            
            const firstRevenue = monthlyRevenue[firstMonth];
            const lastRevenue = monthlyRevenue[lastMonth];
            revenueGrowthRate = firstRevenue > 0
                ? Number((((lastRevenue - firstRevenue) / firstRevenue) * 100).toFixed(2))
                : 0;

            const firstSales = monthlySales[firstMonth];
            const lastSales = monthlySales[lastMonth];
            salesGrowthRate = firstSales > 0
                ? Number((((lastSales - firstSales) / firstSales) * 100).toFixed(2))
                : 0;

            const firstOrders = monthlyOrders[firstMonth];
            const lastOrders = monthlyOrders[lastMonth];
            ordersGrowthRate = firstOrders > 0
                ? Number((((lastOrders - firstOrders) / firstOrders) * 100).toFixed(2))
                : 0;
        }

        const averageMonthlyRevenue = months.length > 0
            ? Number((Object.values(monthlyRevenue).reduce((a, b) => a + b, 0) / months.length).toFixed(2))
            : 0;

        const totalRevenue = Number(Object.values(monthlyRevenue).reduce((a, b) => a + b, 0).toFixed(2));
        const totalSales = Object.values(monthlySales).reduce((a, b) => a + b, 0);
        const totalOrders = Object.values(monthlyOrders).reduce((a, b) => a + b, 0);

        const growthTrend = revenueGrowthRate > 10 ? 'strong_growth'
            : revenueGrowthRate > 0 ? 'growth'
            : revenueGrowthRate > -10 ? 'decline'
            : 'strong_decline';

        res.json({
            categoryId,
            categoryName: category.name,
            growthRate: {
                revenueGrowthRate,
                salesGrowthRate,
                ordersGrowthRate,
                growthTrend
            },
            summary: {
                totalProducts: products.length,
                totalRevenue,
                totalSales,
                totalOrders,
                averageMonthlyRevenue,
                monthsAnalyzed: months.length
            },
            monthlyBreakdown: months.map(month => ({
                month,
                revenue: Number(monthlyRevenue[month].toFixed(2)),
                sales: monthlySales[month],
                orders: monthlyOrders[month]
            }))
        });
    });
};

export const openapi = {
    paths: {
        "/categories/{id}/growth-rate": {
            get: {
                summary: "Get category growth rate analysis",
                parameters: [
                    { in: "path", name: "id", required: true, schema: { type: "integer" }, example: 1 }
                ],
                responses: {
                    "200": {
                        description: "Category growth rate",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/CategoryGrowthRate" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            categoryId: 1,
                                            categoryName: "Category A",
                                            growthRate: {
                                                revenueGrowthRate: 25.50,
                                                salesGrowthRate: 20.75,
                                                ordersGrowthRate: 15.00,
                                                growthTrend: "strong_growth"
                                            },
                                            summary: {
                                                totalProducts: 10,
                                                totalRevenue: 4500.75,
                                                totalSales: 150,
                                                totalOrders: 30,
                                                averageMonthlyRevenue: 1500.25,
                                                monthsAnalyzed: 3
                                            },
                                            monthlyBreakdown: [
                                                {
                                                    month: "2025-01",
                                                    revenue: 1200.50,
                                                    sales: 45,
                                                    orders: 10
                                                }
                                            ]
                                        }
                                    }
                                }
                            }
                        }
                    },
                    "400": { description: "invalid id" },
                    "404": { description: "category not found" }
                }
            }
        }
    },
    components: {
        schemas: {
            CategoryGrowthRate: {
                type: "object",
                properties: {
                    categoryId: { type: "integer", example: 1 },
                    categoryName: { type: "string", example: "Category A" },
                    growthRate: {
                        type: "object",
                        properties: {
                            revenueGrowthRate: { type: "number", format: "float", example: 25.50 },
                            salesGrowthRate: { type: "number", format: "float", example: 20.75 },
                            ordersGrowthRate: { type: "number", format: "float", example: 15.00 },
                            growthTrend: { type: "string", enum: ["strong_growth", "growth", "decline", "strong_decline"], example: "strong_growth" }
                        }
                    },
                    summary: {
                        type: "object",
                        properties: {
                            totalProducts: { type: "integer", example: 10 },
                            totalRevenue: { type: "number", format: "float", example: 4500.75 },
                            totalSales: { type: "integer", example: 150 },
                            totalOrders: { type: "integer", example: 30 },
                            averageMonthlyRevenue: { type: "number", format: "float", example: 1500.25 },
                            monthsAnalyzed: { type: "integer", example: 3 }
                        }
                    },
                    monthlyBreakdown: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                month: { type: "string", example: "2025-01" },
                                revenue: { type: "number", format: "float", example: 1200.50 },
                                sales: { type: "integer", example: 45 },
                                orders: { type: "integer", example: 10 }
                            }
                        }
                    }
                }
            }
        }
    }
};