// Bir kategorideki tüm ürünlerin review istatistiklerini getirir: toplam review sayısı, ortalama rating ve en çok review alan ürünler

export default (app, router) => {
    const db = router.db;

    app.get('/categories/:id/reviews-statistics', (req, res) => {
        const categoryId = Number(req.params.id);
        
        if (!Number.isFinite(categoryId)) return res.status(400).json({ error: 'invalid id' });
        
        const category = db.get('categories').find(c => Number(c.id) === categoryId).value();
        if (!category) return res.status(404).json({ error: 'category not found' });
        
        const products = db.get('products').filter(p => Number(p.categoryId) === categoryId).value() || [];
        const productIds = products.map(p => Number(p.id));
        
        const reviews = db.get('reviews').value() || [];
        const categoryReviews = reviews.filter(r => productIds.includes(Number(r.productId)));
        
        const totalReviews = categoryReviews.length;
        let totalRating = 0;
        const productReviewStats = {};
        
        categoryReviews.forEach(review => {
            const productId = Number(review.productId);
            const rating = Number(review.rating) || 0;
            totalRating += rating;
            
            if (!productReviewStats[productId]) {
                productReviewStats[productId] = {
                    totalReviews: 0,
                    totalRating: 0
                };
            }
            productReviewStats[productId].totalReviews++;
            productReviewStats[productId].totalRating += rating;
        });
        
        const averageRating = totalReviews > 0 ? Number((totalRating / totalReviews).toFixed(2)) : 0;
        
        const topReviewedProducts = Object.keys(productReviewStats)
            .map(productId => {
                const product = products.find(p => Number(p.id) === Number(productId));
                const stats = productReviewStats[productId];
                return {
                    productId: Number(productId),
                    productName: product ? product.name : 'Unknown',
                    totalReviews: stats.totalReviews,
                    averageRating: Number((stats.totalRating / stats.totalReviews).toFixed(2))
                };
            })
            .sort((a, b) => b.totalReviews - a.totalReviews)
            .slice(0, 5);
        
        res.json({
            categoryId,
            categoryName: category.name,
            totalProducts: products.length,
            totalReviews,
            averageRating,
            productsWithReviews: Object.keys(productReviewStats).length,
            topReviewedProducts
        });
    });
};

export const openapi = {
    paths: {
        "/categories/{id}/reviews-statistics": {
            get: {
                summary: "Get category reviews statistics",
                parameters: [
                    { in: "path", name: "id", required: true, schema: { type: "integer" }, example: 1 }
                ],
                responses: {
                    "200": {
                        description: "Category reviews statistics",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/CategoryReviewsStatistics" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            categoryId: 1,
                                            categoryName: "Category A",
                                            totalProducts: 15,
                                            totalReviews: 120,
                                            averageRating: 4.3,
                                            productsWithReviews: 12,
                                            topReviewedProducts: [
                                                {
                                                    productId: 5,
                                                    productName: "Product X",
                                                    totalReviews: 25,
                                                    averageRating: 4.5
                                                }
                                            ]
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
            CategoryReviewsStatistics: {
                type: "object",
                properties: {
                    categoryId: { type: "integer", example: 1 },
                    categoryName: { type: "string", example: "Category A" },
                    totalProducts: { type: "integer", example: 15 },
                    totalReviews: { type: "integer", example: 120 },
                    averageRating: { type: "number", format: "float", example: 4.3 },
                    productsWithReviews: { type: "integer", example: 12 },
                    topReviewedProducts: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                productId: { type: "integer", example: 5 },
                                productName: { type: "string", example: "Product X" },
                                totalReviews: { type: "integer", example: 25 },
                                averageRating: { type: "number", format: "float", example: 4.5 }
                            }
                        }
                    }
                }
            }
        }
    }
};