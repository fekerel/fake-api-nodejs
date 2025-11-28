// Breaking change handler utilities
import { CONFIG } from '../config.js';

/**
 * Creates a breaking change aware request/response handler
 * @param {string} endpointKey - e.g., 'POST /users/flexible-search'
 * @param {object} definitions - Breaking change definitions from breakingMeta
 * @returns {object} Helper functions for handling breaking changes
 */
export function createBreakingHandler(endpointKey, definitions) {
    // activeBreakings is now an array of categories, e.g., ['FIELD_RENAME', 'STATUS_CODE']
    const activeBreakings = CONFIG.breakingChanges.activeBreakings[endpointKey] || [];
    
    /**
     * Check if a specific breaking change category is active
     * @param {string} category - Breaking change category
     * @returns {boolean}
     */
    const isActive = (category) => activeBreakings.includes(category);
    
    /**
     * Get definition for a specific breaking change category
     * @param {string} category - Breaking change category
     * @returns {object|null}
     */
    const getDef = (category) => isActive(category) ? definitions[category] : null;

    return {
        activeBreakings,
        isActive,
        getDef,

        /**
         * Transform incoming request body (snake_case -> camelCase for FIELD_RENAME)
         */
        transformRequest(body) {
            if (!isActive('FIELD_RENAME')) {
                return body;
            }

            const breakingDef = getDef('FIELD_RENAME');
            if (!breakingDef?.fieldMappings) {
                return body;
            }

            // Create reverse mapping: snake_case -> camelCase
            const reverseMap = Object.fromEntries(
                Object.entries(breakingDef.fieldMappings).map(([camel, snake]) => [snake, camel])
            );

            const transformed = {};
            for (const [key, value] of Object.entries(body)) {
                const newKey = reverseMap[key] || key;
                // Handle nested objects/arrays
                if (Array.isArray(value)) {
                    transformed[newKey] = value.map(item => 
                        typeof item === 'object' && item !== null 
                            ? this.transformRequest(item) 
                            : item
                    );
                } else if (typeof value === 'object' && value !== null) {
                    transformed[newKey] = this.transformRequest(value);
                } else {
                    transformed[newKey] = value;
                }
            }
            return transformed;
        },

        /**
         * Check required field (for REQUIRED_FIELD breaking change)
         * @returns {object|null} Error response if required field missing, null otherwise
         */
        checkRequiredField(body) {
            if (!isActive('REQUIRED_FIELD')) {
                return null;
            }

            const breakingDef = getDef('REQUIRED_FIELD');
            if (!breakingDef?.field) {
                return null;
            }

            const field = breakingDef.field;
            if (body[field] === undefined || body[field] === null) {
                return {
                    error: `${field} is required`,
                    code: 'REQUIRED_FIELD_MISSING',
                    field: field
                };
            }
            return null;
        },

        /**
         * Check for deprecated field names (for FIELD_RENAME breaking change)
         * Returns error if old field names are used when FIELD_RENAME is active
         * @param {object} data - Request body or query params
         * @returns {object|null} Error response if deprecated field used, null otherwise
         */
        checkDeprecatedFields(data) {
            if (!isActive('FIELD_RENAME')) {
                return null;
            }

            const breakingDef = getDef('FIELD_RENAME');
            if (!breakingDef?.fieldMappings) {
                return null;
            }

            // Check if any old field name is used
            for (const [oldName, newName] of Object.entries(breakingDef.fieldMappings)) {
                if (data[oldName] !== undefined) {
                    return {
                        error: `Unknown field: ${oldName}`,
                        code: 'UNKNOWN_FIELD',
                        field: oldName
                    };
                }
            }
            return null;
        },

        /**
         * Send response with breaking changes applied
         * Multiple breakings can apply simultaneously:
         * - STATUS_CODE: changes response status
         * - RESPONSE_STRUCTURE: wraps response data
         * 
         * @param {object} res - Express response object
         * @param {*} data - Response data
         * @param {number} statusCode - HTTP status code (default 200)
         */
        sendResponse(res, data, statusCode = 200) {
            let responseBody = data;
            let finalStatus = statusCode;

            // STATUS_CODE breaking: change success status code
            if (isActive('STATUS_CODE') && statusCode >= 200 && statusCode < 300) {
                const statusDef = getDef('STATUS_CODE');
                finalStatus = statusDef?.successCode || statusCode;
            }

            // RESPONSE_STRUCTURE breaking: wrap response in object
            if (isActive('RESPONSE_STRUCTURE')) {
                const structDef = getDef('RESPONSE_STRUCTURE');
                if (structDef?.wrapKey) {
                    responseBody = { [structDef.wrapKey]: data };
                }
            }

            return res.status(finalStatus).json(responseBody);
        }
    };
}
