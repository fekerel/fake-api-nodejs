// Get category revenue trend over time
export default (app, router) => {
    const db = router.db;

    app.get('/categories/:id/revenue-trend', (req, res) => {
        const categoryId = Number(req.params.id);
        const period = req.query.period || 'monthly'; // daily, weekly, monthly

        if (!Number.isFinite(categoryId)) return res.status(400).json({ error: 'invalid id' });

        const category = db.get('categories').find(c => Number(c.id) === categoryId).value();
        if (!category) return res.status(404).json({ error: 'category not found' });

        const products = db.get('products').filter(p => Number(p.categoryId) === categoryId).value() || [];
        const productIds = products.map(p => Number(p.id));
        const orders = db.get('orders').value() || [];

        const revenueByPeriod = {};

        orders.forEach(order => {
            if (order.items && order.createdAt) {
                order.items.forEach(item => {
                    if (productIds.includes(Number(item.productId))) {
                        const orderDate = new Date(order.createdAt);
                        let key = '';
                        
                        if (period === 'daily') {
                            key = orderDate.toISOString().split('T')[0];
                        } else if (period === 'weekly') {
                            const weekStart = new Date(orderDate);
                            weekStart.setDate(orderDate.getDate() - orderDate.getDay());
                            key = weekStart.toISOString().split('T')[0];
                        } else { // monthly
                            key = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
                        }

                        if (!revenueByPeriod[key]) {
                            revenueByPeriod[key] = {
                                period: key,
                                revenue: 0,
                                orderCount: 0,
                                itemCount: 0
                            };
                        }

                        const itemRevenue = (parseFloat(item.price) || 0) * (Number(item.quantity) || 0);
                        revenueByPeriod[key].revenue += itemRevenue;
                        revenueByPeriod[key].itemCount += Number(item.quantity) || 0;
                    }
                });

                const hasCategoryItem = order.items.some(item => productIds.includes(Number(item.productId)));
                if (hasCategoryItem) {
                    const orderDate = new Date(order.createdAt);
                    let key = '';
                    
                    if (period === 'daily') {
                        key = orderDate.toISOString().split('T')[0];
                    } else if (period === 'weekly') {
                        const weekStart = new Date(orderDate);
                        weekStart.setDate(orderDate.getDate() - orderDate.getDay());
                        key = weekStart.toISOString().split('T')[0];
                    } else {
                        key = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
                    }

                    if (revenueByPeriod[key]) {
                        revenueByPeriod[key].orderCount++;
                    }
                }
            }
        });

        const trend = Object.values(revenueByPeriod)
            .map(item => ({
                ...item,
                revenue: Number(item.revenue.toFixed(2))
            }))
            .sort((a, b) => a.period.localeCompare(b.period));

        let totalRevenue = 0;
        let totalOrders = 0;
        let totalItems = 0;

        trend.forEach(item => {
            totalRevenue += item.revenue;
            totalOrders += item.orderCount;
            totalItems += item.itemCount;
        });

        const averageRevenue = trend.length > 0 ? Number((totalRevenue / trend.length).toFixed(2)) : 0;
        const growthRate = trend.length >= 2 
            ? Number((((trend[trend.length - 1].revenue - trend[0].revenue) / trend[0].revenue) * 100).toFixed(2))
            : 0;

        res.json({
            categoryId,
            categoryName: category.name,
            period,
            summary: {
                totalRevenue: Number(totalRevenue.toFixed(2)),
                totalOrders,
                totalItems,
                averageRevenue,
                growthRate,
                periodsCount: trend.length
            },
            trend
        });
    });
};

export const openapi = {
    paths: {
        "/categories/{id}/revenue-trend": {
            get: {
                summary: "Get category revenue trend over time",
                parameters: [
                    { in: "path", name: "id", required: true, schema: { type: "integer" }, example: 1 },
                    { in: "query", name: "period", schema: { type: "string", enum: ["daily", "weekly", "monthly"] }, description: "Grouping period", example: "monthly" }
                ],
                responses: {
                    "200": {
                        description: "Category revenue trend",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/CategoryRevenueTrend" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            categoryId: 1,
                                            categoryName: "Category A",
                                            period: "monthly",
                                            summary: {
                                                totalRevenue: 4500.75,
                                                totalOrders: 50,
                                                totalItems: 150,
                                                averageRevenue: 1500.25,
                                                growthRate: 15.50,
                                                periodsCount: 3
                                            },
                                            trend: [
                                                {
                                                    period: "2025-01",
                                                    revenue: 1200.50,
                                                    orderCount: 15,
                                                    itemCount: 45
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
            CategoryRevenueTrend: {
                type: "object",
                properties: {
                    categoryId: { type: "integer", example: 1 },
                    categoryName: { type: "string", example: "Category A" },
                    period: { type: "string", example: "monthly" },
                    summary: {
                        type: "object",
                        properties: {
                            totalRevenue: { type: "number", format: "float", example: 4500.75 },
                            totalOrders: { type: "integer", example: 50 },
                            totalItems: { type: "integer", example: 150 },
                            averageRevenue: { type: "number", format: "float", example: 1500.25 },
                            growthRate: { type: "number", format: "float", example: 15.50 },
                            periodsCount: { type: "integer", example: 3 }
                        }
                    },
                    trend: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                period: { type: "string", example: "2025-01" },
                                revenue: { type: "number", format: "float", example: 1200.50 },
                                orderCount: { type: "integer", example: 15 },
                                itemCount: { type: "integer", example: 45 }
                            }
                        }
                    }
                }
            }
        }
    }
};