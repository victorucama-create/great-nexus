const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// =============================================
// IN-MEMORY DATABASE (para MVP inicial)
// =============================================
const memoryDB = {
  users: [
    {
      id: '1',
      email: 'admin@greatnexus.com',
      password: 'hashed_password_here', // Em produção, usar bcrypt
      name: 'Administrador',
      role: 'super_admin',
      tenant_id: '1'
    }
  ],
  tenants: [
    {
      id: '1',
      name: 'Great Nexus Demo',
      country: 'MZ',
      currency: 'MZN',
      plan: 'enterprise'
    }
  ],
  products: [],
  investments: []
};

// =============================================
// MIDDLEWARE
// =============================================

// Security Headers
app.use(helmet({
  contentSecurityPolicy: false, // Desabilitado para desenvolvimento
  crossOriginEmbedderPolicy: false
}));

// CORS
app.use(cors());

// Body Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// =============================================
// STATIC FILES
// =============================================

app.use(express.static(path.join(__dirname, 'frontend')));

// =============================================
// AUTHENTICATION MIDDLEWARE (Simplified)
// =============================================

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  // Skip auth for public routes
  const publicRoutes = [
    '/health', 
    '/status',
    '/api/v1/auth/register', 
    '/api/v1/auth/login',
    '/api/v1/auth/demo'
  ];
  
  if (publicRoutes.includes(req.path)) {
    return next();
  }

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
    // Simple token verification for demo
    const jwt = require('jsonwebtoken');
    const jwtSecret = process.env.JWT_SECRET || 'great-nexus-demo-secret';
    const user = jwt.verify(token, jwtSecret);
    req.user = user;
    next();
  } catch (error) {
    return res.status(403).json({ error: 'Invalid or expired token' });
  }
};

app.use('/api/', authenticateToken);

// =============================================
// HEALTH CHECK & STATUS
// =============================================

app.get('/health', (req, res) => {
  res.json({
    status: 'OK',
    service: 'Great Nexus',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    database: 'in-memory',
    timestamp: new Date().toISOString(),
    memory: process.memoryUsage()
  });
});

app.get('/status', (req, res) => {
  res.json({
    message: '🚀 Great Nexus API is running!',
    database: 'In-memory (Demo Mode)',
    endpoints: {
      auth: '/api/v1/auth/*',
      erp: '/api/v1/erp/*',
      mola: '/api/v1/mola/*',
      demo: '/api/v1/auth/demo'
    }
  });
});

// =============================================
// DEMO AUTH ENDPOINT (Para teste rápido)
// =============================================

app.post('/api/v1/auth/demo', (req, res) => {
  const jwt = require('jsonwebtoken');
  const jwtSecret = process.env.JWT_SECRET || 'great-nexus-demo-secret';
  
  const demoUser = {
    id: 'demo-user-1',
    email: 'demo@greatnexus.com',
    name: 'Demo User',
    role: 'tenant_admin',
    tenant_id: 'demo-tenant-1'
  };

  const demoToken = jwt.sign(demoUser, jwtSecret, { expiresIn: '24h' });

  res.json({
    message: 'Demo login successful!',
    user: demoUser,
    tenant: {
      id: 'demo-tenant-1',
      name: 'Great Nexus Demo Company',
      plan: 'starter'
    },
    accessToken: demoToken,
    refreshToken: demoToken
  });
});

// =============================================
// AUTH ROUTES
// =============================================

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Register endpoint
app.post('/api/v1/auth/register', async (req, res) => {
  try {
    const { email, password, name, companyName, country = 'MZ', currency = 'MZN' } = req.body;

    // Validation
    if (!email || !password || !name || !companyName) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    // Check if user exists
    const userExists = memoryDB.users.find(u => u.email === email);
    if (userExists) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Create tenant
    const tenantId = 'tenant-' + Date.now();
    const tenant = {
      id: tenantId,
      name: companyName,
      country,
      currency,
      plan: 'starter',
      created_at: new Date().toISOString()
    };
    memoryDB.tenants.push(tenant);

    // Create user (simplified - sem hash para demo)
    const userId = 'user-' + Date.now();
    const user = {
      id: userId,
      tenant_id: tenantId,
      email,
      password: password, // Em produção: await bcrypt.hash(password, 12)
      name,
      role: 'tenant_admin',
      created_at: new Date().toISOString()
    };
    memoryDB.users.push(user);

    // Generate tokens
    const jwtSecret = process.env.JWT_SECRET || 'great-nexus-demo-secret';
    const accessToken = jwt.sign(
      { user_id: userId, tenant_id: tenantId, role: user.role },
      jwtSecret,
      { expiresIn: '24h' }
    );

    res.status(201).json({
      message: 'Registration successful!',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        plan: tenant.plan
      },
      accessToken,
      refreshToken: accessToken
    });

  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ 
      error: 'Internal server error during registration',
      details: error.message
    });
  }
});

