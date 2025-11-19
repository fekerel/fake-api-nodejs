// Flexible product search with alternative case scenarios
// Supports: name, categoryId, sellerId, priceMin, priceMax, stockMin
// - Only name: returns array of all products with that name (partial match)
// - name + categoryId: returns array of products matching both
// - sellerId: returns array of all products by that seller
// - priceMin + priceMax: returns array of products in price range
// - categoryId + priceMin + priceMax: returns array filtered by category and price
export default (app, router) => {
    const db = router.db;

    app.post('/products/flexible-search', (req, res) => {
        const { name, categoryId, sellerId, priceMin, priceMax, stockMin } = req.body || {};

        // At least one field must be provided
        if (!name && categoryId === undefined && sellerId === undefined && 
            priceMin === undefined && priceMax === undefined && stockMin === undefined) {
            return res.status(400).json({ 
                error: 'At least one search field is required (name, categoryId, sellerId, priceMin, priceMax, or stockMin)' 
            });
        }

        let products = db.get('products').value() || [];

        // Case 1: Only name provided - partial match, returns array
        if (name && categoryId === undefined && sellerId === undefined && 
            priceMin === undefined && priceMax === undefined && stockMin === undefined) {
            products = products.filter(p => 
                p.name && p.name.toLowerCase().includes(name.toLowerCase())
            );
            if (products.length === 0) {
                return res.status(404).json({ error: 'No products found with provided name' });
            }
            return res.json(products); // Array
        }

        // Case 2: name + categoryId combination
        if (name && categoryId !== undefined) {
            products = products.filter(p => 
                p.name && p.name.toLowerCase().includes(name.toLowerCase()) &&
                Number(p.categoryId) === Number(categoryId)
            );
            if (products.length === 0) {
                return res.status(404).json({ error: 'No products found with provided name and categoryId' });
            }
            return res.json(products); // Array
        }

        // Case 3: Only sellerId - returns all products by that seller
        if (sellerId !== undefined && !name && categoryId === undefined && 
            priceMin === undefined && priceMax === undefined && stockMin === undefined) {
            products = products.filter(p => Number(p.sellerId) === Number(sellerId));
            if (products.length === 0) {
                return res.status(404).json({ error: 'No products found for provided sellerId' });
            }
            return res.json(products); // Array
        }

        // Case 4: priceMin + priceMax (price range)
        if ((priceMin !== undefined || priceMax !== undefined) && 
            !name && categoryId === undefined && sellerId === undefined && stockMin === undefined) {
            products = products.filter(p => {
                const price = parseFloat(p.price) || 0;
                const minOk = priceMin === undefined || price >= Number(priceMin);
                const maxOk = priceMax === undefined || price <= Number(priceMax);
                return minOk && maxOk;
            });
            if (products.length === 0) {
                return res.status(404).json({ error: 'No products found in provided price range' });
            }
            return res.json(products); // Array
        }

        // Case 5: categoryId + priceMin + priceMax
        if (categoryId !== undefined && (priceMin !== undefined || priceMax !== undefined) && 
            !name && sellerId === undefined && stockMin === undefined) {
            products = products.filter(p => {
                const matchesCategory = Number(p.categoryId) === Number(categoryId);
                const price = parseFloat(p.price) || 0;
                const minOk = priceMin === undefined || price >= Number(priceMin);
                const maxOk = priceMax === undefined || price <= Number(priceMax);
                return matchesCategory && minOk && maxOk;
            });
            if (products.length === 0) {
                return res.status(404).json({ error: 'No products found with provided categoryId and price range' });
            }
            return res.json(products); // Array
        }

        // Case 6: stockMin (minimum stock filter)
        if (stockMin !== undefined && !name && categoryId === undefined && 
            sellerId === undefined && priceMin === undefined && priceMax === undefined) {
            products = products.filter(p => {
                const stock = parseInt(p.stock) || 0;
                return stock >= Number(stockMin);
            });
            if (products.length === 0) {
                return res.status(404).json({ error: 'No products found with minimum stock' });
            }
            return res.json(products); // Array
        }

        // Case 7: Complex combinations (sellerId + categoryId, etc.)
        if (sellerId !== undefined || categoryId !== undefined || name || 
            priceMin !== undefined || priceMax !== undefined || stockMin !== undefined) {
            
            if (name) {
                products = products.filter(p => 
                    p.name && p.name.toLowerCase().includes(name.toLowerCase())
                );
            }
            if (categoryId !== undefined) {
                products = products.filter(p => Number(p.categoryId) === Number(categoryId));
            }
            if (sellerId !== undefined) {
                products = products.filter(p => Number(p.sellerId) === Number(sellerId));
            }
            if (priceMin !== undefined || priceMax !== undefined) {
                products = products.filter(p => {
                    const price = parseFloat(p.price) || 0;
                    const minOk = priceMin === undefined || price >= Number(priceMin);
                    const maxOk = priceMax === undefined || price <= Number(priceMax);
                    return minOk && maxOk;
                });
            }
            if (stockMin !== undefined) {
                products = products.filter(p => {
                    const stock = parseInt(p.stock) || 0;
                    return stock >= Number(stockMin);
                });
            }

            if (products.length === 0) {
                return res.status(404).json({ error: 'No products found with provided criteria' });
            }
            return res.json(products); // Array
        }

        res.status(400).json({ error: 'Invalid search combination' });
    });
};

