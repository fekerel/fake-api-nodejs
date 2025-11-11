// Get seller product portfolio analysis
export default (app, router) => {
    const db = router.db;

    app.get('/sellers/:id/product-portfolio', (req, res) => {
        const sellerId = Number(req.params.id);

        if (!Number.isFinite(sellerId)) return res.status(400).json({ error: 'invalid id' });

        const seller = db.get('users').find(u => Number(u.id) === sellerId && u.role === 'seller').value();
        if (!seller) return res.status(404).json({ error: 'seller not found' });

        const products = db.get('products').filter(p => Number(p.sellerId) === sellerId).value() || [];
        const orders = db.get('orders').value() || [];
        const categories = db.get('categories').value() || [];

        const categoryDistribution = {};
        const statusDistribution = { active: 0, inactive: 0 };
        let totalStock = 0;
        let totalValue = 0;
        let totalSales = 0;
        let totalRevenue = 0;

        products.forEach(product => {
            const categoryId = Number(product.categoryId);
            const category = categories.find(c => Number(c.id) === categoryId);
            
            if (!categoryDistribution[categoryId]) {
                categoryDistribution[categoryId] = {
                    categoryId,
                    categoryName: category ? category.name : 'Unknown',
                    productCount: 0,
                    totalStock: 0,
                    totalValue: 0
                };
            }

            categoryDistribution[categoryId].productCount++;
            categoryDistribution[categoryId].totalStock += Number(product.stock) || 0;
            categoryDistribution[categoryId].totalValue += (parseFloat(product.price) || 0) * (Number(product.stock) || 0);

            statusDistribution[product.status] = (statusDistribution[product.status] || 0) + 1;
            totalStock += Number(product.stock) || 0;
            totalValue += (parseFloat(product.price) || 0) * (Number(product.stock) || 0);
        });

        orders.forEach(order => {
            if (order.items) {
                order.items.forEach(item => {
                    const product = products.find(p => Number(p.id) === Number(item.productId));
                    if (product) {
                        totalSales += Number(item.quantity) || 0;
                        totalRevenue += (parseFloat(item.price) || 0) * (Number(item.quantity) || 0);
                    }
                });
            }
        });

        const categoryArray = Object.values(categoryDistribution)
            .map(cat => ({
                ...cat,
                totalStock: Number(cat.totalStock),
                totalValue: Number(cat.totalValue.toFixed(2))
            }))
            .sort((a, b) => b.productCount - a.productCount);

        const averageProductPrice = products.length > 0
            ? Number((products.reduce((sum, p) => sum + (parseFloat(p.price) || 0), 0) / products.length).toFixed(2))
            : 0;

        res.json({
            sellerId,
            sellerName: `${seller.firstName || ''} ${seller.lastName || ''}`.trim() || seller.email,
            portfolio: {
                totalProducts: products.length,
                activeProducts: statusDistribution.active || 0,
                inactiveProducts: statusDistribution.inactive || 0,
                totalStock,
                totalInventoryValue: Number(totalValue.toFixed(2)),
                averageProductPrice
            },
            sales: {
                totalSales,
                totalRevenue: Number(totalRevenue.toFixed(2)),
                averageOrderValue: orders.length > 0 ? Number((totalRevenue / orders.length).toFixed(2)) : 0
            },
            categoryDistribution: categoryArray,
            topCategory: categoryArray.length > 0 ? categoryArray[0] : null
        });
    });
};

export const openapi = {
    paths: {
        "/sellers/{id}/product-portfolio": {
            get: {
                summary: "Get seller product portfolio analysis",
                parameters: [
                    { in: "path", name: "id", required: true, schema: { type: "integer" }, example: 1 }
                ],
                responses: {
                    "200": {
                        description: "Seller product portfolio",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/SellerProductPortfolio" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            sellerId: 1,
                                            sellerName: "John Seller",
                                            portfolio: {
                                                totalProducts: 15,
                                                activeProducts: 12,
                                                inactiveProducts: 3,
                                                totalStock: 1500,
                                                totalInventoryValue: 45000.00,
                                                averageProductPrice: 45.50
                                            },
                                            sales: {
                                                totalSales: 150,
                                                totalRevenue: 4500.75,
                                                averageOrderValue: 90.15
                                            },
                                            categoryDistribution: [
                                                {
                                                    categoryId: 1,
                                                    categoryName: "Category A",
                                                    productCount: 5,
                                                    totalStock: 500,
                                                    totalValue: 15000.00
                                                }
                                            ],
                                            topCategory: {
                                                categoryId: 1,
                                                categoryName: "Category A",
                                                productCount: 5,
                                                totalStock: 500,
                                                totalValue: 15000.00
                                            }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    "400": { description: "invalid id" },
                    "404": { description: "seller not found" }
                }
            }
        }
    },
    components: {
        schemas: {
            SellerProductPortfolio: {
                type: "object",
                properties: {
                    sellerId: { type: "integer", example: 1 },
                    sellerName: { type: "string", example: "John Seller" },
                    portfolio: {
                        type: "object",
                        properties: {
                            totalProducts: { type: "integer", example: 15 },
                            activeProducts: { type: "integer", example: 12 },
                            inactiveProducts: { type: "integer", example: 3 },
                            totalStock: { type: "integer", example: 1500 },
                            totalInventoryValue: { type: "number", format: "float", example: 45000.00 },
                            averageProductPrice: { type: "number", format: "float", example: 45.50 }
                        }
                    },
                    sales: {
                        type: "object",
                        properties: {
                            totalSales: { type: "integer", example: 150 },
                            totalRevenue: { type: "number", format: "float", example: 4500.75 },
                            averageOrderValue: { type: "number", format: "float", example: 90.15 }
                        }
                    },
                    categoryDistribution: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                categoryId: { type: "integer", example: 1 },
                                categoryName: { type: "string", example: "Category A" },
                                productCount: { type: "integer", example: 5 },
                                totalStock: { type: "integer", example: 500 },
                                totalValue: { type: "number", format: "float", example: 15000.00 }
                            }
                        }
                    },
                    topCategory: {
                        type: "object",
                        nullable: true,
                        properties: {
                            categoryId: { type: "integer", example: 1 },
                            categoryName: { type: "string", example: "Category A" },
                            productCount: { type: "integer", example: 5 },
                            totalStock: { type: "integer", example: 500 },
                            totalValue: { type: "number", format: "float", example: 15000.00 }
                        }
                    }
                }
            }
        }
    }
};