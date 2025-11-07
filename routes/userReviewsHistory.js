// Bir kullanıcının yazdığı tüm review'ları ve review istatistiklerini getirir

export default (app, router) => {
    const db = router.db;

    app.get('/users/:id/reviews-history', (req, res) => {
        const userId = Number(req.params.id);
        
        if (!Number.isFinite(userId)) return res.status(400).json({ error: 'invalid id' });
        
        const user = db.get('users').find(u => Number(u.id) === userId).value();
        if (!user) return res.status(404).json({ error: 'user not found' });
        
        const reviews = db.get('reviews').filter(r => Number(r.userId) === userId).value() || [];
        
        const totalReviews = reviews.length;
        let totalRating = 0;
        const reviewsByProduct = {};
        
        reviews.forEach(review => {
            const productId = Number(review.productId);
            const rating = Number(review.rating) || 0;
            totalRating += rating;
            
            if (!reviewsByProduct[productId]) {
                reviewsByProduct[productId] = [];
            }
            reviewsByProduct[productId].push(review);
        });
        
        const averageRating = totalReviews > 0 ? Number((totalRating / totalReviews).toFixed(2)) : 0;
        
        const reviewDetails = reviews
            .sort((a, b) => (Number(b.createdAt) || 0) - (Number(a.createdAt) || 0))
            .map(review => {
                const product = db.get('products').find(p => Number(p.id) === Number(review.productId)).value();
                return {
                    reviewId: Number(review.id),
                    productId: Number(review.productId),
                    productName: product ? product.name : 'Unknown',
                    rating: Number(review.rating),
                    comment: review.comment || null,
                    createdAt: review.createdAt
                };
            });
        
        res.json({
            userId,
            userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
            totalReviews,
            averageRating,
            reviewsByProductCount: Object.keys(reviewsByProduct).length,
            reviews: reviewDetails
        });
    });
};

export const openapi = {
    paths: {
        "/users/{id}/reviews-history": {
            get: {
                summary: "Get user reviews history",
                parameters: [
                    { in: "path", name: "id", required: true, schema: { type: "integer" }, example: 1 }
                ],
                responses: {
                    "200": {
                        description: "User reviews history",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/UserReviewsHistory" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            userId: 1,
                                            userName: "John Doe",
                                            totalReviews: 10,
                                            averageRating: 4.5,
                                            reviewsByProductCount: 8,
                                            reviews: [
                                                {
                                                    reviewId: 5,
                                                    productId: 3,
                                                    productName: "Product X",
                                                    rating: 5,
                                                    comment: "Excellent!",
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
                    "404": { description: "user not found" }
                }
            }
        }
    },
    components: {
        schemas: {
            UserReviewsHistory: {
                type: "object",
                properties: {
                    userId: { type: "integer", example: 1 },
                    userName: { type: "string", example: "John Doe" },
                    totalReviews: { type: "integer", example: 10 },
                    averageRating: { type: "number", format: "float", example: 4.5 },
                    reviewsByProductCount: { type: "integer", example: 8 },
                    reviews: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                reviewId: { type: "integer", example: 5 },
                                productId: { type: "integer", example: 3 },
                                productName: { type: "string", example: "Product X" },
                                rating: { type: "integer", example: 5 },
                                comment: { type: "string", nullable: true, example: "Excellent!" },
                                createdAt: { type: "integer", example: 1762406642107 }
                            }
                        }
                    }
                }
            }
        }
    }
};