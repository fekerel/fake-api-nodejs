// Bulk update product inventory, prices, and status
export default (app, router) => {
    const db = router.db;

    app.post('/products/bulk-update', (req, res) => {
        const { updates, operation } = req.body || {};

        if (!updates || !Array.isArray(updates) || updates.length === 0) {
            return res.status(400).json({ error: 'updates array is required and must not be empty' });
        }

        const operationType = operation || 'update'; // 'update', 'add', 'subtract'
        const results = [];
        const errors = [];
        const warnings = [];

        for (const update of updates) {
            const { productId, stock, price, status, discount } = update || {};

            if (!productId) {
                errors.push(`Missing productId in update: ${JSON.stringify(update)}`);
                continue;
            }

            const product = db.get('products').find(p => Number(p.id) === Number(productId)).value();
            if (!product) {
                errors.push(`Product not found: ${productId}`);
                continue;
            }

            const updateData = {};
            let hasChanges = false;

            // Stock update
            if (stock !== undefined && stock !== null) {
                const currentStock = Number(product.stock) || 0;
                let newStock;

                if (operationType === 'add') {
                    newStock = currentStock + Number(stock);
                } else if (operationType === 'subtract') {
                    newStock = Math.max(0, currentStock - Number(stock));
                    if (newStock === 0 && currentStock > 0) {
                        warnings.push(`Product ${productId} stock depleted`);
                    }
                } else {
                    newStock = Number(stock);
                }

                if (newStock < 0) {
                    errors.push(`Invalid stock value for product ${productId}: ${newStock}`);
                    continue;
                }

                updateData.stock = newStock;
                hasChanges = true;
            }

            // Price update
            if (price !== undefined && price !== null) {
                const newPrice = parseFloat(price);
                if (newPrice < 0) {
                    errors.push(`Invalid price for product ${productId}: ${newPrice}`);
                    continue;
                }
                updateData.price = newPrice;
                hasChanges = true;
            }

            // Discount application
            if (discount !== undefined && discount !== null) {
                const discountPercent = Number(discount);
                if (discountPercent < 0 || discountPercent > 100) {
                    errors.push(`Invalid discount for product ${productId}: ${discountPercent}`);
                    continue;
                }
                const currentPrice = updateData.price || parseFloat(product.price) || 0;
                updateData.price = Number((currentPrice * (1 - discountPercent / 100)).toFixed(2));
                hasChanges = true;
            }

            // Status update
            if (status !== undefined && status !== null) {
                const validStatuses = ['active', 'inactive', 'out_of_stock', 'discontinued'];
                if (!validStatuses.includes(status)) {
                    errors.push(`Invalid status for product ${productId}: ${status}`);
                    continue;
                }
                updateData.status = status;
                hasChanges = true;
            }

            if (!hasChanges) {
                warnings.push(`No changes specified for product ${productId}`);
                continue;
            }

            updateData.updatedAt = Date.now();
            db.get('products').find(p => Number(p.id) === Number(productId)).assign(updateData).write();

            const updatedProduct = db.get('products').find(p => Number(p.id) === Number(productId)).value();
            results.push({
                productId: Number(productId),
                productName: updatedProduct.name,
                changes: updateData,
                previousStock: Number(product.stock) || 0,
                previousPrice: parseFloat(product.price) || 0
            });
        }

        if (errors.length > 0 && results.length === 0) {
            return res.status(400).json({
                error: 'All updates failed',
                errors,
                warnings
            });
        }

        res.json({
            success: true,
            operation: operationType,
            totalProcessed: updates.length,
            successful: results.length,
            failed: errors.length,
            results,
            errors: errors.length > 0 ? errors : undefined,
            warnings: warnings.length > 0 ? warnings : undefined
        });
    });
};

export const openapi = {
    paths: {
        "/products/bulk-update": {
            post: {
                summary: "Bulk update product inventory, prices, and status",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["updates"],
                                properties: {
                                    updates: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            required: ["productId"],
                                            properties: {
                                                productId: { type: "integer", example: 1 },
                                                stock: { type: "integer", nullable: true, example: 100 },
                                                price: { type: "number", nullable: true, example: 29.99 },
                                                status: { type: "string", nullable: true, example: "active" },
                                                discount: { type: "number", nullable: true, example: 10 }
                                            }
                                        }
                                    },
                                    operation: { type: "string", enum: ["update", "add", "subtract"], example: "update" }
                                }
                            }
                        }
                    }
                },
                responses: {
                    "200": {
                        description: "Bulk update results",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/BulkUpdateResponse" }
                            }
                        }
                    },
                    "400": { description: "Validation error" }
                }
            }
        }
    },
    components: {
        schemas: {
            BulkUpdateResponse: {
                type: "object",
                properties: {
                    success: { type: "boolean" },
                    operation: { type: "string" },
                    totalProcessed: { type: "integer" },
                    successful: { type: "integer" },
                    failed: { type: "integer" },
                    results: { type: "array" },
                    errors: { type: "array", items: { type: "string" } },
                    warnings: { type: "array", items: { type: "string" } }
                }
            }
        }
    }
};