// Login endpoint
app.post('/api/v1/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user
    const user = memoryDB.users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Verify password (simplified para demo)
    if (user.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Find tenant
    const tenant = memoryDB.tenants.find(t => t.id === user.tenant_id);

    // Generate tokens
    const jwtSecret = process.env.JWT_SECRET || 'great-nexus-demo-secret';
    const accessToken = jwt.sign(
      { user_id: user.id, tenant_id: user.tenant_id, role: user.role },
      jwtSecret,
      { expiresIn: '24h' }
    );

    res.json({
      message: 'Login successful!',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        plan: tenant.plan
      },
      accessToken,
      refreshToken: accessToken
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'Internal server error during login',
      details: error.message
    });
  }
});

// =============================================
// ERP ROUTES
// =============================================

// Get products
app.get('/api/v1/erp/products', (req, res) => {
  try {
    const userProducts = memoryDB.products.filter(p => p.tenant_id === req.user.tenant_id);
    
    res.json({
      success: true,
      products: userProducts,
      pagination: {
        page: 1,
        limit: 50,
        total: userProducts.length,
        pages: 1
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Failed to fetch products' });
  }
});

// Create product
app.post('/api/v1/erp/products', (req, res) => {
  try {
    const { sku, name, price = 0, stock = 0 } = req.body;
    
    if (!sku || !name) {
      return res.status(400).json({ error: 'SKU and name are required' });
    }

    const product = {
      id: 'prod-' + Date.now(),
      tenant_id: req.user.tenant_id,
      sku,
      name,
      price: parseFloat(price),
      stock: parseInt(stock),
      created_at: new Date().toISOString()
    };

    memoryDB.products.push(product);
    
    res.status(201).json({
      success: true,
      product,
      message: 'Product created successfully'
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// =============================================
// GREAT MOLA ROUTES
// =============================================

// Get investments
app.get('/api/v1/mola/investments', (req, res) => {
  try {
    const userInvestments = memoryDB.investments.filter(i => i.user_id === req.user.user_id);
    
    res.json({
      success: true,
      investments: userInvestments.length > 0 ? userInvestments : [
        {
          id: 'demo-investment-1',
          user_id: req.user.user_id,
          capital: 50000,
          start_date: '2024-01-15',
          business_days: 30,
          daily_rate: 0.003,
          gross_return: 4500,
          tax: 900,
          net_return: 3600,
          status: 'active',
          created_at: new Date().toISOString()
        }
      ],
      message: 'Investments fetched successfully'
    });
  } catch (error) {
    console.error('Get investments error:', error);
    res.status(500).json({ error: 'Failed to fetch investments' });
  }
});

// Create investment
app.post('/api/v1/mola/investments', (req, res) => {
  try {
    const { capital, business_days, daily_rate = 0.003 } = req.body;
    
    if (!capital || !business_days) {
      return res.status(400).json({ error: 'Capital and business days are required' });
    }

    // Calculate investment returns
    const gross_return = capital * business_days * daily_rate;
    const tax = gross_return * 0.20;
    const net_return = gross_return - tax;

    const investment = {
      id: 'inv-' + Date.now(),
      user_id: req.user.user_id,
      capital: parseFloat(capital),
      start_date: new Date().toISOString().split('T')[0],
      business_days: parseInt(business_days),
      daily_rate: parseFloat(daily_rate),
      gross_return,
      tax,
      net_return,
      status: 'active',
      created_at: new Date().toISOString()
    };

    memoryDB.investments.push(investment);

    res.status(201).json({
      success: true,
      investment,
      message: 'Investment created successfully'
    });
  } catch (error) {
    console.error('Create investment error:', error);
    res.status(500).json({ error: 'Failed to create investment' });
  }
});

// =============================================
// ADD SOME DEMO DATA
// =============================================

// Add demo products
memoryDB.products.push(
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
  }
);

// =============================================
// FALLBACK ROUTES
// =============================================

// API 404 handler
app.use('/api/*', (req, res) => {
  res.status(404).json({ 
    error: 'API endpoint not found',
    path: req.path,
    method: req.method
  });
});

// Serve frontend for all other routes (SPA support)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// =============================================
// ERROR HANDLING
// =============================================

app.use((err, req, res, next) => {
  console.error('🚨 Error:', err.stack);
  res.status(500).json({ 
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { 
      details: err.message
    })
  });
});

// =============================================
// SERVER STARTUP
// =============================================

app.listen(PORT, () => {
  console.log(`
🎉 GREAT NEXUS SERVER STARTED SUCCESSFULLY!

📍 Port: ${PORT}
🌍 Environment: ${process.env.NODE_ENV || 'development'}  
🗄️  Database: In-memory (Demo Mode)
📅 Started: ${new Date().toLocaleString()}
🔗 Health Check: http://localhost:${PORT}/health
🚀 Demo Login: POST http://localhost:${PORT}/api/v1/auth/demo

✅ READY FOR DEMONSTRATION!
  `);
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

module.exports = app;
