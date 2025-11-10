// Get user engagement score
export default (app, router) => {
    const db = router.db;

    app.get('/users/:id/engagement-score', (req, res) => {
        const userId = Number(req.params.id);

        if (!Number.isFinite(userId)) return res.status(400).json({ error: 'invalid id' });

        const user = db.get('users').find(u => Number(u.id) === userId).value();
        if (!user) return res.status(404).json({ error: 'user not found' });

        const orders = db.get('orders').filter(o => Number(o.userId) === userId).value() || [];
        const reviews = db.get('reviews').filter(r => Number(r.userId) === userId).value() || [];

        const orderCount = orders.length;
        const reviewCount = reviews.length;
        const totalSpent = orders.reduce((sum, o) => sum + (parseFloat(o.totalAmount) || 0), 0);
        
        const orderDates = orders.map(o => o.createdAt).filter(d => d).sort((a, b) => a - b);
        const reviewDates = reviews.map(r => r.createdAt).filter(d => d).sort((a, b) => a - b);
        
        const firstOrderDate = orderDates.length > 0 ? orderDates[0] : null;
        const lastOrderDate = orderDates.length > 0 ? orderDates[orderDates.length - 1] : null;
        const firstReviewDate = reviewDates.length > 0 ? reviewDates[0] : null;
        const lastReviewDate = reviewDates.length > 0 ? reviewDates[reviewDates.length - 1] : null;

        const daysSinceFirstOrder = firstOrderDate 
            ? Math.ceil((Date.now() - firstOrderDate) / (1000 * 60 * 60 * 24))
            : 0;
        const daysSinceLastOrder = lastOrderDate
            ? Math.ceil((Date.now() - lastOrderDate) / (1000 * 60 * 60 * 24))
            : 999;

        const orderFrequency = daysSinceFirstOrder > 0 && orderCount > 0
            ? Number((orderCount / daysSinceFirstOrder * 30).toFixed(2))
            : 0;

        const averageOrderValue = orderCount > 0
            ? Number((totalSpent / orderCount).toFixed(2))
            : 0;

        const averageRating = reviewCount > 0
            ? Number((reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / reviewCount).toFixed(2))
            : 0;

        let engagementScore = 0;
        let scoreBreakdown = {
            orderActivity: 0,
            spending: 0,
            reviewActivity: 0,
            recency: 0
        };

        if (orderCount > 0) {
            scoreBreakdown.orderActivity = Math.min(orderCount * 10, 40);
            scoreBreakdown.spending = Math.min(Math.floor(totalSpent / 100) * 5, 30);
            scoreBreakdown.reviewActivity = Math.min(reviewCount * 5, 20);
            
            if (daysSinceLastOrder <= 7) scoreBreakdown.recency = 10;
            else if (daysSinceLastOrder <= 30) scoreBreakdown.recency = 7;
            else if (daysSinceLastOrder <= 90) scoreBreakdown.recency = 5;
            else if (daysSinceLastOrder <= 180) scoreBreakdown.recency = 3;
            else scoreBreakdown.recency = 0;
        }

        engagementScore = Object.values(scoreBreakdown).reduce((a, b) => a + b, 0);

        const engagementLevel = engagementScore >= 80 ? 'high' 
            : engagementScore >= 50 ? 'medium' 
            : engagementScore >= 20 ? 'low' 
            : 'inactive';

        res.json({
            userId,
            userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
            engagementScore,
            engagementLevel,
            scoreBreakdown,
            metrics: {
                orderCount,
                totalSpent: Number(totalSpent.toFixed(2)),
                averageOrderValue,
                orderFrequency,
                reviewCount,
                averageRating,
                daysSinceFirstOrder,
                daysSinceLastOrder
            },
            activity: {
                firstOrderDate,
                lastOrderDate,
                firstReviewDate,
                lastReviewDate
            }
        });
    });
};

export const openapi = {
    paths: {
        "/users/{id}/engagement-score": {
            get: {
                summary: "Get user engagement score",
                parameters: [
                    { in: "path", name: "id", required: true, schema: { type: "integer" }, example: 1 }
                ],
                responses: {
                    "200": {
                        description: "User engagement score",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/UserEngagementScore" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            userId: 1,
                                            userName: "John Doe",
                                            engagementScore: 75,
                                            engagementLevel: "high",
                                            scoreBreakdown: {
                                                orderActivity: 40,
                                                spending: 25,
                                                reviewActivity: 15,
                                                recency: 10
                                            },
                                            metrics: {
                                                orderCount: 10,
                                                totalSpent: 1500.50,
                                                averageOrderValue: 150.05,
                                                orderFrequency: 2.5,
                                                reviewCount: 5,
                                                averageRating: 4.5,
                                                daysSinceFirstOrder: 120,
                                                daysSinceLastOrder: 5
                                            },
                                            activity: {
                                                firstOrderDate: 1735689600000,
                                                lastOrderDate: 1738368000000,
                                                firstReviewDate: 1735776000000,
                                                lastReviewDate: 1738281600000
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
            UserEngagementScore: {
                type: "object",
                properties: {
                    userId: { type: "integer", example: 1 },
                    userName: { type: "string", example: "John Doe" },
                    engagementScore: { type: "integer", example: 75 },
                    engagementLevel: { type: "string", enum: ["inactive", "low", "medium", "high"], example: "high" },
                    scoreBreakdown: {
                        type: "object",
                        properties: {
                            orderActivity: { type: "integer", example: 40 },
                            spending: { type: "integer", example: 25 },
                            reviewActivity: { type: "integer", example: 15 },
                            recency: { type: "integer", example: 10 }
                        }
                    },
                    metrics: {
                        type: "object",
                        properties: {
                            orderCount: { type: "integer", example: 10 },
                            totalSpent: { type: "number", format: "float", example: 1500.50 },
                            averageOrderValue: { type: "number", format: "float", example: 150.05 },
                            orderFrequency: { type: "number", format: "float", example: 2.5 },
                            reviewCount: { type: "integer", example: 5 },
                            averageRating: { type: "number", format: "float", example: 4.5 },
                            daysSinceFirstOrder: { type: "integer", example: 120 },
                            daysSinceLastOrder: { type: "integer", example: 5 }
                        }
                    },
                    activity: {
                        type: "object",
                        properties: {
                            firstOrderDate: { type: "integer", format: "int64", nullable: true, example: 1735689600000 },
                            lastOrderDate: { type: "integer", format: "int64", nullable: true, example: 1738368000000 },
                            firstReviewDate: { type: "integer", format: "int64", nullable: true, example: 1735776000000 },
                            lastReviewDate: { type: "integer", format: "int64", nullable: true, example: 1738281600000 }
                        }
                    }
                }
            }
        }
    }
};