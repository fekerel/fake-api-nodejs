// Get category market share analysis
export default (app, router) => {
    const db = router.db;

    app.get('/categories/:id/market-share', (req, res) => {
        const categoryId = Number(req.params.id);

        if (!Number.isFinite(categoryId)) return res.status(400).json({ error: 'invalid id' });

        const category = db.get('categories').find(c => Number(c.id) === categoryId).value();
        if (!category) return res.status(404).json({ error: 'category not found' });

        const allCategories = db.get('categories').value() || [];
        const products = db.get('products').value() || [];
        const orders = db.get('orders').value() || [];

        const categoryProducts = products.filter(p => Number(p.categoryId) === categoryId);
        const categoryProductIds = categoryProducts.map(p => Number(p.id));

        let categoryRevenue = 0;
        let categorySales = 0;
        let categoryOrders = 0;
        let totalMarketRevenue = 0;
        let totalMarketSales = 0;
        let totalMarketOrders = 0;

        orders.forEach(order => {
            let hasCategoryItem = false;
            let orderRevenue = 0;
            let orderSales = 0;

            if (order.items) {
                order.items.forEach(item => {
                    const itemProductId = Number(item.productId);
                    const quantity = Number(item.quantity) || 0;
                    const price = parseFloat(item.price) || 0;
                    const itemRevenue = quantity * price;

                    if (categoryProductIds.includes(itemProductId)) {
                        categoryRevenue += itemRevenue;
                        categorySales += quantity;
                        hasCategoryItem = true;
                    }

                    orderRevenue += itemRevenue;
                    orderSales += quantity;
                });
            }

            if (hasCategoryItem) categoryOrders++;
            totalMarketRevenue += orderRevenue;
            totalMarketSales += orderSales;
            totalMarketOrders++;
        });

        const revenueShare = totalMarketRevenue > 0
            ? Number(((categoryRevenue / totalMarketRevenue) * 100).toFixed(2))
            : 0;
        const salesShare = totalMarketSales > 0
            ? Number(((categorySales / totalMarketSales) * 100).toFixed(2))
            : 0;
        const orderShare = totalMarketOrders > 0
            ? Number(((categoryOrders / totalMarketOrders) * 100).toFixed(2))
            : 0;

        const averageOrderValue = categoryOrders > 0
            ? Number((categoryRevenue / categoryOrders).toFixed(2))
            : 0;

        const categoryRank = allCategories
            .map(cat => {
                const catProducts = products.filter(p => Number(p.categoryId) === Number(cat.id));
                const catProductIds = catProducts.map(p => Number(p.id));
                let catRevenue = 0;

                orders.forEach(order => {
                    if (order.items) {
                        order.items.forEach(item => {
                            if (catProductIds.includes(Number(item.productId))) {
                                catRevenue += (parseFloat(item.price) || 0) * (Number(item.quantity) || 0);
                            }
                        });
                    }
                });

                return { categoryId: Number(cat.id), revenue: catRevenue };
            })
            .sort((a, b) => b.revenue - a.revenue)
            .findIndex(cat => cat.categoryId === categoryId) + 1;

        res.json({
            categoryId,
            categoryName: category.name,
            marketShare: {
                revenueShare,
                salesShare,
                orderShare,
                averageOrderValue
            },
            performance: {
                totalRevenue: Number(categoryRevenue.toFixed(2)),
                totalSales: categorySales,
                totalOrders: categoryOrders,
                totalProducts: categoryProducts.length
            },
            ranking: {
                revenueRank: categoryRank,
                totalCategories: allCategories.length
            }
        });
    });
};

export const openapi = {
    paths: {
        "/categories/{id}/market-share": {
            get: {
                summary: "Get category market share analysis",
                parameters: [
                    { in: "path", name: "id", required: true, schema: { type: "integer" }, example: 1 }
                ],
                responses: {
                    "200": {
                        description: "Category market share",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/CategoryMarketShare" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            categoryId: 1,
                                            categoryName: "Category A",
                                            marketShare: {
                                                revenueShare: 25.50,
                                                salesShare: 20.75,
                                                orderShare: 22.00,
                                                averageOrderValue: 150.25
                                            },
                                            performance: {
                                                totalRevenue: 4500.75,
                                                totalSales: 150,
                                                totalOrders: 30,
                                                totalProducts: 10
                                            },
                                            ranking: {
                                                revenueRank: 2,
                                                totalCategories: 5
                                            }
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
            CategoryMarketShare: {
                type: "object",
                properties: {
                    categoryId: { type: "integer", example: 1 },
                    categoryName: { type: "string", example: "Category A" },
                    marketShare: {
                        type: "object",
                        properties: {
                            revenueShare: { type: "number", format: "float", example: 25.50 },
                            salesShare: { type: "number", format: "float", example: 20.75 },
                            orderShare: { type: "number", format: "float", example: 22.00 },
                            averageOrderValue: { type: "number", format: "float", example: 150.25 }
                        }
                    },
                    performance: {
                        type: "object",
                        properties: {
                            totalRevenue: { type: "number", format: "float", example: 4500.75 },
                            totalSales: { type: "integer", example: 150 },
                            totalOrders: { type: "integer", example: 30 },
                            totalProducts: { type: "integer", example: 10 }
                        }
                    },
                    ranking: {
                        type: "object",
                        properties: {
                            revenueRank: { type: "integer", example: 2 },
                            totalCategories: { type: "integer", example: 5 }
                        }
                    }
                }
            }
        }
    }
};