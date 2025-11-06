// Get product variants summary with stock, price range and availability status
export default (app, router) => {
    const db = router.db;

    app.get('/products/:id/variants-summary', (req, res) => {
        const productId = Number(req.params.id);
        
        if (!Number.isFinite(productId)) return res.status(400).json({ error: 'invalid id' });
        
        const product = db.get('products').find(p => Number(p.id) === productId).value();
        
        if (!product) return res.status(404).json({ error: 'product not found' });
        
        const variants = product.variants || [];
        
        const totalVariantStock = variants.reduce((sum, v) => sum + (Number(v.stock) || 0), 0);
        const variantPrices = variants.map(v => parseFloat(v.price) || 0).filter(p => p > 0);
        const availableVariants = variants.filter(v => (Number(v.stock) || 0) > 0).length;
        const outOfStockVariants = variants.filter(v => (Number(v.stock) || 0) === 0).length;
        
        const priceRange = variantPrices.length > 0 ? {
            min: Number(Math.min(...variantPrices).toFixed(2)),
            max: Number(Math.max(...variantPrices).toFixed(2))
        } : { min: 0, max: 0 };
        
        const colorDistribution = {};
        const sizeDistribution = {};
        
        variants.forEach(v => {
            if (v.color) {
                colorDistribution[v.color] = (colorDistribution[v.color] || 0) + 1;
            }
            if (v.size) {
                sizeDistribution[v.size] = (sizeDistribution[v.size] || 0) + 1;
            }
        });
        
        res.json({
            productId: product.id,
            productName: product.name,
            totalVariants: variants.length,
            totalVariantStock,
            availableVariants,
            outOfStockVariants,
            variantPriceRange: priceRange,
            colorDistribution,
            sizeDistribution,
            variants: variants.map(v => ({
                id: v.id,
                color: v.color,
                size: v.size,
                price: parseFloat(v.price) || 0,
                stock: Number(v.stock) || 0,
                isAvailable: (Number(v.stock) || 0) > 0
            }))
        });
    });
};

export const openapi = {
    paths: {
        "/products/{id}/variants-summary": {
            get: {
                summary: "Get product variants summary",
                parameters: [
                    { in: "path", name: "id", required: true, schema: { type: "integer" }, example: 1 }
                ],
                responses: {
                    "200": {
                        description: "Product variants summary",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ProductVariantsSummary" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            productId: 1,
                                            productName: "Product A",
                                            totalVariants: 4,
                                            totalVariantStock: 500,
                                            availableVariants: 3,
                                            outOfStockVariants: 1,
                                            variantPriceRange: { min: 25.00, max: 45.00 },
                                            colorDistribution: { red: 2, blue: 2 },
                                            sizeDistribution: { S: 2, M: 2 },
                                            variants: [
                                                { id: "var1", color: "red", size: "S", price: 25.00, stock: 100, isAvailable: true }
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
            ProductVariantsSummary: {
                type: "object",
                properties: {
                    productId: { type: "integer", example: 1 },
                    productName: { type: "string", example: "Product A" },
                    totalVariants: { type: "integer", example: 4 },
                    totalVariantStock: { type: "integer", example: 500 },
                    availableVariants: { type: "integer", example: 3 },
                    outOfStockVariants: { type: "integer", example: 1 },
                    variantPriceRange: {
                        type: "object",
                        properties: {
                            min: { type: "number", format: "float", example: 25.00 },
                            max: { type: "number", format: "float", example: 45.00 }
                        }
                    },
                    colorDistribution: { type: "object", example: { red: 2, blue: 2 } },
                    sizeDistribution: { type: "object", example: { S: 2, M: 2 } },
                    variants: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                id: { type: "string", example: "var1" },
                                color: { type: "string", example: "red" },
                                size: { type: "string", example: "S" },
                                price: { type: "number", format: "float", example: 25.00 },
                                stock: { type: "integer", example: 100 },
                                isAvailable: { type: "boolean", example: true }
                            }
                        }
                    }
                }
            }
        }
    }
};