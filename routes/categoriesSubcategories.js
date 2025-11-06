export default (app, router) => {
    const db = router.db; 

    app.get('/categories/:id/subcategories', (req, res) => {
        // Get category subcategories hierarchy with product counts
        const categoryId = Number(req.params.id);
        
        if (!Number.isFinite(categoryId)) return res.status(400).json({ error: 'invalid id' });
        
        const category = db.get('categories').find(c => Number(c.id) === categoryId).value();
        
        if (!category) return res.status(404).json({ error: 'category not found' });
        
        // Alt kategorileri bul
        const subcategories = db.get('categories')
            .filter(c => c.parentId !== null && Number(c.parentId) === categoryId)
            .value() || [];
        
        // Her alt kategori için ürün sayısını hesapla
        const subcategoriesWithCount = subcategories.map(sub => {
            const productCount = db.get('products')
                .filter(p => Number(p.categoryId) === Number(sub.id))
                .value().length;
            
            return {
                id: sub.id,
                name: sub.name,
                description: sub.description,
                status: sub.status,
                productCount
            };
        });
        
        // Bu kategori ve alt kategorilerindeki toplam ürün sayısı
        const categoryProductCount = db.get('products')
            .filter(p => Number(p.categoryId) === categoryId)
            .value().length;
        
        let totalProducts = categoryProductCount;
        subcategories.forEach(sub => {
            const subProductCount = db.get('products')
                .filter(p => Number(p.categoryId) === Number(sub.id))
                .value().length;
            totalProducts += subProductCount;
        });
        
        // Hiyerarşi derinliği (sadece bir seviye alt kategori kontrol ediyoruz)
        const depth = subcategories.length > 0 ? 1 : 0;
        
        res.json({
            categoryId,
            categoryName: category.name,
            parentId: category.parentId,
            subcategories: subcategoriesWithCount,
            totalProducts,
            depth
        });
    });
}

export const openapi = {
    paths: {
        "/categories/{id}/subcategories": {
            get: {
                summary: "Get category subcategories hierarchy",
                parameters: [
                    { in: "path", name: "id", required: true, schema: { type: "integer" }, example: 1 }
                ],
                responses: {
                    "200": {
                        description: "Category subcategories",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/CategorySubcategories" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            categoryId: 1,
                                            categoryName: "Meyve & Sebze",
                                            parentId: null,
                                            subcategories: [
                                                { id: 5, name: "Meyve & Sebze Alt Kategori", description: "Açıklama", status: "active", productCount: 10 }
                                            ],
                                            totalProducts: 35,
                                            depth: 1
                                        }
                                    }
                                }
                            }
                        }
                    },
                    "400": { description: "invalid id" },
                    "404": { description: "category not found" }
                }
            }
        }
    },
    components: {
        schemas: {
            CategorySubcategories: {
                type: "object",
                properties: {
                    categoryId: { type: "integer", example: 1 },
                    categoryName: { type: "string", example: "Meyve & Sebze" },
                    parentId: { type: "integer", nullable: true, example: null },
                    subcategories: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                id: { type: "integer", example: 5 },
                                name: { type: "string", example: "Meyve & Sebze Alt Kategori" },
                                description: { type: "string", example: "Açıklama" },
                                status: { type: "string", example: "active" },
                                productCount: { type: "integer", example: 10 }
                            }
                        }
                    },
                    totalProducts: { type: "integer", example: 35 },
                    depth: { type: "integer", example: 1 }
                }
            }
        }
    }
};