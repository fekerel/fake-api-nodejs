// Search orders by orderId, userId, or status
export default (app, router) => {
    const db = router.db;

    app.post('/orders/search', (req, res) => {
        const { orderId, userId, status } = req.body || {};

        if (!orderId && !userId && !status) {
            return res.status(400).json({ error: 'At least one search field is required' });
        }

        let orders = db.get('orders').value() || [];

        if (orderId !== undefined && orderId !== null) {
            orders = orders.filter(o => Number(o.id) === Number(orderId));
        }

        if (userId !== undefined && userId !== null) {
            orders = orders.filter(o => Number(o.userId) === Number(userId));
        }

        if (status) {
            orders = orders.filter(o => o.status && o.status.toLowerCase() === status.toLowerCase());
        }

        if (orders.length === 0) {
            return res.status(404).json({ error: 'No orders found' });
        }

        // orderId is unique, so if orderId is provided and found, return single object
        if (orderId !== undefined && orderId !== null && orders.length === 1) {
            return res.json(orders[0]);
        }

        // Otherwise return array
        res.json(orders);
    });
};

export const openapi = {
    paths: {
        "/orders/search": {
            post: {
                summary: "Search orders by orderId, userId, or status",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    orderId: { type: "integer", nullable: true, example: 1 },
                                    userId: { type: "integer", nullable: true, example: 5 },
                                    status: { type: "string", nullable: true, example: "completed" }
                                }
                            },
                            examples: {
                                "byOrderId": {
                                    summary: "Search by orderId (returns object)",
                                    value: { orderId: 1 }
                                },
                                "byUserId": {
                                    summary: "Search by userId (returns array)",
                                    value: { userId: 5 }
                                },
                                "byStatus": {
                                    summary: "Search by status (returns array)",
                                    value: { status: "completed" }
                                }
                            }
                        }
                    }
                },
                responses: {
                    "200": {
                        description: "Order(s) found",
                        content: {
                            "application/json": {
                                schema: {
                                    oneOf: [
                                        { $ref: "#/components/schemas/Order" },
                                        {
                                            type: "array",
                                            items: { $ref: "#/components/schemas/Order" }
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "400": { description: "At least one search field is required" },
                    "404": { description: "No orders found" }
                }
            }
        }
    },
    components: {
        schemas: {
            Order: {
                type: "object",
                properties: {
                    id: { type: "integer" },
                    userId: { type: "integer" },
                    status: { type: "string" },
                    totalAmount: { type: "number" },
                    items: { type: "array" }
                }
            }
        }
    }
};