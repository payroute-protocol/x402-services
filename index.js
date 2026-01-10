import express from 'express';
import cors from 'cors';
import 'dotenv/config';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import path from 'path';
import { fileURLToPath } from 'url';

import userRoutes from './routes/app_routes.js';

const app = express();
const PORT = process.env.PORT || 3000;

// --- Implementasi Swagger Baru ---

// 4. Static files and Swagger setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const __swaggerDistPath = path.join(
  __dirname,
  "node_modules",
  "swagger-ui-dist"
);

// Menyediakan file statis untuk Swagger UI
app.use("/api-docs-payroute", express.static(__swaggerDistPath));

// Swagger configuration
const swaggerOptions = {
  swaggerDefinition: {
    openapi: "3.0.0",
    info: {
      title: "Payroute API",
      version: "1.0.0",
      description: "API documentation",
    },
    servers: [
      {
        // url: process.env.BASE_URL,
        url: `https://x402-services.vercel.app/`,
      },
    ],
  },
  apis: ["./routes/*.js"],
}

const swaggerDocs = swaggerJsdoc(swaggerOptions);

// Setup UI di endpoint baru
app.use('/api-docs-payroute', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// ----------------------------------

// Middleware
app.use(cors({ origin: '*' }));
app.use(express.json());

// Routes
app.use('/', userRoutes);

app.get('/', (req, res) => {
    res.send('Backend Server Running.');
});

app.listen(PORT, () => {
    console.log(`Server is running on http://localhost:${PORT}`);
    console.log(`Swagger docs available at http://localhost:${PORT}/api-docs-payroute`);
});