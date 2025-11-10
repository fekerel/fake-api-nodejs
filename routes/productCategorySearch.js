// Search products by category, status, price range with variable parameters
export default (app, router) => {
    const db = router.db;

    app.get('/products/search', (req, res) => {
        const categoryId = req.query.categoryId ? Number(req.query.categoryId) : null;
        const status = req.query.status || null;
        const minPrice = req.query.minPrice ? Number(req.query.minPrice) : null;
        const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : null;
        const productId = req.query.productId ? Number(req.query.productId) : null;

        if (categoryId !== null && !Number.isFinite(categoryId)) {
            return res.status(400).json({ error: 'invalid categoryId' });
        }
        if (productId !== null && !Number.isFinite(productId)) {
            return res.status(400).json({ error: 'invalid productId' });
        }
        if (minPrice !== null && (!Number.isFinite(minPrice) || minPrice < 0)) {
            return res.status(400).json({ error: 'invalid minPrice' });
        }
        if (maxPrice !== null && (!Number.isFinite(maxPrice) || maxPrice < 0)) {
            return res.status(400).json({ error: 'invalid maxPrice' });
        }
        if (status !== null && !['active', 'inactive'].includes(status)) {
            return res.status(400).json({ error: 'invalid status' });
        }

        const products = db.get('products').value() || [];
        const categories = db.get('categories').value() || [];

        // Senaryo 1: Sadece productId varsa - tek ürün detayı
        if (productId !== null && categoryId === null && status === null && minPrice === null && maxPrice === null) {
            const product = products.find(p => Number(p.id) === productId);
            if (!product) return res.status(404).json({ error: 'product not found' });

            const category = categories.find(c => Number(c.id) === Number(product.categoryId));

            return res.json({
                type: 'single_product',
                product: {
                    id: product.id,
                    name: product.name,
                    description: product.description,
                    price: parseFloat(product.price) || 0,
                    stock: Number(product.stock) || 0,
                    status: product.status,
                    categoryId: product.categoryId,
                    categoryName: category ? category.name : 'Unknown',
                    variants: product.variants || []
                }
            });
        }

        // Senaryo 2: Sadece categoryId varsa - o kategorideki tüm ürünler
        if (categoryId !== null && productId === null && status === null && minPrice === null && maxPrice === null) {
            const category = categories.find(c => Number(c.id) === categoryId);
            if (!category) return res.status(404).json({ error: 'category not found' });

            const categoryProducts = products.filter(p => Number(p.categoryId) === categoryId);

            return res.json({
                type: 'category_products',
                categoryId,
                categoryName: category.name,
                totalProducts: categoryProducts.length,
                products: categoryProducts.map(p => ({
                    id: p.id,
                    name: p.name,
                    price: parseFloat(p.price) || 0,
                    stock: Number(p.stock) || 0,
                    status: p.status
                }))
            });
        }

        // Senaryo 3: Sadece status varsa - o durumdaki tüm ürünler
        if (status !== null && productId === null && categoryId === null && minPrice === null && maxPrice === null) {
            const statusProducts = products.filter(p => p.status === status);

            return res.json({
                type: 'status_products',
                status,
                totalProducts: statusProducts.length,
                products: statusProducts.map(p => ({
                    id: p.id,
                    name: p.name,
                    price: parseFloat(p.price) || 0,
                    stock: Number(p.stock) || 0,
                    categoryId: p.categoryId
                }))
            });
        }

        // Senaryo 4: categoryId + status - kategorideki belirli durumdaki ürünler
        if (categoryId !== null && status !== null && productId === null && minPrice === null && maxPrice === null) {
            const category = categories.find(c => Number(c.id) === categoryId);
            if (!category) return res.status(404).json({ error: 'category not found' });

            const filteredProducts = products.filter(p => 
                Number(p.categoryId) === categoryId && p.status === status
            );

            return res.json({
                type: 'category_status',
                categoryId,
                categoryName: category.name,
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

        // Senaryo 5: minPrice ve/veya maxPrice - fiyat aralığındaki ürünler
        if ((minPrice !== null || maxPrice !== null) && productId === null) {
            let filteredProducts = products;

            if (categoryId !== null) {
                filteredProducts = filteredProducts.filter(p => Number(p.categoryId) === categoryId);
            }
            if (status !== null) {
                filteredProducts = filteredProducts.filter(p => p.status === status);
            }
            if (minPrice !== null) {
                filteredProducts = filteredProducts.filter(p => (parseFloat(p.price) || 0) >= minPrice);
            }
            if (maxPrice !== null) {
                filteredProducts = filteredProducts.filter(p => (parseFloat(p.price) || 0) <= maxPrice);
            }

            return res.json({
                type: 'price_range',
                filters: {
                    categoryId: categoryId || null,
                    status: status || null,
                    minPrice: minPrice || null,
                    maxPrice: maxPrice || null
                },
                totalProducts: filteredProducts.length,
                products: filteredProducts.map(p => ({
                    id: p.id,
                    name: p.name,
                    price: parseFloat(p.price) || 0,
                    stock: Number(p.stock) || 0,
                    status: p.status,
                    categoryId: p.categoryId
                }))
            });
        }

        // Senaryo 6: Hiç parametre yoksa - tüm ürünler
        return res.json({
            type: 'all_products',
            totalProducts: products.length,
            products: products.map(p => ({
                id: p.id,
                name: p.name,
                price: parseFloat(p.price) || 0,
                stock: Number(p.stock) || 0,
                status: p.status,
                categoryId: p.categoryId
            }))
        });
    });
};

export const openapi = {
    paths: {
        "/products/search": {
            get: {
                summary: "Search products with variable parameters",
                parameters: [
                    { in: "query", name: "productId", schema: { type: "integer" }, description: "Get single product by ID" },
                    { in: "query", name: "categoryId", schema: { type: "integer" }, description: "Filter by category" },
                    { in: "query", name: "status", schema: { type: "string", enum: ["active", "inactive"] }, description: "Filter by status" },
                    { in: "query", name: "minPrice", schema: { type: "number", format: "float" }, description: "Minimum price" },
                    { in: "query", name: "maxPrice", schema: { type: "number", format: "float" }, description: "Maximum price" }
                ],
                responses: {
                    "200": {
                        description: "Products based on search parameters",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ProductSearchResult" }
                            }
                        }
                    },
                    "400": { description: "invalid parameters" },
                    "404": { description: "product or category not found" }
                }
            }
        }
    },
    components: {
        schemas: {
            ProductSearchResult: {
                oneOf: [
                    {
                        type: "object",
                        properties: {
                            type: { type: "string", enum: ["single_product"] },
                            product: { type: "object" }
                        }
                    },
                    {
                        type: "object",
                        properties: {
                            type: { type: "string", enum: ["category_products", "status_products", "category_status", "price_range", "all_products"] },
                            totalProducts: { type: "integer" },
                            products: { type: "array", items: { type: "object" } }
                        }
                    }
                ]
            }
        }
    }
};