// Filter and analyze orders by userId, status, date range with variable parameters
export default (app, router) => {
    const db = router.db;

    app.get('/orders/filter', (req, res) => {
        const userId = req.query.userId ? Number(req.query.userId) : null;
        const status = req.query.status || null;
        const startDate = req.query.startDate ? Number(req.query.startDate) : null;
        const endDate = req.query.endDate ? Number(req.query.endDate) : null;
        const orderId = req.query.orderId ? Number(req.query.orderId) : null;

        if (userId !== null && !Number.isFinite(userId)) {
            return res.status(400).json({ error: 'invalid userId' });
        }
        if (orderId !== null && !Number.isFinite(orderId)) {
            return res.status(400).json({ error: 'invalid orderId' });
        }
        if (startDate !== null && !Number.isFinite(startDate)) {
            return res.status(400).json({ error: 'invalid startDate' });
        }
        if (endDate !== null && !Number.isFinite(endDate)) {
            return res.status(400).json({ error: 'invalid endDate' });
        }

        const orders = db.get('orders').value() || [];
        const users = db.get('users').value() || [];

        // Senaryo 1: Sadece orderId varsa - tek sipariş detayı
        if (orderId !== null && userId === null && status === null && startDate === null && endDate === null) {
            const order = orders.find(o => Number(o.id) === orderId);
            if (!order) return res.status(404).json({ error: 'order not found' });

            const user = users.find(u => Number(u.id) === Number(order.userId));

            return res.json({
                type: 'single_order',
                order: {
                    id: order.id,
                    userId: order.userId,
                    userName: user ? `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email : 'Unknown',
                    totalAmount: parseFloat(order.totalAmount) || 0,
                    status: order.status,
                    payment: order.payment || null,
                    items: order.items || [],
                    createdAt: order.createdAt
                }
            });
        }

        // Senaryo 2: Sadece userId varsa - kullanıcının tüm siparişleri
        if (userId !== null && orderId === null && status === null && startDate === null && endDate === null) {
            const user = users.find(u => Number(u.id) === userId);
            if (!user) return res.status(404).json({ error: 'user not found' });

            const userOrders = orders.filter(o => Number(o.userId) === userId);

            return res.json({
                type: 'user_orders',
                userId,
                userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
                totalOrders: userOrders.length,
                totalSpent: Number(userOrders.reduce((sum, o) => sum + (parseFloat(o.totalAmount) || 0), 0).toFixed(2)),
                orders: userOrders.map(o => ({
                    id: o.id,
                    totalAmount: parseFloat(o.totalAmount) || 0,
                    status: o.status,
                    createdAt: o.createdAt
                }))
            });
        }

        // Senaryo 3: Sadece status varsa - o durumdaki tüm siparişler
        if (status !== null && orderId === null && userId === null && startDate === null && endDate === null) {
            const statusOrders = orders.filter(o => o.status === status);

            return res.json({
                type: 'status_orders',
                status,
                totalOrders: statusOrders.length,
                totalAmount: Number(statusOrders.reduce((sum, o) => sum + (parseFloat(o.totalAmount) || 0), 0).toFixed(2)),
                orders: statusOrders.map(o => ({
                    id: o.id,
                    userId: o.userId,
                    totalAmount: parseFloat(o.totalAmount) || 0,
                    createdAt: o.createdAt
                }))
            });
        }

        // Senaryo 4: userId + status - kullanıcının belirli durumdaki siparişleri
        if (userId !== null && status !== null && orderId === null && startDate === null && endDate === null) {
            const user = users.find(u => Number(u.id) === userId);
            if (!user) return res.status(404).json({ error: 'user not found' });

            const filteredOrders = orders.filter(o => 
                Number(o.userId) === userId && o.status === status
            );

            return res.json({
                type: 'user_status_orders',
                userId,
                userName: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.email,
                status,
                totalOrders: filteredOrders.length,
                totalAmount: Number(filteredOrders.reduce((sum, o) => sum + (parseFloat(o.totalAmount) || 0), 0).toFixed(2)),
                orders: filteredOrders.map(o => ({
                    id: o.id,
                    totalAmount: parseFloat(o.totalAmount) || 0,
                    createdAt: o.createdAt
                }))
            });
        }

        // Senaryo 5: startDate ve/veya endDate - tarih aralığındaki siparişler
        if ((startDate !== null || endDate !== null) && orderId === null) {
            let filteredOrders = orders;

            if (userId !== null) {
                filteredOrders = filteredOrders.filter(o => Number(o.userId) === userId);
            }
            if (status !== null) {
                filteredOrders = filteredOrders.filter(o => o.status === status);
            }
            if (startDate !== null) {
                filteredOrders = filteredOrders.filter(o => o.createdAt && o.createdAt >= startDate);
            }
            if (endDate !== null) {
                filteredOrders = filteredOrders.filter(o => o.createdAt && o.createdAt <= endDate);
            }

            return res.json({
                type: 'date_range_orders',
                filters: {
                    userId: userId || null,
                    status: status || null,
                    startDate: startDate || null,
                    endDate: endDate || null
                },
                totalOrders: filteredOrders.length,
                totalAmount: Number(filteredOrders.reduce((sum, o) => sum + (parseFloat(o.totalAmount) || 0), 0).toFixed(2)),
                orders: filteredOrders.map(o => ({
                    id: o.id,
                    userId: o.userId,
                    totalAmount: parseFloat(o.totalAmount) || 0,
                    status: o.status,
                    createdAt: o.createdAt
                }))
            });
        }

        // Senaryo 6: Hiç parametre yoksa - tüm siparişler
        return res.json({
            type: 'all_orders',
            totalOrders: orders.length,
            totalAmount: Number(orders.reduce((sum, o) => sum + (parseFloat(o.totalAmount) || 0), 0).toFixed(2)),
            orders: orders.map(o => ({
                id: o.id,
                userId: o.userId,
                totalAmount: parseFloat(o.totalAmount) || 0,
                status: o.status,
                createdAt: o.createdAt
            }))
        });
    });
};

export const openapi = {
  paths: {
    "/orders/filter": {
      get: {
        summary: "Filter orders with variable parameters",
        parameters: [
          { in: "query", name: "orderId", schema: { type: "integer" }, description: "Get single order by ID (only this returns a single_order result)" },
          { in: "query", name: "userId", schema: { type: "integer" }, description: "Filter by user ID" },
          { in: "query", name: "status", schema: { type: "string", enum: ["pending","failed","cancelled","returned","delivered"] }, description: "Filter by order status" },
          { in: "query", name: "startDate", schema: { type: "integer", format: "int64" }, description: "Start date (timestamp ms)" },
          { in: "query", name: "endDate", schema: { type: "integer", format: "int64" }, description: "End date (timestamp ms)" }
        ],
        responses: {
          "200": {
            description: "Orders based on filter parameters",
            content: {
              "application/json": {
                schema: {
                  oneOf: [
                    { $ref: "#/components/schemas/SingleOrderResult" },
                    { $ref: "#/components/schemas/UserOrdersResult" },
                    { $ref: "#/components/schemas/StatusOrdersResult" },
                    { $ref: "#/components/schemas/UserStatusOrdersResult" },
                    { $ref: "#/components/schemas/DateRangeOrdersResult" },
                    { $ref: "#/components/schemas/AllOrdersResult" }
                  ],
                  discriminator: {
                    propertyName: "type",
                    mapping: {
                      single_order: "#/components/schemas/SingleOrderResult",
                      user_orders: "#/components/schemas/UserOrdersResult",
                      status_orders: "#/components/schemas/StatusOrdersResult",
                      user_status_orders: "#/components/schemas/UserStatusOrdersResult",
                      date_range_orders: "#/components/schemas/DateRangeOrdersResult",
                      all_orders: "#/components/schemas/AllOrdersResult"
                    }
                  }
                }
              }
            }
          },
          "400": { description: "invalid parameters" },
          "404": { description: "order or user not found" }
        }
      }
    }
  },
  components: {
    schemas: {
      // Shared pieces
      OrderItem: {
        type: "object",
        properties: {
          productId: { type: "integer" },
          variantId: { type: "string" },
          quantity: { type: "integer" },
          price: { type: "number" }
        },
        required: ["productId","variantId","quantity","price"]
      },
      Payment: {
        type: "object",
        properties: {
          method: { type: "string", enum: ["credit_card","paypal","bank_transfer"] },
          status: { type: "string", enum: ["pending","processing","shipped","delivered","cancelled"] }
        },
        required: ["method","status"]
      },
      // For single order detail
      OrderDetail: {
        type: "object",
        properties: {
          id: { type: "integer" },
          userId: { type: "integer" },
          userName: { type: "string" },
          totalAmount: { type: "number" },
          status: { type: "string", enum: ["pending","failed","cancelled","returned","delivered"] },
          payment: { $ref: "#/components/schemas/Payment", nullable: true },
          items: { type: "array", items: { $ref: "#/components/schemas/OrderItem" } },
          createdAt: { type: "integer", format: "int64" }
        },
        required: ["id","userId","userName","totalAmount","status","items","createdAt"]
      },
      // Summaries used in list results (vary by scenario)
      UserOrderSummary: {
        type: "object",
        properties: {
          id: { type: "integer" },
          totalAmount: { type: "number" },
          status: { type: "string", enum: ["pending","failed","cancelled","returned","delivered"] },
          createdAt: { type: "integer", format: "int64" }
        },
        required: ["id","totalAmount","status","createdAt"]
      },
      StatusOrderSummary: {
        type: "object",
        properties: {
          id: { type: "integer" },
          userId: { type: "integer" },
          totalAmount: { type: "number" },
          createdAt: { type: "integer", format: "int64" }
        },
        required: ["id","userId","totalAmount","createdAt"]
      },
      UserStatusOrderSummary: {
        type: "object",
        properties: {
          id: { type: "integer" },
          totalAmount: { type: "number" },
          createdAt: { type: "integer", format: "int64" }
        },
        required: ["id","totalAmount","createdAt"]
      },
      DateRangeOrderSummary: {
        type: "object",
        properties: {
          id: { type: "integer" },
          userId: { type: "integer" },
          totalAmount: { type: "number" },
          status: { type: "string", enum: ["pending","failed","cancelled","returned","delivered"] },
          createdAt: { type: "integer", format: "int64" }
        },
        required: ["id","userId","totalAmount","status","createdAt"]
      },
      AllOrdersSummary: {
        type: "object",
        properties: {
          id: { type: "integer" },
          userId: { type: "integer" },
          totalAmount: { type: "number" },
          status: { type: "string", enum: ["pending","failed","cancelled","returned","delivered"] },
          createdAt: { type: "integer", format: "int64" }
        },
        required: ["id","userId","totalAmount","status","createdAt"]
      },
      // Results by scenario
      SingleOrderResult: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["single_order"] },
          order: { $ref: "#/components/schemas/OrderDetail" }
        },
        required: ["type","order"]
      },
      UserOrdersResult: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["user_orders"] },
          userId: { type: "integer" },
          userName: { type: "string" },
          totalOrders: { type: "integer" },
          totalSpent: { type: "number" },
          orders: { type: "array", items: { $ref: "#/components/schemas/UserOrderSummary" } }
        },
        required: ["type","userId","userName","totalOrders","totalSpent","orders"]
      },
      StatusOrdersResult: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["status_orders"] },
          status: { type: "string", enum: ["pending","failed","cancelled","returned","delivered"] },
          totalOrders: { type: "integer" },
          totalAmount: { type: "number" },
          orders: { type: "array", items: { $ref: "#/components/schemas/StatusOrderSummary" } }
        },
        required: ["type","status","totalOrders","totalAmount","orders"]
      },
      UserStatusOrdersResult: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["user_status_orders"] },
          userId: { type: "integer" },
          userName: { type: "string" },
          status: { type: "string", enum: ["pending","failed","cancelled","returned","delivered"] },
          totalOrders: { type: "integer" },
          totalAmount: { type: "number" },
          orders: { type: "array", items: { $ref: "#/components/schemas/UserStatusOrderSummary" } }
        },
        required: ["type","userId","userName","status","totalOrders","totalAmount","orders"]
      },
      DateRangeOrdersResult: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["date_range_orders"] },
          filters: {
            type: "object",
            properties: {
              userId: { type: "integer", nullable: true },
              status: { type: "string", enum: ["pending","failed","cancelled","returned","delivered"], nullable: true },
              startDate: { type: "integer", format: "int64", nullable: true },
              endDate: { type: "integer", format: "int64", nullable: true }
            },
            required: ["userId","status","startDate","endDate"]
          },
          totalOrders: { type: "integer" },
          totalAmount: { type: "number" },
          orders: { type: "array", items: { $ref: "#/components/schemas/DateRangeOrderSummary" } }
        },
        required: ["type","filters","totalOrders","totalAmount","orders"]
      },
      AllOrdersResult: {
        type: "object",
        properties: {
          type: { type: "string", enum: ["all_orders"] },
          totalOrders: { type: "integer" },
          totalAmount: { type: "number" },
          orders: { type: "array", items: { $ref: "#/components/schemas/AllOrdersSummary" } }
        },
        required: ["type","totalOrders","totalAmount","orders"]
      },
      // union kept for backward compat if referenced elsewhere
      OrderFilterResult: {
        oneOf: [
          { $ref: "#/components/schemas/SingleOrderResult" },
          { $ref: "#/components/schemas/UserOrdersResult" },
          { $ref: "#/components/schemas/StatusOrdersResult" },
          { $ref: "#/components/schemas/UserStatusOrdersResult" },
          { $ref: "#/components/schemas/DateRangeOrdersResult" },
          { $ref: "#/components/schemas/AllOrdersResult" }
        ]
      }
    }
  }
};