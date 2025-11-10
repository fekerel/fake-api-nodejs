// Analyze reviews by productId, userId, rating with variable parameters
export default (app, router) => {
    const db = router.db;

    app.get('/reviews/analysis', (req, res) => {
        const productId = req.query.productId ? Number(req.query.productId) : null;
        const userId = req.query.userId ? Number(req.query.userId) : null;
        const rating = req.query.rating ? Number(req.query.rating) : null;
        const reviewId = req.query.reviewId ? Number(req.query.reviewId) : null;

        if (productId !== null && !Number.isFinite(productId)) {
            return res.status(400).json({ error: 'invalid productId' });
        }
        if (userId !== null && !Number.isFinite(userId)) {
            return res.status(400).json({ error: 'invalid userId' });
        }
        if (rating !== null && (!Number.isFinite(rating) || rating < 1 || rating > 5)) {
            return res.status(400).json({ error: 'invalid rating' });
        }
        if (reviewId !== null && !Number.isFinite(reviewId)) {
            return res.status(400).json({ error: 'invalid reviewId' });
        }

        const reviews = db.get('reviews').value() || [];
        const products = db.get('products').value() || [];
        const users = db.get('users').value() || [];

        // Senaryo 1: Sadece reviewId varsa - tek yorum detayı
        if (reviewId !== null && productId === null && userId === null && rating === null) {
            const review = reviews.find(r => Number(r.id) === reviewId);
            if (!review) return res.status(404).json({ error: 'review not found' });

            const product = products.find(p => Number(p.id) === Number(review.productId));
            const user = users.find(u => Number(u.id) === Number(review.userId));

            return res.json({
                type: 'single_review',
                review: {
                    id: review.id,
                    productId: review.productId,
                    productName: product ? product.name : 'Unknown',
                    userId: review.userId,
                    userName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Unknown',
                    rating: review.rating,
                    comment: review.comment,
                    createdAt: review.createdAt
                }
            });
        }

        // Senaryo 2: Sadece productId varsa - ürüne ait tüm yorumlar
        if (productId !== null && reviewId === null && userId === null && rating === null) {
            const product = products.find(p => Number(p.id) === productId);
            if (!product) return res.status(404).json({ error: 'product not found' });

            const productReviews = reviews.filter(r => Number(r.productId) === productId);
            const averageRating = productReviews.length > 0
                ? Number((productReviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / productReviews.length).toFixed(2))
                : 0;

            return res.json({
                type: 'product_reviews',
                productId,
                productName: product.name,
                totalReviews: productReviews.length,
                averageRating,
                reviews: productReviews.map(r => ({
                    id: r.id,
                    userId: r.userId,
                    rating: r.rating,
                    comment: r.comment,
                    createdAt: r.createdAt
                }))
            });
        }

        // Senaryo 3: Sadece userId varsa - kullanıcının tüm yorumları
        if (userId !== null && reviewId === null && productId === null && rating === null) {
            const user = users.find(u => Number(u.id) === userId);
            if (!user) return res.status(404).json({ error: 'user not found' });

            const userReviews = reviews.filter(r => Number(r.userId) === userId);
            const averageRating = userReviews.length > 0
                ? Number((userReviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / userReviews.length).toFixed(2))
                : 0;

            return res.json({
                type: 'user_reviews',
                userId,
                userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
                totalReviews: userReviews.length,
                averageRating,
                reviews: userReviews.map(r => ({
                    id: r.id,
                    productId: r.productId,
                    rating: r.rating,
                    comment: r.comment,
                    createdAt: r.createdAt
                }))
            });
        }

        // Senaryo 4: Sadece rating varsa - o puanlama değerindeki tüm yorumlar
        if (rating !== null && reviewId === null && productId === null && userId === null) {
            const ratingReviews = reviews.filter(r => Number(r.rating) === rating);

            return res.json({
                type: 'rating_reviews',
                rating,
                totalReviews: ratingReviews.length,
                reviews: ratingReviews.map(r => ({
                    id: r.id,
                    productId: r.productId,
                    userId: r.userId,
                    comment: r.comment,
                    createdAt: r.createdAt
                }))
            });
        }

        // Senaryo 5: productId + rating - ürüne ait belirli puanlama değerindeki yorumlar
        if (productId !== null && rating !== null && reviewId === null && userId === null) {
            const product = products.find(p => Number(p.id) === productId);
            if (!product) return res.status(404).json({ error: 'product not found' });

            const filteredReviews = reviews.filter(r => 
                Number(r.productId) === productId && Number(r.rating) === rating
            );

            return res.json({
                type: 'product_rating_reviews',
                productId,
                productName: product.name,
                rating,
                totalReviews: filteredReviews.length,
                reviews: filteredReviews.map(r => ({
                    id: r.id,
                    userId: r.userId,
                    comment: r.comment,
                    createdAt: r.createdAt
                }))
            });
        }

        // Senaryo 6: userId + rating - kullanıcının belirli puanlama değerindeki yorumları
        if (userId !== null && rating !== null && reviewId === null && productId === null) {
            const user = users.find(u => Number(u.id) === userId);
            if (!user) return res.status(404).json({ error: 'user not found' });

            const filteredReviews = reviews.filter(r => 
                Number(r.userId) === userId && Number(r.rating) === rating
            );

            return res.json({
                type: 'user_rating_reviews',
                userId,
                userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
                rating,
                totalReviews: filteredReviews.length,
                reviews: filteredReviews.map(r => ({
                    id: r.id,
                    productId: r.productId,
                    comment: r.comment,
                    createdAt: r.createdAt
                }))
            });
        }

        // Senaryo 7: productId + userId - kullanıcının belirli ürüne yaptığı yorum
        if (productId !== null && userId !== null && reviewId === null && rating === null) {
            const product = products.find(p => Number(p.id) === productId);
            const user = users.find(u => Number(u.id) === userId);
            if (!product) return res.status(404).json({ error: 'product not found' });
            if (!user) return res.status(404).json({ error: 'user not found' });

            const filteredReviews = reviews.filter(r => 
                Number(r.productId) === productId && Number(r.userId) === userId
            );

            return res.json({
                type: 'user_product_reviews',
                productId,
                productName: product.name,
                userId,
                userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
                totalReviews: filteredReviews.length,
                reviews: filteredReviews.map(r => ({
                    id: r.id,
                    rating: r.rating,
                    comment: r.comment,
                    createdAt: r.createdAt
                }))
            });
        }

        // Senaryo 8: Hiç parametre yoksa - tüm yorumlar
        return res.json({
            type: 'all_reviews',
            totalReviews: reviews.length,
            averageRating: reviews.length > 0
                ? Number((reviews.reduce((sum, r) => sum + (Number(r.rating) || 0), 0) / reviews.length).toFixed(2))
                : 0,
            reviews: reviews.map(r => ({
                id: r.id,
                productId: r.productId,
                userId: r.userId,
                rating: r.rating,
                createdAt: r.createdAt
            }))
        });
    });
};

