// Flexible user search with alternative case scenarios
// Supports: firstName, lastName, email, phone
// - Only firstName: returns array of all users with that first name
// - firstName + lastName: returns array of users matching both
// - email (unique): returns single user object
// - phone (unique): returns single user object
export default (app, router) => {
    const db = router.db;

    app.post('/users/flexible-search', (req, res) => {
        // Validate request body exists
        if (!req.body || typeof req.body !== 'object') {
            return res.status(400).json({ 
                error: 'Request body is required and must be a JSON object',
                code: 'INVALID_REQUEST_BODY'
            });
        }

        const { firstName, lastName, email, phone } = req.body;

        // Validate at least one field is provided
        if (!firstName && !lastName && !email && !phone) {
            return res.status(400).json({ 
                error: 'At least one search field is required (firstName, lastName, email, or phone)',
                code: 'MISSING_SEARCH_FIELDS',
                fields: ['firstName', 'lastName', 'email', 'phone']
            });
        }

        // Validate data types
        if (firstName !== undefined && typeof firstName !== 'string') {
            return res.status(422).json({ 
                error: 'firstName must be a string',
                code: 'INVALID_FIELD_TYPE',
                field: 'firstName',
                expectedType: 'string',
                receivedType: typeof firstName
            });
        }

        if (lastName !== undefined && typeof lastName !== 'string') {
            return res.status(422).json({ 
                error: 'lastName must be a string',
                code: 'INVALID_FIELD_TYPE',
                field: 'lastName',
                expectedType: 'string',
                receivedType: typeof lastName
            });
        }

        if (email !== undefined && typeof email !== 'string') {
            return res.status(422).json({ 
                error: 'email must be a string',
                code: 'INVALID_FIELD_TYPE',
                field: 'email',
                expectedType: 'string',
                receivedType: typeof email
            });
        }

        if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            return res.status(422).json({ 
                error: 'email must be a valid email address',
                code: 'INVALID_EMAIL_FORMAT',
                field: 'email',
                value: email
            });
        }

        if (phone !== undefined && typeof phone !== 'string') {
            return res.status(422).json({ 
                error: 'phone must be a string',
                code: 'INVALID_FIELD_TYPE',
                field: 'phone',
                expectedType: 'string',
                receivedType: typeof phone
            });
        }

        try {
            let users = db.get('users').value() || [];

            // Priority 1: email is unique, return single object if found
            if (email) {
                const found = users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
                if (found) {
                    return res.json(found); // Single object
                }
                return res.status(404).json({ error: 'User not found with provided email', code: 'NOT_FOUND' });
            }

            // Priority 2: phone is unique, return single object if found
            if (phone && !firstName && !lastName) {
                const found = users.find(u => u.phone && u.phone === phone);
                if (found) {
                    return res.json(found); // Single object
                }
                return res.status(404).json({ error: 'User not found with provided phone', code: 'NOT_FOUND' });
            }

            // Priority 3: firstName + lastName combination
            if (firstName && lastName) {
                users = users.filter(u => 
                    u.firstName && u.firstName.toLowerCase().includes(firstName.toLowerCase()) &&
                    u.lastName && u.lastName.toLowerCase().includes(lastName.toLowerCase())
                );
                if (users.length === 0) {
                    return res.status(404).json({ error: 'No users found with provided firstName and lastName', code: 'NOT_FOUND' });
                }
                return res.json(users); // Array
            }

            // Priority 4: Only firstName
            if (firstName && !lastName) {
                users = users.filter(u => 
                    u.firstName && u.firstName.toLowerCase().includes(firstName.toLowerCase())
                );
                if (users.length === 0) {
                    return res.status(404).json({ error: 'No users found with provided firstName', code: 'NOT_FOUND' });
                }
                return res.json(users); // Array
            }

            // Priority 5: Only lastName
            if (lastName && !firstName) {
                users = users.filter(u => 
                    u.lastName && u.lastName.toLowerCase().includes(lastName.toLowerCase())
                );
                if (users.length === 0) {
                    return res.status(404).json({ error: 'No users found with provided lastName', code: 'NOT_FOUND' });
                }
                return res.json(users); // Array
            }

            // Priority 6: phone with firstName or lastName (filter by phone first, then by name)
            if (phone) {
                users = users.filter(u => u.phone && u.phone === phone);
                if (firstName) {
                    users = users.filter(u => 
                        u.firstName && u.firstName.toLowerCase().includes(firstName.toLowerCase())
                    );
                }
                if (lastName) {
                    users = users.filter(u => 
                        u.lastName && u.lastName.toLowerCase().includes(lastName.toLowerCase())
                    );
                }
                if (users.length === 0) {
                    return res.status(404).json({ error: 'No users found with provided criteria', code: 'NOT_FOUND' });
                }
                return res.json(users); // Array
            }

            res.status(400).json({ error: 'Invalid search combination', code: 'INVALID_COMBINATION' });
        } catch (error) {
            console.error('Error in user flexible search:', error);
            res.status(500).json({ 
                error: 'An internal server error occurred',
                code: 'INTERNAL_SERVER_ERROR'
            });
        }
    });
};

