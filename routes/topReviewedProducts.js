// En çok review alan ürünleri, ortalama rating'leri ve toplam review sayılarıyla birlikte getirir

export default (app, router) => {
    const db = router.db;

    app.get('/products/top-reviewed', (req, res) => {
        const limit = Number(req.query.limit) || 10;
        
        const products = db.get('products').value() || [];
        const reviews = db.get('reviews').value() || [];
        
        const productStats = {};
        
        products.forEach(product => {
            const productId = Number(product.id);
            const productReviews = reviews.filter(r => Number(r.productId) === productId);
            
            if (productReviews.length > 0) {
                let totalRating = 0;
                productReviews.forEach(review => {
                    totalRating += Number(review.rating) || 0;
                });
                
                const averageRating = Number((totalRating / productReviews.length).toFixed(2));
                
                productStats[productId] = {
                    productId,
                    productName: product.name,
                    categoryId: Number(product.categoryId),
                    totalReviews: productReviews.length,
                    averageRating,
                    latestReviewDate: Math.max(...productReviews.map(r => Number(r.createdAt) || 0))
                };
            }
        });
        
        const topReviewed = Object.values(productStats)
            .sort((a, b) => {
                if (b.totalReviews !== a.totalReviews) {
                    return b.totalReviews - a.totalReviews;
                }
                return b.averageRating - a.averageRating;
            })
            .slice(0, limit);
        
        const categories = db.get('categories').value() || [];
        topReviewed.forEach(item => {
            const category = categories.find(c => Number(c.id) === item.categoryId);
            item.categoryName = category ? category.name : 'Unknown';
        });
        
        res.json({
            totalProducts: topReviewed.length,
            limit,
            topReviewedProducts: topReviewed
        });
    });
};

export const openapi = {
    paths: {
        "/products/top-reviewed": {
            get: {
                summary: "Get top reviewed products",
                parameters: [
                    {
                        in: "query",
                        name: "limit",
                        schema: { type: "integer" },
                        description: "Number of products to return",
                        example: 10
                    }
                ],
                responses: {
                    "200": {
                        description: "Top reviewed products",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/TopReviewedProducts" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            totalProducts: 10,
                                            limit: 10,
                                            topReviewedProducts: [
                                                {
                                                    productId: 5,
                                                    productName: "Product X",
                                                    categoryId: 1,
                                                    categoryName: "Category A",
                                                    totalReviews: 50,
                                                    averageRating: 4.5,
                                                    latestReviewDate: 1762406642107
                                                }
                                            ]
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }
    },
    components: {
        schemas: {
            TopReviewedProducts: {
                type: "object",
                properties: {
                    totalProducts: { type: "integer", example: 10 },
                    limit: { type: "integer", example: 10 },
                    topReviewedProducts: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                productId: { type: "integer", example: 5 },
                                productName: { type: "string", example: "Product X" },
                                categoryId: { type: "integer", example: 1 },
                                categoryName: { type: "string", example: "Category A" },
                                totalReviews: { type: "integer", example: 50 },
                                averageRating: { type: "number", format: "float", example: 4.5 },
                                latestReviewDate: { type: "integer", example: 1762406642107 }
                            }
                        }
                    }
                }
            }
        }
    }
};