export const openapi = {
    paths: {
        "/reviews/analysis": {
            get: {
                summary: "Analyze reviews with variable parameters",
                parameters: [
                    { in: "query", name: "reviewId", schema: { type: "integer" }, description: "Get single review by ID" },
                    { in: "query", name: "productId", schema: { type: "integer" }, description: "Filter by product ID" },
                    { in: "query", name: "userId", schema: { type: "integer" }, description: "Filter by user ID" },
                    { in: "query", name: "rating", schema: { type: "integer", minimum: 1, maximum: 5 }, description: "Filter by rating" }
                ],
                responses: {
                    "200": {
                        description: "Reviews based on analysis parameters",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/ReviewAnalysisResult" }
                            }
                        }
                    },
                    "400": { description: "invalid parameters" },
                    "404": { description: "review, product or user not found" }
                }
            }
        }
    },
    components: {
        schemas: {
            ReviewAnalysisResult: {
                oneOf: [
                    {
                        type: "object",
                        properties: {
                            type: { type: "string", enum: ["single_review"] },
                            review: { type: "object" }
                        }
                    },
                    {
                        type: "object",
                        properties: {
                            type: { type: "string", enum: ["product_reviews", "user_reviews", "rating_reviews", "product_rating_reviews", "user_rating_reviews", "user_product_reviews", "all_reviews"] },
                            totalReviews: { type: "integer" },
                            reviews: { type: "array", items: { type: "object" } }
                        }
                    }
                ]
            }
        }
    }
};