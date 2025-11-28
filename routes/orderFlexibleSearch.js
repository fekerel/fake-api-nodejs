// Flexible order search with alternative case scenarios
// Supports: orderId, userId, status, totalAmountMin, totalAmountMax, dateFrom, dateTo
// - orderId (unique): returns single order object
// - Only userId: returns array of all orders by that user
// - userId + status: returns array of orders matching both
// - status: returns array of all orders with that status
// - totalAmountMin + totalAmountMax: returns array of orders in amount range
// - dateFrom + dateTo: returns array of orders in date range
import { createBreakingHandler } from '../utils/breaking-handler.js';

// Breaking change definitions for this endpoint
const BREAKING_DEFINITIONS = {
    FIELD_RENAME: {
        fieldMappings: {
            'orderId': 'order_id',
            'userId': 'user_id',
            'totalAmountMin': 'total_amount_min',
            'totalAmountMax': 'total_amount_max',
            'dateFrom': 'date_from',
            'dateTo': 'date_to'
        }
    },
    STATUS_CODE: { successCode: 202 },
    RESPONSE_STRUCTURE: { wrapKey: 'data' },
    REQUIRED_FIELD: { field: 'limit', type: 'integer' }
};

export default (app, router) => {
    const db = router.db;

    app.post('/orders/flexible-search', (req, res) => {
        const breaking = createBreakingHandler('POST /orders/flexible-search', BREAKING_DEFINITIONS);
        
        // Validate request body exists
        if (!req.body || typeof req.body !== 'object') {
            return res.status(400).json({ 
                error: 'Request body is required and must be a JSON object',
                code: 'INVALID_REQUEST_BODY'
            });
        }

        // Check for deprecated field names (old names should not be used)
        const deprecatedError = breaking.checkDeprecatedFields(req.body);
        if (deprecatedError) {
            return res.status(400).json(deprecatedError);
        }

        // Transform request body for FIELD_RENAME
        const body = breaking.transformRequest({ ...req.body });

        // Check REQUIRED_FIELD
        const requiredError = breaking.checkRequiredField(body);
        if (requiredError) {
            return res.status(400).json(requiredError);
        }

        const { orderId, userId, status, totalAmountMin, totalAmountMax, dateFrom, dateTo } = body;

        // Validate at least one field is provided
        if (orderId === undefined && userId === undefined && !status && 
            totalAmountMin === undefined && totalAmountMax === undefined && 
            dateFrom === undefined && dateTo === undefined) {
            return res.status(400).json({ 
                error: 'At least one search field is required (orderId, userId, status, totalAmountMin, totalAmountMax, dateFrom, or dateTo)',
                code: 'MISSING_SEARCH_FIELDS',
                fields: ['orderId', 'userId', 'status', 'totalAmountMin', 'totalAmountMax', 'dateFrom', 'dateTo']
            });
        }

        // Validate data types
        if (orderId !== undefined && (typeof orderId !== 'number' || !Number.isInteger(orderId) || orderId < 1)) {
            return res.status(422).json({ 
                error: 'orderId must be a positive integer',
                code: 'INVALID_FIELD_TYPE',
                field: 'orderId',
                expectedType: 'integer (>= 1)',
                receivedType: typeof orderId,
                value: orderId
            });
        }

        if (userId !== undefined && (typeof userId !== 'number' || !Number.isInteger(userId) || userId < 1)) {
            return res.status(422).json({ 
                error: 'userId must be a positive integer',
                code: 'INVALID_FIELD_TYPE',
                field: 'userId',
                expectedType: 'integer (>= 1)',
                receivedType: typeof userId,
                value: userId
            });
        }

        if (status !== undefined && typeof status !== 'string') {
            return res.status(422).json({ 
                error: 'status must be a string',
                code: 'INVALID_FIELD_TYPE',
                field: 'status',
                expectedType: 'string',
                receivedType: typeof status
            });
        }

        if (status && !['pending', 'failed', 'cancelled', 'returned', 'delivered'].includes(status.toLowerCase())) {
            return res.status(422).json({ 
                error: 'status must be one of: pending, failed, cancelled, returned, delivered',
                code: 'INVALID_STATUS_VALUE',
                field: 'status',
                value: status,
                allowedValues: ['pending', 'failed', 'cancelled', 'returned', 'delivered']
            });
        }

        if (totalAmountMin !== undefined && (typeof totalAmountMin !== 'number' || totalAmountMin < 0 || isNaN(totalAmountMin))) {
            return res.status(422).json({ 
                error: 'totalAmountMin must be a non-negative number',
                code: 'INVALID_FIELD_TYPE',
                field: 'totalAmountMin',
                expectedType: 'number (>= 0)',
                receivedType: typeof totalAmountMin,
                value: totalAmountMin
            });
        }

        if (totalAmountMax !== undefined && (typeof totalAmountMax !== 'number' || totalAmountMax < 0 || isNaN(totalAmountMax))) {
            return res.status(422).json({ 
                error: 'totalAmountMax must be a non-negative number',
                code: 'INVALID_FIELD_TYPE',
                field: 'totalAmountMax',
                expectedType: 'number (>= 0)',
                receivedType: typeof totalAmountMax,
                value: totalAmountMax
            });
        }

        if (totalAmountMin !== undefined && totalAmountMax !== undefined && totalAmountMin > totalAmountMax) {
            return res.status(422).json({ 
                error: 'totalAmountMin cannot be greater than totalAmountMax',
                code: 'INVALID_RANGE',
                field: 'amountRange',
                totalAmountMin: totalAmountMin,
                totalAmountMax: totalAmountMax
            });
        }

        if (dateFrom !== undefined && (typeof dateFrom !== 'number' || !Number.isInteger(dateFrom) || dateFrom < 0)) {
            return res.status(422).json({ 
                error: 'dateFrom must be a non-negative integer (Unix timestamp in milliseconds)',
                code: 'INVALID_FIELD_TYPE',
                field: 'dateFrom',
                expectedType: 'integer (Unix timestamp in ms, >= 0)',
                receivedType: typeof dateFrom,
                value: dateFrom
            });
        }

        if (dateTo !== undefined && (typeof dateTo !== 'number' || !Number.isInteger(dateTo) || dateTo < 0)) {
            return res.status(422).json({ 
                error: 'dateTo must be a non-negative integer (Unix timestamp in milliseconds)',
                code: 'INVALID_FIELD_TYPE',
                field: 'dateTo',
                expectedType: 'integer (Unix timestamp in ms, >= 0)',
                receivedType: typeof dateTo,
                value: dateTo
            });
        }

        if (dateFrom !== undefined && dateTo !== undefined && dateFrom > dateTo) {
            return res.status(422).json({ 
                error: 'dateFrom cannot be greater than dateTo',
                code: 'INVALID_RANGE',
                field: 'dateRange',
                dateFrom: dateFrom,
                dateTo: dateTo
            });
        }

        try {
            let orders = db.get('orders').value() || [];

            // Case 1: orderId is unique, return single object if found
            if (orderId !== undefined && orderId !== null && 
                userId === undefined && !status && totalAmountMin === undefined && 
                totalAmountMax === undefined && dateFrom === undefined && dateTo === undefined) {
                const found = orders.find(o => Number(o.id) === Number(orderId));
                if (found) {
                    return breaking.sendResponse(res, found); // Single object
                }
                return res.status(404).json({ error: 'Order not found with provided orderId', code: 'NOT_FOUND' });
            }

            // Case 2: Only userId - returns all orders by that user
            if (userId !== undefined && orderId === undefined && !status && 
                totalAmountMin === undefined && totalAmountMax === undefined && 
                dateFrom === undefined && dateTo === undefined) {
                orders = orders.filter(o => Number(o.userId) === Number(userId));
                if (orders.length === 0) {
                    return res.status(404).json({ error: 'No orders found for provided userId', code: 'NOT_FOUND' });
                }
                return breaking.sendResponse(res, orders); // Array
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
                    return res.status(404).json({ error: 'No orders found with provided userId and status', code: 'NOT_FOUND' });
                }
                return breaking.sendResponse(res, orders); // Array
            }

            // Case 4: Only status
            if (status && orderId === undefined && userId === undefined && 
                totalAmountMin === undefined && totalAmountMax === undefined && 
                dateFrom === undefined && dateTo === undefined) {
                orders = orders.filter(o => o.status && o.status.toLowerCase() === status.toLowerCase());
                if (orders.length === 0) {
                    return res.status(404).json({ error: 'No orders found with provided status', code: 'NOT_FOUND' });
                }
                return breaking.sendResponse(res, orders); // Array
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
                    return res.status(404).json({ error: 'No orders found in provided amount range', code: 'NOT_FOUND' });
                }
                return breaking.sendResponse(res, orders); // Array
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
                    return res.status(404).json({ error: 'No orders found in provided date range', code: 'NOT_FOUND' });
                }
                return breaking.sendResponse(res, orders); // Array
            }

            // Case 7: Complex combinations
            if (orderId !== undefined && orderId !== null) {
                // If orderId is provided with other fields, still return single object if found
                const found = orders.find(o => Number(o.id) === Number(orderId));
                if (found) {
                    return breaking.sendResponse(res, found); // Single object
                }
                return res.status(404).json({ error: 'Order not found with provided orderId', code: 'NOT_FOUND' });
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
                return res.status(404).json({ error: 'No orders found with provided criteria', code: 'NOT_FOUND' });
            }
            return breaking.sendResponse(res, orders); // Array
        } catch (error) {
            console.error('Error in order flexible search:', error);
            res.status(500).json({ 
                error: 'An internal server error occurred',
                code: 'INTERNAL_SERVER_ERROR'
            });
        }
    });
};

