// Create product bundles with discount calculation and validation
export default (app, router) => {
    const db = router.db;

    app.post('/products/create-bundle', (req, res) => {
        const { name, description, products, discount, bundlePrice, status } = req.body || {};

        if (!name) {
            return res.status(400).json({ error: 'name is required' });
        }

        if (!products || !Array.isArray(products) || products.length < 2) {
            return res.status(400).json({ error: 'products array is required and must contain at least 2 products' });
        }

        const validatedProducts = [];
        let totalOriginalPrice = 0;
        const errors = [];
        const warnings = [];

        for (const bundleProduct of products) {
            const { productId, quantity } = bundleProduct || {};

            if (!productId || quantity === undefined) {
                errors.push(`Missing productId or quantity: ${JSON.stringify(bundleProduct)}`);
                continue;
            }

            const product = db.get('products').find(p => Number(p.id) === Number(productId)).value();
            if (!product) {
                errors.push(`Product not found: ${productId}`);
                continue;
            }

            const requestedQuantity = Number(quantity) || 0;
            if (requestedQuantity <= 0) {
                errors.push(`Invalid quantity for product ${productId}: ${requestedQuantity}`);
                continue;
            }

            const productPrice = parseFloat(product.price) || 0;
            const itemTotal = requestedQuantity * productPrice;
            totalOriginalPrice += itemTotal;

            validatedProducts.push({
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
                errors
            });
        }

        if (validatedProducts.length < 2) {
            return res.status(400).json({
                error: 'At least 2 valid products are required for a bundle'
            });
        }

        // Calculate bundle price
        let finalPrice = totalOriginalPrice;
        let appliedDiscount = 0;

        if (bundlePrice !== undefined && bundlePrice !== null) {
            const customPrice = parseFloat(bundlePrice);
            if (customPrice < 0) {
                return res.status(400).json({ error: 'bundlePrice cannot be negative' });
            }
            finalPrice = customPrice;
            appliedDiscount = totalOriginalPrice - finalPrice;
        } else if (discount !== undefined && discount !== null) {
            const discountPercent = Number(discount);
            if (discountPercent < 0 || discountPercent > 100) {
                return res.status(400).json({ error: 'discount must be between 0 and 100' });
            }
            appliedDiscount = totalOriginalPrice * (discountPercent / 100);
            finalPrice = totalOriginalPrice - appliedDiscount;
        } else {
            // Default 10% discount for bundles
            appliedDiscount = totalOriginalPrice * 0.1;
            finalPrice = totalOriginalPrice - appliedDiscount;
            warnings.push('No discount specified, applying default 10% bundle discount');
        }

        const savings = Number(appliedDiscount.toFixed(2));
        const savingsPercent = totalOriginalPrice > 0 
            ? Number(((savings / totalOriginalPrice) * 100).toFixed(2))
            : 0;

        // Create bundle product
        const bundleId = db.get('products').value().length + 1;
        const newBundle = {
            id: bundleId,
            name: name,
            description: description || `Bundle of ${validatedProducts.length} products`,
            type: 'bundle',
            products: validatedProducts,
            originalPrice: Number(totalOriginalPrice.toFixed(2)),
            price: Number(finalPrice.toFixed(2)),
            discount: savings,
            discountPercent: savingsPercent,
            status: status || 'active',
            stock: Math.min(...validatedProducts.map(p => {
                const product = db.get('products').find(pr => Number(pr.id) === p.productId).value();
                return Math.floor((Number(product?.stock) || 0) / p.quantity);
            })),
            createdAt: Date.now(),
            updatedAt: Date.now()
        };

        db.get('products').push(newBundle).write();

        res.status(201).json({
            bundle: newBundle,
            summary: {
                totalProducts: validatedProducts.length,
                originalPrice: newBundle.originalPrice,
                bundlePrice: newBundle.price,
                savings: newBundle.discount,
                savingsPercent: newBundle.discountPercent
            },
            warnings: warnings.length > 0 ? warnings : undefined
        });
    });
};

export const openapi = {
    paths: {
        "/products/create-bundle": {
            post: {
                summary: "Create product bundles with discount calculation and validation",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                required: ["name", "products"],
                                properties: {
                                    name: { type: "string", example: "Summer Bundle" },
                                    description: { type: "string", nullable: true, example: "Best summer products" },
                                    products: {
                                        type: "array",
                                        items: {
                                            type: "object",
                                            required: ["productId", "quantity"],
                                            properties: {
                                                productId: { type: "integer", example: 1 },
                                                quantity: { type: "integer", example: 2 }
                                            }
                                        }
                                    },
                                    discount: { type: "number", nullable: true, example: 15 },
                                    bundlePrice: { type: "number", nullable: true, example: 99.99 },
                                    status: { type: "string", nullable: true, example: "active" }
                                }
                            }
                        }
                    }
                },
                responses: {
                    "201": {
                        description: "Bundle created successfully",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/BundleCreationResponse" }
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
            // Bundle içine giren ürün kalemi
            BundleItem: {
                type: "object",
                properties: {
                    productId: { type: "integer", example: 1 },
                    productName: { type: "string", example: "Phone X" },
                    quantity: { type: "integer", example: 2 },
                    unitPrice: { type: "number", example: 499.99 },
                    totalPrice: { type: "number", example: 999.98 }
                },
                required: ["productId","productName","quantity","unitPrice","totalPrice"]
            },
            // Oluşturulan bundle nesnesi
            Bundle: {
                type: "object",
                properties: {
                    id: { type: "integer", example: 101 },
                    name: { type: "string", example: "Summer Bundle" },
                    description: { type: "string", nullable: true, example: "Bundle of 3 products" },
                    type: { type: "string", enum: ["bundle"] },
                    products: { type: "array", items: { $ref: "#/components/schemas/BundleItem" } },
                    originalPrice: { type: "number", example: 149.97 },
                    price: { type: "number", example: 129.99 },
                    discount: { type: "number", example: 19.98 },
                    discountPercent: { type: "number", example: 13.34 },
                    status: { type: "string", enum: ["active", "inactive"], example: "active" },
                    stock: { type: "integer", example: 20 },
                    createdAt: { type: "integer", format: "int64", example: 1738368000000 },
                    updatedAt: { type: "integer", format: "int64", example: 1738368000000 }
                },
                required: [
                    "id","name","type","products",
                    "originalPrice","price","discount","discountPercent",
                    "status","stock","createdAt","updatedAt"
                ]
            },
            // ...existing code...
            BundleCreationResponse: {
                type: "object",
                properties: {
                    bundle: { $ref: "#/components/schemas/Bundle" },
                    summary: {
                        type: "object",
                        properties: {
                            totalProducts: { type: "integer" },
                            originalPrice: { type: "number" },
                            bundlePrice: { type: "number" },
                            savings: { type: "number" },
                            savingsPercent: { type: "number" }
                        },
                        required: ["totalProducts","originalPrice","bundlePrice","savings","savingsPercent"]
                    },
                    warnings: { type: "array", items: { type: "string" } }
                },
                required: ["bundle", "summary"]
            }
        }
    }
};