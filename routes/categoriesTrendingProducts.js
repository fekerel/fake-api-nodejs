// Get trending products in a category based on recent sales and popularity
export default (app, router) => {
    const db = router.db;

    app.get('/categories/:id/trending-products', (req, res) => {
        const categoryId = Number(req.params.id);
        const limit = Number(req.query.limit) || 10;
        
        if (!Number.isFinite(categoryId)) return res.status(400).json({ error: 'invalid id' });
        
        const category = db.get('categories').find(c => Number(c.id) === categoryId).value();
        
        if (!category) return res.status(404).json({ error: 'category not found' });
        
        const products = db.get('products').filter(p => Number(p.categoryId) === categoryId).value() || [];
        const productIds = products.map(p => Number(p.id));
        
        // Son 7 gün içindeki siparişleri bul (simüle edilmiş - createdAt kontrolü)
        const orders = db.get('orders').value() || [];
        const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
        
        const productSales = {};
        
        orders.forEach(order => {
            const orderTime = order.createdAt || 0;
            if (orderTime >= sevenDaysAgo && order.items) {
                order.items.forEach(item => {
                    const itemProductId = Number(item.productId);
                    if (productIds.includes(itemProductId)) {
                        const quantity = Number(item.quantity) || 0;
                        if (!productSales[itemProductId]) {
                            productSales[itemProductId] = { salesCount: 0, revenue: 0 };
                        }
                        productSales[itemProductId].salesCount += quantity;
                        productSales[itemProductId].revenue += quantity * (parseFloat(item.price) || 0);
                    }
                });
            }
        });
        
        // Trend ürünleri sırala (satış sayısına göre)
        const trendingProducts = Object.keys(productSales)
            .map(productId => {
                const product = db.get('products').find(p => Number(p.id) === Number(productId)).value();
                return {
                    productId: Number(productId),
                    productName: product ? product.name : 'Unknown',
                    salesCount: productSales[productId].salesCount,
                    revenue: Number(productSales[productId].revenue.toFixed(2)),
                    price: product ? parseFloat(product.price) || 0 : 0,
                    status: product ? product.status : 'unknown'
                };
            })
            .sort((a, b) => b.salesCount - a.salesCount)
            .slice(0, limit);
        
        res.json({
            categoryId,
            categoryName: category.name,
            period: "7 days",
            trendingProducts,
            totalTrendingProducts: trendingProducts.length
        });
    });
};

export const openapi = {
    paths: {
        "/categories/{id}/trending-products": {
            get: {
                summary: "Get trending products in a category",
                parameters: [
                    { in: "path", name: "id", required: true, schema: { type: "integer" }, example: 1 },
                    { in: "query", name: "limit", schema: { type: "integer" }, description: "Number of products to return", example: 10 }
                ],
                responses: {
                    "200": {
                        description: "Trending products",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/CategoryTrendingProducts" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            categoryId: 1,
                                            categoryName: "Category A",
                                            period: "7 days",
                                            trendingProducts: [
                                                { productId: 5, productName: "Product X", salesCount: 50, revenue: 1500.00, price: 30.00, status: "active" }
                                            ],
                                            totalTrendingProducts: 10
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
            CategoryTrendingProducts: {
                type: "object",
                properties: {
                    categoryId: { type: "integer", example: 1 },
                    categoryName: { type: "string", example: "Category A" },
                    period: { type: "string", example: "7 days" },
                    trendingProducts: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                productId: { type: "integer", example: 5 },
                                productName: { type: "string", example: "Product X" },
                                salesCount: { type: "integer", example: 50 },
                                revenue: { type: "number", format: "float", example: 1500.00 },
                                price: { type: "number", format: "float", example: 30.00 },
                                status: { type: "string", example: "active" }
                            }
                        }
                    },
                    totalTrendingProducts: { type: "integer", example: 10 }
                }
            }
        }
    }
};