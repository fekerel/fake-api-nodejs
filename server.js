import fs from 'fs';
import { join } from 'path';
import { pathToFileURL } from 'url';
import { graphqlHTTP } from 'express-graphql';
import http from 'http';
import jsonServer from 'json-server';
import morgan from 'morgan';
import { Low } from 'lowdb';
import { JSONFile } from 'lowdb/node';
import { Server } from 'socket.io';
import { createProxyMiddleware } from 'http-proxy-middleware';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import generateSwaggerDocs, { filterIsSelectOnly } from './utils/swagger-generator.js';

import { CONFIG } from './config.js';
import { isAuthenticated } from './utils/jwt-authenticate.js';
import { schema, setupRootValue } from './src/graphql.js';
import {
  loginHandler,
  registerHandler,
  refreshTokenHandler,
  socketEmit,
  testHandler,
  uploadFileHandler,
  uploadFilesHandler,
} from './src/rest.js';
import socketHandler from './src/socket-io.js';

const db = new Low(new JSONFile(CONFIG.databaseFile));
await db.read();

const app = jsonServer.create();
const router = jsonServer.router(CONFIG.databaseFile);
const middlewares = jsonServer.defaults({ logger: false });
// Parse JSON bodies early so route modules loaded below receive parsed req.body
app.use(jsonServer.bodyParser);
app.use(morgan('dev'));
const port = process.env.PORT || CONFIG.defaultPort;
const server = http.createServer(app);

// load route handlers without passing db explicitly
const handlersDir = join(process.cwd(), 'routes');
if (fs.existsSync(handlersDir)) {
  const files = fs.readdirSync(handlersDir).filter((f) => f.endsWith('.js'));
  for (const file of files) {
    try {
      const mod = await import(pathToFileURL(join(handlersDir, file)).href);
      if (mod && typeof mod.default === 'function') {
        // pass only app and router (handlers can use router.db or req.app.locals.db)
        mod.default(app, router);
      }
    } catch (err) {
      console.error('Failed to load route', file, err);
    }
  }
}

const swaggerSpec = await generateSwaggerDocs();
const filteredSpec = filterIsSelectOnly(swaggerSpec);

// Debug: Log path counts
console.log(`Total paths in swaggerSpec: ${Object.keys(swaggerSpec.paths || {}).length}`);
console.log(`Total paths in filteredSpec: ${Object.keys(filteredSpec.paths || {}).length}`);
console.log(`Sample paths in swaggerSpec:`, Object.keys(swaggerSpec.paths || {}).slice(0, 10));
console.log(`Sample paths in filteredSpec:`, Object.keys(filteredSpec.paths || {}).slice(0, 10));

// OpenAPI JSON for all endpoints (must be before Swagger UI routes)
app.get('/openapi.json', (req, res) => {
  res.json(swaggerSpec);
});

// OpenAPI JSON for isSelect:true endpoints only (must be before /isSelect Swagger UI)
app.get('/isSelect/openapi.json', (req, res) => {
  res.json(filteredSpec);
});

// Helper function to create a clean copy of spec without isSelect flags
function createCleanSpec(originalSpec) {
  const cleanSpec = JSON.parse(JSON.stringify(originalSpec));
  // Remove isSelect flags from all paths and methods
  Object.keys(cleanSpec.paths || {}).forEach(path => {
    const pathObj = cleanSpec.paths[path];
    // Remove isSelect from path level
    if (pathObj.isSelect !== undefined) {
      delete pathObj.isSelect;
    }
    // Remove isSelect from method level
    Object.keys(pathObj).forEach(method => {
      if (['get', 'post', 'put', 'delete', 'patch', 'head', 'options'].includes(method.toLowerCase())) {
        if (pathObj[method] && pathObj[method].isSelect !== undefined) {
          delete pathObj[method].isSelect;
        }
      }
    });
  });
  return cleanSpec;
}

// Swagger UI for all endpoints - use clean spec copy and force URL loading
const cleanSwaggerSpec = createCleanSpec(swaggerSpec);
app.use('/api-docs', swaggerUi.serve);
app.get('/api-docs', (req, res, next) => {
  // Force Swagger UI to load from /openapi.json by using null spec
  const swaggerUiHandler = swaggerUi.setup(null, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'API Documentation - All Endpoints',
    swaggerOptions: {
      url: '/openapi.json',
      persistAuthorization: false,
      tryItOutEnabled: true
    }
  });
  swaggerUiHandler(req, res, next);
});