export const openapi = {
    paths: {
        "/orders/flexible-search": {
            post: {
                isSelect:true,
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
                        description: "Order(s) found successfully",
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
                    "400": {
                        description: "Bad Request - Invalid request format or missing required fields",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorResponse" },
                                examples: {
                                    "missingFields": {
                                        summary: "No search fields provided",
                                        value: {
                                            error: "At least one search field is required (orderId, userId, status, totalAmountMin, totalAmountMax, dateFrom, or dateTo)",
                                            code: "MISSING_SEARCH_FIELDS",
                                            fields: ["orderId", "userId", "status", "totalAmountMin", "totalAmountMax", "dateFrom", "dateTo"]
                                        }
                                    },
                                    "invalidBody": {
                                        summary: "Invalid request body",
                                        value: {
                                            error: "Request body is required and must be a JSON object",
                                            code: "INVALID_REQUEST_BODY"
                                        }
                                    }
                                }
                            }
                        }
                    },
                    "404": {
                        description: "Not Found - No orders match the search criteria",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ErrorResponse" },
                                examples: {
                                    "notFound": {
                                        summary: "Order not found",
                                        value: {
                                            error: "Order not found with provided orderId",
                                            code: "NOT_FOUND"
                                        }
                                    },
                                    "userNotFound": {
                                        summary: "No orders for user",
                                        value: {
                                            error: "No orders found for provided userId",
                                            code: "NOT_FOUND"
                                        }
                                    },
                                    "statusNotFound": {
                                        summary: "No orders with status",
                                        value: {
                                            error: "No orders found with provided status",
                                            code: "NOT_FOUND"
                                        }
                                    },
                                    "rangeNotFound": {
                                        summary: "No orders in range",
                                        value: {
                                            error: "No orders found in provided amount range",
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
                                            error: "orderId must be a positive integer",
                                            code: "INVALID_FIELD_TYPE",
                                            field: "orderId",
                                            expectedType: "integer (>= 1)",
                                            receivedType: "string",
                                            value: "abc"
                                        }
                                    },
                                    "invalidStatus": {
                                        summary: "Invalid status value",
                                        value: {
                                            error: "status must be one of: pending, failed, cancelled, returned, delivered",
                                            code: "INVALID_STATUS_VALUE",
                                            field: "status",
                                            value: "invalid_status",
                                            allowedValues: ["pending", "failed", "cancelled", "returned", "delivered"]
                                        }
                                    },
                                    "invalidRange": {
                                        summary: "Invalid amount range",
                                        value: {
                                            error: "totalAmountMin cannot be greater than totalAmountMax",
                                            code: "INVALID_RANGE",
                                            field: "amountRange",
                                            totalAmountMin: 500,
                                            totalAmountMax: 100
                                        }
                                    },
                                    "invalidDateRange": {
                                        summary: "Invalid date range",
                                        value: {
                                            error: "dateFrom cannot be greater than dateTo",
                                            code: "INVALID_RANGE",
                                            field: "dateRange",
                                            dateFrom: 1704067200000,
                                            dateTo: 1609459200000
                                        }
                                    },
                                    "invalidTimestamp": {
                                        summary: "Invalid timestamp format",
                                        value: {
                                            error: "dateFrom must be a non-negative integer (Unix timestamp in milliseconds)",
                                            code: "INVALID_FIELD_TYPE",
                                            field: "dateFrom",
                                            expectedType: "integer (Unix timestamp in ms, >= 0)",
                                            receivedType: "string",
                                            value: "invalid-date"
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
            Order: {
                type: "object",
                properties: {
                    id: { type: "integer", example: 1 },
                    userId: { type: "integer", example: 5 },
                    status: { type: "string", enum: ["pending", "failed", "cancelled", "returned", "delivered"], example: "delivered" },
                    totalAmount: { type: "number", format: "float", example: 125.50 },
                    items: { 
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                productId: { type: "integer" },
                                variantId: { type: "string" },
                                quantity: { type: "integer" },
                                price: { type: "number" }
                            }
                        }
                    },
                    shippingAddress: { type: "object" },
                    payment: { type: "object" },
                    createdAt: { type: "integer", format: "int64", description: "Unix timestamp (ms)", example: 1609459200000 },
                    modifiedAt: { type: "integer", format: "int64", description: "Unix timestamp (ms)" }
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
                    allowedValues: { type: "array", items: { type: "string" }, description: "List of allowed values" },
                    totalAmountMin: { type: "number", description: "Minimum amount value" },
                    totalAmountMax: { type: "number", description: "Maximum amount value" },
                    dateFrom: { type: "integer", format: "int64", description: "Start date timestamp" },
                    dateTo: { type: "integer", format: "int64", description: "End date timestamp" }
                },
                required: ["error", "code"]
            }
        }
    }
};

// Breaking changes metadata
export const breakingMeta = {
  method: 'POST',
  path: '/orders/flexible-search',
  availableCategories: ['FIELD_RENAME', 'STATUS_CODE', 'RESPONSE_STRUCTURE', 'REQUIRED_FIELD'],
  definitions: {
    FIELD_RENAME: {
      fieldMappings: {
        'orderId': 'order_id',
        'userId': 'user_id',
        'totalAmountMin': 'total_amount_min',
        'totalAmountMax': 'total_amount_max',
        'dateFrom': 'date_from',
        'dateTo': 'date_to'
      }
    },
    STATUS_CODE: {
      successCode: '202'
    },
    RESPONSE_STRUCTURE: {
      wrapKey: 'data'
    },
    REQUIRED_FIELD: {
      field: 'limit',
      type: 'integer'
    }
  }
};
