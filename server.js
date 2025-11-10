const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// =============================================
// MIDDLEWARE CONFIGURATION
// =============================================

// Security Headers
app.use(helmet({
  contentSecurityPolicy: false, // Desabilitado para desenvolvimento
  crossOriginEmbedderPolicy: false
}));

// CORS Configuration
app.use(cors({
  origin: true, // Permitir qualquer origem
  credentials: true
}));

// Body Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 1000, // Mais leniente para demo
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

// =============================================
// STATIC FILES SERVING
// =============================================

// Servir arquivos estáticos do frontend
app.use(express.static(path.join(__dirname, 'frontend'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0',
  etag: true,
  lastModified: true,
  index: false // Não servir index.html automaticamente
}));

// =============================================
// HEALTH CHECK & STATUS ENDPOINTS
// =============================================

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Great Nexus',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'production',
    timestamp: new Date().toISOString(),
    database: 'mock-data',
    message: '🚀 Servidor está funcionando perfeitamente! Frontend com dados demo.'
  });
});

app.get('/status', (req, res) => {
  res.json({
    message: 'Great Nexus API Server',
    status: 'operational',
    version: '1.0.0',
    endpoints: {
      auth: ['/api/v1/auth/demo', '/api/v1/auth/login', '/api/v1/auth/register'],
      erp: ['/api/v1/erp/products'],
      mola: ['/api/v1/mola/investments'],
      health: '/health'
    },
    timestamp: new Date().toISOString()
  });
});

