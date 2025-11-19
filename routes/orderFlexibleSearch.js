// Flexible order search with alternative case scenarios
// Supports: orderId, userId, status, totalAmountMin, totalAmountMax, dateFrom, dateTo
// - orderId (unique): returns single order object
// - Only userId: returns array of all orders by that user
// - userId + status: returns array of orders matching both
// - status: returns array of all orders with that status
// - totalAmountMin + totalAmountMax: returns array of orders in amount range
// - dateFrom + dateTo: returns array of orders in date range
export default (app, router) => {
    const db = router.db;

    app.post('/orders/flexible-search', (req, res) => {
        const { orderId, userId, status, totalAmountMin, totalAmountMax, dateFrom, dateTo } = req.body || {};

        // At least one field must be provided
        if (orderId === undefined && userId === undefined && !status && 
            totalAmountMin === undefined && totalAmountMax === undefined && 
            dateFrom === undefined && dateTo === undefined) {
            return res.status(400).json({ 
                error: 'At least one search field is required (orderId, userId, status, totalAmountMin, totalAmountMax, dateFrom, or dateTo)' 
            });
        }

        let orders = db.get('orders').value() || [];

        // Case 1: orderId is unique, return single object if found
        if (orderId !== undefined && orderId !== null && 
            userId === undefined && !status && totalAmountMin === undefined && 
            totalAmountMax === undefined && dateFrom === undefined && dateTo === undefined) {
            const found = orders.find(o => Number(o.id) === Number(orderId));
            if (found) {
                return res.json(found); // Single object
            }
            return res.status(404).json({ error: 'Order not found with provided orderId' });
        }

        // Case 2: Only userId - returns all orders by that user
        if (userId !== undefined && orderId === undefined && !status && 
            totalAmountMin === undefined && totalAmountMax === undefined && 
            dateFrom === undefined && dateTo === undefined) {
            orders = orders.filter(o => Number(o.userId) === Number(userId));
            if (orders.length === 0) {
                return res.status(404).json({ error: 'No orders found for provided userId' });
            }
            return res.json(orders); // Array
        }

        // Case 3: userId + status combination
        if (userId !== undefined && status && orderId === undefined && 
            totalAmountMin === undefined && totalAmountMax === undefined && 
            dateFrom === undefined && dateTo === undefined) {
            orders = orders.filter(o => 
                Number(o.userId) === Number(userId) &&
                o.status && o.status.toLowerCase() === status.toLowerCase()
            );
            if (orders.length === 0) {
                return res.status(404).json({ error: 'No orders found with provided userId and status' });
            }
            return res.json(orders); // Array
        }

        // Case 4: Only status
        if (status && orderId === undefined && userId === undefined && 
            totalAmountMin === undefined && totalAmountMax === undefined && 
            dateFrom === undefined && dateTo === undefined) {
            orders = orders.filter(o => o.status && o.status.toLowerCase() === status.toLowerCase());
            if (orders.length === 0) {
                return res.status(404).json({ error: 'No orders found with provided status' });
            }
            return res.json(orders); // Array
        }

        // Case 5: totalAmountMin + totalAmountMax (amount range)
        if ((totalAmountMin !== undefined || totalAmountMax !== undefined) && 
            orderId === undefined && userId === undefined && !status && 
            dateFrom === undefined && dateTo === undefined) {
            orders = orders.filter(o => {
                const amount = parseFloat(o.totalAmount) || 0;
                const minOk = totalAmountMin === undefined || amount >= Number(totalAmountMin);
                const maxOk = totalAmountMax === undefined || amount <= Number(totalAmountMax);
                return minOk && maxOk;
            });
            if (orders.length === 0) {
                return res.status(404).json({ error: 'No orders found in provided amount range' });
            }
            return res.json(orders); // Array
        }

        // Case 6: dateFrom + dateTo (date range)
        if ((dateFrom !== undefined || dateTo !== undefined) && 
            orderId === undefined && userId === undefined && !status && 
            totalAmountMin === undefined && totalAmountMax === undefined) {
            orders = orders.filter(o => {
                const orderDate = parseInt(o.createdAt) || 0;
                const fromOk = dateFrom === undefined || orderDate >= Number(dateFrom);
                const toOk = dateTo === undefined || orderDate <= Number(dateTo);
                return fromOk && toOk;
            });
            if (orders.length === 0) {
                return res.status(404).json({ error: 'No orders found in provided date range' });
            }
            return res.json(orders); // Array
        }

        // Case 7: Complex combinations
        if (orderId !== undefined && orderId !== null) {
            // If orderId is provided with other fields, still return single object if found
            const found = orders.find(o => Number(o.id) === Number(orderId));
            if (found) {
                return res.json(found); // Single object
            }
            return res.status(404).json({ error: 'Order not found with provided orderId' });
        }

        // Apply all filters for complex combinations
        if (userId !== undefined) {
            orders = orders.filter(o => Number(o.userId) === Number(userId));
        }
        if (status) {
            orders = orders.filter(o => o.status && o.status.toLowerCase() === status.toLowerCase());
        }
        if (totalAmountMin !== undefined || totalAmountMax !== undefined) {
            orders = orders.filter(o => {
                const amount = parseFloat(o.totalAmount) || 0;
                const minOk = totalAmountMin === undefined || amount >= Number(totalAmountMin);
                const maxOk = totalAmountMax === undefined || amount <= Number(totalAmountMax);
                return minOk && maxOk;
            });
        }
        if (dateFrom !== undefined || dateTo !== undefined) {
            orders = orders.filter(o => {
                const orderDate = parseInt(o.createdAt) || 0;
                const fromOk = dateFrom === undefined || orderDate >= Number(dateFrom);
                const toOk = dateTo === undefined || orderDate <= Number(dateTo);
                return fromOk && toOk;
            });
        }

        if (orders.length === 0) {
            return res.status(404).json({ error: 'No orders found with provided criteria' });
        }
        return res.json(orders); // Array
    });
};

