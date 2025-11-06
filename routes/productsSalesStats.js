export default (app, router) => { 
    const db = router.db;  // ← Bu satırı eklemen gerekiyor!
    app.get('/products/:id/sales-stats', (req, res) => {
        // Get product sales statistics (total sales, revenue, orders count, average order value)
        const productId = Number(req.params.id);
        
        if (!Number.isFinite(productId)) return res.status(400).json({ error: 'invalid id' });
        
        const product = db.get('products').find(p => Number(p.id) === productId).value();
        
        if (!product) return res.status(404).json({ error: 'product not found' });
        
        const orders = db.get('orders').value() || [];
        let totalSales = 0;
        let totalRevenue = 0;
        let ordersCount = 0;
        
        orders.forEach(order => {
            const productItems = order.items.filter(item => Number(item.productId) === productId);
            if (productItems.length > 0) {
                ordersCount++;
                productItems.forEach(item => {
                    const quantity = Number(item.quantity) || 0;
                    const price = parseFloat(item.price) || 0;
                    totalSales += quantity;
                    totalRevenue += quantity * price;
                });
            }
        });
        
        const averageOrderValue = ordersCount > 0 ? Number((totalRevenue / ordersCount).toFixed(2)) : 0;
        
        res.json({
            productId,
            productName: product.name,
            totalSales,
            totalRevenue: Number(totalRevenue.toFixed(2)),
            ordersCount,
            averageOrderValue
        });
    });
}


export const openapi = {
    paths: {
        "/products/{id}/sales-stats": {
            get: {
                summary: "Get product sales statistics",
                parameters: [
                    { in: "path", name: "id", required: true, schema: { type: "integer" }, example: 1 }
                ],
                responses: {
                    "200": {
                        description: "Product sales statistics",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ProductSalesStats" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            productId: 1,
                                            productName: "Sample Product",
                                            totalSales: 15,
                                            totalRevenue: 450.75,
                                            ordersCount: 5,
                                            averageOrderValue: 90.15
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
            ProductSalesStats: {
                type: "object",
                properties: {
                    productId: { type: "integer", example: 1 },
                    productName: { type: "string", example: "Sample Product" },
                    totalSales: { type: "integer", example: 15 },
                    totalRevenue: { type: "number", format: "float", example: 450.75 },
                    ordersCount: { type: "integer", example: 5 },
                    averageOrderValue: { type: "number", format: "float", example: 90.15 }
                }
            }
        }
    }
};