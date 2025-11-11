// Get user return rate and repeat purchase analysis
export default (app, router) => {
    const db = router.db;

    app.get('/users/:id/return-rate', (req, res) => {
        const userId = Number(req.params.id);

        if (!Number.isFinite(userId)) return res.status(400).json({ error: 'invalid id' });

        const user = db.get('users').find(u => Number(u.id) === userId).value();
        if (!user) return res.status(404).json({ error: 'user not found' });

        const orders = db.get('orders').filter(o => Number(o.userId) === userId).value() || [];
        
        const orderDates = orders.map(o => o.createdAt).filter(d => d).sort((a, b) => a - b);
        const firstOrderDate = orderDates.length > 0 ? orderDates[0] : null;
        const lastOrderDate = orderDates.length > 0 ? orderDates[orderDates.length - 1] : null;
        
        const daysSinceFirstOrder = firstOrderDate
            ? Math.ceil((Date.now() - firstOrderDate) / (1000 * 60 * 60 * 24))
            : 0;
        const daysSinceLastOrder = lastOrderDate
            ? Math.ceil((Date.now() - lastOrderDate) / (1000 * 60 * 60 * 24))
            : 999;

        const totalOrders = orders.length;
        const totalSpent = orders.reduce((sum, o) => sum + (parseFloat(o.totalAmount) || 0), 0);
        const averageOrderValue = totalOrders > 0
            ? Number((totalSpent / totalOrders).toFixed(2))
            : 0;

        const orderFrequency = daysSinceFirstOrder > 0 && totalOrders > 1
            ? Number((daysSinceFirstOrder / (totalOrders - 1)).toFixed(2))
            : 0;

        let returnRate = 0;
        if (totalOrders > 1) {
            const timeBetweenOrders = [];
            for (let i = 1; i < orderDates.length; i++) {
                timeBetweenOrders.push(orderDates[i] - orderDates[i - 1]);
            }
            const averageTimeBetweenOrders = timeBetweenOrders.length > 0
                ? timeBetweenOrders.reduce((a, b) => a + b, 0) / timeBetweenOrders.length
                : 0;
            
            const expectedNextOrder = lastOrderDate + averageTimeBetweenOrders;
            const daysUntilExpected = Math.ceil((expectedNextOrder - Date.now()) / (1000 * 60 * 60 * 24));
            
            if (daysSinceLastOrder <= averageTimeBetweenOrders / (1000 * 60 * 60 * 24)) {
                returnRate = 100;
            } else {
                returnRate = Math.max(0, 100 - (daysSinceLastOrder / (averageTimeBetweenOrders / (1000 * 60 * 60 * 24))) * 100);
            }
        } else if (totalOrders === 1) {
            returnRate = daysSinceLastOrder <= 30 ? 50 : 0;
        }

        const returnRateLevel = returnRate >= 80 ? 'very_high'
            : returnRate >= 60 ? 'high'
            : returnRate >= 40 ? 'medium'
            : returnRate >= 20 ? 'low'
            : 'very_low';

        const orderIntervals = [];
        for (let i = 1; i < orderDates.length; i++) {
            const interval = Math.ceil((orderDates[i] - orderDates[i - 1]) / (1000 * 60 * 60 * 24));
            orderIntervals.push(interval);
        }

        const averageOrderInterval = orderIntervals.length > 0
            ? Number((orderIntervals.reduce((a, b) => a + b, 0) / orderIntervals.length).toFixed(2))
            : 0;

        res.json({
            userId,
            userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
            returnRate: Number(returnRate.toFixed(2)),
            returnRateLevel,
            metrics: {
                totalOrders,
                totalSpent: Number(totalSpent.toFixed(2)),
                averageOrderValue,
                orderFrequency,
                averageOrderInterval,
                daysSinceFirstOrder,
                daysSinceLastOrder
            },
            activity: {
                firstOrderDate,
                lastOrderDate,
                isActive: daysSinceLastOrder <= 30
            }
        });
    });
};

export const openapi = {
    paths: {
        "/users/{id}/return-rate": {
            get: {
                summary: "Get user return rate and repeat purchase analysis",
                parameters: [
                    { in: "path", name: "id", required: true, schema: { type: "integer" }, example: 1 }
                ],
                responses: {
                    "200": {
                        description: "User return rate",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/UserReturnRate" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            userId: 1,
                                            userName: "John Doe",
                                            returnRate: 75.50,
                                            returnRateLevel: "high",
                                            metrics: {
                                                totalOrders: 10,
                                                totalSpent: 1500.50,
                                                averageOrderValue: 150.05,
                                                orderFrequency: 12.5,
                                                averageOrderInterval: 30.5,
                                                daysSinceFirstOrder: 120,
                                                daysSinceLastOrder: 15
                                            },
                                            activity: {
                                                firstOrderDate: 1735689600000,
                                                lastOrderDate: 1738368000000,
                                                isActive: true
                                            }
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
            UserReturnRate: {
                type: "object",
                properties: {
                    userId: { type: "integer", example: 1 },
                    userName: { type: "string", example: "John Doe" },
                    returnRate: { type: "number", format: "float", example: 75.50 },
                    returnRateLevel: { type: "string", enum: ["very_low", "low", "medium", "high", "very_high"], example: "high" },
                    metrics: {
                        type: "object",
                        properties: {
                            totalOrders: { type: "integer", example: 10 },
                            totalSpent: { type: "number", format: "float", example: 1500.50 },
                            averageOrderValue: { type: "number", format: "float", example: 150.05 },
                            orderFrequency: { type: "number", format: "float", example: 12.5 },
                            averageOrderInterval: { type: "number", format: "float", example: 30.5 },
                            daysSinceFirstOrder: { type: "integer", example: 120 },
                            daysSinceLastOrder: { type: "integer", example: 15 }
                        }
                    },
                    activity: {
                        type: "object",
                        properties: {
                            firstOrderDate: { type: "integer", format: "int64", nullable: true, example: 1735689600000 },
                            lastOrderDate: { type: "integer", format: "int64", nullable: true, example: 1738368000000 },
                            isActive: { type: "boolean", example: true }
                        }
                    }
                }
            }
        }
    }
};