// Get products with low stock levels
export default (app, router) => {
    const db = router.db;

    app.get('/products/low-stock', (req, res) => {
        const threshold = Number(req.query.threshold) || 10;
        const categoryId = req.query.categoryId ? Number(req.query.categoryId) : null;

        if (!Number.isFinite(threshold) || threshold < 0) {
            return res.status(400).json({ error: 'invalid threshold' });
        }

        let products = db.get('products').value() || [];
        
        if (categoryId !== null) {
            if (!Number.isFinite(categoryId)) {
                return res.status(400).json({ error: 'invalid categoryId' });
            }
            products = products.filter(p => Number(p.categoryId) === categoryId);
        }

        const lowStockProducts = products
            .filter(p => {
                const mainStock = Number(p.stock) || 0;
                const variantStock = (p.variants || []).reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
                return (mainStock + variantStock) <= threshold;
            })
            .map(p => {
                const mainStock = Number(p.stock) || 0;
                const variantStock = (p.variants || []).reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
                const totalStock = mainStock + variantStock;
                
                return {
                    productId: p.id,
                    productName: p.name,
                    categoryId: p.categoryId,
                    categoryName: db.get('categories').find(c => Number(c.id) === Number(p.categoryId)).value()?.name || 'Unknown',
                    mainStock,
                    variantStock,
                    totalStock,
                    status: p.status,
                    price: parseFloat(p.price) || 0
                };
            })
            .sort((a, b) => a.totalStock - b.totalStock);

        res.json({
            threshold,
            categoryId: categoryId || null,
            totalLowStockProducts: lowStockProducts.length,
            products: lowStockProducts
        });
    });
};

export const openapi = {
    paths: {
        "/products/low-stock": {
            get: {
                summary: "Get products with low stock levels",
                parameters: [
                    { in: "query", name: "threshold", schema: { type: "integer" }, description: "Stock threshold", example: 10 },
                    { in: "query", name: "categoryId", schema: { type: "integer" }, description: "Filter by category", example: 1 }
                ],
                responses: {
                    "200": {
                        description: "Low stock products",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ProductInventoryAlert" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            threshold: 10,
                                            categoryId: null,
                                            totalLowStockProducts: 5,
                                            products: [
                                                {
                                                    productId: 1,
                                                    productName: "Product A",
                                                    categoryId: 1,
                                                    categoryName: "Category A",
                                                    mainStock: 5,
                                                    variantStock: 3,
                                                    totalStock: 8,
                                                    status: "active",
                                                    price: 29.99
                                                }
                                            ]
                                        }
                                    }
                                }
                            }
                        }
                    },
                    "400": { description: "invalid threshold or categoryId" }
                }
            }
        }
    },
    components: {
        schemas: {
            ProductInventoryAlert: {
                type: "object",
                properties: {
                    threshold: { type: "integer", example: 10 },
                    categoryId: { type: "integer", nullable: true, example: null },
                    totalLowStockProducts: { type: "integer", example: 5 },
                    products: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                productId: { type: "integer", example: 1 },
                                productName: { type: "string", example: "Product A" },
                                categoryId: { type: "integer", example: 1 },
                                categoryName: { type: "string", example: "Category A" },
                                mainStock: { type: "integer", example: 5 },
                                variantStock: { type: "integer", example: 3 },
                                totalStock: { type: "integer", example: 8 },
                                status: { type: "string", example: "active" },
                                price: { type: "number", format: "float", example: 29.99 }
                            }
                        }
                    }
                }
            }
        }
    }
};