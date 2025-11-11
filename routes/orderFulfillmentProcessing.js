// Process order fulfillment with stock management and payment validation
export default (app, router) => {
    const db = router.db;

    app.post('/orders/fulfill', (req, res) => {
        const { orderId, paymentStatus, shippingMethod, trackingNumber, autoUpdateStock } = req.body || {};

        if (!orderId) {
            return res.status(400).json({ error: 'orderId is required' });
        }

        const order = db.get('orders').find(o => Number(o.id) === Number(orderId)).value();
        if (!order) {
            return res.status(404).json({ error: 'order not found' });
        }

        if (order.status === 'completed' || order.status === 'shipped') {
            return res.status(400).json({ 
                error: `Order is already ${order.status}`,
                currentStatus: order.status
            });
        }

        const errors = [];
        const warnings = [];
        const stockUpdates = [];

        // Validate and update stock
        const shouldUpdateStock = autoUpdateStock !== false; // Default true
        if (shouldUpdateStock && order.items) {
            for (const item of order.items) {
                const productId = Number(item.productId);
                if (!productId) {
                    warnings.push(`Invalid productId in order item: ${JSON.stringify(item)}`);
                    continue;
                }

                const product = db.get('products').find(p => Number(p.id) === productId).value();
                if (!product) {
                    warnings.push(`Product not found: ${productId}. Skipping stock update for this item.`);
                    continue; // Skip this item but continue with others
                }

                const requestedQuantity = Number(item.quantity) || 0;
                if (requestedQuantity <= 0) {
                    warnings.push(`Invalid quantity for product ${productId}: ${requestedQuantity}`);
                    continue;
                }

                const currentStock = Number(product.stock) || 0;

                if (currentStock < requestedQuantity) {
                    errors.push(`Insufficient stock for product ${productId}. Available: ${currentStock}, Required: ${requestedQuantity}`);
                    continue;
                }

                const newStock = currentStock - requestedQuantity;
                db.get('products').find(p => Number(p.id) === productId).assign({ stock: newStock }).write();

                stockUpdates.push({
                    productId: productId,
                    productName: product.name,
                    quantityDeducted: requestedQuantity,
                    previousStock: currentStock,
                    newStock: newStock
                });
            }
        }

        // Payment validation
        const paymentStatusValue = paymentStatus || 'pending';
        const validPaymentStatuses = ['pending', 'paid', 'failed', 'refunded'];
        if (!validPaymentStatuses.includes(paymentStatusValue)) {
            return res.status(400).json({ error: `Invalid paymentStatus: ${paymentStatusValue}` });
        }

        if (paymentStatusValue === 'failed') {
            return res.status(400).json({
                error: 'Payment failed, cannot fulfill order',
                orderId: Number(orderId)
            });
        }

        // If there are critical errors (insufficient stock), return error
        if (errors.length > 0) {
            return res.status(400).json({
                error: 'Fulfillment errors',
                errors,
                warnings,
                order: order
            });
        }

        // Update order status
        let newStatus = 'processing';
        if (paymentStatusValue === 'paid') {
            newStatus = shippingMethod ? 'shipped' : 'processing';
        }

        const updateData = {
            status: newStatus,
            paymentStatus: paymentStatusValue,
            updatedAt: Date.now()
        };

        if (shippingMethod) {
            updateData.shippingMethod = shippingMethod;
        }

        if (trackingNumber) {
            updateData.trackingNumber = trackingNumber;
            updateData.status = 'shipped';
        }

        if (newStatus === 'shipped' && !order.shippedAt) {
            updateData.shippedAt = Date.now();
        }

        if (newStatus === 'shipped' && paymentStatusValue === 'paid') {
            updateData.status = 'completed';
            updateData.completedAt = Date.now();
        }

        db.get('orders').find(o => Number(o.id) === Number(orderId)).assign(updateData).write();

        const updatedOrder = db.get('orders').find(o => Number(o.id) === Number(orderId)).value();

        res.json({
            success: true,
            order: updatedOrder,
            fulfillment: {
                previousStatus: order.status,
                newStatus: updatedOrder.status,
                paymentStatus: updatedOrder.paymentStatus,
                stockUpdated: shouldUpdateStock,
                stockUpdates: stockUpdates.length > 0 ? stockUpdates : undefined
            },
            warnings: warnings.length > 0 ? warnings : undefined
        });
    });
};

export const openapi = {
    paths: {
        "/orders/fulfill": {
            post: {
                summary: "Process order fulfillment with stock management and payment validation",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["orderId"],
                                properties: {
                                    orderId: { type: "integer", example: 1 },
                                    paymentStatus: { type: "string", enum: ["pending", "paid", "failed", "refunded"], nullable: true, example: "paid" },
                                    shippingMethod: { type: "string", nullable: true, example: "express" },
                                    trackingNumber: { type: "string", nullable: true, example: "TRACK123456" },
                                    autoUpdateStock: { type: "boolean", nullable: true, example: true }
                                }
                            }
                        }
                    }
                },
                responses: {
                    "200": {
                        description: "Order fulfilled successfully",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/FulfillmentResponse" }
                            }
                        }
                    },
                    "400": { description: "Validation error" },
                    "404": { description: "Order not found" }
                }
            }
        }
    },
    components: {
        schemas: {
            FulfillmentResponse: {
                type: "object",
                properties: {
                    success: { type: "boolean" },
                    order: { type: "object" },
                    fulfillment: {
                        type: "object",
                        properties: {
                            previousStatus: { type: "string" },
                            newStatus: { type: "string" },
                            paymentStatus: { type: "string" },
                            stockUpdated: { type: "boolean" },
                            stockUpdates: { type: "array" }
                        }
                    },
                    warnings: { type: "array", items: { type: "string" } }
                }
            }
        }
    }
};