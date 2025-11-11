// Get combined analytics for user and/or seller with variable parameters
export default (app, router) => {
    const db = router.db;

    app.get('/analytics/user-seller', (req, res) => {
        const userId = req.query.userId ? Number(req.query.userId) : null;
        const sellerId = req.query.sellerId ? Number(req.query.sellerId) : null;

        if (userId !== null && !Number.isFinite(userId)) {
            return res.status(400).json({ error: 'invalid userId' });
        }
        if (sellerId !== null && !Number.isFinite(sellerId)) {
            return res.status(400).json({ error: 'invalid sellerId' });
        }

        const users = db.get('users').value() || [];
        const orders = db.get('orders').value() || [];
        const products = db.get('products').value() || [];

        // Senaryo 1: Sadece userId varsa - kullanıcının tüm sipariş analizi
        if (userId !== null && sellerId === null) {
            const user = users.find(u => Number(u.id) === userId);
            if (!user) return res.status(404).json({ error: 'user not found' });

            const userOrders = orders.filter(o => Number(o.userId) === userId);
            const totalSpent = userOrders.reduce((sum, o) => sum + (parseFloat(o.totalAmount) || 0), 0);
            const orderCount = userOrders.length;

            return res.json({
                type: 'user_only',
                userId,
                userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
                analytics: {
                    totalOrders: orderCount,
                    totalSpent: Number(totalSpent.toFixed(2)),
                    averageOrderValue: orderCount > 0 ? Number((totalSpent / orderCount).toFixed(2)) : 0,
                    orders: userOrders.map(o => ({
                        orderId: o.id,
                        totalAmount: parseFloat(o.totalAmount) || 0,
                        status: o.status,
                        createdAt: o.createdAt
                    }))
                }
            });
        }

        // Senaryo 2: Sadece sellerId varsa - satıcının tüm ürün ve satış analizi
        if (sellerId !== null && userId === null) {
            const seller = users.find(u => Number(u.id) === sellerId && u.role === 'seller');
            if (!seller) return res.status(404).json({ error: 'seller not found' });

            const sellerProducts = products.filter(p => Number(p.sellerId) === sellerId);
            let totalSales = 0;
            let totalRevenue = 0;

            orders.forEach(order => {
                if (order.items) {
                    order.items.forEach(item => {
                        const product = sellerProducts.find(p => Number(p.id) === Number(item.productId));
                        if (product) {
                            totalSales += Number(item.quantity) || 0;
                            totalRevenue += (parseFloat(item.price) || 0) * (Number(item.quantity) || 0);
                        }
                    });
                }
            });

            return res.json({
                type: 'seller_only',
                sellerId,
                sellerName: `${seller.firstName || ''} ${seller.lastName || ''}`.trim() || seller.email,
                analytics: {
                    totalProducts: sellerProducts.length,
                    totalSales,
                    totalRevenue: Number(totalRevenue.toFixed(2)),
                    products: sellerProducts.map(p => ({
                        productId: p.id,
                        productName: p.name,
                        price: parseFloat(p.price) || 0,
                        stock: Number(p.stock) || 0
                    }))
                }
            });
        }

        // Senaryo 3: Her ikisi de varsa - kullanıcının o satıcıdan yaptığı siparişler
        if (userId !== null && sellerId !== null) {
            const user = users.find(u => Number(u.id) === userId);
            const seller = users.find(u => Number(u.id) === sellerId && u.role === 'seller');
            if (!user) return res.status(404).json({ error: 'user not found' });
            if (!seller) return res.status(404).json({ error: 'seller not found' });

            const sellerProducts = products.filter(p => Number(p.sellerId) === sellerId);
            const sellerProductIds = sellerProducts.map(p => Number(p.id));
            const userOrders = orders.filter(o => {
                if (Number(o.userId) !== userId) return false;
                if (!o.items) return false;
                return o.items.some(item => sellerProductIds.includes(Number(item.productId)));
            });

            let totalSpent = 0;
            userOrders.forEach(order => {
                if (order.items) {
                    order.items.forEach(item => {
                        if (sellerProductIds.includes(Number(item.productId))) {
                            totalSpent += (parseFloat(item.price) || 0) * (Number(item.quantity) || 0);
                        }
                    });
                }
            });

            return res.json({
                type: 'user_seller_combined',
                userId,
                userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
                sellerId,
                sellerName: `${seller.firstName || ''} ${seller.lastName || ''}`.trim() || seller.email,
                analytics: {
                    orderCount: userOrders.length,
                    totalSpent: Number(totalSpent.toFixed(2)),
                    averageOrderValue: userOrders.length > 0 ? Number((totalSpent / userOrders.length).toFixed(2)) : 0,
                    orders: userOrders.map(o => ({
                        orderId: o.id,
                        totalAmount: parseFloat(o.totalAmount) || 0,
                        status: o.status,
                        createdAt: o.createdAt
                    }))
                }
            });
        }

        // Senaryo 4: Hiç parametre yoksa - genel istatistikler
        return res.json({
            type: 'general',
            analytics: {
                totalUsers: users.length,
                totalSellers: users.filter(u => u.role === 'seller').length,
                totalOrders: orders.length,
                totalProducts: products.length
            }
        });
    });
};