// =============================================
// AUTHENTICATION MIDDLEWARE
// =============================================

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  // Skip auth for public routes
  const publicRoutes = [
    '/health', 
    '/status',
    '/api/v1/auth/demo', 
    '/api/v1/auth/login', 
    '/api/v1/auth/register'
  ];
  
  if (publicRoutes.includes(req.path)) {
    return next();
  }

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  // Simple token verification for demo
  try {
    // In a real app, you would verify JWT properly
    if (token.startsWith('demo-') || token.startsWith('jwt-token-')) {
      req.user = {
        user_id: 'demo-user-1',
        tenant_id: 'demo-tenant-1',
        role: 'tenant_admin'
      };
      return next();
    }
    
    throw new Error('Invalid token');
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

// Apply auth middleware to protected API routes
app.use('/api/v1/erp', authenticateToken);
app.use('/api/v1/mola', authenticateToken);

// =============================================
// AUTHENTICATION ROUTES
// =============================================

// Demo Login - No authentication required
app.post('/api/v1/auth/demo', (req, res) => {
  console.log('📧 Demo login request received');
  
  const demoUser = {
    id: 'demo-user-1',
    email: 'demo@greatnexus.com',
    name: 'Demo User',
    role: 'tenant_admin',
    tenant_id: 'demo-tenant-1'
  };

  const demoToken = 'demo-jwt-token-' + Date.now();

  res.json({
    message: 'Demo login successful!',
    user: demoUser,
    tenant: {
      id: 'demo-tenant-1',
      name: 'Great Nexus Demo Company',
      plan: 'starter',
      country: 'MZ',
      currency: 'MZN'
    },
    accessToken: demoToken,
    refreshToken: demoToken
  });
});

// User Login
app.post('/api/v1/auth/login', (req, res) => {
  const { email, password } = req.body;
  
  console.log('📧 Login attempt for:', email);

  if (!email || !password) {
    return res.status(400).json({ error: 'Email and password are required' });
  }

  // Mock user validation
  const user = {
    id: 'user-' + Date.now(),
    email: email,
    name: email.split('@')[0],
    role: 'tenant_admin',
    tenant_id: 'tenant-' + Date.now()
  };

  const token = 'jwt-token-' + Date.now();

  res.json({
    message: 'Login successful!',
    user: user,
    tenant: {
      id: user.tenant_id,
      name: 'Minha Empresa',
      plan: 'starter',
      country: 'MZ',
      currency: 'MZN'
    },
    accessToken: token,
    refreshToken: token
  });
});

// User Registration
app.post('/api/v1/auth/register', (req, res) => {
  const { email, password, name, companyName, country = 'MZ', currency = 'MZN' } = req.body;
  
  console.log('📧 Registration attempt for:', email, 'Company:', companyName);

  if (!email || !password || !name || !companyName) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  if (password.length < 8) {
    return res.status(400).json({ error: 'Password must be at least 8 characters' });
  }

  // Mock user creation
  const user = {
    id: 'user-' + Date.now(),
    email: email,
    name: name,
    role: 'tenant_admin',
    tenant_id: 'tenant-' + Date.now()
  };

  const token = 'jwt-token-' + Date.now();

  res.status(201).json({
    message: 'Registration successful!',
    user: user,
    tenant: {
      id: user.tenant_id,
      name: companyName,
      plan: 'starter',
      country: country,
      currency: currency
    },
    accessToken: token,
    refreshToken: token
  });
});

// =============================================
// ERP ROUTES
// =============================================

// Mock products data
let mockProducts = [
  {
    id: 'prod-1',
    tenant_id: 'demo-tenant-1',
    sku: 'MON-24-LED',
    name: 'Monitor LED 24"',
    price: 8500.00,
    stock: 15,
    created_at: new Date().toISOString()
  },
  {
    id: 'prod-2',
    tenant_id: 'demo-tenant-1',
    sku: 'TEC-GAMER',
    name: 'Teclado Gamer Mecânico',
    price: 2500.00,
    stock: 8,
    created_at: new Date().toISOString()
  },
  {
    id: 'prod-3',
    tenant_id: 'demo-tenant-1',
    sku: 'MOUSE-WL',
    name: 'Mouse Sem Fios',
    price: 1200.00,
    stock: 25,
    created_at: new Date().toISOString()
  },
  {
    id: 'prod-4',
    tenant_id: 'demo-tenant-1',
    sku: 'CPU-I7',
    name: 'Computador Intel i7',
    price: 45000.00,
    stock: 5,
    created_at: new Date().toISOString()
  }
];

// Get products with pagination and search
app.get('/api/v1/erp/products', (req, res) => {
  const { page = 1, limit = 50, search } = req.query;
  const pageNum = parseInt(page);
  const limitNum = parseInt(limit);
  
  console.log('📦 Fetching products - Page:', pageNum, 'Limit:', limitNum, 'Search:', search);

  let filteredProducts = [...mockProducts];

  // Apply search filter
  if (search) {
    const searchLower = search.toLowerCase();
    filteredProducts = filteredProducts.filter(product => 
      product.name.toLowerCase().includes(searchLower) ||
      product.sku.toLowerCase().includes(searchLower)
    );
  }

  // Apply pagination
  const startIndex = (pageNum - 1) * limitNum;
  const endIndex = startIndex + limitNum;
  const paginatedProducts = filteredProducts.slice(startIndex, endIndex);

  res.json({
    success: true,
    products: paginatedProducts,
    pagination: {
      page: pageNum,
      limit: limitNum,
      total: filteredProducts.length,
      pages: Math.ceil(filteredProducts.length / limitNum)
    }
  });
});

// Create new product
app.post('/api/v1/erp/products', (req, res) => {
  const { sku, name, price, stock } = req.body;
  
  console.log('📦 Creating product:', { sku, name, price, stock });

  if (!sku || !name || !price || !stock) {
    return res.status(400).json({ 
      success: false,
      error: 'SKU, name, price and stock are required' 
    });
  }

  // Check if SKU already exists
  const existingProduct = mockProducts.find(p => p.sku === sku);
  if (existingProduct) {
    return res.status(400).json({
      success: false,
      error: 'Product with this SKU already exists'
    });
  }

  const newProduct = {
    id: 'prod-' + Date.now(),
    tenant_id: req.user?.tenant_id || 'demo-tenant-1',
    sku: sku,
    name: name,
    price: parseFloat(price),
    stock: parseInt(stock),
    created_at: new Date().toISOString()
  };

  mockProducts.unshift(newProduct); // Add to beginning of array

  res.status(201).json({
    success: true,
    product: newProduct,
    message: 'Product created successfully'
  });
});

// Update product
app.put('/api/v1/erp/products/:id', (req, res) => {
  const productId = req.params.id;
  const { sku, name, price, stock } = req.body;
  
  console.log('📦 Updating product:', productId);

  const productIndex = mockProducts.findIndex(p => p.id === productId);
  
  if (productIndex === -1) {
    return res.status(404).json({
      success: false,
      error: 'Product not found'
    });
  }

  // Update product
  mockProducts[productIndex] = {
    ...mockProducts[productIndex],
    sku: sku || mockProducts[productIndex].sku,
    name: name || mockProducts[productIndex].name,
    price: price !== undefined ? parseFloat(price) : mockProducts[productIndex].price,
    stock: stock !== undefined ? parseInt(stock) : mockProducts[productIndex].stock
  };

  res.json({
    success: true,
    product: mockProducts[productIndex],
    message: 'Product updated successfully'
  });
});

// Delete product
app.delete('/api/v1/erp/products/:id', (req, res) => {
  const productId = req.params.id;
  
  console.log('📦 Deleting product:', productId);

  const productIndex = mockProducts.findIndex(p => p.id === productId);
  
  if (productIndex === -1) {
    return res.status(404).json({
      success: false,
      error: 'Product not found'
    });
  }

  const deletedProduct = mockProducts.splice(productIndex, 1)[0];

  res.json({
    success: true,
    product: deletedProduct,
    message: 'Product deleted successfully'
  });
});

// =============================================
// GREAT MOLA ROUTES
// =============================================

// Mock investments data
let mockInvestments = [
  {
    id: 'inv-1',
    user_id: 'demo-user-1',
    capital: 50000,
    start_date: '2024-01-15',
    business_days: 30,
    daily_rate: 0.003,
    gross_return: 4500,
    tax: 900,
    net_return: 3600,
    status: 'active',
    created_at: new Date().toISOString()
  },
  {
    id: 'inv-2',
    user_id: 'demo-user-1',
    capital: 25000,
    start_date: '2024-02-01',
    business_days: 15,
    daily_rate: 0.003,
    gross_return: 1125,
    tax: 225,
    net_return: 900,
    status: 'active',
    created_at: new Date().toISOString()
  }
];

// Get user investments
app.get('/api/v1/mola/investments', (req, res) => {
  const userId = req.user?.user_id || 'demo-user-1';
  
  console.log('💰 Fetching investments for user:', userId);

  const userInvestments = mockInvestments.filter(inv => inv.user_id === userId);

  res.json({
    success: true,
    investments: userInvestments,
    message: 'Investments fetched successfully'
  });
});

// Create new investment
app.post('/api/v1/mola/investments', (req, res) => {
  const { capital, business_days, daily_rate = 0.003 } = req.body;
  const userId = req.user?.user_id || 'demo-user-1';
  
  console.log('💰 Creating investment:', { capital, business_days, daily_rate });

  if (!capital || !business_days) {
    return res.status(400).json({
      success: false,
      error: 'Capital and business days are required'
    });
  }

  if (capital <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Capital must be greater than 0'
    });
  }

  if (business_days <= 0) {
    return res.status(400).json({
      success: false,
      error: 'Business days must be greater than 0'
    });
  }

  // Calculate investment returns
  const gross_return = capital * business_days * daily_rate;
  const tax = gross_return * 0.20; // 20% tax
  const net_return = gross_return - tax;

  const newInvestment = {
    id: 'inv-' + Date.now(),
    user_id: userId,
    capital: parseFloat(capital),
    start_date: new Date().toISOString().split('T')[0],
    business_days: parseInt(business_days),
    daily_rate: parseFloat(daily_rate),
    gross_return: gross_return,
    tax: tax,
    net_return: net_return,
    status: 'active',
    created_at: new Date().toISOString()
  };

  mockInvestments.unshift(newInvestment);

  res.status(201).json({
    success: true,
    investment: newInvestment,
    message: 'Investment created successfully'
  });
});

