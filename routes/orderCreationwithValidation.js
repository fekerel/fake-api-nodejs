// Create order with product validation, stock check, and price calculation
export default (app, router) => {
    const db = router.db;

    app.post('/orders/create', (req, res) => {
        const { userId, items, shippingAddress, paymentMethod } = req.body || {};

        if (!userId) {
            return res.status(400).json({ error: 'userId is required' });
        }

        if (!items || !Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ error: 'items array is required and must not be empty' });
        }

        const user = db.get('users').find(u => Number(u.id) === Number(userId)).value();
        if (!user) {
            return res.status(404).json({ error: 'user not found' });
        }

        const validatedItems = [];
        let totalAmount = 0;
        const errors = [];
        const warnings = [];

        for (const item of items) {
            const { productId, quantity } = item || {};

            if (!productId || quantity === undefined) {
                errors.push(`Item missing productId or quantity: ${JSON.stringify(item)}`);
                continue;
            }

            const product = db.get('products').find(p => Number(p.id) === Number(productId)).value();
            if (!product) {
                errors.push(`Product not found: ${productId}`);
                continue;
            }

            const requestedQuantity = Number(quantity) || 0;
            const availableStock = Number(product.stock) || 0;
            const productPrice = parseFloat(product.price) || 0;

            if (requestedQuantity <= 0) {
                errors.push(`Invalid quantity for product ${productId}: ${requestedQuantity}`);
                continue;
            }

            if (availableStock < requestedQuantity) {
                warnings.push(`Insufficient stock for product ${productId}. Available: ${availableStock}, Requested: ${requestedQuantity}`);
                continue;
            }

            const itemTotal = requestedQuantity * productPrice;
            totalAmount += itemTotal;

            validatedItems.push({
                productId: Number(productId),
                productName: product.name,
                quantity: requestedQuantity,
                unitPrice: productPrice,
                totalPrice: Number(itemTotal.toFixed(2))
            });
        }

        if (errors.length > 0) {
            return res.status(400).json({
                error: 'Validation errors',
                errors,
                warnings
            });
        }

        if (validatedItems.length === 0) {
            return res.status(400).json({
                error: 'No valid items to process',
                warnings
            });
        }

        // Create order
        const newOrder = {
            id: db.get('orders').value().length + 1,
            userId: Number(userId),
            items: validatedItems,
            totalAmount: Number(totalAmount.toFixed(2)),
            status: 'pending',
            shippingAddress: shippingAddress || user.address || null,
            paymentMethod: paymentMethod || 'credit_card',
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        db.get('orders').push(newOrder).write();

        // Update stock (optional - can be done in fulfillment)
        if (warnings.length === 0) {
            validatedItems.forEach(item => {
                const product = db.get('products').find(p => Number(p.id) === item.productId).value();
                if (product) {
                    product.stock = (Number(product.stock) || 0) - item.quantity;
                    db.get('products').find(p => Number(p.id) === item.productId).assign(product).write();
                }
            });
        }

        res.status(201).json({
            order: newOrder,
            summary: {
                totalItems: validatedItems.length,
                totalAmount: newOrder.totalAmount,
                status: newOrder.status
            },
            warnings: warnings.length > 0 ? warnings : undefined
        });
    });
};

export const openapi = {
    paths: {
        "/orders/create": {
            post: {
                summary: "Create order with product validation, stock check, and price calculation",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["userId", "items"],
                                properties: {
                                    userId: { type: "integer", example: 1 },
                                    items: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            required: ["productId", "quantity"],
                                            properties: {
                                                productId: { type: "integer", example: 5 },
                                                quantity: { type: "integer", example: 2 }
                                            }
                                        }
                                    },
                                    shippingAddress: { type: "string", nullable: true, example: "123 Main St" },
                                    paymentMethod: { type: "string", nullable: true, example: "credit_card" }
                                }
                            }
                        }
                    }
                },
                responses: {
                    "201": {
                        description: "Order created successfully",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/OrderCreationResponse" }
                            }
                        }
                    },
                    "400": { description: "Validation error" },
                    "404": { description: "User not found" }
                }
            }
        }
    },
    components: {
        schemas: {
            OrderCreationResponse: {
                type: "object",
                properties: {
                    order: { $ref: "#/components/schemas/Order" },
                    summary: {
                        type: "object",
                        properties: {
                            totalItems: { type: "integer" },
                            totalAmount: { type: "number" },
                            status: { type: "string" }
                        }
                    },
                    warnings: {
                        type: "array",
                        items: { type: "string" }
                    }
                }
            },
            Order: {
                type: "object",
                properties: {
                    id: { type: "integer" },
                    userId: { type: "integer" },
                    items: { type: "array" },
                    totalAmount: { type: "number" },
                    status: { type: "string" }
                }
            }
        }
    }
};