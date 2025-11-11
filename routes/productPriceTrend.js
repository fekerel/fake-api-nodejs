// Get product price trend analysis
export default (app, router) => {
    const db = router.db;

    app.get('/products/:id/price-trend', (req, res) => {
        const productId = Number(req.params.id);

        if (!Number.isFinite(productId)) return res.status(400).json({ error: 'invalid id' });

        const product = db.get('products').find(p => Number(p.id) === productId).value();
        if (!product) return res.status(404).json({ error: 'product not found' });

        const orders = db.get('orders').value() || [];
        const priceHistory = [];
        const currentPrice = parseFloat(product.price) || 0;

        orders.forEach(order => {
            if (order.items) {
                order.items.forEach(item => {
                    if (Number(item.productId) === productId && order.createdAt) {
                        priceHistory.push({
                            price: parseFloat(item.price) || 0,
                            date: order.createdAt,
                            orderId: order.id
                        });
                    }
                });
            }
        });

        priceHistory.sort((a, b) => a.date - b.date);

        let minPrice = currentPrice;
        let maxPrice = currentPrice;
        let totalPrice = 0;
        let priceCount = 0;

        priceHistory.forEach(entry => {
            if (entry.price > 0) {
                minPrice = Math.min(minPrice, entry.price);
                maxPrice = Math.max(maxPrice, entry.price);
                totalPrice += entry.price;
                priceCount++;
            }
        });

        const averagePrice = priceCount > 0 ? Number((totalPrice / priceCount).toFixed(2)) : currentPrice;
        const priceChange = priceHistory.length > 0 
            ? Number((currentPrice - priceHistory[0].price).toFixed(2))
            : 0;
        const priceChangePercentage = priceHistory.length > 0 && priceHistory[0].price > 0
            ? Number(((priceChange / priceHistory[0].price) * 100).toFixed(2))
            : 0;

        const recentPrices = priceHistory.slice(-10).map(p => ({
            price: p.price,
            date: p.date
        }));

        res.json({
            productId,
            productName: product.name,
            currentPrice,
            priceRange: {
                min: Number(minPrice.toFixed(2)),
                max: Number(maxPrice.toFixed(2)),
                average: averagePrice
            },
            priceChange: {
                absolute: priceChange,
                percentage: priceChangePercentage,
                trend: priceChange > 0 ? 'increasing' : priceChange < 0 ? 'decreasing' : 'stable'
            },
            priceHistoryCount: priceHistory.length,
            recentPrices
        });
    });
};

export const openapi = {
    paths: {
        "/products/{id}/price-trend": {
            get: {
                summary: "Get product price trend analysis",
                parameters: [
                    { in: "path", name: "id", required: true, schema: { type: "integer" }, example: 1 }
                ],
                responses: {
                    "200": {
                        description: "Product price trend",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ProductPriceTrend" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            productId: 1,
                                            productName: "Product A",
                                            currentPrice: 99.99,
                                            priceRange: {
                                                min: 79.99,
                                                max: 99.99,
                                                average: 89.50
                                            },
                                            priceChange: {
                                                absolute: 20.00,
                                                percentage: 25.00,
                                                trend: "increasing"
                                            },
                                            priceHistoryCount: 15,
                                            recentPrices: [
                                                { price: 99.99, date: 1738368000000 }
                                            ]
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
            ProductPriceTrend: {
                type: "object",
                properties: {
                    productId: { type: "integer", example: 1 },
                    productName: { type: "string", example: "Product A" },
                    currentPrice: { type: "number", format: "float", example: 99.99 },
                    priceRange: {
                        type: "object",
                        properties: {
                            min: { type: "number", format: "float", example: 79.99 },
                            max: { type: "number", format: "float", example: 99.99 },
                            average: { type: "number", format: "float", example: 89.50 }
                        }
                    },
                    priceChange: {
                        type: "object",
                        properties: {
                            absolute: { type: "number", format: "float", example: 20.00 },
                            percentage: { type: "number", format: "float", example: 25.00 },
                            trend: { type: "string", enum: ["increasing", "decreasing", "stable"], example: "increasing" }
                        }
                    },
                    priceHistoryCount: { type: "integer", example: 15 },
                    recentPrices: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                price: { type: "number", format: "float", example: 99.99 },
                                date: { type: "integer", format: "int64", example: 1738368000000 }
                            }
                        }
                    }
                }
            }
        }
    }
};