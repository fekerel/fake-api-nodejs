// Get user purchase summary with total spent, average order value, most purchased category and product
export default (app, router) => {
    const db = router.db;

    app.get('/users/:id/purchase-summary', (req, res) => {
        const userId = Number(req.params.id);
        
        if (!Number.isFinite(userId)) return res.status(400).json({ error: 'invalid id' });
        
        const user = db.get('users').find(u => Number(u.id) === userId).value();
        
        if (!user) return res.status(404).json({ error: 'user not found' });
        
        const orders = db.get('orders').filter(o => Number(o.userId) === userId).value() || [];
        
        const totalSpent = orders.reduce((acc, o) => acc + (parseFloat(o.totalAmount) || 0), 0);
        const averageOrderValue = orders.length > 0 ? Number((totalSpent / orders.length).toFixed(2)) : 0;
        
        const categoryPurchases = {};
        const productPurchases = {};
        
        orders.forEach(order => {
            if (order.items) {
                order.items.forEach(item => {
                    const product = db.get('products').find(p => Number(p.id) === Number(item.productId)).value();
                    if (product) {
                        const catId = Number(product.categoryId);
                        const quantity = Number(item.quantity) || 0;
                        
                        categoryPurchases[catId] = (categoryPurchases[catId] || 0) + quantity;
                        productPurchases[product.id] = (productPurchases[product.id] || 0) + quantity;
                    }
                });
            }
        });
        
        let mostPurchasedCategory = null;
        if (Object.keys(categoryPurchases).length > 0) {
            const maxCategoryId = Object.keys(categoryPurchases).reduce((a, b) => 
                categoryPurchases[a] > categoryPurchases[b] ? a : b
            );
            const category = db.get('categories').find(c => Number(c.id) === Number(maxCategoryId)).value();
            mostPurchasedCategory = category ? {
                categoryId: category.id,
                categoryName: category.name,
                totalQuantity: categoryPurchases[maxCategoryId]
            } : null;
        }
        
        let mostPurchasedProduct = null;
        if (Object.keys(productPurchases).length > 0) {
            const maxProductId = Object.keys(productPurchases).reduce((a, b) => 
                productPurchases[a] > productPurchases[b] ? a : b
            );
            const product = db.get('products').find(p => Number(p.id) === Number(maxProductId)).value();
            mostPurchasedProduct = product ? {
                productId: product.id,
                productName: product.name,
                totalQuantity: productPurchases[maxProductId]
            } : null;
        }
        
        res.json({
            userId,
            userName: `${user.firstName} ${user.lastName}`,
            totalOrders: orders.length,
            totalSpent: Number(totalSpent.toFixed(2)),
            averageOrderValue,
            mostPurchasedCategory,
            mostPurchasedProduct
        });
    });
};

export const openapi = {
    paths: {
        "/users/{id}/purchase-summary": {
            get: {
                summary: "Get user purchase summary",
                parameters: [
                    { in: "path", name: "id", required: true, schema: { type: "integer" }, example: 1 }
                ],
                responses: {
                    "200": {
                        description: "User purchase summary",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/UserPurchaseSummary" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            userId: 1,
                                            userName: "John Doe",
                                            totalOrders: 5,
                                            totalSpent: 450.50,
                                            averageOrderValue: 90.10,
                                            mostPurchasedCategory: { categoryId: 1, categoryName: "Category A", totalQuantity: 15 },
                                            mostPurchasedProduct: { productId: 5, productName: "Product X", totalQuantity: 8 }
                                        }
                                    }
                                }
                            }
                        }
                    },
                    "400": { description: "invalid id" },
                    "404": { description: "user not found" }
                }
            }
        }
    },
    components: {
        schemas: {
            UserPurchaseSummary: {
                type: "object",
                properties: {
                    userId: { type: "integer", example: 1 },
                    userName: { type: "string", example: "John Doe" },
                    totalOrders: { type: "integer", example: 5 },
                    totalSpent: { type: "number", format: "float", example: 450.50 },
                    averageOrderValue: { type: "number", format: "float", example: 90.10 },
                    mostPurchasedCategory: {
                        type: "object",
                        nullable: true,
                        properties: {
                            categoryId: { type: "integer", example: 1 },
                            categoryName: { type: "string", example: "Category A" },
                            totalQuantity: { type: "integer", example: 15 }
                        }
                    },
                    mostPurchasedProduct: {
                        type: "object",
                        nullable: true,
                        properties: {
                            productId: { type: "integer", example: 5 },
                            productName: { type: "string", example: "Product X" },
                            totalQuantity: { type: "integer", example: 8 }
                        }
                    }
                }
            }
        }
    }
};