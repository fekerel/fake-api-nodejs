// Bir ürünün review istatistikleri ile satış verilerini birlikte analiz eder ve korelasyonu gösterir

export default (app, router) => {
    const db = router.db;

    app.get('/products/:id/review-sales-correlation', (req, res) => {
        const productId = Number(req.params.id);
        
        if (!Number.isFinite(productId)) return res.status(400).json({ error: 'invalid id' });
        
        const product = db.get('products').find(p => Number(p.id) === productId).value();
        if (!product) return res.status(404).json({ error: 'product not found' });
        
        const reviews = db.get('reviews').filter(r => Number(r.productId) === productId).value() || [];
        const orders = db.get('orders').value() || [];
        
        let totalSales = 0;
        let totalRevenue = 0;
        const salesByRating = { 1: { sales: 0, revenue: 0 }, 2: { sales: 0, revenue: 0 }, 3: { sales: 0, revenue: 0 }, 4: { sales: 0, revenue: 0 }, 5: { sales: 0, revenue: 0 } };
        
        orders.forEach(order => {
            if (order.items) {
                order.items.forEach(item => {
                    if (Number(item.productId) === productId) {
                        const quantity = Number(item.quantity) || 0;
                        const price = parseFloat(item.price) || 0;
                        totalSales += quantity;
                        totalRevenue += quantity * price;
                        
                        const orderDate = Number(order.createdAt) || 0;
                        const reviewsBeforeOrder = reviews.filter(r => Number(r.createdAt) <= orderDate);
                        
                        if (reviewsBeforeOrder.length > 0) {
                            let avgRating = 0;
                            reviewsBeforeOrder.forEach(r => {
                                avgRating += Number(r.rating) || 0;
                            });
                            avgRating = Math.round(avgRating / reviewsBeforeOrder.length);
                            
                            if (avgRating >= 1 && avgRating <= 5) {
                                salesByRating[avgRating].sales += quantity;
                                salesByRating[avgRating].revenue += quantity * price;
                            }
                        }
                    }
                });
            }
        });
        
        let totalRating = 0;
        reviews.forEach(review => {
            totalRating += Number(review.rating) || 0;
        });
        const averageRating = reviews.length > 0 ? Number((totalRating / reviews.length).toFixed(2)) : 0;
        
        const category = db.get('categories').find(c => Number(c.id) === Number(product.categoryId)).value();
        
        res.json({
            productId,
            productName: product.name,
            categoryId: Number(product.categoryId),
            categoryName: category ? category.name : 'Unknown',
            reviewStats: {
                totalReviews: reviews.length,
                averageRating
            },
            salesStats: {
                totalSales,
                totalRevenue: Number(totalRevenue.toFixed(2)),
                ordersCount: orders.filter(o => 
                    o.items && o.items.some(item => Number(item.productId) === productId)
                ).length
            },
            correlation: {
                salesByRating,
                hasReviews: reviews.length > 0,
                hasSales: totalSales > 0
            }
        });
    });
};

export const openapi = {
    paths: {
        "/products/{id}/review-sales-correlation": {
            get: {
                summary: "Get product review and sales correlation",
                parameters: [
                    { in: "path", name: "id", required: true, schema: { type: "integer" }, example: 1 }
                ],
                responses: {
                    "200": {
                        description: "Product review and sales correlation",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ProductReviewSalesCorrelation" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            productId: 1,
                                            productName: "Product A",
                                            categoryId: 1,
                                            categoryName: "Category A",
                                            reviewStats: {
                                                totalReviews: 25,
                                                averageRating: 4.2
                                            },
                                            salesStats: {
                                                totalSales: 150,
                                                totalRevenue: 4500.75,
                                                ordersCount: 45
                                            },
                                            correlation: {
                                                salesByRating: {
                                                    "1": { sales: 0, revenue: 0 },
                                                    "2": { sales: 5, revenue: 150.25 },
                                                    "3": { sales: 10, revenue: 300.50 },
                                                    "4": { sales: 50, revenue: 1500.00 },
                                                    "5": { sales: 85, revenue: 2550.00 }
                                                },
                                                hasReviews: true,
                                                hasSales: true
                                            }
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
            ProductReviewSalesCorrelation: {
                type: "object",
                properties: {
                    productId: { type: "integer", example: 1 },
                    productName: { type: "string", example: "Product A" },
                    categoryId: { type: "integer", example: 1 },
                    categoryName: { type: "string", example: "Category A" },
                    reviewStats: {
                        type: "object",
                        properties: {
                            totalReviews: { type: "integer", example: 25 },
                            averageRating: { type: "number", format: "float", example: 4.2 }
                        }
                    },
                    salesStats: {
                        type: "object",
                        properties: {
                            totalSales: { type: "integer", example: 150 },
                            totalRevenue: { type: "number", format: "float", example: 4500.75 },
                            ordersCount: { type: "integer", example: 45 }
                        }
                    },
                    correlation: {
                        type: "object",
                        properties: {
                            salesByRating: {
                                type: "object",
                                properties: {
                                    "1": {
                                        type: "object",
                                        properties: {
                                            sales: { type: "integer", example: 0 },
                                            revenue: { type: "number", format: "float", example: 0 }
                                        }
                                    },
                                    "2": {
                                        type: "object",
                                        properties: {
                                            sales: { type: "integer", example: 5 },
                                            revenue: { type: "number", format: "float", example: 150.25 }
                                        }
                                    },
                                    "3": {
                                        type: "object",
                                        properties: {
                                            sales: { type: "integer", example: 10 },
                                            revenue: { type: "number", format: "float", example: 300.50 }
                                        }
                                    },
                                    "4": {
                                        type: "object",
                                        properties: {
                                            sales: { type: "integer", example: 50 },
                                            revenue: { type: "number", format: "float", example: 1500.00 }
                                        }
                                    },
                                    "5": {
                                        type: "object",
                                        properties: {
                                            sales: { type: "integer", example: 85 },
                                            revenue: { type: "number", format: "float", example: 2550.00 }
                                        }
                                    }
                                }
                            },
                            hasReviews: { type: "boolean", example: true },
                            hasSales: { type: "boolean", example: true }
                        }
                    }
                }
            }
        }
    }
};