// Swagger UI for isSelect:true endpoints only - force URL loading
const cleanFilteredSpec = createCleanSpec(filteredSpec);
app.use('/isSelect', swaggerUi.serve);
app.get('/isSelect', (req, res, next) => {
  // Force Swagger UI to load from /isSelect/openapi.json by using null spec
  const swaggerUiHandler = swaggerUi.setup(null, {
    customCss: '.swagger-ui .topbar { display: none }',
    customSiteTitle: 'API Documentation - isSelect Only',
    swaggerOptions: {
      url: '/isSelect/openapi.json',
      persistAuthorization: false,
      tryItOutEnabled: true
    }
  });
  swaggerUiHandler(req, res, next);
});

// Init socket io server
const io = new Server(server, {
  cors: { origin: '*' },
});
io.on('connection', (socket) => {
  socketHandler(socket, io);
});

// Config proxy middlewares
if (CONFIG.proxyServer) {
  app.use(
    CONFIG.proxyUrl,
    createProxyMiddleware({
      target: CONFIG.proxyServer,
      changeOrigin: true,
      ws: true,
      logger: console,
      onProxyRes: function (proxyRes, req, res) {
        cors()(req, res, () => {});
      },
    })
  );
}

// Init graphql
app.use('/graphql', graphqlHTTP({ schema, rootValue: setupRootValue(db), graphiql: true }));

// Set default middlewares (logger, static, cors and no-cache)
app.use(middlewares);

// Body parser moved earlier (above route handlers)

// Bekleyen reset varsa tüm istekleri reset bitene kadar beklet
let resettingPromise = null;
app.use(async (req, res, next) => {
  if (resettingPromise) {
    try { await resettingPromise; } catch (_) {}
  }
  next();
});

const fsp = fs.promises;

async function safeWriteDb() {
  for (let i = 0; i < 5; i++) {
    try {
      await router.db.write(); // sadece router.db diske yazar
      return;
    } catch (e) {
      if (e && e.code === 'EPERM') {
        await new Promise(r => setTimeout(r, 100 * (i + 1)));
        continue;
      }
      throw e;
    }
  }
  await router.db.write();
}

// DB'yi backup'tan yükle
async function resetDbFromBackup() {
  const backupPath = join(process.cwd(), 'yedekDatabase.json');
  const raw = await fsp.readFile(backupPath, 'utf8');
  const nextState = JSON.parse(raw);

  // 1) json-server (router) belleğini güncelle
  router.db.setState(nextState);

  // 2) GraphQL'in kullandığı Low örneğini sadece bellekte eşitle
  db.data = router.db.getState();

  // 3) Diske TEK SEFER yaz
  await safeWriteDb();
}

// Reset endpoint
app.post('/_admin/reset-db', async (req, res) => {
  try {
    if (!resettingPromise) {
      resettingPromise = (async () => {
        await resetDbFromBackup();
      })();
    }
    await resettingPromise;
    resettingPromise = null;
    res.status(204).end();
  } catch (err) {
    resettingPromise = null;
    console.error('DB reset failed:', err);
    res.status(500).json({ error: 'reset_failed' });
  }
});

// Save createdAt and updatedAt automatically
app.use((req, res, next) => {
  const currentTime = Date.now();

  if (req.method === 'POST') {
    req.body.createdAt = currentTime;
    req.body.modifiedAt = currentTime;
  } else if (['PUT', 'PATCH'].includes(req.method)) {
    req.body.modifiedAt = currentTime;
  }

  next();
});

// Test web socket request
app.post('/socket-emit', (req, res) => {
  socketEmit(io, req, res);
});

// Test request (change the response in src/rest.js)
app.get('/test', (req, res) => {
  testHandler(db, req, res);
});

// Register request
app.post('/register', (req, res) => {
  registerHandler(db, req, res);
});

// Login request
app.post('/login', (req, res) => {
  loginHandler(db, req, res);
});

// Renew Token request
app.post('/refresh-token', (req, res) => {
  refreshTokenHandler(req, res);
});

// Upload 1 file
app.post('/upload-file', uploadFileHandler);

// Upload multiple files
app.post('/upload-files', uploadFilesHandler);

// Access control
app.use((req, res, next) => {
  const protectedResources = db.data.protectedResources;
  if (!protectedResources) {
    next();
    return;
  }

  const resource = req.path.slice(1).split('/')[0];
  const protectedResource =
    protectedResources[resource] && protectedResources[resource].map((item) => item.toUpperCase());
  const reqMethod = req.method.toUpperCase();

  if (protectedResource && protectedResource.includes(reqMethod)) {
    if (isAuthenticated(req)) {
      next();
    } else {
      res.sendStatus(401);
    }
  } else {
    next();
  }
});

// Rewrite routes
const urlRewriteFile = new JSONFile(CONFIG.urlRewriteFile);
const rewriteRules = await urlRewriteFile.read();
app.use(jsonServer.rewriter(rewriteRules));

// Setup others routes
app.use(router);

// Start server
server.listen(port, () => {
  console.log('Server is running on port ' + port);
});
