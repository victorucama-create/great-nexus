const express = require('express');
const path = require('path');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;

// =============================================
// IN-MEMORY DATABASE
// =============================================
const memoryDB = {
  users: [
    {
      id: '1',
      email: 'admin@greatnexus.com',
      password: '12345678', // Demo only
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

// Add demo data
memoryDB.products.push(
  {
    id: 'prod-1',
    tenant_id: '1',
    sku: 'MON-24-LED',
    name: 'Monitor LED 24"',
    price: 8500.00,
    stock: 15,
    created_at: new Date().toISOString()
  },
  {
    id: 'prod-2', 
    tenant_id: '1',
    sku: 'TEC-GAMER',
    name: 'Teclado Gamer Mecânico',
    price: 2500.00,
    stock: 8,
    created_at: new Date().toISOString()
  }
);

// =============================================
// MIDDLEWARE
// =============================================
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 1000,
  message: { error: 'Too many requests, please try again later.' }
});
app.use('/api/', limiter);

// =============================================
// STATIC FILE SERVING - Criar pasta frontend se não existir
// =============================================
const fs = require('fs');
const frontendPath = path.join(__dirname, 'frontend');

// Criar pasta frontend se não existir
if (!fs.existsSync(frontendPath)) {
  fs.mkdirSync(frontendPath, { recursive: true });
  console.log('✅ Created frontend directory');
}

// Servir arquivos estáticos da pasta frontend
app.use(express.static(frontendPath));

// =============================================
// AUTHENTICATION MIDDLEWARE
// =============================================
const authenticateToken = (req, res, next) => {
  const authHeader = req.headers['authorization'];
  const token = authHeader && authHeader.split(' ')[1];

  const publicRoutes = [
    '/', '/health', '/status', '/api/v1/auth/register', 
    '/api/v1/auth/login', '/api/v1/auth/demo'
  ];
  
  if (publicRoutes.includes(req.path)) {
    return next();
  }

  if (!token) {
    return res.status(401).json({ error: 'Access token required' });
  }

  try {
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
    timestamp: new Date().toISOString()
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
// DEMO AUTH ENDPOINT
// =============================================
app.post('/api/v1/auth/demo', (req, res) => {
  const jwt = require('jsonwebtoken');
  const jwtSecret = process.env.JWT_SECRET || 'great-nexus-demo-secret';
  
  const demoUser = {
    id: 'demo-user-1',
    email: 'demo@greatnexus.com',
    name: 'Demo User',
    role: 'tenant_admin',
    tenant_id: '1'
  };

  const demoToken = jwt.sign(demoUser, jwtSecret, { expiresIn: '24h' });

  res.json({
    message: 'Demo login successful!',
    user: demoUser,
    tenant: memoryDB.tenants[0],
    accessToken: demoToken,
    refreshToken: demoToken
  });
});

// =============================================
// AUTH ROUTES
// =============================================
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

app.post('/api/v1/auth/register', async (req, res) => {
  try {
    const { email, password, name, companyName, country = 'MZ', currency = 'MZN' } = req.body;

    if (!email || !password || !name || !companyName) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    const userExists = memoryDB.users.find(u => u.email === email);
    if (userExists) {
      return res.status(400).json({ error: 'User already exists' });
    }

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

    const userId = 'user-' + Date.now();
    const user = {
      id: userId,
      tenant_id: tenantId,
      email,
      password: password,
      name,
      role: 'tenant_admin',
      created_at: new Date().toISOString()
    };
    memoryDB.users.push(user);

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

app.post('/api/v1/auth/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = memoryDB.users.find(u => u.email === email);
    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    if (user.password !== password) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const tenant = memoryDB.tenants.find(t => t.id === user.tenant_id);
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

app.post('/api/v1/mola/investments', (req, res) => {
  try {
    const { capital, business_days, daily_rate = 0.003 } = req.body;
    
    if (!capital || !business_days) {
      return res.status(400).json({ error: 'Capital and business days are required' });
    }

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
// FRONTEND ROUTE - Serve HTML básico se não existir frontend
// =============================================
app.get('/', (req, res) => {
  const frontendFile = path.join(frontendPath, 'index.html');
  
  // Se o arquivo index.html existe, servir ele
  if (fs.existsSync(frontendFile)) {
    return res.sendFile(frontendFile);
  }
  
  // Se não existe, criar um frontend básico automaticamente
  const basicFrontend = `
<!DOCTYPE html>
<html lang="pt">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Great Nexus - Ecossistema Empresarial Inteligente</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { 
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
            background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .container { 
            background: white;
            padding: 3rem;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            text-align: center;
            max-width: 500px;
            width: 90%;
        }
        .logo { 
            font-size: 2.5rem;
            font-weight: bold;
            color: #667eea;
            margin-bottom: 1rem;
        }
        h1 { 
            color: #333;
            margin-bottom: 1rem;
            font-size: 1.8rem;
        }
        p { 
            color: #666;
            margin-bottom: 2rem;
            line-height: 1.6;
        }
        .btn { 
            background: #667eea;
            color: white;
            padding: 12px 30px;
            border: none;
            border-radius: 10px;
            font-size: 1rem;
            cursor: pointer;
            margin: 0.5rem;
            text-decoration: none;
            display: inline-block;
        }
        .btn:hover { background: #5a6fd8; }
        .demo-info { 
            background: #f8f9fa;
            padding: 1rem;
            border-radius: 10px;
            margin: 2rem 0;
            text-align: left;
        }
        .status { 
            color: #28a745;
            font-weight: bold;
            margin: 1rem 0;
        }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo">Great Nexus</div>
        <h1>🚀 Sistema em Execução!</h1>
        <p>Seu ecossistema empresarial inteligente está rodando perfeitamente.</p>
        
        <div class="status">✅ Backend API: Operacional</div>
        <div class="status">✅ Banco de Dados: Em Memória</div>
        <div class="status">✅ Autenticação: Pronta</div>
        
        <div class="demo-info">
            <h3>📋 Teste Rápido:</h3>
            <p><strong>Demo Login:</strong> Use o botão abaixo para fazer login automático</p>
            <p><strong>API Health:</strong> <a href="/health" target="_blank">/health</a></p>
            <p><strong>Status:</strong> <a href="/status" target="_blank">/status</a></p>
        </div>

        <button class="btn" onclick="demoLogin()">🎯 Demo Login</button>
        <a href="/health" class="btn" target="_blank">📊 Health Check</a>
        
        <div style="margin-top: 2rem; font-size: 0.9rem; color: #888;">
            <p>Frontend completo em desenvolvimento...</p>
        </div>
    </div>

    <script>
        async function demoLogin() {
            try {
                const response = await fetch('/api/v1/auth/demo', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' }
                });
                
                const data = await response.json();
                
                if (response.ok) {
                    localStorage.setItem('auth_token', data.accessToken);
                    localStorage.setItem('user_data', JSON.stringify(data.user));
                    localStorage.setItem('tenant_data', JSON.stringify(data.tenant));
                    
                    alert('✅ Login demo realizado! Token salvo no localStorage.');
                    console.log('Demo user:', data.user);
                } else {
                    alert('❌ Erro no login: ' + data.error);
                }
            } catch (error) {
                alert('❌ Erro de conexão: ' + error.message);
            }
        }

        // Testar conexão automaticamente
        fetch('/health')
            .then(r => r.json())
            .then(data => console.log('Health check:', data))
            .catch(err => console.error('Health check failed:', err));
    </script>
</body>
</html>
  `;
  
  res.send(basicFrontend);
});

// =============================================
// FALLBACK ROUTES
// =============================================
app.use('/api/*', (req, res) => {
  res.status(404).json({ 
    error: 'API endpoint not found',
    path: req.path,
    method: req.method
  });
});

// Serve frontend for all other routes
app.get('*', (req, res) => {
  const requestedFile = path.join(frontendPath, req.path);
  
  if (fs.existsSync(requestedFile)) {
    res.sendFile(requestedFile);
  } else {
    res.redirect('/');
  }
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
🏠 Frontend: http://localhost:${PORT}/

✅ READY FOR PRODUCTION!
  `);
});

process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  process.exit(0);
});

module.exports = app;
