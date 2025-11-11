// Get product stock movement analysis
export default (app, router) => {
    const db = router.db;

    app.get('/products/:id/stock-movement', (req, res) => {
        const productId = Number(req.params.id);

        if (!Number.isFinite(productId)) return res.status(400).json({ error: 'invalid id' });

        const product = db.get('products').find(p => Number(p.id) === productId).value();
        if (!product) return res.status(404).json({ error: 'product not found' });

        const orders = db.get('orders').value() || [];
        const currentStock = Number(product.stock) || 0;
        
        const stockMovements = [];
        let totalSold = 0;
        let totalReturned = 0;

        orders.forEach(order => {
            if (order.items && order.createdAt) {
                order.items.forEach(item => {
                    if (Number(item.productId) === productId) {
                        const quantity = Number(item.quantity) || 0;
                        
                        if (order.status === 'delivered') {
                            totalSold += quantity;
                            stockMovements.push({
                                type: 'sale',
                                quantity: -quantity,
                                orderId: order.id,
                                date: order.createdAt,
                                status: order.status
                            });
                        } else if (order.status === 'returned') {
                            totalReturned += quantity;
                            stockMovements.push({
                                type: 'return',
                                quantity: quantity,
                                orderId: order.id,
                                date: order.createdAt,
                                status: order.status
                            });
                        } else if (order.status === 'cancelled') {
                            stockMovements.push({
                                type: 'cancellation',
                                quantity: 0,
                                orderId: order.id,
                                date: order.createdAt,
                                status: order.status
                            });
                        }
                    }
                });
            }
        });

        stockMovements.sort((a, b) => a.date - b.date);

        const netStockChange = totalReturned - totalSold;
        const estimatedCurrentStock = currentStock + netStockChange;
        const stockTurnoverRate = currentStock > 0 && totalSold > 0
            ? Number((totalSold / currentStock).toFixed(2))
            : 0;

        const recentMovements = stockMovements.slice(-10);

        res.json({
            productId,
            productName: product.name,
            currentStock,
            stockAnalysis: {
                totalSold,
                totalReturned,
                netStockChange,
                estimatedCurrentStock,
                stockTurnoverRate
            },
            movementHistory: {
                totalMovements: stockMovements.length,
                recentMovements
            },
            stockStatus: currentStock <= 10 ? 'low' : currentStock <= 50 ? 'medium' : 'high',
            alerts: currentStock <= 10 ? ['Low stock warning'] : []
        });
    });
};

export const openapi = {
    paths: {
        "/products/{id}/stock-movement": {
            get: {
                summary: "Get product stock movement analysis",
                parameters: [
                    { in: "path", name: "id", required: true, schema: { type: "integer" }, example: 1 }
                ],
                responses: {
                    "200": {
                        description: "Product stock movement",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ProductStockMovement" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            productId: 1,
                                            productName: "Product A",
                                            currentStock: 100,
                                            stockAnalysis: {
                                                totalSold: 50,
                                                totalReturned: 5,
                                                netStockChange: -45,
                                                estimatedCurrentStock: 55,
                                                stockTurnoverRate: 0.50
                                            },
                                            movementHistory: {
                                                totalMovements: 20,
                                                recentMovements: [
                                                    {
                                                        type: "sale",
                                                        quantity: -2,
                                                        orderId: 100,
                                                        date: 1738368000000,
                                                        status: "delivered"
                                                    }
                                                ]
                                            },
                                            stockStatus: "high",
                                            alerts: []
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
            ProductStockMovement: {
                type: "object",
                properties: {
                    productId: { type: "integer", example: 1 },
                    productName: { type: "string", example: "Product A" },
                    currentStock: { type: "integer", example: 100 },
                    stockAnalysis: {
                        type: "object",
                        properties: {
                            totalSold: { type: "integer", example: 50 },
                            totalReturned: { type: "integer", example: 5 },
                            netStockChange: { type: "integer", example: -45 },
                            estimatedCurrentStock: { type: "integer", example: 55 },
                            stockTurnoverRate: { type: "number", format: "float", example: 0.50 }
                        }
                    },
                    movementHistory: {
                        type: "object",
                        properties: {
                            totalMovements: { type: "integer", example: 20 },
                            recentMovements: {
                                type: "array",
                                items: {
                                    type: "object",
                                    properties: {
                                        type: { type: "string", enum: ["sale", "return", "cancellation"], example: "sale" },
                                        quantity: { type: "integer", example: -2 },
                                        orderId: { type: "integer", example: 100 },
                                        date: { type: "integer", format: "int64", example: 1738368000000 },
                                        status: { type: "string", example: "delivered" }
                                    }
                                }
                            }
                        }
                    },
                    stockStatus: { type: "string", enum: ["low", "medium", "high"], example: "high" },
                    alerts: {
                        type: "array",
                        items: { type: "string" },
                        example: []
                    }
                }
            }
        }
    }
};