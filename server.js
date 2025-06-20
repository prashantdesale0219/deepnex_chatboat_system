const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');
const swaggerJsDoc = require('swagger-jsdoc');
const swaggerUi = require('swagger-ui-express');
const dotenv = require('dotenv');

// Load environment variables
dotenv.config();

// Import routes and utilities
const configRoutes = require('./routes/configRoutes');
const sessionRoutes = require('./routes/sessionRoutes');
const webhookRoutes = require('./routes/webhookRoutes');
const authRoutes = require('./routes/authRoutes');
const adminInventoryRoutes = require('./routes/adminInventoryRoutes');
const chatInventoryRoutes = require('./routes/chatInventoryRoutes');
const projectConfigManager = require('./utils/projectConfigManager');

// Initialize Express app
const app = express();

// Set up rate limiting
const limiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW_MS || 60000, // 1 minute
  max: process.env.RATE_LIMIT_MAX_REQUESTS || 60, // limit each IP to 60 requests per windowMs
  message: 'Too many requests from this IP, please try again after a minute'
});

// Apply middleware
app.use(helmet()); // Security headers
app.use(cors()); // Enable CORS
app.use(express.json()); // Parse JSON bodies
app.use(express.urlencoded({ extended: true })); // Parse URL-encoded bodies
app.use(morgan('dev')); // HTTP request logger
app.use(limiter); // Apply rate limiting

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Chatbot API',
      version: '1.0.0',
      description: 'MERN-Stack Chatbot Backend API Documentation',
    },
    servers: [
      {
        url: `http://localhost:${process.env.PORT || 5000}`,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    security: [
      {
        bearerAuth: [],
      },
    ],
  },
  apis: ['./routes/*.js'], // Path to the API routes files
};

const swaggerDocs = swaggerJsDoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerDocs));

// Connect to MongoDB for main application
mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Main MongoDB connected successfully');
    // Sync project configurations with database
    projectConfigManager.syncWithDatabase()
      .then(() => console.log('Project configurations synced with database'))
      .catch(err => console.error('Error syncing project configurations:', err));
    
    // Connect to inventory database for product information only
    const inventoryConnection = mongoose.createConnection(process.env.INVENTORY_MONGO_URI || process.env.MONGO_URI);
    
    // Set up ProductInventory model with inventory connection
    const productinventories = require('./models/ProductInventory');
    const OrderRequest = require('./models/OrderRequest');
    
    // Make inventory connection available globally
    global.inventoryDb = inventoryConnection;
    
    // Register ProductInventory model on inventory connection
    global.InventoryProduct = inventoryConnection.model('productinventories', productinventories.schema);
    global.InventoryOrder = inventoryConnection.model('OrderRequest', OrderRequest.schema);
    
    console.log('Inventory database connected for product information using:', process.env.INVENTORY_MONGO_URI || process.env.MONGO_URI);
  })
  .catch((err) => console.error('MongoDB connection error:', err));

// Use routes
app.use('/api/configs', configRoutes);
app.use('/api/sessions', sessionRoutes);
app.use('/api/webhook', webhookRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/admin/inventory', adminInventoryRoutes);
app.use('/api/chat/inventory', chatInventoryRoutes);

// Serve static assets in production
if (process.env.NODE_ENV === 'production') {
  // Set static folder
  const path = require('path');
  app.use(express.static(path.join(__dirname, 'client/build')));

  app.get('*', (req, res) => {
    res.sendFile(path.resolve(__dirname, 'client', 'build', 'index.html'));
  });
} else {
  // Root route for development
  app.get('/', (req, res) => {
    res.json({ message: 'Welcome to the Chatbot API' });
  });
}

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(500).json({
    success: false,
    message: 'Internal Server Error',
    error: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

// Start server
const PORT = process.env.PORT || 5000;
app.listen(PORT, async () => {
  console.log(`Server running on port ${PORT}`);
  
  // Load project configurations and sync with database
  try {
    console.log('Loading project configurations...');
    await projectConfigManager.syncWithDatabase();
    console.log('Project configurations synced with database successfully');
  } catch (error) {
    console.error('Error syncing project configurations with database:', error);
  }
});

module.exports = app; // Export for testing