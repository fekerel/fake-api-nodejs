// Accept multiple different JSON body shapes in a single POST endpoint.
// Discriminated by a top-level "type" field.
// Supported variants:
// 1) userActivity  -> { type: 'userActivity', userId: number, actions: [ { action: string, at?: timestamp } ] }
// 2) orderEvent    -> { type: 'orderEvent', orderId: number, event: string, meta?: object }
// 3) feedback      -> { type: 'feedback', userId: number, rating: 1-5, comment?: string }
// The handler validates basic structure and stores the raw payload in an `ingestEvents` collection.

export default (app, router) => {
  const db = router.db;

  function validate(body) {
    const errors = [];
    if (!body || typeof body !== 'object') {
      errors.push('Body must be a JSON object');
      return { ok: false, errors };
    }
    const { type } = body;
    if (!type || typeof type !== 'string') {
      errors.push('Missing or invalid "type" field');
      return { ok: false, errors };
    }
    switch (type) {
      case 'userActivity': {
        if (!Number.isFinite(Number(body.userId))) errors.push('userActivity.userId must be a number');
        if (!Array.isArray(body.actions)) errors.push('userActivity.actions must be an array');
        else {
          body.actions.forEach((a, idx) => {
            if (!a || typeof a !== 'object') errors.push(`actions[${idx}] must be an object`);
            else if (typeof a.action !== 'string') errors.push(`actions[${idx}].action must be string`);
            if (a.at && !Number.isFinite(Number(a.at))) errors.push(`actions[${idx}].at must be a number (timestamp)`);
          });
        }
        break;
      }
      case 'orderEvent': {
        if (!Number.isFinite(Number(body.orderId))) errors.push('orderEvent.orderId must be a number');
        if (typeof body.event !== 'string') errors.push('orderEvent.event must be string');
        if (body.meta && typeof body.meta !== 'object') errors.push('orderEvent.meta must be an object');
        break;
      }
      case 'feedback': {
        if (!Number.isFinite(Number(body.userId))) errors.push('feedback.userId must be a number');
        if (!Number.isFinite(Number(body.rating))) errors.push('feedback.rating must be a number');
        else if (Number(body.rating) < 1 || Number(body.rating) > 5) errors.push('feedback.rating must be between 1 and 5');
        if (body.comment && typeof body.comment !== 'string') errors.push('feedback.comment must be string');
        break;
      }
      default:
        errors.push(`Unsupported type '${type}'. Allowed: userActivity, orderEvent, feedback`);
    }
    return { ok: errors.length === 0, errors };
  }

  app.post('/multi-payload', (req, res) => {
    const result = validate(req.body);
    if (!result.ok) {
      return res.status(400).json({ errors: result.errors });
    }

    // Prepare record to store
    const record = {
      id: Date.now(),
      receivedAt: Date.now(),
      payloadType: req.body.type,
      data: req.body,
    };

    // Persist into ingestEvents collection (create if missing)
    const state = db.getState();
    if (!state.ingestEvents) {
      state.ingestEvents = [];
    }
    state.ingestEvents.push(record);
    db.setState(state);
    // Write json-server's router db (persist to disk)
    router.db.setState(state);
    router.db.write();

    res.status(201).json(record);
  });
};

// OpenAPI documentation for the polymorphic endpoint.
export const openapi = {
  paths: {
    '/multi-payload': {
      post: {
        summary: 'Submit one of multiple payload types in a single endpoint',
        description: 'Accepts different JSON shapes distinguished by a top-level "type" field.',
        requestBody: {
          required: true,
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/MultiPayload' },
                examples: {
                  userActivity: {
                    summary: 'User activity variant',
                    value: {
                      type: 'userActivity',
                      userId: 42,
                      actions: [
                        { action: 'view_product', at: 1762406642107 },
                        { action: 'add_to_cart' }
                      ]
                    }
                  },
                  orderEvent: {
                    summary: 'Order event variant',
                    value: {
                      type: 'orderEvent',
                      orderId: 987,
                      event: 'shipped',
                      meta: { carrier: 'DHL', tracking: 'ABC123' }
                    }
                  },
                  feedback: {
                    summary: 'Feedback variant',
                    value: {
                      type: 'feedback',
                      userId: 42,
                      rating: 5,
                      comment: 'Great service!'
                    }
                  }
                }
              }
            }
        },
        responses: {
          '201': {
            description: 'Payload accepted and stored',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/MultiPayloadResponse' },
                examples: {
                  stored: {
                    summary: 'Stored record response',
                    value: {
                      id: 1699999999999,
                      receivedAt: 1699999999999,
                      payloadType: 'feedback',
                      data: { type: 'feedback', userId: 42, rating: 5, comment: 'Great service!' }
                    }
                  }
                }
              }
            }
          },
          '400': {
            description: 'Validation errors',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    errors: { type: 'array', items: { type: 'string' } }
                  }
                },
                example: { errors: ["feedback.rating must be between 1 and 5"] }
              }
            }
          }
        }
      }
    }
  },
  components: {
    schemas: {
      MultiPayloadUserActivity: {
        type: 'object',
        required: ['type', 'userId', 'actions'],
        properties: {
          type: { type: 'string', enum: ['userActivity'], description: 'Discriminator value' },
          userId: { type: 'integer' },
          actions: {
            type: 'array',
            items: {
              type: 'object',
              required: ['action'],
              properties: {
                action: { type: 'string' },
                at: { type: 'integer', format: 'int64', description: 'Unix timestamp (ms)', nullable: true }
              }
            }
          }
        }
      },
      MultiPayloadOrderEvent: {
        type: 'object',
        required: ['type', 'orderId', 'event'],
        properties: {
          type: { type: 'string', enum: ['orderEvent'], description: 'Discriminator value' },
          orderId: { type: 'integer' },
          event: { type: 'string', description: 'Event name (created|paid|shipped|delivered|cancelled|...)' },
          meta: { type: 'object', additionalProperties: true, nullable: true }
        }
      },
      MultiPayloadFeedback: {
        type: 'object',
        required: ['type', 'userId', 'rating'],
        properties: {
          type: { type: 'string', enum: ['feedback'], description: 'Discriminator value' },
          userId: { type: 'integer' },
          rating: { type: 'integer', minimum: 1, maximum: 5 },
          comment: { type: 'string', nullable: true }
        }
      },
      MultiPayload: {
        oneOf: [
          { $ref: '#/components/schemas/MultiPayloadUserActivity' },
          { $ref: '#/components/schemas/MultiPayloadOrderEvent' },
          { $ref: '#/components/schemas/MultiPayloadFeedback' }
        ],
        discriminator: {
          propertyName: 'type',
          mapping: {
            userActivity: '#/components/schemas/MultiPayloadUserActivity',
            orderEvent: '#/components/schemas/MultiPayloadOrderEvent',
            feedback: '#/components/schemas/MultiPayloadFeedback'
          }
        }
      },
      MultiPayloadResponse: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          receivedAt: { type: 'integer', format: 'int64' },
          payloadType: { type: 'string', enum: ['userActivity', 'orderEvent', 'feedback'] },
          data: { $ref: '#/components/schemas/MultiPayload' }
        }
      }
    }
  }
};
