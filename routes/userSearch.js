// Search users by email, firstName, or lastName
export default (app, router) => {
    const db = router.db;

    app.post('/users/search', (req, res) => {
        const { email, firstName, lastName } = req.body || {};

        if (!email && !firstName && !lastName) {
            return res.status(400).json({ error: 'At least one search field is required' });
        }

        let users = db.get('users').value() || [];

        if (email) {
            users = users.filter(u => u.email && u.email.toLowerCase() === email.toLowerCase());
        }

        if (firstName) {
            users = users.filter(u => u.firstName && u.firstName.toLowerCase().includes(firstName.toLowerCase()));
        }

        if (lastName) {
            users = users.filter(u => u.lastName && u.lastName.toLowerCase().includes(lastName.toLowerCase()));
        }

        if (users.length === 0) {
            return res.status(404).json({ error: 'No users found' });
        }

        // Email is unique, so if email is provided and found, return single object
        if (email && users.length === 1) {
            return res.json(users[0]);
        }

        // Otherwise return array
        res.json(users);
    });
};

export const openapi = {
    paths: {
        "/users/search": {
            post: {
                summary: "Search users by email, firstName, or lastName",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    email: { type: "string", example: "user@example.com" },
                                    firstName: { type: "string", example: "John" },
                                    lastName: { type: "string", example: "Doe" }
                                }
                            },
                            examples: {
                                "byEmail": {
                                    summary: "Search by email (returns object)",
                                    value: { email: "user@example.com" }
                                },
                                "byFirstName": {
                                    summary: "Search by first name (returns array)",
                                    value: { firstName: "John" }
                                },
                                "byMultiple": {
                                    summary: "Search by multiple fields",
                                    value: { firstName: "John", lastName: "Doe" }
                                }
                            }
                        }
                    }
                },
                responses: {
                    "200": {
                        description: "User(s) found",
                        content: {
                            "application/json": {
                                schema: {
                                    oneOf: [
                                        { $ref: "#/components/schemas/User" },
                                        {
                                            type: "array",
                                            items: { $ref: "#/components/schemas/User" }
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "400": { description: "At least one search field is required" },
                    "404": { description: "No users found" }
                }
            }
        }
    },
    components: {
        schemas: {
            User: {
                type: "object",
                properties: {
                    id: { type: "integer" },
                    email: { type: "string" },
                    firstName: { type: "string" },
                    lastName: { type: "string" },
                    role: { type: "string" }
                }
            }
        }
    }
};