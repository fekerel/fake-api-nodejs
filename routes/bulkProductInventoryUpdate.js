// Bulk update product inventory (only stock). Supports update | subtract
import { CONFIG } from '../config.js';

export default (app, router) => {
  const db = router.db;
  const MAX_BATCH = 200;
  const VALID_OPERATIONS = ['update', 'subtract'];

  app.post('/products/bulk-update', (req, res) => {
    const activeBreaking = CONFIG.breakingChanges.activeBreakings['POST /products/bulk-update'];

    const { updates, operation } = req.body || {};

    // Validate updates array
    if (!updates || !Array.isArray(updates)) {
      return res.status(400).json({
        mode: 'failed',
        error: 'updates array is required',
        errors: [{ code: 'UPDATES_INVALID', message: 'updates must be an array' }]
      });
    }
    if (updates.length === 0) {
      return res.status(400).json({
        mode: 'failed',
        error: 'updates array must not be empty',
        errors: [{ code: 'UPDATES_EMPTY', message: 'no items provided' }]
      });
    }

    if (activeBreaking === 'FIELD_RENAME') {
      // product_id zorunlu, yoksa hata
      const missingNewField = updates.filter(u => !('product_id' in u));
      if (missingNewField.length > 0) {
        return res.status(400).json({
          mode: 'failed',
          error: 'product_id is required',
          errors: [{ 
            code: 'PRODUCT_ID_MISSING', 
            message: 'product_id is required' 
          }]
        });
      }
      
      // Yeni adı internal ada çevir
      updates = updates.map(u => ({
        productId: u.product_id,
        stock: u.stock
      }));
    }

    if (updates.length > MAX_BATCH) {
      return res.status(413).json({
        mode: 'failed',
        error: `batch size exceeds limit ${MAX_BATCH}`,
        errors: [{ code: 'BATCH_TOO_LARGE', message: `Provided: ${updates.length}` }]
      });
    }

    // Operation validation (only update | subtract)
    const operationType = operation || 'update';
    if (operation && !VALID_OPERATIONS.includes(operation)) {
      return res.status(400).json({
        mode: 'failed',
        error: 'invalid operation value',
        errors: [{ code: 'OPERATION_INVALID', message: `Allowed: ${VALID_OPERATIONS.join(', ')}` }]
      });
    }

    // Duplicate productId detection
    const idCounts = updates
      .filter(u => u && u.productId !== undefined && u.productId !== null)
      .reduce((acc, u) => {
        acc[u.productId] = (acc[u.productId] || 0) + 1;
        return acc;
      }, {});
    const duplicateIds = Object.keys(idCounts).filter(k => idCounts[k] > 1);

    const results = [];
    const errors = [];
    const warnings = [];

    // Strict politika: duplicate varsa tüm batch'i reddet
    if (duplicateIds.length > 0) {
      return res.status(400).json({
        success: false,
        mode: 'failed',
        operation: operationType,
        meta: {
          totalProcessed: updates.length,
          successful: 0,
          failed: updates.length,
          hasWarnings: false,
          hasErrors: true,
          duplicateIds: duplicateIds.map(Number)
        },
        errors: [{
          code: 'DUPLICATE_IDS',
          message: `Duplicate productId(s) are not allowed: ${duplicateIds.join(', ')}`
        }]
      });
    }

    for (const update of updates) {
      // Only allow productId and stock
      const { productId, stock } = update || {};
      const extraKeys = Object.keys(update || {}).filter(k => !['productId', 'stock'].includes(k));
      if (extraKeys.length > 0) {
        errors.push({
          code: 'EXTRA_FIELDS_NOT_ALLOWED',
          message: `Only 'productId' and 'stock' are allowed. Extra: ${extraKeys.join(', ')}`,
          productId: productId != null ? Number(productId) : null
        });
        continue;
      }

      // productId required
      if (productId === undefined || productId === null) {
        errors.push({
          code: 'PRODUCT_ID_MISSING',
          message: 'productId is required',
          productId: null
        });
        continue;
      }

      // Product lookup
      const product = db.get('products').find(p => Number(p.id) === Number(productId)).value();
      if (!product) {
        errors.push({
          code: 'PRODUCT_NOT_FOUND',
          message: `Product not found: ${productId}`,
          productId: Number(productId)
        });
        continue;
      }

      const updateData = {};
      let hasChanges = false;
      const itemWarnings = [];

      // Stock logic (update | subtract)
      if (stock !== undefined && stock !== null) {
        const qty = Number(stock);
        const currentStock = Number(product.stock) || 0;

        if (Number.isNaN(qty) || qty < 0) {
          errors.push({
            code: 'STOCK_INVALID',
            message: `Invalid stock value for product ${productId}`,
            productId: Number(productId)
          });
          continue;
        }

        let newStock;
        if (operationType === 'subtract') {
          newStock = Math.max(0, currentStock - qty);
          if (newStock === 0 && currentStock > 0 && qty > 0) {
            itemWarnings.push({
              code: 'STOCK_DEPLETED',
              message: `Stock depleted for product ${productId}`
            });
          }
        } else {
          // operationType === 'update'
          newStock = qty;
        }

        updateData.stock = newStock;
        hasChanges = true;
      }

      if (!hasChanges) {
        itemWarnings.push({
          code: 'NO_CHANGES',
          message: `No changes specified for product ${productId}`
        });
        warnings.push(...itemWarnings);
        continue;
      }

      updateData.updatedAt = Date.now();
      db.get('products').find(p => Number(p.id) === Number(productId)).assign(updateData).write();

      const updatedProduct = db.get('products').find(p => Number(p.id) === Number(productId)).value();
      results.push({
        productId: Number(productId),
        productName: updatedProduct.name,
        changes: updateData,
        previousStock: Number(product.stock) || 0,
        warnings: itemWarnings.length ? itemWarnings : undefined
      });
      warnings.push(...itemWarnings);
    }

    // Determine response status & mode
    // STATUS_CODE breaking: success returns 238 instead of 200
    let statusCode = activeBreaking === 'STATUS_CODE' ? 238 : 200;
    let mode = 'full';
    if (errors.length > 0 && results.length === 0) {
      statusCode = 400;
      mode = 'failed';
    } else if (errors.length > 0 && results.length > 0) {
      statusCode = 207; // Multi-Status (partial success)
      mode = 'partial';
    }

    // success: ancak tüm item'lar başarıyla işlendiğinde true
    const success = errors.length === 0 && results.length === updates.length && updates.length > 0;

    // Build the response body
    let responseBody = {
      success,
      mode,
      operation: operationType,
      meta: {
        totalProcessed: updates.length,
        successful: results.length,
        failed: errors.length,
        hasWarnings: warnings.length > 0,
        hasErrors: errors.length > 0,
        duplicateIds: duplicateIds.length ? duplicateIds.map(Number) : undefined
      },
      results,
      errors: errors.length ? errors : undefined,
      warnings: warnings.length ? warnings : undefined
    };

    // RESPONSE_STRUCTURE breaking: wrap response in { data: ... }
    if (activeBreaking === 'RESPONSE_STRUCTURE') {
      responseBody = { data: responseBody };
    }

    return res.status(statusCode).json(responseBody);
  });
};

