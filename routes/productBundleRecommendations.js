// Get product bundle recommendations based on frequently bought together
export default (app, router) => {
    const db = router.db;

    app.get('/products/:id/bundle-recommendations', (req, res) => {
        const productId = Number(req.params.id);
        const limit = req.query.limit ? Number(req.query.limit) : 5;

        if (!Number.isFinite(productId)) return res.status(400).json({ error: 'invalid id' });
        if (!Number.isFinite(limit) || limit < 1) return res.status(400).json({ error: 'invalid limit' });

        const product = db.get('products').find(p => Number(p.id) === productId).value();
        if (!product) return res.status(404).json({ error: 'product not found' });

        const orders = db.get('orders').value() || [];
        const products = db.get('products').value() || [];
        const categories = db.get('categories').value() || [];

        const bundleFrequency = {};
        const bundleRevenue = {};

        orders.forEach(order => {
            if (order.items && order.items.length > 1) {
                const orderProductIds = order.items.map(item => Number(item.productId));
                
                if (orderProductIds.includes(productId)) {
                    orderProductIds.forEach(otherProductId => {
                        if (otherProductId !== productId) {
                            if (!bundleFrequency[otherProductId]) {
                                bundleFrequency[otherProductId] = 0;
                                bundleRevenue[otherProductId] = 0;
                            }
                            bundleFrequency[otherProductId]++;
                            
                            const item = order.items.find(i => Number(i.productId) === otherProductId);
                            if (item) {
                                bundleRevenue[otherProductId] += (parseFloat(item.price) || 0) * (Number(item.quantity) || 0);
                            }
                        }
                    });
                }
            }
        });

        const bundleProducts = Object.keys(bundleFrequency)
            .map(otherProductId => {
                const otherProduct = products.find(p => Number(p.id) === Number(otherProductId));
                const category = otherProduct
                    ? categories.find(c => Number(c.id) === Number(otherProduct.categoryId))
                    : null;

                return {
                    productId: Number(otherProductId),
                    productName: otherProduct ? otherProduct.name : 'Unknown',
                    categoryId: otherProduct ? otherProduct.categoryId : null,
                    categoryName: category ? category.name : 'Unknown',
                    bundleFrequency: bundleFrequency[otherProductId],
                    bundleRevenue: Number(bundleRevenue[otherProductId].toFixed(2)),
                    price: otherProduct ? parseFloat(otherProduct.price) || 0 : 0,
                    status: otherProduct ? otherProduct.status : 'unknown',
                    stock: otherProduct ? (Number(otherProduct.stock) || 0) : 0
                };
            })
            .filter(p => p.status === 'active')
            .sort((a, b) => b.bundleFrequency - a.bundleFrequency)
            .slice(0, limit);

        const totalBundles = Object.keys(bundleFrequency).length;
        const averageBundleValue = bundleProducts.length > 0
            ? Number((bundleProducts.reduce((sum, p) => sum + p.bundleRevenue, 0) / bundleProducts.length).toFixed(2))
            : 0;

        res.json({
            productId,
            productName: product.name,
            categoryId: product.categoryId,
            bundleRecommendations: bundleProducts,
            summary: {
                totalBundles,
                averageBundleValue,
                recommendedCount: bundleProducts.length
            }
        });
    });
};

export const openapi = {
    paths: {
        "/products/{id}/bundle-recommendations": {
            get: {
                summary: "Get product bundle recommendations",
                parameters: [
                    { in: "path", name: "id", required: true, schema: { type: "integer" }, example: 1 },
                    { in: "query", name: "limit", schema: { type: "integer" }, description: "Number of recommendations", example: 5 }
                ],
                responses: {
                    "200": {
                        description: "Product bundle recommendations",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ProductBundleRecommendations" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            productId: 1,
                                            productName: "Product A",
                                            categoryId: 1,
                                            bundleRecommendations: [
                                                {
                                                    productId: 5,
                                                    productName: "Product B",
                                                    categoryId: 1,
                                                    categoryName: "Category A",
                                                    bundleFrequency: 15,
                                                    bundleRevenue: 450.75,
                                                    price: 29.99,
                                                    status: "active",
                                                    stock: 100
                                                }
                                            ],
                                            summary: {
                                                totalBundles: 8,
                                                averageBundleValue: 225.38,
                                                recommendedCount: 5
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    "400": { description: "invalid id or limit" },
                    "404": { description: "product not found" }
                }
            }
        }
    },
    components: {
        schemas: {
            ProductBundleRecommendations: {
                type: "object",
                properties: {
                    productId: { type: "integer", example: 1 },
                    productName: { type: "string", example: "Product A" },
                    categoryId: { type: "integer", example: 1 },
                    bundleRecommendations: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                productId: { type: "integer", example: 5 },
                                productName: { type: "string", example: "Product B" },
                                categoryId: { type: "integer", example: 1 },
                                categoryName: { type: "string", example: "Category A" },
                                bundleFrequency: { type: "integer", example: 15 },
                                bundleRevenue: { type: "number", format: "float", example: 450.75 },
                                price: { type: "number", format: "float", example: 29.99 },
                                status: { type: "string", example: "active" },
                                stock: { type: "integer", example: 100 }
                            }
                        }
                    },
                    summary: {
                        type: "object",
                        properties: {
                            totalBundles: { type: "integer", example: 8 },
                            averageBundleValue: { type: "number", format: "float", example: 225.38 },
                            recommendedCount: { type: "integer", example: 5 }
                        }
                    }
                }
            }
        }
    }
};