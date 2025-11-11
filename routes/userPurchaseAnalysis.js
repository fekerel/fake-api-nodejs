// Analyze user purchase history with filters and statistics
export default (app, router) => {
    const db = router.db;

    app.post('/users/purchase-analysis', (req, res) => {
        const { userId, startDate, endDate, minAmount, maxAmount, categoryIds, productIds, status } = req.body || {};

        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }

        const user = db.get('users').find(u => Number(u.id) === Number(userId)).value();
        if (!user) {
            return res.status(404).json({ error: 'user not found' });
        }

        let orders = db.get('orders').filter(o => Number(o.userId) === Number(userId)).value() || [];

        // Date filtering
        if (startDate) {
            const start = Number(startDate);
            orders = orders.filter(o => o.createdAt && o.createdAt >= start);
        }

        if (endDate) {
            const end = Number(endDate);
            orders = orders.filter(o => o.createdAt && o.createdAt <= end);
        }

        // Amount filtering
        if (minAmount !== undefined && minAmount !== null) {
            orders = orders.filter(o => parseFloat(o.totalAmount) >= Number(minAmount));
        }

        if (maxAmount !== undefined && maxAmount !== null) {
            orders = orders.filter(o => parseFloat(o.totalAmount) <= Number(maxAmount));
        }

        // Status filtering
        if (status) {
            orders = orders.filter(o => o.status && o.status.toLowerCase() === status.toLowerCase());
        }

        // Category and product filtering
        if (categoryIds && Array.isArray(categoryIds) && categoryIds.length > 0) {
            const categoryIdSet = new Set(categoryIds.map(id => Number(id)));
            orders = orders.filter(order => {
                if (!order.items) return false;
                return order.items.some(item => {
                    const product = db.get('products').find(p => Number(p.id) === Number(item.productId)).value();
                    return product && categoryIdSet.has(Number(product.categoryId));
                });
            });
        }

        if (productIds && Array.isArray(productIds) && productIds.length > 0) {
            const productIdSet = new Set(productIds.map(id => Number(id)));
            orders = orders.filter(order => {
                if (!order.items) return false;
                return order.items.some(item => productIdSet.has(Number(item.productId)));
            });
        }

        // Calculate statistics
        const totalOrders = orders.length;
        const totalSpent = orders.reduce((sum, o) => sum + (parseFloat(o.totalAmount) || 0), 0);
        const averageOrderValue = totalOrders > 0 ? Number((totalSpent / totalOrders).toFixed(2)) : 0;

        const statusBreakdown = {};
        const categorySpending = {};
        const productFrequency = {};
        const monthlySpending = {};

        orders.forEach(order => {
            // Status breakdown
            const orderStatus = order.status || 'unknown';
            statusBreakdown[orderStatus] = (statusBreakdown[orderStatus] || 0) + 1;

            // Monthly spending
            if (order.createdAt) {
                const orderDate = new Date(order.createdAt);
                const monthKey = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
                monthlySpending[monthKey] = (monthlySpending[monthKey] || 0) + (parseFloat(order.totalAmount) || 0);
            }

            // Category and product analysis
            if (order.items) {
                order.items.forEach(item => {
                    const product = db.get('products').find(p => Number(p.id) === Number(item.productId)).value();
                    if (product) {
                        const categoryId = Number(product.categoryId);
                        categorySpending[categoryId] = (categorySpending[categoryId] || 0) + (parseFloat(item.price) || 0) * (Number(item.quantity) || 0);

                        const productId = Number(item.productId);
                        productFrequency[productId] = (productFrequency[productId] || 0) + (Number(item.quantity) || 0);
                    }
                });
            }
        });

        const topCategories = Object.entries(categorySpending)
            .map(([categoryId, amount]) => ({
                categoryId: Number(categoryId),
                categoryName: db.get('categories').find(c => Number(c.id) === Number(categoryId)).value()?.name || 'Unknown',
                totalSpent: Number(amount.toFixed(2))
            }))
            .sort((a, b) => b.totalSpent - a.totalSpent)
            .slice(0, 5);

        const topProducts = Object.entries(productFrequency)
            .map(([productId, quantity]) => ({
                productId: Number(productId),
                productName: db.get('products').find(p => Number(p.id) === Number(productId)).value()?.name || 'Unknown',
                totalQuantity: quantity
            }))
            .sort((a, b) => b.totalQuantity - a.totalQuantity)
            .slice(0, 5);

        res.json({
            userId: Number(userId),
            userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
            analysis: {
                totalOrders,
                totalSpent: Number(totalSpent.toFixed(2)),
                averageOrderValue,
                statusBreakdown,
                monthlySpending: Object.entries(monthlySpending).map(([month, amount]) => ({
                    month,
                    amount: Number(amount.toFixed(2))
                })).sort((a, b) => a.month.localeCompare(b.month))
            },
            topCategories,
            topProducts,
            filters: {
                startDate: startDate || null,
                endDate: endDate || null,
                minAmount: minAmount || null,
                maxAmount: maxAmount || null,
                categoryIds: categoryIds || null,
                productIds: productIds || null,
                status: status || null
            }
        });
    });
};

export const openapi = {
    paths: {
        "/users/purchase-analysis": {
            post: {
                summary: "Analyze user purchase history with filters and statistics",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["userId"],
                                properties: {
                                    userId: { type: "integer", example: 1 },
                                    startDate: { type: "integer", format: "int64", nullable: true, example: 1735689600000 },
                                    endDate: { type: "integer", format: "int64", nullable: true, example: 1738368000000 },
                                    minAmount: { type: "number", nullable: true, example: 50.00 },
                                    maxAmount: { type: "number", nullable: true, example: 500.00 },
                                    categoryIds: { type: "array", items: { type: "integer" }, nullable: true, example: [1, 2] },
                                    productIds: { type: "array", items: { type: "integer" }, nullable: true, example: [5, 10] },
                                    status: { type: "string", nullable: true, example: "completed" }
                                }
                            }
                        }
                    }
                },
                responses: {
                    "200": {
                        description: "Purchase analysis results",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/PurchaseAnalysisResponse" }
                            }
                        }
                    },
                    "400": { description: "userId is required" },
                    "404": { description: "User not found" }
                }
            }
        }
    },
    components: {
        schemas: {
            PurchaseAnalysisResponse: {
                type: "object",
                properties: {
                    userId: { type: "integer" },
                    userName: { type: "string" },
                    analysis: {
                        type: "object",
                        properties: {
                            totalOrders: { type: "integer" },
                            totalSpent: { type: "number" },
                            averageOrderValue: { type: "number" },
                            statusBreakdown: { type: "object" },
                            monthlySpending: { type: "array" }
                        }
                    },
                    topCategories: { type: "array" },
                    topProducts: { type: "array" },
                    filters: { type: "object" }
                }
            }
        }
    }
};