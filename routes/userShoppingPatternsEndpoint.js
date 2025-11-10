// Get user shopping patterns and behavior analysis
export default (app, router) => {
    const db = router.db;

    app.get('/users/:id/shopping-patterns', (req, res) => {
        const userId = Number(req.params.id);

        if (!Number.isFinite(userId)) return res.status(400).json({ error: 'invalid id' });

        const user = db.get('users').find(u => Number(u.id) === userId).value();
        if (!user) return res.status(404).json({ error: 'user not found' });

        const orders = db.get('orders').filter(o => Number(o.userId) === userId).value() || [];
        const products = db.get('products').value() || [];
        const categories = db.get('categories').value() || [];

        const categoryFrequency = {};
        const timeOfDayFrequency = { morning: 0, afternoon: 0, evening: 0, night: 0 };
        const dayOfWeekFrequency = { monday: 0, tuesday: 0, wednesday: 0, thursday: 0, friday: 0, saturday: 0, sunday: 0 };
        const orderSizes = [];
        let totalSpent = 0;
        let averageOrderValue = 0;

        orders.forEach(order => {
            const orderDate = new Date(order.createdAt);
            const hour = orderDate.getHours();
            const dayOfWeek = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'][orderDate.getDay()];

            if (hour >= 6 && hour < 12) timeOfDayFrequency.morning++;
            else if (hour >= 12 && hour < 18) timeOfDayFrequency.afternoon++;
            else if (hour >= 18 && hour < 22) timeOfDayFrequency.evening++;
            else timeOfDayFrequency.night++;

            dayOfWeekFrequency[dayOfWeek]++;

            let orderItemCount = 0;
            if (order.items) {
                order.items.forEach(item => {
                    orderItemCount += Number(item.quantity) || 0;
                    
                    const product = products.find(p => Number(p.id) === Number(item.productId));
                    if (product) {
                        const categoryId = Number(product.categoryId);
                        const category = categories.find(c => Number(c.id) === categoryId);
                        
                        if (!categoryFrequency[categoryId]) {
                            categoryFrequency[categoryId] = {
                                categoryId,
                                categoryName: category ? category.name : 'Unknown',
                                purchaseCount: 0,
                                totalSpent: 0
                            };
                        }
                        
                        categoryFrequency[categoryId].purchaseCount++;
                        categoryFrequency[categoryId].totalSpent += (parseFloat(item.price) || 0) * (Number(item.quantity) || 0);
                    }
                });
            }

            orderSizes.push(orderItemCount);
            totalSpent += parseFloat(order.totalAmount) || 0;
        });

        averageOrderValue = orders.length > 0 ? Number((totalSpent / orders.length).toFixed(2)) : 0;

        const favoriteCategory = Object.values(categoryFrequency)
            .sort((a, b) => b.purchaseCount - a.purchaseCount)[0] || null;

        const preferredTimeOfDay = Object.keys(timeOfDayFrequency)
            .reduce((a, b) => timeOfDayFrequency[a] > timeOfDayFrequency[b] ? a : b, 'morning');

        const preferredDayOfWeek = Object.keys(dayOfWeekFrequency)
            .reduce((a, b) => dayOfWeekFrequency[a] > dayOfWeekFrequency[b] ? a : b, 'monday');

        const averageOrderSize = orderSizes.length > 0
            ? Number((orderSizes.reduce((a, b) => a + b, 0) / orderSizes.length).toFixed(2))
            : 0;

        res.json({
            userId,
            userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
            summary: {
                totalOrders: orders.length,
                totalSpent: Number(totalSpent.toFixed(2)),
                averageOrderValue,
                averageOrderSize
            },
            patterns: {
                preferredTimeOfDay,
                preferredDayOfWeek,
                timeOfDayDistribution: timeOfDayFrequency,
                dayOfWeekDistribution: dayOfWeekFrequency
            },
            categoryPreferences: Object.values(categoryFrequency)
                .map(cat => ({
                    ...cat,
                    totalSpent: Number(cat.totalSpent.toFixed(2))
                }))
                .sort((a, b) => b.purchaseCount - a.purchaseCount),
            favoriteCategory: favoriteCategory ? {
                ...favoriteCategory,
                totalSpent: Number(favoriteCategory.totalSpent.toFixed(2))
            } : null
        });
    });
};

