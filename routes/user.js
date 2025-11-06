export default (app, router) => {
    const db = router.db

    //Elle buraya yazılacak

    app.get('/users/:id/total-spent', (req, res) => {
        const userId = Number(req.params.id);
        if (!Number.isFinite(userId)) return res.status(400).json({ error: 'invalid id' });

        const user = db.get('users').find(u => Number(u.id) === userId).value();
        if (!user) return res.status(404).json({ error: 'user not found' });

        const orders = db.get('orders').filter({ userId }).value() || [];
        const total = orders.reduce((acc, o) => acc + (isNaN(parseFloat(o.totalAmount)) ? 0 : parseFloat(o.totalAmount)), 0);
        res.json({ userId, ordersCount: orders.length, total: Number(total.toFixed(2)) });
    });
};
//Sw
export const openapi = {
    paths: {
        "/users/{id}/total-spent": {
        get: {
            summary: "Return total spent by user",
            parameters: [
            { in: "path", name: "id", required: true, schema: { type: "integer" }, example: 12 }
            ],
            responses: {
            "200": {
                description: "User total spent",
                content: {
                "application/json": {
                    schema: { $ref: "#/components/schemas/UserTotalSpent" },
                    examples: {
                    "normal": {
                        summary: "Normal response",
                        value: { "userId": 12, "ordersCount": 3, "total": 1599.42 }
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
        UserTotalSpent: {
            type: "object",
            properties: {
            userId: { type: "integer", example: 12 },
            ordersCount: { type: "integer", example: 3 },
            total: { type: "number", format: "float", example: 1599.42 }
            }
        }
        }
    }
};