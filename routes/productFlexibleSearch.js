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
        // Validate request body exists
        if (!req.body || typeof req.body !== 'object') {
            return res.status(400).json({ 
                error: 'Request body is required and must be a JSON object',
                code: 'INVALID_REQUEST_BODY'
            });
        }

        const { name, categoryId, sellerId, priceMin, priceMax, stockMin } = req.body;

        // Validate at least one field is provided
        if (!name && categoryId === undefined && sellerId === undefined && 
            priceMin === undefined && priceMax === undefined && stockMin === undefined) {
            return res.status(400).json({ 
                error: 'At least one search field is required (name, categoryId, sellerId, priceMin, priceMax, or stockMin)',
                code: 'MISSING_SEARCH_FIELDS',
                fields: ['name', 'categoryId', 'sellerId', 'priceMin', 'priceMax', 'stockMin']
            });
        }

        // Validate data types
        if (name !== undefined && typeof name !== 'string') {
            return res.status(422).json({ 
                error: 'name must be a string',
                code: 'INVALID_FIELD_TYPE',
                field: 'name',
                expectedType: 'string',
                receivedType: typeof name
            });
        }

        if (categoryId !== undefined && (typeof categoryId !== 'number' || !Number.isInteger(categoryId) || categoryId < 1)) {
            return res.status(422).json({ 
                error: 'categoryId must be a positive integer',
                code: 'INVALID_FIELD_TYPE',
                field: 'categoryId',
                expectedType: 'integer (>= 1)',
                receivedType: typeof categoryId,
                value: categoryId
            });
        }

        if (sellerId !== undefined && (typeof sellerId !== 'number' || !Number.isInteger(sellerId) || sellerId < 1)) {
            return res.status(422).json({ 
                error: 'sellerId must be a positive integer',
                code: 'INVALID_FIELD_TYPE',
                field: 'sellerId',
                expectedType: 'integer (>= 1)',
                receivedType: typeof sellerId,
                value: sellerId
            });
        }

        if (priceMin !== undefined && (typeof priceMin !== 'number' || priceMin < 0 || isNaN(priceMin))) {
            return res.status(422).json({ 
                error: 'priceMin must be a non-negative number',
                code: 'INVALID_FIELD_TYPE',
                field: 'priceMin',
                expectedType: 'number (>= 0)',
                receivedType: typeof priceMin,
                value: priceMin
            });
        }

        if (priceMax !== undefined && (typeof priceMax !== 'number' || priceMax < 0 || isNaN(priceMax))) {
            return res.status(422).json({ 
                error: 'priceMax must be a non-negative number',
                code: 'INVALID_FIELD_TYPE',
                field: 'priceMax',
                expectedType: 'number (>= 0)',
                receivedType: typeof priceMax,
                value: priceMax
            });
        }

        if (priceMin !== undefined && priceMax !== undefined && priceMin > priceMax) {
            return res.status(422).json({ 
                error: 'priceMin cannot be greater than priceMax',
                code: 'INVALID_RANGE',
                field: 'priceRange',
                priceMin: priceMin,
                priceMax: priceMax
            });
        }

        if (stockMin !== undefined && (typeof stockMin !== 'number' || !Number.isInteger(stockMin) || stockMin < 0)) {
            return res.status(422).json({ 
                error: 'stockMin must be a non-negative integer',
                code: 'INVALID_FIELD_TYPE',
                field: 'stockMin',
                expectedType: 'integer (>= 0)',
                receivedType: typeof stockMin,
                value: stockMin
            });
        }

        try {
            let products = db.get('products').value() || [];

            // Case 1: Only name provided - partial match, returns array
            if (name && categoryId === undefined && sellerId === undefined && 
                priceMin === undefined && priceMax === undefined && stockMin === undefined) {
                products = products.filter(p => 
                    p.name && p.name.toLowerCase().includes(name.toLowerCase())
                );
                if (products.length === 0) {
                    return res.status(404).json({ error: 'No products found with provided name', code: 'NOT_FOUND' });
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
                    return res.status(404).json({ error: 'No products found with provided name and categoryId', code: 'NOT_FOUND' });
                }
                return res.json(products); // Array
            }

            // Case 3: Only sellerId - returns all products by that seller
            if (sellerId !== undefined && !name && categoryId === undefined && 
                priceMin === undefined && priceMax === undefined && stockMin === undefined) {
                products = products.filter(p => Number(p.sellerId) === Number(sellerId));
                if (products.length === 0) {
                    return res.status(404).json({ error: 'No products found for provided sellerId', code: 'NOT_FOUND' });
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
                    return res.status(404).json({ error: 'No products found in provided price range', code: 'NOT_FOUND' });
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
                    return res.status(404).json({ error: 'No products found with provided categoryId and price range', code: 'NOT_FOUND' });
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
                    return res.status(404).json({ error: 'No products found with minimum stock', code: 'NOT_FOUND' });
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
                    return res.status(404).json({ error: 'No products found with provided criteria', code: 'NOT_FOUND' });
                }
                return res.json(products); // Array
            }

            res.status(400).json({ error: 'Invalid search combination', code: 'INVALID_COMBINATION' });
        } catch (error) {
            console.error('Error in product flexible search:', error);
            res.status(500).json({ 
                error: 'An internal server error occurred',
                code: 'INTERNAL_SERVER_ERROR'
            });
        }
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
                        description: "Product(s) found successfully",
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
                    "400": {
                        description: "Bad Request - Invalid request format or missing required fields",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorResponse" },
                                examples: {
                                    "missingFields": {
                                        summary: "No search fields provided",
                                        value: {
                                            error: "At least one search field is required (name, categoryId, sellerId, priceMin, priceMax, or stockMin)",
                                            code: "MISSING_SEARCH_FIELDS",
                                            fields: ["name", "categoryId", "sellerId", "priceMin", "priceMax", "stockMin"]
                                        }
                                    },
                                    "invalidBody": {
                                        summary: "Invalid request body",
                                        value: {
                                            error: "Request body is required and must be a JSON object",
                                            code: "INVALID_REQUEST_BODY"
                                        }
                                    },
                                    "invalidCombination": {
                                        summary: "Invalid search combination",
                                        value: {
                                            error: "Invalid search combination",
                                            code: "INVALID_COMBINATION"
                                        }
                                    }
                                }
                            }
                        }
                    },
                    "404": {
                        description: "Not Found - No products match the search criteria",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorResponse" },
                                examples: {
                                    "notFound": {
                                        summary: "No products found",
                                        value: {
                                            error: "No products found with provided name",
                                            code: "NOT_FOUND"
                                        }
                                    },
                                    "sellerNotFound": {
                                        summary: "No products for seller",
                                        value: {
                                            error: "No products found for provided sellerId",
                                            code: "NOT_FOUND"
                                        }
                                    },
                                    "priceRangeNotFound": {
                                        summary: "No products in price range",
                                        value: {
                                            error: "No products found in provided price range",
                                            code: "NOT_FOUND"
                                        }
                                    }
                                }
                            }
                        }
                    },
                    "422": {
                        description: "Unprocessable Entity - Invalid data types, formats, or value constraints",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ValidationErrorResponse" },
                                examples: {
                                    "invalidType": {
                                        summary: "Invalid field type",
                                        value: {
                                            error: "name must be a string",
                                            code: "INVALID_FIELD_TYPE",
                                            field: "name",
                                            expectedType: "string",
                                            receivedType: "number"
                                        }
                                    },
                                    "invalidInteger": {
                                        summary: "Invalid integer value",
                                        value: {
                                            error: "categoryId must be a positive integer",
                                            code: "INVALID_FIELD_TYPE",
                                            field: "categoryId",
                                            expectedType: "integer (>= 1)",
                                            receivedType: "string",
                                            value: "abc"
                                        }
                                    },
                                    "invalidRange": {
                                        summary: "Invalid price range",
                                        value: {
                                            error: "priceMin cannot be greater than priceMax",
                                            code: "INVALID_RANGE",
                                            field: "priceRange",
                                            priceMin: 100,
                                            priceMax: 50
                                        }
                                    },
                                    "negativeValue": {
                                        summary: "Negative value not allowed",
                                        value: {
                                            error: "priceMin must be a non-negative number",
                                            code: "INVALID_FIELD_TYPE",
                                            field: "priceMin",
                                            expectedType: "number (>= 0)",
                                            receivedType: "number",
                                            value: -10
                                        }
                                    }
                                }
                            }
                        }
                    },
                    "500": {
                        description: "Internal Server Error",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorResponse" },
                                example: {
                                    error: "An internal server error occurred",
                                    code: "INTERNAL_SERVER_ERROR"
                                }
                            }
                        }
                    }
                }
            }
        }
    },
    components: {
        schemas: {
            Product: {
                type: "object",
                properties: {
                    id: { type: "integer", example: 1 },
                    name: { type: "string", example: "Product Name" },
                    description: { type: "string", example: "Product description" },
                    categoryId: { type: "integer", example: 5 },
                    sellerId: { type: "integer", example: 10 },
                    price: { type: "number", format: "float", example: 25.99 },
                    stock: { type: "integer", example: 100 },
                    status: { type: "string", example: "active" },
                    variants: { type: "array" },
                    tags: { type: "array" },
                    createdAt: { type: "integer", format: "int64" },
                    modifiedAt: { type: "integer", format: "int64" }
                }
            },
            ErrorResponse: {
                type: "object",
                properties: {
                    error: { type: "string", description: "Error message" },
                    code: { type: "string", description: "Error code" },
                    fields: { type: "array", items: { type: "string" }, description: "List of available fields" }
                },
                required: ["error", "code"]
            },
            ValidationErrorResponse: {
                type: "object",
                properties: {
                    error: { type: "string", description: "Error message" },
                    code: { type: "string", description: "Error code" },
                    field: { type: "string", description: "Field name that caused the error" },
                    expectedType: { type: "string", description: "Expected data type" },
                    receivedType: { type: "string", description: "Received data type" },
                    value: { type: ["string", "number"], description: "Invalid value provided" },
                    priceMin: { type: "number", description: "Minimum price value" },
                    priceMax: { type: "number", description: "Maximum price value" }
                },
                required: ["error", "code"]
            }
        }
    }
};

