import jsonServer from 'json-server';
import cors from 'cors';
import swaggerUi from 'swagger-ui-express';
import generateSwaggerDocs, { filterIsSelectOnly } from './utils/swagger-generator.js';

const app = jsonServer.create();
const port = 8001;

app.use(cors());
app.use(jsonServer.bodyParser);

// Generate swagger docs and filter only isSelect: true endpoints
const swaggerSpec = await generateSwaggerDocs();
const filteredSpec = filterIsSelectOnly(swaggerSpec);

// Serve Swagger UI at /isSelect
app.use('/isSelect', swaggerUi.serve, swaggerUi.setup(filteredSpec));

// Serve OpenAPI JSON at /openapi.json (like server.js)
app.get('/openapi.json', (req, res) => {
  res.json(filteredSpec);
});

// Also serve at /isSelect/openapi.json
app.get('/isSelect/openapi.json', (req, res) => {
  res.json(filteredSpec);
});

// Start server
app.listen(port, () => {
  console.log(`isSelect Swagger server is running on http://localhost:${port}/isSelect`);
});

