// Search products by productId, name, or categoryId
export default (app, router) => {
    const db = router.db;

    app.post('/products/search', (req, res) => {
        const { productId, name, categoryId } = req.body || {};

        if (!productId && !name && !categoryId) {
            return res.status(400).json({ error: 'At least one search field is required' });
        }

        let products = db.get('products').value() || [];

        if (productId !== undefined && productId !== null) {
            products = products.filter(p => Number(p.id) === Number(productId));
        }

        if (name) {
            products = products.filter(p => p.name && p.name.toLowerCase().includes(name.toLowerCase()));
        }

        if (categoryId !== undefined && categoryId !== null) {
            products = products.filter(p => Number(p.categoryId) === Number(categoryId));
        }

        if (products.length === 0) {
            return res.status(404).json({ error: 'No products found' });
        }

        // productId is unique, so if productId is provided and found, return single object
        if (productId !== undefined && productId !== null && products.length === 1) {
            return res.json(products[0]);
        }

        // Otherwise return array
        res.json(products);
    });
};

export const openapi = {
    paths: {
        "/products/search": {
            post: {
                summary: "Search products by productId, name, or categoryId",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    productId: { type: "integer", nullable: true, example: 1 },
                                    name: { type: "string", nullable: true, example: "Product" },
                                    categoryId: { type: "integer", nullable: true, example: 5 }
                                }
                            },
                            examples: {
                                "byProductId": {
                                    summary: "Search by productId (returns object)",
                                    value: { productId: 1 }
                                },
                                "byName": {
                                    summary: "Search by name (returns array)",
                                    value: { name: "Product" }
                                },
                                "byCategoryId": {
                                    summary: "Search by categoryId (returns array)",
                                    value: { categoryId: 5 }
                                }
                            }
                        }
                    }
                },
                responses: {
                    "200": {
                        description: "Product(s) found",
                        content: {
                            "application/json": {
                                schema: {
                                    oneOf: [
                                        { $ref: "#/components/schemas/Product" },
                                        {
                                            type: "array",
                                            items: { $ref: "#/components/schemas/Product" }
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "400": { description: "At least one search field is required" },
                    "404": { description: "No products found" }
                }
            }
        }
    },
    components: {
        schemas: {
            Product: {
                type: "object",
                properties: {
                    id: { type: "integer" },
                    name: { type: "string" },
                    categoryId: { type: "integer" },
                    price: { type: "number" },
                    stock: { type: "integer" }
                }
            }
        }
    }
};