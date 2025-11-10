const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// =============================================
// DATABASE CONFIGURATION (Simplified for now)
// =============================================
const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

const initDB = async () => {
  const client = await pool.connect();
  try {
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');
    
    // Create tenants table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name TEXT NOT NULL,
        country TEXT NOT NULL,
        currency TEXT NOT NULL DEFAULT 'MZN',
        plan TEXT NOT NULL DEFAULT 'starter',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create companies table
    await client.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL,
        name TEXT NOT NULL,
        currency TEXT NOT NULL DEFAULT 'MZN',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    console.log('✅ Database tables created successfully');
    return true;
  } catch (error) {
    console.error('❌ Database initialization error:', error);
    return false;
  } finally {
    client.release();
  }
};

const testConnection = async () => {
  try {
    const client = await pool.connect();
    await client.query('SELECT 1');
    client.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
};

// =============================================
// MIDDLEWARE
// =============================================

// Security Headers
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https://cdnjs.cloudflare.com", "https://fonts.googleapis.com"],
      fontSrc: ["'self'", "https://fonts.gstatic.com", "https://cdnjs.cloudflare.com"],
      scriptSrc: ["'self'", "'unsafe-inline'", "https://cdn.jsdelivr.net"],
      connectSrc: ["'self'", "https://api.render.com"]
    }
  },
  crossOriginEmbedderPolicy: false
}));

// CORS Configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || true,
  credentials: true
}));

// Body Parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.NODE_ENV === 'production' ? 100 : 1000, // more lenient in development
  message: {
    error: 'Too many requests from this IP, please try again later.'
  },
  standardHeaders: true,
  legacyHeaders: false
});
app.use('/api/', limiter);

// =============================================
// STATIC FILES
// =============================================

app.use(express.static(path.join(__dirname, 'frontend'), {
  maxAge: process.env.NODE_ENV === 'production' ? '1d' : '0',
  etag: true,
  lastModified: true
}));

// =============================================
// AUTHENTICATION MIDDLEWARE
// =============================================

const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  // Skip auth for public routes
  const publicRoutes = ['/health', '/api/v1/auth/register', '/api/v1/auth/login'];
  if (publicRoutes.includes(req.path)) {
    return next();
  }

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  const jwt = require('jsonwebtoken');
  const jwtSecret = process.env.JWT_SECRET || 'great-nexus-dev-secret-2024';

  jwt.verify(token, jwtSecret, (err, user) => {
    if (err) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }
    
    req.user = user;
    next();
  });
};

// Apply auth middleware to all API routes
app.use('/api/', authenticateToken);

// =============================================
// HEALTH CHECK & STATUS
// =============================================

app.get('/health', async (req, res) => {
  const dbStatus = await testConnection();
  const uptime = process.uptime();
  
  res.json({
    status: 'OK',
    service: 'Great Nexus',
    version: '1.0.0',
    environment: process.env.NODE_ENV || 'development',
    database: dbStatus ? 'connected' : 'disconnected',
    uptime: `${Math.floor(uptime / 60)}m ${Math.floor(uptime % 60)}s`,
    timestamp: new Date().toISOString(),
    memory: {
      used: `${Math.round(process.memoryUsage().heapUsed / 1024 / 1024)}MB`,
      total: `${Math.round(process.memoryUsage().heapTotal / 1024 / 1024)}MB`
    }
  });
});

app.get('/status', (req, res) => {
  res.json({
    message: 'Great Nexus API is running',
    endpoints: {
      auth: '/api/v1/auth',
      erp: '/api/v1/erp',
      mola: '/api/v1/mola',
      health: '/health'
    }
  });
});

// =============================================
// AUTH ROUTES
// =============================================

const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

