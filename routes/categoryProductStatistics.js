// Get statistics for categories and products with variable parameters
export default (app, router) => {
    const db = router.db;

    app.get('/statistics/category-product', (req, res) => {
        const categoryId = req.query.categoryId ? Number(req.query.categoryId) : null;
        const status = req.query.status || null;
        const includeProducts = req.query.includeProducts === 'true';
        const includeSales = req.query.includeSales === 'true';

        if (categoryId !== null && !Number.isFinite(categoryId)) {
            return res.status(400).json({ error: 'invalid categoryId' });
        }
        if (status !== null && !['active', 'inactive'].includes(status)) {
            return res.status(400).json({ error: 'invalid status' });
        }

        const categories = db.get('categories').value() || [];
        const products = db.get('products').value() || [];
        const orders = db.get('orders').value() || [];

        // Senaryo 1: Sadece categoryId varsa - kategori istatistikleri
        if (categoryId !== null && status === null && !includeProducts && !includeSales) {
            const category = categories.find(c => Number(c.id) === categoryId);
            if (!category) return res.status(404).json({ error: 'category not found' });

            const categoryProducts = products.filter(p => Number(p.categoryId) === categoryId);

            return res.json({
                type: 'category_stats',
                category: {
                    id: category.id,
                    name: category.name,
                    description: category.description,
                    status: category.status
                },
                statistics: {
                    totalProducts: categoryProducts.length,
                    activeProducts: categoryProducts.filter(p => p.status === 'active').length,
                    inactiveProducts: categoryProducts.filter(p => p.status === 'inactive').length
                }
            });
        }

        // Senaryo 2: categoryId + includeProducts - kategori ve ürünleri
        if (categoryId !== null && status === null && includeProducts && !includeSales) {
            const category = categories.find(c => Number(c.id) === categoryId);
            if (!category) return res.status(404).json({ error: 'category not found' });

            const categoryProducts = products.filter(p => Number(p.categoryId) === categoryId);

            return res.json({
                type: 'category_with_products',
                category: {
                    id: category.id,
                    name: category.name,
                    description: category.description,
                    status: category.status
                },
                products: categoryProducts.map(p => ({
                    id: p.id,
                    name: p.name,
                    price: parseFloat(p.price) || 0,
                    stock: Number(p.stock) || 0,
                    status: p.status
                })),
                totalProducts: categoryProducts.length
            });
        }

        // Senaryo 3: categoryId + includeSales - kategori satış istatistikleri
        if (categoryId !== null && status === null && !includeProducts && includeSales) {
            const category = categories.find(c => Number(c.id) === categoryId);
            if (!category) return res.status(404).json({ error: 'category not found' });

            const categoryProducts = products.filter(p => Number(p.categoryId) === categoryId);
            const categoryProductIds = categoryProducts.map(p => Number(p.id));
            
            let totalSales = 0;
            let totalRevenue = 0;
            let orderCount = 0;

            orders.forEach(order => {
                if (order.items) {
                    let hasCategoryItem = false;
                    order.items.forEach(item => {
                        if (categoryProductIds.includes(Number(item.productId))) {
                            hasCategoryItem = true;
                            totalSales += Number(item.quantity) || 0;
                            totalRevenue += (parseFloat(item.price) || 0) * (Number(item.quantity) || 0);
                        }
                    });
                    if (hasCategoryItem) orderCount++;
                }
            });

            return res.json({
                type: 'category_sales_stats',
                category: {
                    id: category.id,
                    name: category.name
                },
                sales: {
                    totalSales,
                    totalRevenue: Number(totalRevenue.toFixed(2)),
                    orderCount,
                    averageOrderValue: orderCount > 0 ? Number((totalRevenue / orderCount).toFixed(2)) : 0
                }
            });
        }

        // Senaryo 4: categoryId + includeProducts + includeSales - tam istatistikler
        if (categoryId !== null && status === null && includeProducts && includeSales) {
            const category = categories.find(c => Number(c.id) === categoryId);
            if (!category) return res.status(404).json({ error: 'category not found' });

            const categoryProducts = products.filter(p => Number(p.categoryId) === categoryId);
            const categoryProductIds = categoryProducts.map(p => Number(p.id));
            
            let totalSales = 0;
            let totalRevenue = 0;
            let orderCount = 0;

            orders.forEach(order => {
                if (order.items) {
                    let hasCategoryItem = false;
                    order.items.forEach(item => {
                        if (categoryProductIds.includes(Number(item.productId))) {
                            hasCategoryItem = true;
                            totalSales += Number(item.quantity) || 0;
                            totalRevenue += (parseFloat(item.price) || 0) * (Number(item.quantity) || 0);
                        }
                    });
                    if (hasCategoryItem) orderCount++;
                }
            });

            return res.json({
                type: 'category_full_stats',
                category: {
                    id: category.id,
                    name: category.name,
                    description: category.description,
                    status: category.status
                },
                products: categoryProducts.map(p => ({
                    id: p.id,
                    name: p.name,
                    price: parseFloat(p.price) || 0,
                    stock: Number(p.stock) || 0,
                    status: p.status
                })),
                sales: {
                    totalSales,
                    totalRevenue: Number(totalRevenue.toFixed(2)),
                    orderCount,
                    averageOrderValue: orderCount > 0 ? Number((totalRevenue / orderCount).toFixed(2)) : 0
                },
                statistics: {
                    totalProducts: categoryProducts.length,
                    activeProducts: categoryProducts.filter(p => p.status === 'active').length
                }
            });
        }

        // Senaryo 5: Sadece status varsa - o durumdaki kategoriler ve ürünleri
        if (status !== null && categoryId === null) {
            const statusProducts = products.filter(p => p.status === status);
            const statusCategories = categories.filter(c => c.status === status);

            return res.json({
                type: 'status_statistics',
                status,
                statistics: {
                    totalCategories: statusCategories.length,
                    totalProducts: statusProducts.length,
                    categories: statusCategories.map(c => ({
                        id: c.id,
                        name: c.name,
                        productCount: statusProducts.filter(p => Number(p.categoryId) === Number(c.id)).length
                    }))
                }
            });
        }

        // Senaryo 6: categoryId + status - kategorideki belirli durumdaki ürünler
        if (categoryId !== null && status !== null) {
            const category = categories.find(c => Number(c.id) === categoryId);
            if (!category) return res.status(404).json({ error: 'category not found' });

            const filteredProducts = products.filter(p => 
                Number(p.categoryId) === categoryId && p.status === status
            );

            return res.json({
                type: 'category_status_products',
                category: {
                    id: category.id,
                    name: category.name
                },
                status,
                totalProducts: filteredProducts.length,
                products: filteredProducts.map(p => ({
                    id: p.id,
                    name: p.name,
                    price: parseFloat(p.price) || 0,
                    stock: Number(p.stock) || 0
                }))
            });
        }

        // Senaryo 7: Hiç parametre yoksa - genel istatistikler
        return res.json({
            type: 'general_statistics',
            statistics: {
                totalCategories: categories.length,
                totalProducts: products.length,
                activeProducts: products.filter(p => p.status === 'active').length,
                inactiveProducts: products.filter(p => p.status === 'inactive').length,
                totalOrders: orders.length
            }
        });
    });
};

