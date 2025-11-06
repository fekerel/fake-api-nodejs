// @ts-check
/// <reference path="../types/schema-types.d.ts" />

/**
 * Helper to preserve literal types and enable IDE suggestions for FilterConfig.
 * @template {FilterConfig} T
 * @param {T} cfg
 * @returns {T}
 */
export function defineFilterConfig(cfg) {
  return cfg;
}
