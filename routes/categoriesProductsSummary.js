export default (app, router) => { 
    const db = router.db;  // ← Bu satırı eklemen gerekiyor!
    app.get('/categories/:id/products-summary', (req, res) => {
        // Get category products summary (total products, active products, stock, price range)
        const categoryId = Number(req.params.id);
        
        if (!Number.isFinite(categoryId)) return res.status(400).json({ error: 'invalid id' });
        
        const category = db.get('categories').find(c => Number(c.id) === categoryId).value();
        
        if (!category) return res.status(404).json({ error: 'category not found' });
        
        const products = db.get('products').filter(p => Number(p.categoryId) === categoryId).value() || [];
        
        const totalProducts = products.length;
        const activeProducts = products.filter(p => p.status === 'active').length;
        const totalStock = products.reduce((sum, p) => sum + (Number(p.stock) || 0), 0);
        
        const prices = products.map(p => parseFloat(p.price) || 0).filter(p => p > 0);
        const averagePrice = prices.length > 0 ? Number((prices.reduce((a, b) => a + b, 0) / prices.length).toFixed(2)) : 0;
        const minPrice = prices.length > 0 ? Number(Math.min(...prices).toFixed(2)) : 0;
        const maxPrice = prices.length > 0 ? Number(Math.max(...prices).toFixed(2)) : 0;
        
        res.json({
            categoryId,
            categoryName: category.name,
            totalProducts,
            activeProducts,
            totalStock,
            averagePrice,
            priceRange: { min: minPrice, max: maxPrice }
        });
    });
}


export const openapi = {
    paths: {
        "/categories/{id}/products-summary": {
            get: {
                summary: "Get category products summary",
                parameters: [
                    { in: "path", name: "id", required: true, schema: { type: "integer" }, example: 1 }
                ],
                responses: {
                    "200": {
                        description: "Category products summary",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/CategoryProductsSummary" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            categoryId: 1,
                                            categoryName: "Meyve & Sebze",
                                            totalProducts: 25,
                                            activeProducts: 20,
                                            totalStock: 1500,
                                            averagePrice: 45.50,
                                            priceRange: { min: 10.00, max: 99.99 }
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
            CategoryProductsSummary: {
                type: "object",
                properties: {
                    categoryId: { type: "integer", example: 1 },
                    categoryName: { type: "string", example: "Meyve & Sebze" },
                    totalProducts: { type: "integer", example: 25 },
                    activeProducts: { type: "integer", example: 20 },
                    totalStock: { type: "integer", example: 1500 },
                    averagePrice: { type: "number", format: "float", example: 45.50 },
                    priceRange: {
                        type: "object",
                        properties: {
                            min: { type: "number", format: "float", example: 10.00 },
                            max: { type: "number", format: "float", example: 99.99 }
                        }
                    }
                }
            }
        }
    }
};