// Register endpoint
app.post('/api/v1/auth/register', async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const { email, password, name, companyName, country = 'MZ', currency = 'MZN' } = req.body;

    // Validation
    if (!email || !password || !name || !companyName) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'Password must be at least 8 characters' });
    }

    // Check if user exists
    const userExists = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create tenant
    const tenantResult = await client.query(
      `INSERT INTO tenants (name, country, currency, plan) 
       VALUES ($1, $2, $3, $4) RETURNING id, name, plan`,
      [companyName, country, currency, 'starter']
    );
    const tenant = tenantResult.rows[0];

    // Create user
    const userResult = await client.query(
      `INSERT INTO users (tenant_id, email, password_hash, name, role) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id, email, name, role`,
      [tenant.id, email, passwordHash, name, 'tenant_admin']
    );
    const user = userResult.rows[0];

    // Create default company
    await client.query(
      `INSERT INTO companies (tenant_id, name, currency) 
       VALUES ($1, $2, $3)`,
      [tenant.id, companyName, currency]
    );

    await client.query('COMMIT');

    // Generate tokens
    const jwtSecret = process.env.JWT_SECRET || 'great-nexus-dev-secret-2024';
    const accessToken = jwt.sign(
      { user_id: user.id, tenant_id: tenant.id, role: user.role },
      jwtSecret,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { user_id: user.id, tenant_id: tenant.id },
      jwtSecret,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Registration successful',
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
      refreshToken
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Registration error:', error);
    res.status(500).json({ 
      error: 'Internal server error during registration',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  } finally {
    client.release();
  }
});

// Login endpoint
app.post('/api/v1/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    // Find user with tenant info
    const result = await pool.query(
      `SELECT u.id, u.tenant_id, u.email, u.password_hash, u.name, u.role, 
              t.name as tenant_name, t.plan as tenant_plan
       FROM users u 
       JOIN tenants t ON u.tenant_id = t.id 
       WHERE u.email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate tokens
    const jwtSecret = process.env.JWT_SECRET || 'great-nexus-dev-secret-2024';
    const accessToken = jwt.sign(
      { user_id: user.id, tenant_id: user.tenant_id, role: user.role },
      jwtSecret,
      { expiresIn: '15m' }
    );

    const refreshToken = jwt.sign(
      { user_id: user.id, tenant_id: user.tenant_id },
      jwtSecret,
      { expiresIn: '7d' }
    );

    res.json({
      message: 'Login successful',
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      tenant: {
        id: user.tenant_id,
        name: user.tenant_name,
        plan: user.tenant_plan
      },
      accessToken,
      refreshToken
    });

  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ 
      error: 'Internal server error during login',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
});

// Refresh token endpoint
app.post('/api/v1/auth/refresh', (req, res) => {
  try {
    const { refreshToken } = req.body;
    const jwtSecret = process.env.JWT_SECRET || 'great-nexus-dev-secret-2024';

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    const decoded = jwt.verify(refreshToken, jwtSecret);
    
    // Generate new access token
    const accessToken = jwt.sign(
      { 
        user_id: decoded.user_id, 
        tenant_id: decoded.tenant_id, 
        role: decoded.role 
      },
      jwtSecret,
      { expiresIn: '15m' }
    );

    res.json({ accessToken });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
});

// =============================================
// ERP ROUTES
// =============================================

// Products endpoints
app.get('/api/v1/erp/products', async (req, res) => {
  try {
    const { page = 1, limit = 50, search } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(limit);
    
    let query = `SELECT * FROM products WHERE tenant_id = $1`;
    let countQuery = `SELECT COUNT(*) FROM products WHERE tenant_id = $1`;
    const params = [req.user.tenant_id];
    
    if (search) {
      query += ` AND (name ILIKE $2 OR sku ILIKE $2)`;
      countQuery += ` AND (name ILIKE $2 OR sku ILIKE $2)`;
      params.push(`%${search}%`);
    }
    
    query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(parseInt(limit), offset);
    
    const [productsResult, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, params.slice(0, search ? 2 : 1))
    ]);
    
    res.json({
      success: true,
      products: productsResult.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(parseInt(countResult.rows[0].count) / parseInt(limit))
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ 
      error: 'Failed to fetch products',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
});

app.post('/api/v1/erp/products', async (req, res) => {
  try {
    const { sku, name, price = 0, stock = 0, company_id } = req.body;
    
    if (!sku || !name || !company_id) {
      return res.status(400).json({ error: 'SKU, name and company_id are required' });
    }

    const result = await pool.query(
      `INSERT INTO products (tenant_id, company_id, sku, name, price, stock) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [req.user.tenant_id, company_id, sku, name, price, stock]
    );
    
    res.status(201).json({
      success: true,
      product: result.rows[0],
      message: 'Product created successfully'
    });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ 
      error: 'Failed to create product',
      ...(process.env.NODE_ENV === 'development' && { details: error.message })
    });
  }
});

