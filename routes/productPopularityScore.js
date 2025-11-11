// Get product popularity score based on sales, reviews, and orders
export default (app, router) => {
    const db = router.db;

    app.get('/products/:id/popularity-score', (req, res) => {
        const productId = Number(req.params.id);

        if (!Number.isFinite(productId)) return res.status(400).json({ error: 'invalid id' });

        const product = db.get('products').find(p => Number(p.id) === productId).value();
        if (!product) return res.status(404).json({ error: 'product not found' });

        const orders = db.get('orders').value() || [];
        const reviews = db.get('reviews').filter(r => Number(r.productId) === productId).value() || [];

        let totalSales = 0;
        let totalRevenue = 0;
        let orderCount = 0;
        let uniqueCustomers = new Set();

        orders.forEach(order => {
            if (order.items) {
                order.items.forEach(item => {
                    if (Number(item.productId) === productId) {
                        const quantity = Number(item.quantity) || 0;
                        const price = parseFloat(item.price) || 0;
                        totalSales += quantity;
                        totalRevenue += quantity * price;
                        orderCount++;
                        if (order.userId) uniqueCustomers.add(Number(order.userId));
                    }
                });
            }
        });

        const reviewCount = reviews.length;
        const averageRating = reviewCount > 0
            ? Number((reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / reviewCount).toFixed(2))
            : 0;

        let popularityScore = 0;
        const scoreBreakdown = {
            salesVolume: 0,
            revenue: 0,
            customerBase: 0,
            reviews: 0,
            rating: 0
        };

        if (totalSales > 0) {
            scoreBreakdown.salesVolume = Math.min(Math.floor(totalSales / 10) * 10, 30);
        }
        if (totalRevenue > 0) {
            scoreBreakdown.revenue = Math.min(Math.floor(totalRevenue / 100) * 5, 25);
        }
        if (uniqueCustomers.size > 0) {
            scoreBreakdown.customerBase = Math.min(uniqueCustomers.size * 2, 20);
        }
        if (reviewCount > 0) {
            scoreBreakdown.reviews = Math.min(reviewCount * 2, 15);
        }
        if (averageRating > 0) {
            scoreBreakdown.rating = Math.min(averageRating * 2, 10);
        }

        popularityScore = Object.values(scoreBreakdown).reduce((a, b) => a + b, 0);

        const popularityLevel = popularityScore >= 80 ? 'very_high'
            : popularityScore >= 60 ? 'high'
            : popularityScore >= 40 ? 'medium'
            : popularityScore >= 20 ? 'low'
            : 'very_low';

        res.json({
            productId,
            productName: product.name,
            popularityScore,
            popularityLevel,
            scoreBreakdown,
            metrics: {
                totalSales,
                totalRevenue: Number(totalRevenue.toFixed(2)),
                orderCount,
                uniqueCustomers: uniqueCustomers.size,
                reviewCount,
                averageRating
            }
        });
    });
};

export const openapi = {
    paths: {
        "/products/{id}/popularity-score": {
            get: {
                summary: "Get product popularity score",
                parameters: [
                    { in: "path", name: "id", required: true, schema: { type: "integer" }, example: 1 }
                ],
                responses: {
                    "200": {
                        description: "Product popularity score",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ProductPopularityScore" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            productId: 1,
                                            productName: "Product A",
                                            popularityScore: 75,
                                            popularityLevel: "high",
                                            scoreBreakdown: {
                                                salesVolume: 30,
                                                revenue: 25,
                                                customerBase: 15,
                                                reviews: 10,
                                                rating: 8
                                            },
                                            metrics: {
                                                totalSales: 150,
                                                totalRevenue: 4500.75,
                                                orderCount: 50,
                                                uniqueCustomers: 35,
                                                reviewCount: 25,
                                                averageRating: 4.5
                                            }
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
            ProductPopularityScore: {
                type: "object",
                properties: {
                    productId: { type: "integer", example: 1 },
                    productName: { type: "string", example: "Product A" },
                    popularityScore: { type: "integer", example: 75 },
                    popularityLevel: { type: "string", enum: ["very_low", "low", "medium", "high", "very_high"], example: "high" },
                    scoreBreakdown: {
                        type: "object",
                        properties: {
                            salesVolume: { type: "integer", example: 30 },
                            revenue: { type: "integer", example: 25 },
                            customerBase: { type: "integer", example: 15 },
                            reviews: { type: "integer", example: 10 },
                            rating: { type: "integer", example: 8 }
                        }
                    },
                    metrics: {
                        type: "object",
                        properties: {
                            totalSales: { type: "integer", example: 150 },
                            totalRevenue: { type: "number", format: "float", example: 4500.75 },
                            orderCount: { type: "integer", example: 50 },
                            uniqueCustomers: { type: "integer", example: 35 },
                            reviewCount: { type: "integer", example: 25 },
                            averageRating: { type: "number", format: "float", example: 4.5 }
                        }
                    }
                }
            }
        }
    }
};