// Get recent orders list with pagination support, sorted by creation date
export default (app, router) => {
    const db = router.db;

    app.get('/orders/recent', (req, res) => {
        const limit = Number(req.query.limit) || 10;
        const offset = Number(req.query.offset) || 0;
        
        const allOrders = db.get('orders').value() || [];
        
        // Sort by createdAt descending (most recent first)
        const sortedOrders = allOrders.sort((a, b) => {
            const timeA = a.createdAt || 0;
            const timeB = b.createdAt || 0;
            return timeB - timeA;
        });
        
        const paginatedOrders = sortedOrders.slice(offset, offset + limit);
        
        const ordersWithUsers = paginatedOrders.map(order => {
            const user = db.get('users').find(u => Number(u.id) === Number(order.userId)).value();
            
            return {
                orderId: order.id,
                userId: order.userId,
                userName: user ? `${user.firstName} ${user.lastName}` : 'Unknown',
                totalAmount: parseFloat(order.totalAmount) || 0,
                status: order.status,
                paymentMethod: order.payment?.method || null,
                itemsCount: order.items?.length || 0,
                createdAt: order.createdAt || null
            };
        });
        
        res.json({
            totalOrders: allOrders.length,
            limit,
            offset,
            orders: ordersWithUsers
        });
    });
};

export const openapi = {
    paths: {
        "/orders/recent": {
            get: {
                summary: "Get recent orders list",
                parameters: [
                    { in: "query", name: "limit", schema: { type: "integer" }, description: "Number of orders to return", example: 10 },
                    { in: "query", name: "offset", schema: { type: "integer" }, description: "Number of orders to skip", example: 0 }
                ],
                responses: {
                    "200": {
                        description: "Recent orders list",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/RecentOrders" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            totalOrders: 50,
                                            limit: 10,
                                            offset: 0,
                                            orders: [
                                                { orderId: 50, userId: 1, userName: "John Doe", totalAmount: 99.99, status: "delivered", paymentMethod: "credit_card", itemsCount: 2, createdAt: 1762406642107 }
                                            ]
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    },
    components: {
        schemas: {
            RecentOrders: {
                type: "object",
                properties: {
                    totalOrders: { type: "integer", example: 50 },
                    limit: { type: "integer", example: 10 },
                    offset: { type: "integer", example: 0 },
                    orders: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                orderId: { type: "integer", example: 50 },
                                userId: { type: "integer", example: 1 },
                                userName: { type: "string", example: "John Doe" },
                                totalAmount: { type: "number", format: "float", example: 99.99 },
                                status: { type: "string", example: "delivered" },
                                paymentMethod: { type: "string", nullable: true, example: "credit_card" },
                                itemsCount: { type: "integer", example: 2 },
                                createdAt: { type: "integer", nullable: true, example: 1762406642107 }
                            }
                        }
                    }
                }
            }
        }
    }
};