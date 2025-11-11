// Search categories by categoryId, name, or status
export default (app, router) => {
    const db = router.db;

    app.post('/categories/search', (req, res) => {
        const { categoryId, name, status } = req.body || {};

        if (!categoryId && !name && !status) {
            return res.status(400).json({ error: 'At least one search field is required' });
        }

        let categories = db.get('categories').value() || [];

        if (categoryId !== undefined && categoryId !== null) {
            categories = categories.filter(c => Number(c.id) === Number(categoryId));
        }

        if (name) {
            categories = categories.filter(c => c.name && c.name.toLowerCase().includes(name.toLowerCase()));
        }

        if (status) {
            categories = categories.filter(c => c.status && c.status.toLowerCase() === status.toLowerCase());
        }

        if (categories.length === 0) {
            return res.status(404).json({ error: 'No categories found' });
        }

        // categoryId is unique, so if categoryId is provided and found, return single object
        if (categoryId !== undefined && categoryId !== null && categories.length === 1) {
            return res.json(categories[0]);
        }

        // Otherwise return array
        res.json(categories);
    });
};

export const openapi = {
    paths: {
        "/categories/search": {
            post: {
                summary: "Search categories by categoryId, name, or status",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    categoryId: { type: "integer", nullable: true, example: 1 },
                                    name: { type: "string", nullable: true, example: "Electronics" },
                                    status: { type: "string", nullable: true, example: "active" }
                                }
                            },
                            examples: {
                                "byCategoryId": {
                                    summary: "Search by categoryId (returns object)",
                                    value: { categoryId: 1 }
                                },
                                "byName": {
                                    summary: "Search by name (returns array)",
                                    value: { name: "Electronics" }
                                },
                                "byStatus": {
                                    summary: "Search by status (returns array)",
                                    value: { status: "active" }
                                }
                            }
                        }
                    }
                },
                responses: {
                    "200": {
                        description: "Category(ies) found",
                        content: {
                            "application/json": {
                                schema: {
                                    oneOf: [
                                        { $ref: "#/components/schemas/Category" },
                                        {
                                            type: "array",
                                            items: { $ref: "#/components/schemas/Category" }
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "400": { description: "At least one search field is required" },
                    "404": { description: "No categories found" }
                }
            }
        }
    },
    components: {
        schemas: {
            Category: {
                type: "object",
                properties: {
                    id: { type: "integer" },
                    name: { type: "string" },
                    status: { type: "string" },
                    description: { type: "string" }
                }
            }
        }
    }
};