export const openapi = {
    paths: {
        "/users/flexible-search": {
            post: {
                isSelect:true,
                summary: "Flexible user search with alternative case scenarios",
                description: `
                    Search users with different behaviors based on provided fields:
                    - Only firstName: returns array of all users with that first name
                    - firstName + lastName: returns array of users matching both
                    - email (unique): returns single user object
                    - phone (unique): returns single user object
                    - phone + firstName/lastName: returns array filtered by phone and name
                `,
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    firstName: { type: "string", nullable: true, example: "John" },
                                    lastName: { type: "string", nullable: true, example: "Doe" },
                                    email: { type: "string", nullable: true, example: "user@example.com" },
                                    phone: { type: "string", nullable: true, example: "+1234567890" }
                                }
                            },
                            examples: {
                                "byEmail": {
                                    summary: "Search by email (returns single object - unique)",
                                    value: { email: "user@example.com" }
                                },
                                "byPhone": {
                                    summary: "Search by phone (returns single object - unique)",
                                    value: { phone: "+1234567890" }
                                },
                                "byFirstNameOnly": {
                                    summary: "Search by firstName only (returns array)",
                                    value: { firstName: "John" }
                                },
                                "byFirstNameAndLastName": {
                                    summary: "Search by firstName and lastName (returns array)",
                                    value: { firstName: "John", lastName: "Doe" }
                                },
                                "byPhoneAndName": {
                                    summary: "Search by phone and firstName (returns array)",
                                    value: { phone: "+1234567890", firstName: "John" }
                                }
                            }
                        }
                    }
                },
                responses: {
                    "200": {
                        description: "User(s) found successfully",
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
                                },
                                examples: {
                                    "singleUser": {
                                        summary: "Single user (email or phone search)",
                                        value: {
                                            id: 1,
                                            email: "user@example.com",
                                            firstName: "John",
                                            lastName: "Doe",
                                            role: "buyer",
                                            status: "active"
                                        }
                                    },
                                    "multipleUsers": {
                                        summary: "Array of users (name search)",
                                        value: [
                                            {
                                                id: 1,
                                                email: "john1@example.com",
                                                firstName: "John",
                                                lastName: "Doe",
                                                role: "buyer"
                                            },
                                            {
                                                id: 2,
                                                email: "john2@example.com",
                                                firstName: "John",
                                                lastName: "Smith",
                                                role: "seller"
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
                                            error: "At least one search field is required (firstName, lastName, email, or phone)",
                                            code: "MISSING_SEARCH_FIELDS",
                                            fields: ["firstName", "lastName", "email", "phone"]
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
                        description: "Not Found - No users match the search criteria",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorResponse" },
                                examples: {
                                    "notFound": {
                                        summary: "No users found",
                                        value: {
                                            error: "No users found with provided firstName",
                                            code: "NOT_FOUND"
                                        }
                                    },
                                    "emailNotFound": {
                                        summary: "Email not found",
                                        value: {
                                            error: "User not found with provided email",
                                            code: "NOT_FOUND"
                                        }
                                    }
                                }
                            }
                        }
                    },
                    "422": {
                        description: "Unprocessable Entity - Invalid data types or formats",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ValidationErrorResponse" },
                                examples: {
                                    "invalidType": {
                                        summary: "Invalid field type",
                                        value: {
                                            error: "firstName must be a string",
                                            code: "INVALID_FIELD_TYPE",
                                            field: "firstName",
                                            expectedType: "string",
                                            receivedType: "number"
                                        }
                                    },
                                    "invalidEmail": {
                                        summary: "Invalid email format",
                                        value: {
                                            error: "email must be a valid email address",
                                            code: "INVALID_EMAIL_FORMAT",
                                            field: "email",
                                            value: "invalid-email"
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
            User: {
                type: "object",
                properties: {
                    id: { type: "integer", example: 1 },
                    email: { type: "string", format: "email", example: "user@example.com" },
                    firstName: { type: "string", example: "John" },
                    lastName: { type: "string", example: "Doe" },
                    role: { type: "string", example: "buyer" },
                    phone: { type: "string", example: "+1234567890" },
                    status: { type: "string", example: "active" },
                    address: { type: "object" },
                    createdAt: { type: "integer", format: "int64" },
                    modifiedAt: { type: "integer", format: "int64" }
                }
            },
            ErrorResponse: {
                type: "object",
                properties: {
                    error: { type: "string", description: "Error message" },
                    code: { type: "string", description: "Error code" }
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
                    value: { type: "string", description: "Invalid value provided" }
                },
                required: ["error", "code"]
            }
        }
    }
};