export const openapi = {
    paths: {
        "/products/flexible-search": {
            post: {
                isSelect:true,
                summary: "Flexible product search with alternative case scenarios",
                description: `
                    Search products with different behaviors based on provided fields:
                    - Only name: returns array of all products with that name (partial match)
                    - name + categoryId: returns array of products matching both
                    - sellerId: returns array of all products by that seller
                    - priceMin + priceMax: returns array of products in price range
                    - categoryId + priceMin + priceMax: returns array filtered by category and price
                    - stockMin: returns array of products with minimum stock
                    - Complex combinations: returns array filtered by all provided criteria
                `,
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    name: { type: "string", nullable: true, example: "Product" },
                                    categoryId: { type: "integer", nullable: true, example: 5 },
                                    sellerId: { type: "integer", nullable: true, example: 10 },
                                    priceMin: { type: "number", nullable: true, example: 10.0 },
                                    priceMax: { type: "number", nullable: true, example: 100.0 },
                                    stockMin: { type: "integer", nullable: true, example: 5 }
                                }
                            },
                            examples: {
                                "byNameOnly": {
                                    summary: "Search by name only (returns array)",
                                    value: { name: "Product" }
                                },
                                "byNameAndCategory": {
                                    summary: "Search by name and categoryId (returns array)",
                                    value: { name: "Product", categoryId: 5 }
                                },
                                "bySellerId": {
                                    summary: "Search by sellerId (returns array)",
                                    value: { sellerId: 10 }
                                },
                                "byPriceRange": {
                                    summary: "Search by price range (returns array)",
                                    value: { priceMin: 10.0, priceMax: 100.0 }
                                },
                                "byCategoryAndPrice": {
                                    summary: "Search by categoryId and price range (returns array)",
                                    value: { categoryId: 5, priceMin: 10.0, priceMax: 100.0 }
                                },
                                "byStockMin": {
                                    summary: "Search by minimum stock (returns array)",
                                    value: { stockMin: 5 }
                                },
                                "complex": {
                                    summary: "Complex search with multiple criteria (returns array)",
                                    value: { name: "Product", categoryId: 5, priceMin: 10.0, priceMax: 100.0 }
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
                                    type: "array",
                                    items: { $ref: "#/components/schemas/Product" }
                                },
                                examples: {
                                    "products": {
                                        summary: "Array of products",
                                        value: [
                                            {
                                                id: 1,
                                                name: "Product Name",
                                                categoryId: 5,
                                                sellerId: 10,
                                                price: 25.99,
                                                stock: 100,
                                                status: "active"
                                            },
                                            {
                                                id: 2,
                                                name: "Another Product",
                                                categoryId: 5,
                                                sellerId: 10,
                                                price: 45.50,
                                                stock: 50,
                                                status: "active"
                                            }
                                        ]
                                    }
                                }
                            }
                        }
                    },
                    "400": { description: "At least one search field is required or invalid combination" },
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
                    sellerId: { type: "integer" },
                    price: { type: "number" },
                    stock: { type: "integer" },
                    status: { type: "string" }
                }
            }
        }
    }
};

