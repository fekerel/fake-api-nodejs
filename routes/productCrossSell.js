// Get cross-sell opportunities for a product
export default (app, router) => {
    const db = router.db;

    app.get('/products/:id/cross-sell', (req, res) => {
        const productId = Number(req.params.id);
        const limit = req.query.limit ? Number(req.query.limit) : 5;

        if (!Number.isFinite(productId)) return res.status(400).json({ error: 'invalid id' });
        if (!Number.isFinite(limit) || limit < 1) return res.status(400).json({ error: 'invalid limit' });

        const product = db.get('products').find(p => Number(p.id) === productId).value();
        if (!product) return res.status(404).json({ error: 'product not found' });

        const orders = db.get('orders').value() || [];
        const productCoOccurrence = {};

        orders.forEach(order => {
            if (order.items && order.items.length > 1) {
                const orderProductIds = order.items.map(item => Number(item.productId));
                
                if (orderProductIds.includes(productId)) {
                    orderProductIds.forEach(otherProductId => {
                        if (otherProductId !== productId) {
                            if (!productCoOccurrence[otherProductId]) {
                                productCoOccurrence[otherProductId] = {
                                    productId: otherProductId,
                                    coOccurrenceCount: 0,
                                    totalRevenue: 0
                                };
                            }
                            productCoOccurrence[otherProductId].coOccurrenceCount++;
                            
                            const item = order.items.find(i => Number(i.productId) === otherProductId);
                            if (item) {
                                productCoOccurrence[otherProductId].totalRevenue += 
                                    parseFloat(item.price) * (Number(item.quantity) || 0);
                            }
                        }
                    });
                }
            }
        });

        const crossSellProducts = Object.values(productCoOccurrence)
            .map(coOccurrence => {
                const otherProduct = db.get('products').find(p => Number(p.id) === coOccurrence.productId).value();
                const category = otherProduct 
                    ? db.get('categories').find(c => Number(c.id) === Number(otherProduct.categoryId)).value()
                    : null;

                return {
                    productId: coOccurrence.productId,
                    productName: otherProduct ? otherProduct.name : 'Unknown',
                    categoryId: otherProduct ? otherProduct.categoryId : null,
                    categoryName: category ? category.name : 'Unknown',
                    coOccurrenceCount: coOccurrence.coOccurrenceCount,
                    totalRevenue: Number(coOccurrence.totalRevenue.toFixed(2)),
                    price: otherProduct ? parseFloat(otherProduct.price) || 0 : 0,
                    status: otherProduct ? otherProduct.status : 'unknown',
                    stock: otherProduct ? (Number(otherProduct.stock) || 0) : 0
                };
            })
            .filter(p => p.status === 'active')
            .sort((a, b) => b.coOccurrenceCount - a.coOccurrenceCount)
            .slice(0, limit);

        res.json({
            productId,
            productName: product.name,
            categoryId: product.categoryId,
            totalOpportunities: Object.keys(productCoOccurrence).length,
            crossSellProducts
        });
    });
};

export const openapi = {
    paths: {
        "/products/{id}/cross-sell": {
            get: {
                summary: "Get cross-sell opportunities for a product",
                parameters: [
                    { in: "path", name: "id", required: true, schema: { type: "integer" }, example: 1 },
                    { in: "query", name: "limit", schema: { type: "integer" }, description: "Number of products to return", example: 5 }
                ],
                responses: {
                    "200": {
                        description: "Cross-sell opportunities",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ProductCrossSell" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            productId: 1,
                                            productName: "Product A",
                                            categoryId: 1,
                                            totalOpportunities: 8,
                                            crossSellProducts: [
                                                {
                                                    productId: 5,
                                                    productName: "Product B",
                                                    categoryId: 1,
                                                    categoryName: "Category A",
                                                    coOccurrenceCount: 15,
                                                    totalRevenue: 450.75,
                                                    price: 29.99,
                                                    status: "active",
                                                    stock: 100
                                                }
                                            ]
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
            ProductCrossSell: {
                type: "object",
                properties: {
                    productId: { type: "integer", example: 1 },
                    productName: { type: "string", example: "Product A" },
                    categoryId: { type: "integer", example: 1 },
                    totalOpportunities: { type: "integer", example: 8 },
                    crossSellProducts: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                productId: { type: "integer", example: 5 },
                                productName: { type: "string", example: "Product B" },
                                categoryId: { type: "integer", example: 1 },
                                categoryName: { type: "string", example: "Category A" },
                                coOccurrenceCount: { type: "integer", example: 15 },
                                totalRevenue: { type: "number", format: "float", example: 450.75 },
                                price: { type: "number", format: "float", example: 29.99 },
                                status: { type: "string", example: "active" },
                                stock: { type: "integer", example: 100 }
                            }
                        }
                    }
                }
            }
        }
    }
};