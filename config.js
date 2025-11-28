export const CONFIG = {
  accessTokenSecret: 'accessToken',
  accessTokenExpiresInMinutes: '15',
  refreshTokenSecret: 'refreshToken',
  refreshTokenExpiresInMinutes: '10080',
  databaseFile: 'database.json',
  urlRewriteFile: 'url-rewrite.json',
  // proxyServer: 'https://huydq.dev',
  proxyUrl: '/blog',
  defaultPort: 8000,
  
  // Breaking Changes Configuration
  breakingChanges: {
    enabled: process.env.BREAKING_CHANGES === 'true',
    // ALL mode: activates ALL breaking categories on ALL endpoints
    allMode: process.env.BREAKING_ALL === 'true',
    
    // Available breaking change categories
    categories: {
      FIELD_RENAME: 'field-rename',
      REQUIRED_FIELD: 'required-field',
      STATUS_CODE: 'status-code',
      RESPONSE_STRUCTURE: 'response-structure',
      ENUM_VALUE_CHANGE: 'enum-value-change',
      TYPE_CHANGE: 'type-change'
    },
    
    // Runtime: will be populated on server startup
    // Format: { 'POST /products/bulk-update': ['FIELD_RENAME', 'STATUS_CODE'], ... }
    // Normal mode: Math.floor(availableCategories.length / 2) + 1 breakings per endpoint
    // ALL mode: All available categories for each endpoint
    activeBreakings: {}
  }
};