// Get investment statistics
app.get('/api/v1/mola/stats', (req, res) => {
  const userId = req.user?.user_id || 'demo-user-1';
  const userInvestments = mockInvestments.filter(inv => inv.user_id === userId);

  const totalInvested = userInvestments.reduce((sum, inv) => sum + inv.capital, 0);
  const totalReturns = userInvestments.reduce((sum, inv) => sum + inv.net_return, 0);
  const activeInvestments = userInvestments.filter(inv => inv.status === 'active').length;

  res.json({
    success: true,
    stats: {
      totalInvested,
      totalReturns,
      activeInvestments,
      totalInvestments: userInvestments.length
    }
  });
});

// =============================================
// DASHBOARD ROUTES
// =============================================

// Get dashboard data
app.get('/api/v1/dashboard/overview', (req, res) => {
  const tenantId = req.user?.tenant_id || 'demo-tenant-1';
  
  console.log('📊 Fetching dashboard data for tenant:', tenantId);

  const tenantProducts = mockProducts.filter(p => p.tenant_id === tenantId);
  const totalProducts = tenantProducts.length;
  const lowStockProducts = tenantProducts.filter(p => p.stock < 10).length;
  const totalInventoryValue = tenantProducts.reduce((sum, p) => sum + (p.price * p.stock), 0);

  const userId = req.user?.user_id || 'demo-user-1';
  const userInvestments = mockInvestments.filter(inv => inv.user_id === userId);
  const totalInvested = userInvestments.reduce((sum, inv) => sum + inv.capital, 0);
  const totalInvestmentReturns = userInvestments.reduce((sum, inv) => sum + inv.net_return, 0);

  // Mock sales data
  const monthlySales = 125840;
  const dailySales = 12540;
  const totalOrders = 42;

  res.json({
    success: true,
    data: {
      sales: {
        monthly: monthlySales,
        daily: dailySales,
        orders: totalOrders,
        trend: 12.5
      },
      inventory: {
        totalProducts,
        lowStock: lowStockProducts,
        totalValue: totalInventoryValue,
        trend: -3.1
      },
      investments: {
        totalInvested,
        totalReturns: totalInvestmentReturns,
        active: userInvestments.length,
        trend: 5.7
      }
    }
  });
});

