// Get product recommendations based on same category and similar price range
export default (app, router) => {
    const db = router.db;

    app.get('/products/:id/recommendations', (req, res) => {
        const productId = Number(req.params.id);
        const limit = Number(req.query.limit) || 5;
        
        if (!Number.isFinite(productId)) return res.status(400).json({ error: 'invalid id' });
        
        const product = db.get('products').find(p => Number(p.id) === productId).value();
        
        if (!product) return res.status(404).json({ error: 'product not found' });
        
        const categoryId = Number(product.categoryId);
        const productPrice = parseFloat(product.price) || 0;
        
        // Aynı kategorideki diğer ürünleri bul (kendisi hariç)
        const similarProducts = db.get('products')
            .filter(p => {
                return Number(p.id) !== productId && 
                       Number(p.categoryId) === categoryId &&
                       p.status === 'active';
            })
            .value() || [];
        
        // Fiyat aralığına göre sırala (benzer fiyatlı ürünler önce)
        const productsWithDistance = similarProducts.map(p => {
            const price = parseFloat(p.price) || 0;
            const priceDistance = Math.abs(price - productPrice);
            return {
                ...p,
                priceDistance
            };
        });
        
        // Fiyat mesafesine göre sırala ve limit uygula
        const recommendations = productsWithDistance
            .sort((a, b) => a.priceDistance - b.priceDistance)
            .slice(0, limit)
            .map(p => ({
                productId: p.id,
                productName: p.name,
                price: parseFloat(p.price) || 0,
                stock: Number(p.stock) || 0,
                status: p.status,
                tags: p.tags || []
            }));
        
        res.json({
            productId: product.id,
            productName: product.name,
            categoryId,
            recommendations,
            totalRecommendations: recommendations.length
        });
    });
};

export const openapi = {
    paths: {
        "/products/{id}/recommendations": {
            get: {
                summary: "Get product recommendations",
                parameters: [
                    { in: "path", name: "id", required: true, schema: { type: "integer" }, example: 1 },
                    { in: "query", name: "limit", schema: { type: "integer" }, description: "Number of recommendations", example: 5 }
                ],
                responses: {
                    "200": {
                        description: "Product recommendations",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ProductRecommendations" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            productId: 1,
                                            productName: "Product A",
                                            categoryId: 1,
                                            recommendations: [
                                                { productId: 5, productName: "Product B", price: 45.50, stock: 100, status: "active", tags: ["featured"] }
                                            ],
                                            totalRecommendations: 5
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
            ProductRecommendations: {
                type: "object",
                properties: {
                    productId: { type: "integer", example: 1 },
                    productName: { type: "string", example: "Product A" },
                    categoryId: { type: "integer", example: 1 },
                    recommendations: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                productId: { type: "integer", example: 5 },
                                productName: { type: "string", example: "Product B" },
                                price: { type: "number", format: "float", example: 45.50 },
                                stock: { type: "integer", example: 100 },
                                status: { type: "string", example: "active" },
                                tags: { type: "array", items: { type: "string" }, example: ["featured"] }
                            }
                        }
                    },
                    totalRecommendations: { type: "integer", example: 5 }
                }
            }
        }
    }
};