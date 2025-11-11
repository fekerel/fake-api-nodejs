// Get seller performance ranking
export default (app, router) => {
    const db = router.db;

    app.get('/sellers/ranking', (req, res) => {
        const limit = req.query.limit ? Number(req.query.limit) : 10;
        const sortBy = req.query.sortBy || 'totalRevenue'; // totalRevenue, totalSales, totalProducts, averageRating

        if (!Number.isFinite(limit) || limit < 1) {
            return res.status(400).json({ error: 'invalid limit' });
        }

        const users = db.get('users').filter(u => u.role === 'seller').value() || [];
        const products = db.get('products').value() || [];
        const orders = db.get('orders').value() || [];
        const reviews = db.get('reviews').value() || [];

        const sellerStats = {};

        users.forEach(seller => {
            const sellerId = Number(seller.id);
            const sellerProducts = products.filter(p => Number(p.sellerId) === sellerId);
            
            let totalSales = 0;
            let totalRevenue = 0;
            let totalStock = 0;
            let totalPrice = 0;
            let reviewCount = 0;
            let reviewSum = 0;

            orders.forEach(order => {
                if (order.items) {
                    order.items.forEach(item => {
                        const product = sellerProducts.find(p => Number(p.id) === Number(item.productId));
                        if (product) {
                            const quantity = Number(item.quantity) || 0;
                            const price = parseFloat(item.price) || 0;
                            totalSales += quantity;
                            totalRevenue += quantity * price;
                        }
                    });
                }
            });

            sellerProducts.forEach(product => {
                totalStock += Number(product.stock) || 0;
                totalPrice += parseFloat(product.price) || 0;

                const productReviews = reviews.filter(r => Number(r.productId) === Number(product.id));
                productReviews.forEach(review => {
                    reviewCount++;
                    reviewSum += Number(review.rating) || 0;
                });
            });

            sellerStats[sellerId] = {
                sellerId,
                sellerName: `${seller.firstName || ''} ${seller.lastName || ''}`.trim() || seller.email,
                email: seller.email,
                totalProducts: sellerProducts.length,
                activeProducts: sellerProducts.filter(p => p.status === 'active').length,
                totalSales,
                totalRevenue: Number(totalRevenue.toFixed(2)),
                totalStock,
                averageProductPrice: sellerProducts.length > 0 ? Number((totalPrice / sellerProducts.length).toFixed(2)) : 0,
                averageRating: reviewCount > 0 ? Number((reviewSum / reviewCount).toFixed(2)) : 0,
                totalReviews: reviewCount
            };
        });

        let ranking = Object.values(sellerStats);

        if (sortBy === 'totalRevenue') {
            ranking.sort((a, b) => b.totalRevenue - a.totalRevenue);
        } else if (sortBy === 'totalSales') {
            ranking.sort((a, b) => b.totalSales - a.totalSales);
        } else if (sortBy === 'totalProducts') {
            ranking.sort((a, b) => b.totalProducts - a.totalProducts);
        } else if (sortBy === 'averageRating') {
            ranking.sort((a, b) => b.averageRating - a.averageRating);
        }

        ranking = ranking.slice(0, limit).map((seller, index) => ({
            rank: index + 1,
            ...seller
        }));

        res.json({
            sortBy,
            limit,
            totalSellers: users.length,
            ranking
        });
    });
};

export const openapi = {
    paths: {
        "/sellers/ranking": {
            get: {
                summary: "Get seller performance ranking",
                parameters: [
                    { in: "query", name: "limit", schema: { type: "integer" }, description: "Number of sellers to return", example: 10 },
                    { in: "query", name: "sortBy", schema: { type: "string", enum: ["totalRevenue", "totalSales", "totalProducts", "averageRating"] }, description: "Sort by metric", example: "totalRevenue" }
                ],
                responses: {
                    "200": {
                        description: "Seller performance ranking",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/SellerPerformanceRanking" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            sortBy: "totalRevenue",
                                            limit: 10,
                                            totalSellers: 20,
                                            ranking: [
                                                {
                                                    rank: 1,
                                                    sellerId: 1,
                                                    sellerName: "John Seller",
                                                    email: "john@seller.com",
                                                    totalProducts: 15,
                                                    activeProducts: 12,
                                                    totalSales: 150,
                                                    totalRevenue: 4500.75,
                                                    totalStock: 1500,
                                                    averageProductPrice: 45.50,
                                                    averageRating: 4.5,
                                                    totalReviews: 30
                                                }
                                            ]
                                        }
                                    }
                                }
                            }
                        }
                    },
                    "400": { description: "invalid limit" }
                }
            }
        }
    },
    components: {
        schemas: {
            SellerPerformanceRanking: {
                type: "object",
                properties: {
                    sortBy: { type: "string", example: "totalRevenue" },
                    limit: { type: "integer", example: 10 },
                    totalSellers: { type: "integer", example: 20 },
                    ranking: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                rank: { type: "integer", example: 1 },
                                sellerId: { type: "integer", example: 1 },
                                sellerName: { type: "string", example: "John Seller" },
                                email: { type: "string", example: "john@seller.com" },
                                totalProducts: { type: "integer", example: 15 },
                                activeProducts: { type: "integer", example: 12 },
                                totalSales: { type: "integer", example: 150 },
                                totalRevenue: { type: "number", format: "float", example: 4500.75 },
                                totalStock: { type: "integer", example: 1500 },
                                averageProductPrice: { type: "number", format: "float", example: 45.50 },
                                averageRating: { type: "number", format: "float", example: 4.5 },
                                totalReviews: { type: "integer", example: 30 }
                            }
                        }
                    }
                }
            }
        }
    }
};