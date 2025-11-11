// Search reviews by reviewId, productId, userId, or rating
export default (app, router) => {
    const db = router.db;

    app.post('/reviews/search', (req, res) => {
        const { reviewId, productId, userId, rating } = req.body || {};

        if (!reviewId && !productId && !userId && !rating) {
            return res.status(400).json({ error: 'At least one search field is required' });
        }

        let reviews = db.get('reviews').value() || [];

        if (reviewId !== undefined && reviewId !== null) {
            reviews = reviews.filter(r => Number(r.id) === Number(reviewId));
        }

        if (productId !== undefined && productId !== null) {
            reviews = reviews.filter(r => Number(r.productId) === Number(productId));
        }

        if (userId !== undefined && userId !== null) {
            reviews = reviews.filter(r => Number(r.userId) === Number(userId));
        }

        if (rating !== undefined && rating !== null) {
            reviews = reviews.filter(r => Number(r.rating) === Number(rating));
        }

        if (reviews.length === 0) {
            return res.status(404).json({ error: 'No reviews found' });
        }

        // reviewId is unique, so if reviewId is provided and found, return single object
        if (reviewId !== undefined && reviewId !== null && reviews.length === 1) {
            return res.json(reviews[0]);
        }

        // productId + userId combination is unique per user, so if both provided and found single, return object
        if (productId !== undefined && productId !== null && userId !== undefined && userId !== null && reviews.length === 1) {
            return res.json(reviews[0]);
        }

        // Otherwise return array
        res.json(reviews);
    });
};

export const openapi = {
    paths: {
        "/reviews/search": {
            post: {
                summary: "Search reviews by reviewId, productId, userId, or rating",
                requestBody: {
                    required: true,
                    content: {
                        "application/json": {
                            schema: {
                                type: "object",
                                properties: {
                                    reviewId: { type: "integer", nullable: true, example: 1 },
                                    productId: { type: "integer", nullable: true, example: 5 },
                                    userId: { type: "integer", nullable: true, example: 10 },
                                    rating: { type: "integer", nullable: true, example: 5 }
                                }
                            },
                            examples: {
                                "byReviewId": {
                                    summary: "Search by reviewId (returns object)",
                                    value: { reviewId: 1 }
                                },
                                "byProductId": {
                                    summary: "Search by productId (returns array)",
                                    value: { productId: 5 }
                                },
                                "byProductAndUser": {
                                    summary: "Search by productId and userId (returns object)",
                                    value: { productId: 5, userId: 10 }
                                },
                                "byRating": {
                                    summary: "Search by rating (returns array)",
                                    value: { rating: 5 }
                                }
                            }
                        }
                    }
                },
                responses: {
                    "200": {
                        description: "Review(s) found",
                        content: {
                            "application/json": {
                                schema: {
                                    oneOf: [
                                        { $ref: "#/components/schemas/Review" },
                                        {
                                            type: "array",
                                            items: { $ref: "#/components/schemas/Review" }
                                        }
                                    ]
                                }
                            }
                        }
                    },
                    "400": { description: "At least one search field is required" },
                    "404": { description: "No reviews found" }
                }
            }
        }
    },
    components: {
        schemas: {
            Review: {
                type: "object",
                properties: {
                    id: { type: "integer" },
                    productId: { type: "integer" },
                    userId: { type: "integer" },
                    rating: { type: "integer" },
                    comment: { type: "string" }
                }
            }
        }
    }
};