// Flexible user search with alternative case scenarios
// Supports: firstName, lastName, email, phone
// - Only firstName: returns array of all users with that first name
// - firstName + lastName: returns array of users matching both
// - email (unique): returns single user object
// - phone (unique): returns single user object
export default (app, router) => {
    const db = router.db;

    app.post('/users/flexible-search', (req, res) => {
        const { firstName, lastName, email, phone } = req.body || {};

        // At least one field must be provided
        if (!firstName && !lastName && !email && !phone) {
            return res.status(400).json({ 
                error: 'At least one search field is required (firstName, lastName, email, or phone)' 
            });
        }

        let users = db.get('users').value() || [];

        // Priority 1: email is unique, return single object if found
        if (email) {
            const found = users.find(u => u.email && u.email.toLowerCase() === email.toLowerCase());
            if (found) {
                return res.json(found); // Single object
            }
            return res.status(404).json({ error: 'User not found with provided email' });
        }

        // Priority 2: phone is unique, return single object if found
        if (phone && !firstName && !lastName) {
            const found = users.find(u => u.phone && u.phone === phone);
            if (found) {
                return res.json(found); // Single object
            }
            return res.status(404).json({ error: 'User not found with provided phone' });
        }

        // Priority 3: firstName + lastName combination
        if (firstName && lastName) {
            users = users.filter(u => 
                u.firstName && u.firstName.toLowerCase().includes(firstName.toLowerCase()) &&
                u.lastName && u.lastName.toLowerCase().includes(lastName.toLowerCase())
            );
            if (users.length === 0) {
                return res.status(404).json({ error: 'No users found with provided firstName and lastName' });
            }
            return res.json(users); // Array
        }

        // Priority 4: Only firstName
        if (firstName && !lastName) {
            users = users.filter(u => 
                u.firstName && u.firstName.toLowerCase().includes(firstName.toLowerCase())
            );
            if (users.length === 0) {
                return res.status(404).json({ error: 'No users found with provided firstName' });
            }
            return res.json(users); // Array
        }

        // Priority 5: Only lastName
        if (lastName && !firstName) {
            users = users.filter(u => 
                u.lastName && u.lastName.toLowerCase().includes(lastName.toLowerCase())
            );
            if (users.length === 0) {
                return res.status(404).json({ error: 'No users found with provided lastName' });
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
                return res.status(404).json({ error: 'No users found with provided criteria' });
            }
            return res.json(users); // Array
        }

        res.status(400).json({ error: 'Invalid search combination' });
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
                    "400": { description: "At least one search field is required or invalid combination" },
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
                    role: { type: "string" },
                    phone: { type: "string" },
                    status: { type: "string" }
                }
            }
        }
    }
};

