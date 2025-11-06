export default (app, router) => { 
    const db = router.db;  // ← Bu satırı eklemen gerekiyor!
    app.get('/sellers/:sellerId/dashboard', (req, res) => {
        // Get seller dashboard with top selling products and category distribution
        const sellerId = Number(req.params.sellerId);
        
        if (!Number.isFinite(sellerId)) return res.status(400).json({ error: 'invalid seller id' });
        
        const seller = db.get('users').find(u => Number(u.id) === sellerId).value();
        
        if (!seller) return res.status(404).json({ error: 'seller not found' });
        
        const products = db.get('products').filter(p => Number(p.sellerId) === sellerId).value() || [];
        const totalProducts = products.length;
        const activeProducts = products.filter(p => p.status === 'active').length;
        
        // Satış hesaplamaları
        const orders = db.get('orders').value() || [];
        let totalSales = 0;
        let totalRevenue = 0;
        const productSales = {};
        
        orders.forEach(order => {
            if (order.items) {
                order.items.forEach(item => {
                    const product = db.get('products').find(p => Number(p.id) === Number(item.productId)).value();
                    if (product && Number(product.sellerId) === sellerId) {
                        const quantity = Number(item.quantity) || 0;
                        const price = parseFloat(item.price) || 0;
                        totalSales += quantity;
                        totalRevenue += quantity * price;
                        
                        if (!productSales[product.id]) {
                            productSales[product.id] = { salesCount: 0, revenue: 0 };
                        }
                        productSales[product.id].salesCount += quantity;
                        productSales[product.id].revenue += quantity * price;
                    }
                });
            }
        });
        
        // En çok satan 5 ürün
        const topSellingProducts = Object.keys(productSales)
            .map(productId => {
                const product = db.get('products').find(p => Number(p.id) === Number(productId)).value();
                return {
                    productId: Number(productId),
                    productName: product ? product.name : 'Unknown',
                    salesCount: productSales[productId].salesCount,
                    revenue: Number(productSales[productId].revenue.toFixed(2))
                };
            })
            .sort((a, b) => b.salesCount - a.salesCount)
            .slice(0, 5);
        
        // Kategori bazında ürün dağılımı
        const categoryDistribution = {};
        products.forEach(product => {
            const catId = Number(product.categoryId);
            if (!categoryDistribution[catId]) {
                const category = db.get('categories').find(c => Number(c.id) === catId).value();
                categoryDistribution[catId] = {
                    categoryId: catId,
                    categoryName: category ? category.name : 'Unknown',
                    productCount: 0
                };
            }
            categoryDistribution[catId].productCount++;
        });
        
        res.json({
            sellerId,
            sellerName: `${seller.firstName} ${seller.lastName}`,
            totalProducts,
            activeProducts,
            totalSales,
            totalRevenue: Number(totalRevenue.toFixed(2)),
            topSellingProducts,
            productsByCategory: Object.values(categoryDistribution)
        });
    });
}


export const openapi = {
    paths: {
        "/sellers/{sellerId}/dashboard": {
            get: {
                summary: "Get seller dashboard statistics",
                parameters: [
                    { in: "path", name: "sellerId", required: true, schema: { type: "integer" }, example: 1 }
                ],
                responses: {
                    "200": {
                        description: "Seller dashboard statistics",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/SellerDashboard" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            sellerId: 1,
                                            sellerName: "John Seller",
                                            totalProducts: 15,
                                            activeProducts: 12,
                                            totalSales: 150,
                                            totalRevenue: 4500.75,
                                            topSellingProducts: [
                                                { productId: 5, productName: "Product A", salesCount: 50, revenue: 1500.00 }
                                            ],
                                            productsByCategory: [
                                                { categoryId: 1, categoryName: "Meyve & Sebze", productCount: 8 }
                                            ]
                                        }
                                    }
                                }
                            }
                        }
                    },
                    "400": { description: "invalid seller id" },
                    "404": { description: "seller not found" }
                }
            }
        }
    },
    components: {
        schemas: {
            SellerDashboard: {
                type: "object",
                properties: {
                    sellerId: { type: "integer", example: 1 },
                    sellerName: { type: "string", example: "John Seller" },
                    totalProducts: { type: "integer", example: 15 },
                    activeProducts: { type: "integer", example: 12 },
                    totalSales: { type: "integer", example: 150 },
                    totalRevenue: { type: "number", format: "float", example: 4500.75 },
                    topSellingProducts: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                productId: { type: "integer", example: 5 },
                                productName: { type: "string", example: "Product A" },
                                salesCount: { type: "integer", example: 50 },
                                revenue: { type: "number", format: "float", example: 1500.00 }
                            }
                        }
                    },
                    productsByCategory: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                categoryId: { type: "integer", example: 1 },
                                categoryName: { type: "string", example: "Meyve & Sebze" },
                                productCount: { type: "integer", example: 8 }
                            }
                        }
                    }
                }
            }
        }
    }
};


