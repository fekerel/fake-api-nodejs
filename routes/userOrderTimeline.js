// Get user order timeline grouped by date periods
export default (app, router) => {
    const db = router.db;

    app.get('/users/:id/order-timeline', (req, res) => {
        const userId = Number(req.params.id);
        const period = req.query.period || 'monthly'; // daily, weekly, monthly

        if (!Number.isFinite(userId)) return res.status(400).json({ error: 'invalid id' });

        const user = db.get('users').find(u => Number(u.id) === userId).value();
        if (!user) return res.status(404).json({ error: 'user not found' });

        const orders = db.get('orders').filter(o => Number(o.userId) === userId).value() || [];
        
        const timeline = {};
        orders.forEach(order => {
            const orderDate = new Date(order.createdAt);
            let key = '';
            
            if (period === 'daily') {
                key = orderDate.toISOString().split('T')[0];
            } else if (period === 'weekly') {
                const weekStart = new Date(orderDate);
                weekStart.setDate(orderDate.getDate() - orderDate.getDay());
                key = weekStart.toISOString().split('T')[0];
            } else { // monthly
                key = `${orderDate.getFullYear()}-${String(orderDate.getMonth() + 1).padStart(2, '0')}`;
            }

            if (!timeline[key]) {
                timeline[key] = {
                    period: key,
                    orderCount: 0,
                    totalAmount: 0,
                    orders: []
                };
            }

            timeline[key].orderCount++;
            timeline[key].totalAmount += parseFloat(order.totalAmount) || 0;
            timeline[key].orders.push({
                orderId: order.id,
                totalAmount: parseFloat(order.totalAmount) || 0,
                status: order.status,
                createdAt: order.createdAt
            });
        });

        const timelineArray = Object.values(timeline)
            .map(item => ({
                ...item,
                totalAmount: Number(item.totalAmount.toFixed(2))
            }))
            .sort((a, b) => new Date(a.period) - new Date(b.period));

        res.json({
            userId,
            userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
            period,
            totalPeriods: timelineArray.length,
            timeline: timelineArray
        });
    });
};

export const openapi = {
    paths: {
        "/users/{id}/order-timeline": {
            get: {
                summary: "Get user order timeline grouped by date periods",
                parameters: [
                    { in: "path", name: "id", required: true, schema: { type: "integer" }, example: 1 },
                    { in: "query", name: "period", schema: { type: "string", enum: ["daily", "weekly", "monthly"] }, description: "Grouping period", example: "monthly" }
                ],
                responses: {
                    "200": {
                        description: "User order timeline",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/UserOrderTimeline" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            userId: 1,
                                            userName: "John Doe",
                                            period: "monthly",
                                            totalPeriods: 3,
                                            timeline: [
                                                {
                                                    period: "2025-01",
                                                    orderCount: 5,
                                                    totalAmount: 450.50,
                                                    orders: [
                                                        { orderId: 1, totalAmount: 99.99, status: "delivered", createdAt: 1735689600000 }
                                                    ]
                                                }
                                            ]
                                        }
                                    }
                                }
                            }
                        }
                    },
                    "400": { description: "invalid id" },
                    "404": { description: "user not found" }
                }
            }
        }
    },
    components: {
        schemas: {
            UserOrderTimeline: {
                type: "object",
                properties: {
                    userId: { type: "integer", example: 1 },
                    userName: { type: "string", example: "John Doe" },
                    period: { type: "string", example: "monthly" },
                    totalPeriods: { type: "integer", example: 3 },
                    timeline: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                period: { type: "string", example: "2025-01" },
                                orderCount: { type: "integer", example: 5 },
                                totalAmount: { type: "number", format: "float", example: 450.50 },
                                orders: {
                                    type: "array",
                                    items: {
                                        type: "object",
                                        properties: {
                                            orderId: { type: "integer", example: 1 },
                                            totalAmount: { type: "number", format: "float", example: 99.99 },
                                            status: { type: "string", example: "delivered" },
                                            createdAt: { type: "integer", format: "int64", example: 1735689600000 }
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
};