export const openapi = {
    paths: {
        "/statistics/category-product": {
            get: {
                summary: "Get statistics for categories and products with variable parameters",
                parameters: [
                    { in: "query", name: "categoryId", schema: { type: "integer" }, description: "Filter by category ID" },
                    { in: "query", name: "status", schema: { type: "string", enum: ["active", "inactive"] }, description: "Filter by status" },
                    { in: "query", name: "includeProducts", schema: { type: "boolean" }, description: "Include products in response" },
                    { in: "query", name: "includeSales", schema: { type: "boolean" }, description: "Include sales statistics" }
                ],
                responses: {
                    "200": {
                        description: "Statistics based on parameters",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/CategoryProductStatistics" }
                            }
                        }
                    },
                    "400": { description: "invalid parameters" },
                    "404": { description: "category not found" }
                }
            }
        }
    },
    components: {
        schemas: {
            CategoryProductStatistics: {
                oneOf: [
                    {
                        type: "object",
                        properties: {
                            type: { type: "string", enum: ["category_stats", "category_with_products", "category_sales_stats", "category_full_stats", "category_status_products"] },
                            category: { type: "object" },
                            products: { type: "array", items: { type: "object" } },
                            sales: { type: "object" },
                            statistics: { type: "object" }
                        }
                    },
                    {
                        type: "object",
                        properties: {
                            type: { type: "string", enum: ["status_statistics", "general_statistics"] },
                            status: { type: "string" },
                            statistics: { type: "object" }
                        }
                    }
                ]
            }
        }
    }
};