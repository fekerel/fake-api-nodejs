// Compare performance metrics across categories
import { createBreakingHandler } from '../utils/breaking-handler.js';

// Breaking change definitions for this endpoint
const BREAKING_DEFINITIONS = {
    FIELD_RENAME: {
        fieldMappings: { 'sortBy': 'sort_by' }
    },
    STATUS_CODE: { successCode: 226 },
    RESPONSE_STRUCTURE: { wrapKey: 'data' }
};

export default (app, router) => {
    const db = router.db;

    app.get('/categories/performance-comparison', (req, res) => {
        const breaking = createBreakingHandler('GET /categories/performance-comparison', BREAKING_DEFINITIONS);
        
        // Check for deprecated field names (old names should not be used)
        const deprecatedError = breaking.checkDeprecatedFields(req.query);
        if (deprecatedError) {
            return res.status(400).json(deprecatedError);
        }
        
        // Transform query params for FIELD_RENAME (sort_by -> sortBy)
        const query = breaking.transformRequest({ ...req.query });
        
        const limit = query.limit ? Number(query.limit) : null;
        const sortBy = query.sortBy || 'totalRevenue'; // totalRevenue, totalSales, totalProducts, averagePrice

        const categories = db.get('categories').value() || [];
        const products = db.get('products').value() || [];
        const orders = db.get('orders').value() || [];

        const categoryStats = {};

        categories.forEach(category => {
            const categoryId = Number(category.id);
            const categoryProducts = products.filter(p => Number(p.categoryId) === categoryId);
            
            let totalSales = 0;
            let totalRevenue = 0;
            let totalStock = 0;
            let totalPrice = 0;

            orders.forEach(order => {
                if (order.items) {
                    order.items.forEach(item => {
                        const product = categoryProducts.find(p => Number(p.id) === Number(item.productId));
                        if (product) {
                            const quantity = Number(item.quantity) || 0;
                            const price = parseFloat(item.price) || 0;
                            totalSales += quantity;
                            totalRevenue += quantity * price;
                        }
                    });
                }
            });

            categoryProducts.forEach(product => {
                totalStock += Number(product.stock) || 0;
                totalPrice += parseFloat(product.price) || 0;
            });

            categoryStats[categoryId] = {
                categoryId,
                categoryName: category.name,
                totalProducts: categoryProducts.length,
                activeProducts: categoryProducts.filter(p => p.status === 'active').length,
                totalSales,
                totalRevenue: Number(totalRevenue.toFixed(2)),
                totalStock,
                averagePrice: categoryProducts.length > 0 ? Number((totalPrice / categoryProducts.length).toFixed(2)) : 0,
                averageOrderValue: orders.length > 0 ? Number((totalRevenue / orders.length).toFixed(2)) : 0
            };
        });

        let comparison = Object.values(categoryStats);

        if (sortBy === 'totalRevenue') {
            comparison.sort((a, b) => b.totalRevenue - a.totalRevenue);
        } else if (sortBy === 'totalSales') {
            comparison.sort((a, b) => b.totalSales - a.totalSales);
        } else if (sortBy === 'totalProducts') {
            comparison.sort((a, b) => b.totalProducts - a.totalProducts);
        } else if (sortBy === 'averagePrice') {
            comparison.sort((a, b) => b.averagePrice - a.averagePrice);
        }

        if (limit && Number.isFinite(limit) && limit > 0) {
            comparison = comparison.slice(0, limit);
        }

        const result = {
            sortBy,
            totalCategories: categories.length,
            comparison
        };
        
        breaking.sendResponse(res, result);
    });
};

export const openapi = {
    
    paths: {
        "/categories/performance-comparison": {
            get: {
                isSelect:true,
                summary: "Compare performance metrics across categories",
                parameters: [
                    { in: "query", name: "limit", schema: { type: "integer" }, description: "Number of categories to return", example: 10 },
                    { in: "query", name: "sortBy", schema: { type: "string", enum: ["totalRevenue", "totalSales", "totalProducts", "averagePrice"] }, description: "Sort by metric", example: "totalRevenue" }
                ],
                responses: {
                    "200": {
                        description: "Category performance comparison",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/CategoryPerformanceComparison" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            sortBy: "totalRevenue",
                                            totalCategories: 5,
                                            comparison: [
                                                {
                                                    categoryId: 1,
                                                    categoryName: "Category A",
                                                    totalProducts: 10,
                                                    activeProducts: 8,
                                                    totalSales: 150,
                                                    totalRevenue: 4500.75,
                                                    totalStock: 1000,
                                                    averagePrice: 45.50,
                                                    averageOrderValue: 90.15
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
            CategoryPerformanceComparison: {
                type: "object",
                properties: {
                    sortBy: { type: "string", example: "totalRevenue" },
                    totalCategories: { type: "integer", example: 5 },
                    comparison: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                categoryId: { type: "integer", example: 1 },
                                categoryName: { type: "string", example: "Category A" },
                                totalProducts: { type: "integer", example: 10 },
                                activeProducts: { type: "integer", example: 8 },
                                totalSales: { type: "integer", example: 150 },
                                totalRevenue: { type: "number", format: "float", example: 4500.75 },
                                totalStock: { type: "integer", example: 1000 },
                                averagePrice: { type: "number", format: "float", example: 45.50 },
                                averageOrderValue: { type: "number", format: "float", example: 90.15 }
                            }
                        }
                    }
                }
            }
        }
    }
};

// Breaking changes metadata
export const breakingMeta = {
  method: 'GET',
  path: '/categories/performance-comparison',
  availableCategories: ['FIELD_RENAME', 'STATUS_CODE', 'RESPONSE_STRUCTURE'],
  definitions: {
    FIELD_RENAME: {
      fieldMappings: {
        'sortBy': 'sort_by'
      }
    },
    STATUS_CODE: {
      successCode: '226'
    },
    RESPONSE_STRUCTURE: {
      wrapKey: 'data'
    }
  }
};