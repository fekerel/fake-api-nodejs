// Get category sales statistics with total sales, revenue, top selling products and sales trend
import { createBreakingHandler } from '../utils/breaking-handler.js';

// Breaking change definitions for this endpoint
const BREAKING_DEFINITIONS = {
    STATUS_CODE: { successCode: 218 },
    RESPONSE_STRUCTURE: { wrapKey: 'data' }
};

export default (app, router) => {
    const db = router.db;

    app.get('/categories/:id/sales-stats', (req, res) => {
        const breaking = createBreakingHandler('GET /categories/{id}/sales-stats', BREAKING_DEFINITIONS);
        
        const categoryId = Number(req.params.id);
        
        if (!Number.isFinite(categoryId)) return res.status(400).json({ error: 'invalid id' });
        
        const category = db.get('categories').find(c => Number(c.id) === categoryId).value();
        
        if (!category) return res.status(404).json({ error: 'category not found' });
        
        const products = db.get('products').filter(p => Number(p.categoryId) === categoryId).value() || [];
        const productIds = products.map(p => Number(p.id));
        
        const orders = db.get('orders').value() || [];
        let totalSales = 0;
        let totalRevenue = 0;
        const productSales = {};
        
        orders.forEach(order => {
            if (order.items) {
                order.items.forEach(item => {
                    const itemProductId = Number(item.productId);
                    if (productIds.includes(itemProductId)) {
                        const quantity = Number(item.quantity) || 0;
                        const price = parseFloat(item.price) || 0;
                        totalSales += quantity;
                        totalRevenue += quantity * price;
                        
                        if (!productSales[itemProductId]) {
                            productSales[itemProductId] = { salesCount: 0, revenue: 0 };
                        }
                        productSales[itemProductId].salesCount += quantity;
                        productSales[itemProductId].revenue += quantity * price;
                    }
                });
            }
        });
        
        const topSellingProducts = Object.keys(productSales)
            .map(productId => {
                const product = db.get('products').find(p => Number(p.id) === Number(productId)).value();
                return {
                    productId: Number(productId),
                    productName: product ? product.name : 'Unknown',
                    salesCount: productSales[productId].salesCount,
                    revenue: Number(productSales[productId].revenue.toFixed(2))
                };
            })
            .sort((a, b) => b.salesCount - a.salesCount)
            .slice(0, 5);
        
        const averageOrderValue = orders.length > 0 ? Number((totalRevenue / orders.length).toFixed(2)) : 0;
        
        const result = {
            categoryId,
            categoryName: category.name,
            totalProducts: products.length,
            totalSales,
            totalRevenue: Number(totalRevenue.toFixed(2)),
            averageOrderValue,
            topSellingProducts
        };
        
        breaking.sendResponse(res, result);
    });
};

export const openapi = {
    paths: {
        "/categories/{id}/sales-stats": {
            get: {
                isSelect:true,
                summary: "Get category sales statistics",
                parameters: [
                    { in: "path", name: "id", required: true, schema: { type: "integer" }, example: 1 }
                ],
                responses: {
                    "200": {
                        description: "Category sales statistics",
                        content: {
                            "application/json": {
                                schema: { $ref: "#/components/schemas/CategorySalesStats" },
                                examples: {
                                    "normal": {
                                        summary: "Normal response",
                                        value: {
                                            categoryId: 1,
                                            categoryName: "Category A",
                                            totalProducts: 10,
                                            totalSales: 150,
                                            totalRevenue: 4500.75,
                                            averageOrderValue: 90.15,
                                            topSellingProducts: [
                                                { productId: 5, productName: "Product X", salesCount: 50, revenue: 1500.00 }
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
            CategorySalesStats: {
                type: "object",
                properties: {
                    categoryId: { type: "integer", example: 1 },
                    categoryName: { type: "string", example: "Category A" },
                    totalProducts: { type: "integer", example: 10 },
                    totalSales: { type: "integer", example: 150 },
                    totalRevenue: { type: "number", format: "float", example: 4500.75 },
                    averageOrderValue: { type: "number", format: "float", example: 90.15 },
                    topSellingProducts: {
                        type: "array",
                        items: {
                            type: "object",
                            properties: {
                                productId: { type: "integer", example: 5 },
                                productName: { type: "string", example: "Product X" },
                                salesCount: { type: "integer", example: 50 },
                                revenue: { type: "number", format: "float", example: 1500.00 }
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
  path: '/categories/{id}/sales-stats',
  availableCategories: ['STATUS_CODE', 'RESPONSE_STRUCTURE'],
  definitions: {
    STATUS_CODE: {
      successCode: '218'
    },
    RESPONSE_STRUCTURE: {
      wrapKey: 'data'
    }
  }
};