export const openapi = {
    paths: {
        "/users/{id}/shopping-patterns": {
            get: {
                summary: "Get user shopping patterns and behavior analysis",
                parameters: [
                    { in: "path", name: "id", required: true, schema: { type: "integer" }, example: 1 }
                ],
                responses: {
                    "200": {
                        description: "User shopping patterns",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/UserShoppingPatterns" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            userId: 1,
                                            userName: "John Doe",
                                            summary: {
                                                totalOrders: 10,
                                                totalSpent: 1500.50,
                                                averageOrderValue: 150.05,
                                                averageOrderSize: 2.5
                                            },
                                            patterns: {
                                                preferredTimeOfDay: "evening",
                                                preferredDayOfWeek: "friday",
                                                timeOfDayDistribution: {
                                                    morning: 2,
                                                    afternoon: 3,
                                                    evening: 4,
                                                    night: 1
                                                },
                                                dayOfWeekDistribution: {
                                                    monday: 1,
                                                    tuesday: 1,
                                                    wednesday: 2,
                                                    thursday: 2,
                                                    friday: 3,
                                                    saturday: 1,
                                                    sunday: 0
                                                }
                                            },
                                            categoryPreferences: [
                                                {
                                                    categoryId: 1,
                                                    categoryName: "Category A",
                                                    purchaseCount: 5,
                                                    totalSpent: 750.25
                                                }
                                            ],
                                            favoriteCategory: {
                                                categoryId: 1,
                                                categoryName: "Category A",
                                                purchaseCount: 5,
                                                totalSpent: 750.25
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
            UserShoppingPatterns: {
                type: "object",
                properties: {
                    userId: { type: "integer", example: 1 },
                    userName: { type: "string", example: "John Doe" },
                    summary: {
                        type: "object",
                        properties: {
                            totalOrders: { type: "integer", example: 10 },
                            totalSpent: { type: "number", format: "float", example: 1500.50 },
                            averageOrderValue: { type: "number", format: "float", example: 150.05 },
                            averageOrderSize: { type: "number", format: "float", example: 2.5 }
                        }
                    },
                    patterns: {
                        type: "object",
                        properties: {
                            preferredTimeOfDay: { type: "string", enum: ["morning", "afternoon", "evening", "night"], example: "evening" },
                            preferredDayOfWeek: { type: "string", example: "friday" },
                            timeOfDayDistribution: {
                                type: "object",
                                properties: {
                                    morning: { type: "integer", example: 2 },
                                    afternoon: { type: "integer", example: 3 },
                                    evening: { type: "integer", example: 4 },
                                    night: { type: "integer", example: 1 }
                                }
                            },
                            dayOfWeekDistribution: {
                                type: "object",
                                properties: {
                                    monday: { type: "integer", example: 1 },
                                    tuesday: { type: "integer", example: 1 },
                                    wednesday: { type: "integer", example: 2 },
                                    thursday: { type: "integer", example: 2 },
                                    friday: { type: "integer", example: 3 },
                                    saturday: { type: "integer", example: 1 },
                                    sunday: { type: "integer", example: 0 }
                                }
                            }
                        }
                    },
                    categoryPreferences: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                categoryId: { type: "integer", example: 1 },
                                categoryName: { type: "string", example: "Category A" },
                                purchaseCount: { type: "integer", example: 5 },
                                totalSpent: { type: "number", format: "float", example: 750.25 }
                            }
                        }
                    },
                    favoriteCategory: {
                        type: "object",
                        nullable: true,
                        properties: {
                            categoryId: { type: "integer", example: 1 },
                            categoryName: { type: "string", example: "Category A" },
                            purchaseCount: { type: "integer", example: 5 },
                            totalSpent: { type: "number", format: "float", example: 750.25 }
                        }
                    }
                }
            }
        }
    }
};