export const openapi = {
    paths: {
        "/analytics/user-seller": {
            get: {
                summary: "Get combined analytics for user and/or seller with variable parameters",
                parameters: [
                    { in: "query", name: "userId", schema: { type: "integer" }, description: "Filter by user ID", example: 1 },
                    { in: "query", name: "sellerId", schema: { type: "integer" }, description: "Filter by seller ID", example: 2 }
                ],
                responses: {
                    "200": {
                        description: "Analytics data based on provided parameters",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/UserSellerAnalytics" }
                            }
                        }
                    },
                    "400": { description: "invalid parameters" },
                    "404": { description: "user or seller not found" }
                }
            }
        }
    },
    components: {
        schemas: {
            UserSellerAnalytics: {
                oneOf: [
                    {
                        type: "object",
                        properties: {
                            type: { type: "string", enum: ["user_only"] },
                            userId: { type: "integer" },
                            userName: { type: "string" },
                            analytics: {
                                type: "object",
                                properties: {
                                    totalOrders: { type: "integer" },
                                    totalSpent: { type: "number", format: "float" },
                                    averageOrderValue: { type: "number", format: "float" },
                                    orders: { type: "array", items: { type: "object" } }
                                }
                            }
                        }
                    },
                    {
                        type: "object",
                        properties: {
                            type: { type: "string", enum: ["seller_only"] },
                            sellerId: { type: "integer" },
                            sellerName: { type: "string" },
                            analytics: {
                                type: "object",
                                properties: {
                                    totalProducts: { type: "integer" },
                                    totalSales: { type: "integer" },
                                    totalRevenue: { type: "number", format: "float" },
                                    products: { type: "array", items: { type: "object" } }
                                }
                            }
                        }
                    },
                    {
                        type: "object",
                        properties: {
                            type: { type: "string", enum: ["user_seller_combined"] },
                            userId: { type: "integer" },
                            userName: { type: "string" },
                            sellerId: { type: "integer" },
                            sellerName: { type: "string" },
                            analytics: {
                                type: "object",
                                properties: {
                                    orderCount: { type: "integer" },
                                    totalSpent: { type: "number", format: "float" },
                                    averageOrderValue: { type: "number", format: "float" },
                                    orders: { type: "array", items: { type: "object" } }
                                }
                            }
                        }
                    },
                    {
                        type: "object",
                        properties: {
                            type: { type: "string", enum: ["general"] },
                            analytics: {
                                type: "object",
                                properties: {
                                    totalUsers: { type: "integer" },
                                    totalSellers: { type: "integer" },
                                    totalOrders: { type: "integer" },
                                    totalProducts: { type: "integer" }
                                }
                            }
                        }
                    }
                ]
            }
        }
    }
};