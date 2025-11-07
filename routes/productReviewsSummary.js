// Bir ürünün tüm review'larının özetini getirir: ortalama rating, toplam review sayısı, rating dağılımı ve en son review'lar

export default (app, router) => {
    const db = router.db;

    app.get('/products/:id/reviews-summary', (req, res) => {
        const productId = Number(req.params.id);
        
        if (!Number.isFinite(productId)) return res.status(400).json({ error: 'invalid id' });
        
        const product = db.get('products').find(p => Number(p.id) === productId).value();
        if (!product) return res.status(404).json({ error: 'product not found' });
        
        const reviews = db.get('reviews').filter(r => Number(r.productId) === productId).value() || [];
        
        const totalReviews = reviews.length;
        let totalRating = 0;
        const ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
        
        reviews.forEach(review => {
            const rating = Number(review.rating) || 0;
            if (rating >= 1 && rating <= 5) {
                totalRating += rating;
                ratingDistribution[rating]++;
            }
        });
        
        const averageRating = totalReviews > 0 ? Number((totalRating / totalReviews).toFixed(2)) : 0;
        
        const recentReviews = reviews
            .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0))
            .slice(0, 5)
            .map(review => {
                const user = db.get('users').find(u => Number(u.id) === Number(review.userId)).value();
                return {
                    reviewId: Number(review.id),
                    userId: Number(review.userId),
                    userName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Unknown',
                    rating: Number(review.rating),
                    comment: review.comment || null,
                    createdAt: review.createdAt
                };
            });
        
        res.json({
            productId,
            productName: product.name,
            totalReviews,
            averageRating,
            ratingDistribution,
            recentReviews
        });
    });
};

export const openapi = {
    paths: {
        "/products/{id}/reviews-summary": {
            get: {
                summary: "Get product reviews summary",
                parameters: [
                    { in: "path", name: "id", required: true, schema: { type: "integer" }, example: 1 }
                ],
                responses: {
                    "200": {
                        description: "Product reviews summary",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ProductReviewsSummary" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            productId: 1,
                                            productName: "Product A",
                                            totalReviews: 25,
                                            averageRating: 4.2,
                                            ratingDistribution: { 1: 2, 2: 3, 3: 5, 4: 8, 5: 7 },
                                            recentReviews: [
                                                {
                                                    reviewId: 10,
                                                    userId: 5,
                                                    userName: "John Doe",
                                                    rating: 5,
                                                    comment: "Great product!",
                                                    createdAt: 1762406642107
                                                }
                                            ]
                                        }
                                    }
                                }
                            }
                        }
                    },
                    "400": { description: "invalid id" },
                    "404": { description: "product not found" }
                }
            }
        }
    },
    components: {
        schemas: {
            ProductReviewsSummary: {
                type: "object",
                properties: {
                    productId: { type: "integer", example: 1 },
                    productName: { type: "string", example: "Product A" },
                    totalReviews: { type: "integer", example: 25 },
                    averageRating: { type: "number", format: "float", example: 4.2 },
                    ratingDistribution: {
                        type: "object",
                        properties: {
                            "1": { type: "integer", example: 2 },
                            "2": { type: "integer", example: 3 },
                            "3": { type: "integer", example: 5 },
                            "4": { type: "integer", example: 8 },
                            "5": { type: "integer", example: 7 }
                        }
                    },
                    recentReviews: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                reviewId: { type: "integer", example: 10 },
                                userId: { type: "integer", example: 5 },
                                userName: { type: "string", example: "John Doe" },
                                rating: { type: "integer", example: 5 },
                                comment: { type: "string", nullable: true, example: "Great product!" },
                                createdAt: { type: "integer", example: 1762406642107 }
                            }
                        }
                    }
                }
            }
        }
    }
};