export const openapi = {

  paths: {
    "/products/bulk-update": {
      post: {
        isSelect:true,
        summary: "Bulk update product stock (supports update | subtract)",
        requestBody: {
          required: true,
          content: {
            "application/json": {
              schema: {
                type: "object",
                required: ["updates"],
                properties: {
                  updates: {
                    type: "array",
                    minItems: 1,
                    items: {
                      type: "object",
                      required: ["productId"],
                      additionalProperties: false,
                      properties: {
                        productId: { type: "integer", example: 1 },
                        stock: { type: "integer", nullable: true, example: 100, minimum: 0 }
                      }
                    }
                  },
                  operation: { type: "string", enum: ["update", "subtract"], default: "update", example: "update" }
                },
                additionalProperties: false
              },
              examples: {
                fullSuccess: {
                  summary: "Full success example (update stock to fixed values)",
                  value: {
                    updates: [{ productId: 1, stock: 50 }, { productId: 2, stock: 10 }],
                    operation: "update"
                  }
                },
                partialSuccess: {
                  summary: "Partial success example (subtract and unknown product)",
                  value: {
                    updates: [
                      { productId: 1, stock: 5 },
                      { productId: 99999, stock: 10 },
                      { productId: 2, stock: 99999 }
                    ],
                    operation: "subtract"
                  }
                },
                invalidOperation: {
                  summary: "Invalid operation",
                  value: {
                    updates: [{ productId: 1, stock: 5 }],
                    operation: "multiply"
                  }
                }
              }
            }
          }
        },
        responses: {
          "200": {
            description: "Full success",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/BulkUpdateResponse" }
              }
            }
          },
          "207": {
            description: "Partial success (some items failed)",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/BulkUpdateResponse" },
                examples: {
                  partial: {
                    value: {
                      success: false,
                      mode: "partial",
                      operation: "subtract",
                      meta: { totalProcessed: 3, successful: 2, failed: 1, hasWarnings: true, hasErrors: true },
                      results: [
                        { productId: 1, productName: "Product A", changes: { stock: 45, updatedAt: 1711111111111 }, previousStock: 50 },
                        { productId: 2, productName: "Product B", changes: { stock: 0, updatedAt: 1711111111112 }, previousStock: 20, warnings: [{ code: "STOCK_DEPLETED", message: "Stock depleted for product 2" }] }
                      ],
                      errors: [{ code: "PRODUCT_NOT_FOUND", message: "Product not found: 99999", productId: 99999 }]
                    }
                  }
                }
              }
            }
          },
          "400": {
            description: "Validation / all failed",
            content: {
              "application/json": {
                schema: { $ref: "#/components/schemas/BulkUpdateResponse" },
                examples: {
                  missingUpdates: {
                    summary: "updates yok/yanlış tip",
                    value: {
                      success: false,
                      mode: "failed",
                      operation: "update",
                      meta: { totalProcessed: 0, successful: 0, failed: 0, hasWarnings: false, hasErrors: true },
                      errors: [{ code: "UPDATES_INVALID", message: "updates must be an array" }]
                    }
                  },
                  duplicateIds: {
                    summary: "Duplicate productId → strict 400",
                    value: {
                      success: false,
                      mode: "failed",
                      operation: "update",
                      meta: { totalProcessed: 3, successful: 0, failed: 3, hasWarnings: false, hasErrors: true, duplicateIds: [1] },
                      errors: [{ code: "DUPLICATE_IDS", message: "Duplicate productId(s) are not allowed: 1" }]
                    }
                  },
                  invalidOperation: {
                    summary: "Geçersiz operation",
                    value: {
                      success: false,
                      mode: "failed",
                      operation: "update",
                      meta: { totalProcessed: 1, successful: 0, failed: 1, hasWarnings: false, hasErrors: true },
                      errors: [{ code: "OPERATION_INVALID", message: "Allowed: update, subtract" }]
                    }
                  }
                }
              }
            }
          },
          "413": {
            description: "Batch too large",
            content: {
              "application/json": {
                schema: {
                  type: "object",
                  properties: {
                    mode: { type: "string" },
                    error: { type: "string" },
                    errors: { type: "array", items: { $ref: "#/components/schemas/ErrorItem" } }
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
      BulkUpdateResponse: {
        type: "object",
        properties: {
          success: { type: "boolean" },
          mode: { type: "string", enum: ["full","partial","failed"] },
          operation: { type: "string", enum: ["update","subtract"] },
          meta: { $ref: "#/components/schemas/BulkUpdateMeta" },
          results: {
            type: "array",
            items: { $ref: "#/components/schemas/ResultItem" }
          },
          errors: {
            type: "array",
            items: { $ref: "#/components/schemas/ErrorItem" }
          },
          warnings: {
            type: "array",
            items: { $ref: "#/components/schemas/WarningItem" }
          }
        }
      },
      ResultItem: {
        type: "object",
        properties: {
          productId: { type: "integer" },
          productName: { type: "string" },
          changes: {
            type: "object",
            properties: {
              stock: { type: "integer" },
              updatedAt: { type: "integer" }
            },
            additionalProperties: false
          },
          previousStock: { type: "integer" },
          warnings: {
            type: "array",
            items: { $ref: "#/components/schemas/WarningItem" }
          }
        },
        additionalProperties: false
      },
      ErrorItem: {
        type: "object",
        properties: {
          code: { type: "string" },
          message: { type: "string" },
          productId: { type: "integer", nullable: true }
        },
        additionalProperties: false
      },
      WarningItem: {
        type: "object",
        properties: {
          code: { type: "string" },
          message: { type: "string" }
        },
        additionalProperties: false
      },
      BulkUpdateMeta: {
        type: "object",
        properties: {
          totalProcessed: { type: "integer" },
          successful: { type: "integer" },
          failed: { type: "integer" },
          hasWarnings: { type: "boolean" },
          hasErrors: { type: "boolean" },
          duplicateIds: { type: "array", items: { type: "integer" }, nullable: true }
        },
        additionalProperties: false
      }
    }
  },
  "x-test-cases": [
    "MISSING_UPDATES",
    "EMPTY_UPDATES",
    "INVALID_OPERATION",
    "BATCH_TOO_LARGE",
    "ALL_FAILED",
    "PARTIAL_SUCCESS",
    "FULL_SUCCESS",
    "DUPLICATE_IDS",           // was DUPLICATE_IDS_WARNING
    "STOCK_DEPLETED_WARNING",
    "NO_CHANGES_WARNING",
    "STOCK_INVALID",
    "PRODUCT_ID_MISSING",
    "PRODUCT_NOT_FOUND",
    "EXTRA_FIELDS_NOT_ALLOWED"
  ]
};

// Breaking changes metadata: defines which breaking categories are available for this endpoint
export const breakingMeta = {
  method: 'POST',
  path: '/products/bulk-update',
  availableCategories: ['FIELD_RENAME', 'STATUS_CODE', 'RESPONSE_STRUCTURE'],
  definitions: {
    FIELD_RENAME: {
      fieldMappings: {
        'productId': 'product_id'
      }
    },
    STATUS_CODE: {
      successCode: '222'
    },
    RESPONSE_STRUCTURE: {
      wrapKey: 'data'
    }
  }
};