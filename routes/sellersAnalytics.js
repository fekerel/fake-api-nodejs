// Get seller analytics with performance metrics, growth trends and insights
export default (app, router) => {
    const db = router.db;

    app.get('/sellers/:sellerId/analytics', (req, res) => {
        const sellerId = Number(req.params.sellerId);
        
        if (!Number.isFinite(sellerId)) return res.status(400).json({ error: 'invalid seller id' });
        
        const seller = db.get('users').find(u => Number(u.id) === sellerId).value();
        
        if (!seller) return res.status(404).json({ error: 'seller not found' });
        
        const products = db.get('products').filter(p => Number(p.sellerId) === sellerId).value() || [];
        const orders = db.get('orders').value() || [];
        
        // Toplam metrikler
        const totalProducts = products.length;
        const activeProducts = products.filter(p => p.status === 'active').length;
        
        // Satış metrikleri
        let totalSales = 0;
        let totalRevenue = 0;
        const monthlyRevenue = {};
        
        orders.forEach(order => {
            if (order.items) {
                order.items.forEach(item => {
                    const product = db.get('products').find(p => Number(p.id) === Number(item.productId)).value();
                    if (product && Number(product.sellerId) === sellerId) {
                        const quantity = Number(item.quantity) || 0;
                        const price = parseFloat(item.price) || 0;
                        totalSales += quantity;
                        totalRevenue += quantity * price;
                        
                        // Aylık gelir (simüle edilmiş)
                        if (order.createdAt) {
                            const month = new Date(order.createdAt).toISOString().substring(0, 7); // YYYY-MM
                            monthlyRevenue[month] = (monthlyRevenue[month] || 0) + (quantity * price);
                        }
                    }
                });
            }
        });
        
        // Ortalama ürün fiyatı
        const productPrices = products.map(p => parseFloat(p.price) || 0).filter(p => p > 0);
        const averageProductPrice = productPrices.length > 0 
            ? Number((productPrices.reduce((a, b) => a + b, 0) / productPrices.length).toFixed(2))
            : 0;
        
        // Toplam stok
        const totalStock = products.reduce((sum, p) => sum + (Number(p.stock) || 0), 0);
        
        // Kategori dağılımı
        const categoryCount = {};
        products.forEach(product => {
            const catId = Number(product.categoryId);
            categoryCount[catId] = (categoryCount[catId] || 0) + 1;
        });
        
        const topCategory = Object.keys(categoryCount).length > 0
            ? Object.keys(categoryCount).reduce((a, b) => categoryCount[a] > categoryCount[b] ? a : b)
            : null;
        
        const topCategoryName = topCategory 
            ? (db.get('categories').find(c => Number(c.id) === Number(topCategory)).value()?.name || 'Unknown')
            : null;
        
        res.json({
            sellerId,
            sellerName: `${seller.firstName} ${seller.lastName}`,
            totalProducts,
            activeProducts,
            totalSales,
            totalRevenue: Number(totalRevenue.toFixed(2)),
            averageProductPrice,
            totalStock,
            topCategory: topCategory ? {
                categoryId: Number(topCategory),
                categoryName: topCategoryName,
                productCount: categoryCount[topCategory]
            } : null,
            monthlyRevenue
        });
    });
};

export const openapi = {
    paths: {
        "/sellers/{sellerId}/analytics": {
            get: {
                summary: "Get seller analytics and performance metrics",
                parameters: [
                    { in: "path", name: "sellerId", required: true, schema: { type: "integer" }, example: 1 }
                ],
                responses: {
                    "200": {
                        description: "Seller analytics",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/SellerAnalytics" },
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
                                            averageProductPrice: 45.50,
                                            totalStock: 1500,
                                            topCategory: { categoryId: 1, categoryName: "Category A", productCount: 8 },
                                            monthlyRevenue: { "2025-11": 1500.25, "2025-10": 2000.50 }
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
            SellerAnalytics: {
                type: "object",
                properties: {
                    sellerId: { type: "integer", example: 1 },
                    sellerName: { type: "string", example: "John Seller" },
                    totalProducts: { type: "integer", example: 15 },
                    activeProducts: { type: "integer", example: 12 },
                    totalSales: { type: "integer", example: 150 },
                    totalRevenue: { type: "number", format: "float", example: 4500.75 },
                    averageProductPrice: { type: "number", format: "float", example: 45.50 },
                    totalStock: { type: "integer", example: 1500 },
                    topCategory: {
                        type: "object",
                        nullable: true,
                        properties: {
                            categoryId: { type: "integer", example: 1 },
                            categoryName: { type: "string", example: "Category A" },
                            productCount: { type: "integer", example: 8 }
                        }
                    },
                    monthlyRevenue: { type: "object", example: { "2025-11": 1500.25, "2025-10": 2000.50 } }
                }
            }
        }
    }
};