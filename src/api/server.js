const express = require('express');
const bodyParser = require('body-parser');
const config = require('../config');
const { swaggerUi, swaggerSpec } = require('./swagger');
const crawlRoutes = require('./routes/crawl');
const logger = require('../utils/logger');

const app = express();

// Middleware
app.use(bodyParser.json());

// Swagger setup
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));

// Routes
app.use('/', crawlRoutes);

// Start server
app.listen(config.port, () => {
  logger.info(`API server listening on port ${config.port}`);
});