export const openapi = {
    paths: {
        "/orders/flexible-search": {
            post: {
                summary: "Flexible order search with alternative case scenarios",
                description: `
                    Search orders with different behaviors based on provided fields:
                    - orderId (unique): returns single order object
                    - Only userId: returns array of all orders by that user
                    - userId + status: returns array of orders matching both
                    - status: returns array of all orders with that status
                    - totalAmountMin + totalAmountMax: returns array of orders in amount range
                    - dateFrom + dateTo: returns array of orders in date range (timestamp)
                    - Complex combinations: returns array filtered by all provided criteria
                `,
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    orderId: { type: "integer", nullable: true, example: 1 },
                                    userId: { type: "integer", nullable: true, example: 5 },
                                    status: { type: "string", nullable: true, example: "delivered" },
                                    totalAmountMin: { type: "number", nullable: true, example: 10.0 },
                                    totalAmountMax: { type: "number", nullable: true, example: 500.0 },
                                    dateFrom: { type: "integer", nullable: true, example: 1609459200000, description: "Unix timestamp (ms)" },
                                    dateTo: { type: "integer", nullable: true, example: 1704067200000, description: "Unix timestamp (ms)" }
                                }
                            },
                            examples: {
                                "byOrderId": {
                                    summary: "Search by orderId (returns single object - unique)",
                                    value: { orderId: 1 }
                                },
                                "byUserIdOnly": {
                                    summary: "Search by userId only (returns array)",
                                    value: { userId: 5 }
                                },
                                "byUserIdAndStatus": {
                                    summary: "Search by userId and status (returns array)",
                                    value: { userId: 5, status: "delivered" }
                                },
                                "byStatus": {
                                    summary: "Search by status only (returns array)",
                                    value: { status: "delivered" }
                                },
                                "byAmountRange": {
                                    summary: "Search by amount range (returns array)",
                                    value: { totalAmountMin: 10.0, totalAmountMax: 500.0 }
                                },
                                "byDateRange": {
                                    summary: "Search by date range (returns array)",
                                    value: { dateFrom: 1609459200000, dateTo: 1704067200000 }
                                },
                                "complex": {
                                    summary: "Complex search with multiple criteria (returns array)",
                                    value: { 
                                        userId: 5, 
                                        status: "delivered", 
                                        totalAmountMin: 10.0, 
                                        totalAmountMax: 500.0 
                                    }
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
                                },
                                examples: {
                                    "singleOrder": {
                                        summary: "Single order (orderId search)",
                                        value: {
                                            id: 1,
                                            userId: 5,
                                            status: "delivered",
                                            totalAmount: 125.50,
                                            items: [],
                                            createdAt: 1609459200000
                                        }
                                    },
                                    "multipleOrders": {
                                        summary: "Array of orders (other searches)",
                                        value: [
                                            {
                                                id: 1,
                                                userId: 5,
                                                status: "delivered",
                                                totalAmount: 125.50,
                                                items: [],
                                                createdAt: 1609459200000
                                            },
                                            {
                                                id: 2,
                                                userId: 5,
                                                status: "delivered",
                                                totalAmount: 89.99,
                                                items: [],
                                                createdAt: 1609460000000
                                            }
                                        ]
                                    }
                                }
                            }
                        }
                    },
                    "400": { description: "At least one search field is required or invalid combination" },
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
                    items: { type: "array" },
                    createdAt: { type: "integer", format: "int64", description: "Unix timestamp (ms)" }
                }
            }
        }
    }
};