// =============================================
// ERROR HANDLING MIDDLEWARE
// =============================================

// 404 Handler for API routes
app.use('/api/*', (req, res) => {
  res.status(404).json({ 
    success: false,
    error: 'API endpoint not found',
    path: req.path,
    method: req.method,
    availableEndpoints: {
      auth: ['/api/v1/auth/demo', '/api/v1/auth/login', '/api/v1/auth/register'],
      erp: ['/api/v1/erp/products'],
      mola: ['/api/v1/mola/investments', '/api/v1/mola/stats'],
      dashboard: ['/api/v1/dashboard/overview']
    }
  });
});

// Serve frontend for all other routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// Global error handler
app.use((err, req, res, next) => {
  console.error('🚨 Global Error Handler:', err.stack);
  
  // Database connection errors
  if (err.code === 'ECONNREFUSED') {
    return res.status(503).json({ 
      success: false,
      error: 'Database connection failed',
      message: 'Service temporarily unavailable'
    });
  }
  
  // Default error response
  res.status(500).json({ 
    success: false,
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { 
      details: err.message,
      stack: err.stack 
    })
  });
});

// =============================================
// SERVER STARTUP
// =============================================

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error);
  process.exit(1);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  process.exit(0);
});

// Start Server
app.listen(PORT, () => {
  console.log(`
🎉 GREAT NEXUS SERVER STARTED SUCCESSFULLY!

📍 Port: ${PORT}
🌍 Environment: ${process.env.NODE_ENV || 'production'}
📅 Started: ${new Date().toLocaleString()}
🔗 Health Check: http://localhost:${PORT}/health
📊 Status: http://localhost:${PORT}/status
🚀 Demo Login: POST http://localhost:${PORT}/api/v1/auth/demo

📦 Mock Data Loaded:
   - Products: ${mockProducts.length}
   - Investments: ${mockInvestments.length}

✅ SERVER READY FOR PRODUCTION!
  `);
});

module.exports = app;
