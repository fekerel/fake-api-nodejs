// Get user payment methods summary and preferences
export default (app, router) => {
    const db = router.db;

    app.get('/users/:id/payment-methods-summary', (req, res) => {
        const userId = Number(req.params.id);

        if (!Number.isFinite(userId)) return res.status(400).json({ error: 'invalid id' });

        const user = db.get('users').find(u => Number(u.id) === userId).value();
        if (!user) return res.status(404).json({ error: 'user not found' });

        const orders = db.get('orders').filter(o => Number(o.userId) === userId).value() || [];
        
        const paymentMethods = {
            credit_card: { count: 0, totalAmount: 0, averageAmount: 0 },
            paypal: { count: 0, totalAmount: 0, averageAmount: 0 },
            bank_transfer: { count: 0, totalAmount: 0, averageAmount: 0 }
        };

        let totalOrders = 0;
        let totalAmount = 0;

        orders.forEach(order => {
            if (order.payment && order.payment.method) {
                const method = order.payment.method;
                const amount = parseFloat(order.totalAmount) || 0;
                
                if (paymentMethods[method]) {
                    paymentMethods[method].count++;
                    paymentMethods[method].totalAmount += amount;
                }
                
                totalOrders++;
                totalAmount += amount;
            }
        });

        Object.keys(paymentMethods).forEach(method => {
            if (paymentMethods[method].count > 0) {
                paymentMethods[method].averageAmount = Number((paymentMethods[method].totalAmount / paymentMethods[method].count).toFixed(2));
            }
        });

        const preferredMethod = Object.keys(paymentMethods)
            .reduce((a, b) => paymentMethods[a].count > paymentMethods[b].count ? a : b, 'credit_card');

        res.json({
            userId,
            userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
            totalOrders,
            totalAmount: Number(totalAmount.toFixed(2)),
            preferredMethod,
            paymentMethods: {
                credit_card: {
                    usageCount: paymentMethods.credit_card.count,
                    totalSpent: Number(paymentMethods.credit_card.totalAmount.toFixed(2)),
                    averageOrderValue: paymentMethods.credit_card.averageAmount,
                    usagePercentage: totalOrders > 0 ? Number(((paymentMethods.credit_card.count / totalOrders) * 100).toFixed(2)) : 0
                },
                paypal: {
                    usageCount: paymentMethods.paypal.count,
                    totalSpent: Number(paymentMethods.paypal.totalAmount.toFixed(2)),
                    averageOrderValue: paymentMethods.paypal.averageAmount,
                    usagePercentage: totalOrders > 0 ? Number(((paymentMethods.paypal.count / totalOrders) * 100).toFixed(2)) : 0
                },
                bank_transfer: {
                    usageCount: paymentMethods.bank_transfer.count,
                    totalSpent: Number(paymentMethods.bank_transfer.totalAmount.toFixed(2)),
                    averageOrderValue: paymentMethods.bank_transfer.averageAmount,
                    usagePercentage: totalOrders > 0 ? Number(((paymentMethods.bank_transfer.count / totalOrders) * 100).toFixed(2)) : 0
                }
            }
        });
    });
};

export const openapi = {
    paths: {
        "/users/{id}/payment-methods-summary": {
            get: {
                summary: "Get user payment methods summary and preferences",
                parameters: [
                    { in: "path", name: "id", required: true, schema: { type: "integer" }, example: 1 }
                ],
                responses: {
                    "200": {
                        description: "User payment methods summary",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/UserPaymentMethodsSummary" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            userId: 1,
                                            userName: "John Doe",
                                            totalOrders: 10,
                                            totalAmount: 1500.50,
                                            preferredMethod: "credit_card",
                                            paymentMethods: {
                                                credit_card: {
                                                    usageCount: 7,
                                                    totalSpent: 1050.35,
                                                    averageOrderValue: 150.05,
                                                    usagePercentage: 70.00
                                                },
                                                paypal: {
                                                    usageCount: 2,
                                                    totalSpent: 300.15,
                                                    averageOrderValue: 150.08,
                                                    usagePercentage: 20.00
                                                },
                                                bank_transfer: {
                                                    usageCount: 1,
                                                    totalSpent: 150.00,
                                                    averageOrderValue: 150.00,
                                                    usagePercentage: 10.00
                                                }
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
            UserPaymentMethodsSummary: {
                type: "object",
                properties: {
                    userId: { type: "integer", example: 1 },
                    userName: { type: "string", example: "John Doe" },
                    totalOrders: { type: "integer", example: 10 },
                    totalAmount: { type: "number", format: "float", example: 1500.50 },
                    preferredMethod: { type: "string", enum: ["credit_card", "paypal", "bank_transfer"], example: "credit_card" },
                    paymentMethods: {
                        type: "object",
                        properties: {
                            credit_card: {
                                type: "object",
                                properties: {
                                    usageCount: { type: "integer", example: 7 },
                                    totalSpent: { type: "number", format: "float", example: 1050.35 },
                                    averageOrderValue: { type: "number", format: "float", example: 150.05 },
                                    usagePercentage: { type: "number", format: "float", example: 70.00 }
                                }
                            },
                            paypal: {
                                type: "object",
                                properties: {
                                    usageCount: { type: "integer", example: 2 },
                                    totalSpent: { type: "number", format: "float", example: 300.15 },
                                    averageOrderValue: { type: "number", format: "float", example: 150.08 },
                                    usagePercentage: { type: "number", format: "float", example: 20.00 }
                                }
                            },
                            bank_transfer: {
                                type: "object",
                                properties: {
                                    usageCount: { type: "integer", example: 1 },
                                    totalSpent: { type: "number", format: "float", example: 150.00 },
                                    averageOrderValue: { type: "number", format: "float", example: 150.00 },
                                    usagePercentage: { type: "number", format: "float", example: 10.00 }
                                }
                            }
                        }
                    }
                }
            }
        }
    }
};