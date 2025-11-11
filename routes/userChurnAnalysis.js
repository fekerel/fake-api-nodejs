// Get user churn analysis and risk assessment
export default (app, router) => {
    const db = router.db;

    app.get('/users/:id/churn-analysis', (req, res) => {
        const userId = Number(req.params.id);

        if (!Number.isFinite(userId)) return res.status(400).json({ error: 'invalid id' });

        const user = db.get('users').find(u => Number(u.id) === userId).value();
        if (!user) return res.status(404).json({ error: 'user not found' });

        const orders = db.get('orders').filter(o => Number(o.userId) === userId).value() || [];
        const reviews = db.get('reviews').filter(r => Number(r.userId) === userId).value() || [];
        
        const orderDates = orders.map(o => o.createdAt).filter(d => d).sort((a, b) => a - b);
        const lastOrderDate = orderDates.length > 0 ? orderDates[orderDates.length - 1] : null;
        const firstOrderDate = orderDates.length > 0 ? orderDates[0] : null;
        
        const daysSinceLastOrder = lastOrderDate
            ? Math.ceil((Date.now() - lastOrderDate) / (1000 * 60 * 60 * 24))
            : 999;

        const totalOrders = orders.length;
        const totalSpent = orders.reduce((sum, o) => sum + (parseFloat(o.totalAmount) || 0), 0);
        const averageOrderValue = totalOrders > 0
            ? Number((totalSpent / totalOrders).toFixed(2))
            : 0;

        let churnRisk = 'low';
        let churnScore = 0;
        const riskFactors = [];

        if (totalOrders === 0) {
            churnRisk = 'very_high';
            churnScore = 90;
            riskFactors.push('no_orders');
        } else if (daysSinceLastOrder > 90) {
            churnRisk = 'high';
            churnScore = 70;
            riskFactors.push('inactive_90_days');
        } else if (daysSinceLastOrder > 60) {
            churnRisk = 'medium';
            churnScore = 50;
            riskFactors.push('inactive_60_days');
        } else if (daysSinceLastOrder > 30) {
            churnRisk = 'low';
            churnScore = 30;
            riskFactors.push('inactive_30_days');
        }

        if (totalOrders === 1) {
            churnScore += 20;
            riskFactors.push('single_order');
        }

        if (reviews.length === 0 && totalOrders > 0) {
            churnScore += 10;
            riskFactors.push('no_reviews');
        }

        if (averageOrderValue < 50 && totalOrders > 0) {
            churnScore += 10;
            riskFactors.push('low_order_value');
        }

        if (churnScore >= 80) churnRisk = 'very_high';
        else if (churnScore >= 60) churnRisk = 'high';
        else if (churnScore >= 40) churnRisk = 'medium';
        else churnRisk = 'low';

        const orderFrequency = orderDates.length > 1 && firstOrderDate
            ? Number((Math.ceil((lastOrderDate - firstOrderDate) / (1000 * 60 * 60 * 24)) / (totalOrders - 1)).toFixed(2))
            : 0;

        res.json({
            userId,
            userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
            churnRisk,
            churnScore: Math.min(churnScore, 100),
            riskFactors,
            metrics: {
                totalOrders,
                totalSpent: Number(totalSpent.toFixed(2)),
                averageOrderValue,
                orderFrequency,
                daysSinceLastOrder,
                reviewCount: reviews.length
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
        "/users/{id}/churn-analysis": {
            get: {
                summary: "Get user churn analysis and risk assessment",
                parameters: [
                    { in: "path", name: "id", required: true, schema: { type: "integer" }, example: 1 }
                ],
                responses: {
                    "200": {
                        description: "User churn analysis",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/UserChurnAnalysis" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            userId: 1,
                                            userName: "John Doe",
                                            churnRisk: "low",
                                            churnScore: 30,
                                            riskFactors: ["inactive_30_days"],
                                            metrics: {
                                                totalOrders: 10,
                                                totalSpent: 1500.50,
                                                averageOrderValue: 150.05,
                                                orderFrequency: 12.5,
                                                daysSinceLastOrder: 15,
                                                reviewCount: 5
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
            UserChurnAnalysis: {
                type: "object",
                properties: {
                    userId: { type: "integer", example: 1 },
                    userName: { type: "string", example: "John Doe" },
                    churnRisk: { type: "string", enum: ["low", "medium", "high", "very_high"], example: "low" },
                    churnScore: { type: "integer", example: 30 },
                    riskFactors: {
                        type: "array",
                        items: { type: "string" },
                        example: ["inactive_30_days"]
                    },
                    metrics: {
                        type: "object",
                        properties: {
                            totalOrders: { type: "integer", example: 10 },
                            totalSpent: { type: "number", format: "float", example: 1500.50 },
                            averageOrderValue: { type: "number", format: "float", example: 150.05 },
                            orderFrequency: { type: "number", format: "float", example: 12.5 },
                            daysSinceLastOrder: { type: "integer", example: 15 },
                            reviewCount: { type: "integer", example: 5 }
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