// =============================================
// GREAT MOLA ROUTES
// =============================================

app.get('/api/v1/mola/investments', async (req, res) => {
  try {
    // Mock investments data for now
    res.json({
      success: true,
      investments: [
        {
          id: '1',
          capital: 50000,
          start_date: '2024-01-15',
          business_days: 30,
          daily_rate: 0.003,
          gross_return: 4500,
          tax: 900,
          net_return: 3600,
          status: 'active'
        }
      ],
      message: 'Investments fetched successfully'
    });
  } catch (error) {
    console.error('Get investments error:', error);
    res.status(500).json({ error: 'Failed to fetch investments' });
  }
});

app.post('/api/v1/mola/investments', async (req, res) => {
  try {
    const { capital, business_days, daily_rate = 0.003 } = req.body;
    
    if (!capital || !business_days) {
      return res.status(400).json({ error: 'Capital and business days are required' });
    }

    // Calculate investment returns
    const gross_return = capital * business_days * daily_rate;
    const tax = gross_return * 0.20; // 20% tax
    const net_return = gross_return - tax;

    // Mock response - in real app, save to database
    const investment = {
      id: Date.now().toString(),
      capital,
      start_date: new Date().toISOString().split('T')[0],
      business_days,
      daily_rate,
      gross_return,
      tax,
      net_return,
      status: 'active'
    };

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

// Global error handler
app.use((err, req, res, next) => {
  console.error('🚨 Global Error Handler:', err.stack);
  
  // Database connection errors
  if (err.code === 'ECONNREFUSED') {
    return res.status(503).json({ 
      error: 'Database connection failed',
      message: 'Service temporarily unavailable'
    });
  }
  
  // JWT errors
  if (err.name === 'JsonWebTokenError') {
    return res.status(401).json({ error: 'Invalid token' });
  }
  
  if (err.name === 'TokenExpiredError') {
    return res.status(401).json({ error: 'Token expired' });
  }
  
  // Default error response
  res.status(500).json({ 
    error: 'Internal server error',
    ...(process.env.NODE_ENV === 'development' && { 
      details: err.message,
      stack: err.stack 
    })
  });
});

// Unhandled rejection handler
process.on('unhandledRejection', (reason, promise) => {
  console.error('🚨 Unhandled Rejection at:', promise, 'reason:', reason);
});

// Uncaught exception handler
process.on('uncaughtException', (error) => {
  console.error('🚨 Uncaught Exception:', error);
  process.exit(1);
});

// =============================================
// SERVER STARTUP
// =============================================

const startServer = async () => {
  try {
    // Test database connection
    const dbConnected = await testConnection();
    if (!dbConnected) {
      console.warn('⚠️  Database connection failed, but starting server anyway...');
    }

    // Initialize database tables
    await initDB();

    // Start server
    app.listen(PORT, () => {
      console.log(`
🎉 GREAT NEXUS SERVER STARTED SUCCESSFULLY!

📍 Port: ${PORT}
🌍 Environment: ${process.env.NODE_ENV || 'development'}
🗄️  Database: ${dbConnected ? '✅ Connected' : '❌ Disconnected'}
📅 Started: ${new Date().toLocaleString()}
🔗 Health Check: http://localhost:${PORT}/health
📊 Status: http://localhost:${PORT}/status

🚀 Ready for production!
      `);
    });

  } catch (error) {
    console.error('💥 Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  pool.end();
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  pool.end();
  process.exit(0);
});

// Start the server
startServer();

module.exports = app;
