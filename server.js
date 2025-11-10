const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// =============================================
// MIDDLEWARE
// =============================================

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =============================================
// SIMPLE MOCK DATABASE
// =============================================

const database = {
  users: [
    {
      id: 'super-admin-1',
      email: 'admin@greatnexus.com',
      name: 'Super Admin',
      password: 'admin123',
      role: 'super_admin',
      tenant_id: null
    },
    {
      id: 'demo-user-1',
      email: 'demo@greatnexus.com',
      name: 'Demo User',
      password: 'demo123',
      role: 'tenant_admin',
      tenant_id: 'demo-tenant-1'
    }
  ],
  tenants: [
    {
      id: 'demo-tenant-1',
      name: 'Great Nexus Demo Company',
      country: 'MZ',
      currency: 'MZN',
      plan: 'enterprise'
    }
  ],
  products: [
    {
      id: 'prod-1',
      tenant_id: 'demo-tenant-1',
      sku: 'MON-24-LED',
      name: 'Monitor LED 24"',
      price: 8500.00,
      stock: 15,
      category: 'Eletrônicos'
    },
    {
      id: 'prod-2',
      tenant_id: 'demo-tenant-1',
      sku: 'TEC-GAMER',
      name: 'Teclado Gamer Mecânico',
      price: 2500.00,
      stock: 8,
      category: 'Eletrônicos'
    }
  ],
  sales: [
    {
      id: 'sale-1',
      tenant_id: 'demo-tenant-1',
      invoice_number: 'INV-2024-001',
      total: 11000.00,
      status: 'completed',
      created_at: new Date().toISOString()
    }
  ],
  investments: [
    {
      id: 'inv-1',
      user_id: 'demo-user-1',
      capital: 50000.00,
      net_return: 3600.00,
      status: 'active'
    }
  ]
};

// =============================================
// SIMPLE FRONTEND HTML
// =============================================

const frontendHtml = `<!DOCTYPE html>
<html lang="pt">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Great Nexus</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; font-family: Arial, sans-serif; }
        body { background: #f8fafc; min-height: 100vh; }
        .hidden { display: none !important; }
        
        /* Loading */
        #loading-screen { 
            background: linear-gradient(135deg, #2563eb, #1d4ed8); 
            min-height: 100vh; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            color: white; 
            text-align: center; 
        }
        .spinner {
            width: 48px; height: 48px; border: 4px solid rgba(255,255,255,0.3); 
            border-top: 4px solid white; border-radius: 50%; 
            animation: spin 1s linear infinite; margin: 0 auto 1rem;
        }
        @keyframes spin { 
            0% { transform: rotate(0deg); } 
            100% { transform: rotate(360deg); } 
        }

        /* Auth */
        .auth-screen { 
            background: linear-gradient(135deg, #2563eb, #1d4ed8); 
            min-height: 100vh; 
            display: flex; 
            align-items: center; 
            justify-content: center; 
            padding: 2rem; 
        }
        .auth-container { 
            background: white; 
            border-radius: 20px; 
            box-shadow: 0 20px 40px rgba(0,0,0,0.1); 
            max-width: 400px; 
            width: 100%; 
        }
        .auth-header { 
            background: #2563eb; 
            color: white; 
            padding: 2rem; 
            text-align: center; 
        }
        .auth-content { padding: 2rem; }
        .form-group { margin-bottom: 1rem; }
        label { display: block; margin-bottom: 0.5rem; font-weight: 500; }
        input { 
            width: 100%; 
            padding: 0.75rem; 
            border: 1px solid #cbd5e1; 
            border-radius: 8px; 
            font-size: 1rem; 
        }
        .btn { 
            display: inline-flex; 
            align-items: center; 
            justify-content: center; 
            gap: 0.5rem; 
            padding: 0.75rem 1.5rem; 
            border: none; 
            border-radius: 8px; 
            font-size: 1rem; 
            font-weight: 600; 
            cursor: pointer; 
            width: 100%; 
        }
        .btn-primary { background: #2563eb; color: white; }
        .btn-primary:hover { background: #1d4ed8; }

        /* Main App */
        .main-app { display: flex; min-height: 100vh; }
        .sidebar { 
            width: 280px; 
            background: white; 
            border-right: 1px solid #e2e8f0; 
            padding: 1rem; 
        }
        .content-area { flex: 1; padding: 2rem; }
        .stats-grid { 
            display: grid; 
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr)); 
            gap: 1.5rem; 
            margin-bottom: 2rem; 
        }
        .stat-card { 
            background: white; 
            border-radius: 12px; 
            padding: 1.5rem; 
            box-shadow: 0 1px 3px rgba(0,0,0,0.1); 
            border: 1px solid #e2e8f0; 
        }

        /* Notifications */
        .notification {
            position: fixed;
            top: 20px;
            right: 20px;
            background: white;
            border-radius: 8px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            padding: 1rem;
            min-width: 300px;
            border-left: 4px solid #2563eb;
            z-index: 1000;
        }
        .notification.success { border-left-color: #10b981; }
        .notification.error { border-left-color: #ef4444; }
    </style>
</head>
<body>
    <!-- Loading Screen -->
    <div id="loading-screen">
        <div style="text-align: center;">
            <div style="font-size: 2rem; margin-bottom: 1rem;">Great Nexus</div>
            <div class="spinner"></div>
            <p>Inicializando...</p>
        </div>
    </div>

    <!-- Auth Screens -->
    <div id="auth-screens" class="hidden">
        <div class="auth-screen">
            <div class="auth-container">
                <div class="auth-header">
                    <div style="font-size: 1.5rem; font-weight: bold;">Great Nexus</div>
                    <div>Ecossistema Empresarial</div>
                </div>
                <div class="auth-content">
                    <h2 style="margin-bottom: 0.5rem;">Bem-vindo</h2>
                    <p style="color: #64748b; margin-bottom: 2rem;">Entre na sua conta</p>

                    <form id="login-form">
                        <div class="form-group">
                            <label for="login-email">Email</label>
                            <input type="email" id="login-email" required placeholder="seu@email.com">
                        </div>
                        <div class="form-group">
                            <label for="login-password">Password</label>
                            <input type="password" id="login-password" required placeholder="Sua password">
                        </div>
                        <button type="submit" class="btn btn-primary" style="margin-bottom: 1rem;">
                            Entrar
                        </button>
                    </form>

                    <div style="margin: 1.5rem 0; text-align: center;">
                        <div style="color: #94a3b8; margin: 1rem 0;">ou</div>
                        <button type="button" id="demo-login-btn" class="btn" style="background: transparent; border: 2px solid #2563eb; color: #2563eb;">
                            Entrar com Demo
                        </button>
                    </div>

                    <div style="margin-top: 2rem; padding: 1rem; background: #f1f5f9; border-radius: 8px;">
                        <h4 style="margin-bottom: 0.5rem;">Credenciais de Teste:</h4>
                        <div style="font-size: 0.875rem;">
                            <div><strong>Super Admin:</strong> admin@greatnexus.com / admin123</div>
                            <div><strong>Demo Cliente:</strong> demo@greatnexus.com / demo123</div>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <!-- Main Application -->
    <div id="main-app" class="hidden">
        <nav class="sidebar">
            <div style="padding: 1rem; border-bottom: 1px solid #e2e8f0;">
                <div style="font-size: 1.25rem; font-weight: bold;">Great Nexus</div>
            </div>
            
            <div style="padding: 1rem;">
                <div style="font-weight: 600;" id="current-user">Utilizador</div>
                <div style="font-size: 0.875rem; color: #64748b;" id="user-role">Role</div>
            </div>

            <div style="margin-top: 2rem;">
                <button onclick="showModule('dashboard')" style="width: 100%; text-align: left; padding: 0.75rem; background: #2563eb; color: white; border: none; border-radius: 8px; margin-bottom: 0.5rem;">
                    Dashboard
                </button>
                <button onclick="showModule('products')" style="width: 100%; text-align: left; padding: 0.75rem; background: transparent; border: none; border-radius: 8px; margin-bottom: 0.5rem;">
                    Produtos
                </button>
                <button onclick="showModule('sales')" style="width: 100%; text-align: left; padding: 0.75rem; background: transparent; border: none; border-radius: 8px; margin-bottom: 0.5rem;">
                    Vendas
                </button>
                <button onclick="showModule('investments')" style="width: 100%; text-align: left; padding: 0.75rem; background: transparent; border: none; border-radius: 8px; margin-bottom: 0.5rem;">
                    Investimentos
                </button>
                <button onclick="logout()" style="width: 100%; text-align: left; padding: 0.75rem; background: transparent; border: none; border-radius: 8px; margin-top: 2rem;">
                    Sair
                </button>
            </div>
        </nav>

        <main class="content-area">
            <!-- Dashboard -->
            <div id="dashboard-module">
                <h1 style="margin-bottom: 2rem;">Dashboard</h1>
                
                <div class="stats-grid">
                    <div class="stat-card">
                        <h3 id="total-sales">11.000 MZN</h3>
                        <p>Vendas do Mês</p>
                    </div>
                    <div class="stat-card">
                        <h3 id="total-products">2</h3>
                        <p>Produtos</p>
                    </div>
                    <div class="stat-card">
                        <h3 id="total-investments">50.000 MZN</h3>
                        <p>Investimentos</p>
                    </div>
                </div>

                <div style="background: white; border-radius: 12px; padding: 1.5rem;">
                    <h3 style="margin-bottom: 1rem;">Atividade Recente</h3>
                    <div id="recent-activities">
                        <div style="padding: 0.5rem 0; border-bottom: 1px solid #e2e8f0;">
                            Nova venda criada - INV-2024-001
                        </div>
                        <div style="padding: 0.5rem 0; border-bottom: 1px solid #e2e8f0;">
                            Produto adicionado - Monitor LED 24"
                        </div>
                    </div>
                </div>
            </div>

            <!-- Products -->
            <div id="products-module" class="hidden">
                <h1 style="margin-bottom: 2rem;">Produtos</h1>
                <div style="background: white; border-radius: 12px; padding: 1.5rem;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="border-bottom: 1px solid #e2e8f0;">
                                <th style="padding: 1rem; text-align: left;">SKU</th>
                                <th style="padding: 1rem; text-align: left;">Nome</th>
                                <th style="padding: 1rem; text-align: left;">Preço</th>
                                <th style="padding: 1rem; text-align: left;">Stock</th>
                            </tr>
                        </thead>
                        <tbody id="products-table-body">
                            <!-- Products will be loaded here -->
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Sales -->
            <div id="sales-module" class="hidden">
                <h1 style="margin-bottom: 2rem;">Vendas</h1>
                <div style="background: white; border-radius: 12px; padding: 1.5rem;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="border-bottom: 1px solid #e2e8f0;">
                                <th style="padding: 1rem; text-align: left;">Fatura</th>
                                <th style="padding: 1rem; text-align: left;">Total</th>
                                <th style="padding: 1rem; text-align: left;">Data</th>
                                <th style="padding: 1rem; text-align: left;">Status</th>
                            </tr>
                        </thead>
                        <tbody id="sales-table-body">
                            <!-- Sales will be loaded here -->
                        </tbody>
                    </table>
                </div>
            </div>

            <!-- Investments -->
            <div id="investments-module" class="hidden">
                <h1 style="margin-bottom: 2rem;">Investimentos</h1>
                <div style="background: white; border-radius: 12px; padding: 1.5rem;">
                    <table style="width: 100%; border-collapse: collapse;">
                        <thead>
                            <tr style="border-bottom: 1px solid #e2e8f0;">
                                <th style="padding: 1rem; text-align: left;">Capital</th>
                                <th style="padding: 1rem; text-align: left;">Retorno</th>
                                <th style="padding: 1rem; text-align: left;">Status</th>
                            </tr>
                        </thead>
                        <tbody id="investments-table-body">
                            <!-- Investments will be loaded here -->
                        </tbody>
                    </table>
                </div>
            </div>
        </main>
    </div>

    <!-- Notifications Container -->
    <div id="notifications-container"></div>

    <script>
        let currentUser = null;
        let currentModule = 'dashboard';

        // Simple API client
        const apiClient = {
            async post(endpoint, data) {
                try {
                    const response = await fetch('/api/v1' + endpoint, {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify(data)
                    });
                    
                    if (!response.ok) {
                        throw new Error('Network error');
                    }
                    
                    return await response.json();
                } catch (error) {
                    console.error('API Error:', error);
                    throw error;
                }
            },

            async get(endpoint) {
                try {
                    const response = await fetch('/api/v1' + endpoint);
                    
                    if (!response.ok) {
                        throw new Error('Network error');
                    }
                    
                    return await response.json();
                } catch (error) {
                    console.error('API Error:', error);
                    throw error;
                }
            }
        };

        // Authentication
        async function handleLogin(email, password) {
            try {
                showNotification('A realizar login...', 'info');
                
                const response = await apiClient.post('/auth/login', {
                    email: email,
                    password: password
                });
                
                if (response.success) {
                    setupUserSession(response.data);
                    showNotification('Login realizado com sucesso!', 'success');
                } else {
                    showNotification(response.error || 'Erro no login', 'error');
                }
            } catch (error) {
                showNotification('Erro de conexão. Verifique se o servidor está a correr.', 'error');
                // Fallback to demo data
                fallbackLogin(email, password);
            }
        }

        async function handleDemoLogin() {
            await handleLogin('demo@greatnexus.com', 'demo123');
        }

        // Fallback login for demo
        function fallbackLogin(email, password) {
            const user = {
                'admin@greatnexus.com': database.users[0],
                'demo@greatnexus.com': database.users[1]
            }[email];

            if (user && user.password === password) {
                const authData = {
                    user: user,
                    tenant: database.tenants[0],
                    accessToken: 'demo-token'
                };
                setupUserSession(authData);
                showNotification('Login demo realizado com sucesso!', 'success');
            } else {
                showNotification('Credenciais inválidas', 'error');
            }
        }

        function setupUserSession(authData) {
            currentUser = authData.user;
            
            // Update UI
            document.getElementById('current-user').textContent = currentUser.name;
            document.getElementById('user-role').textContent = 
                currentUser.role === 'super_admin' ? 'Super Administrador' : 'Administrador';

            // Show main app
            document.getElementById('loading-screen').classList.add('hidden');
            document.getElementById('auth-screens').classList.add('hidden');
            document.getElementById('main-app').classList.remove('hidden');

            // Load data
            loadDashboardData();
        }

        // Module management
        function showModule(moduleName) {
            // Hide all modules
            document.querySelectorAll('[id$="-module"]').forEach(module => {
                module.classList.add('hidden');
            });
            
            // Show target module
            document.getElementById(moduleName + '-module').classList.remove('hidden');
            currentModule = moduleName;
            
            // Load module data
            loadModuleData(moduleName);
        }

        function loadModuleData(moduleName) {
            switch(moduleName) {
                case 'products':
                    loadProducts();
                    break;
                case 'sales':
                    loadSales();
                    break;
                case 'investments':
                    loadInvestments();
                    break;
            }
        }

        function loadDashboardData() {
            // Update stats with demo data
            document.getElementById('total-sales').textContent = '11.000 MZN';
            document.getElementById('total-products').textContent = '2';
            document.getElementById('total-investments').textContent = '50.000 MZN';
        }

        function loadProducts() {
            const products = currentUser.role === 'super_admin' ? 
                database.products : 
                database.products.filter(p => p.tenant_id === currentUser.tenant_id);
            
            const tbody = document.getElementById('products-table-body');
            tbody.innerHTML = products.map(product => \`
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 1rem;">\${product.sku}</td>
                    <td style="padding: 1rem;">\${product.name}</td>
                    <td style="padding: 1rem;">\${formatCurrency(product.price)}</td>
                    <td style="padding: 1rem;">\${product.stock}</td>
                </tr>
            \`).join('');
        }

        function loadSales() {
            const sales = currentUser.role === 'super_admin' ? 
                database.sales : 
                database.sales.filter(s => s.tenant_id === currentUser.tenant_id);
            
            const tbody = document.getElementById('sales-table-body');
            tbody.innerHTML = sales.map(sale => \`
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 1rem;">\${sale.invoice_number}</td>
                    <td style="padding: 1rem;">\${formatCurrency(sale.total)}</td>
                    <td style="padding: 1rem;">\${new Date(sale.created_at).toLocaleDateString('pt-PT')}</td>
                    <td style="padding: 1rem;">\${sale.status}</td>
                </tr>
            \`).join('');
        }

        function loadInvestments() {
            const investments = currentUser.role === 'super_admin' ? 
                database.investments : 
                database.investments.filter(i => i.user_id === currentUser.id);
            
            const tbody = document.getElementById('investments-table-body');
            tbody.innerHTML = investments.map(investment => \`
                <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 1rem;">\${formatCurrency(investment.capital)}</td>
                    <td style="padding: 1rem;">\${formatCurrency(investment.net_return)}</td>
                    <td style="padding: 1rem;">\${investment.status}</td>
                </tr>
            \`).join('');
        }

        // Utility functions
        function formatCurrency(amount) {
            return new Intl.NumberFormat('pt-PT', {
                style: 'currency',
                currency: 'MZN'
            }).format(amount);
        }

        function showNotification(message, type = 'info') {
            const container = document.getElementById('notifications-container');
            const notification = document.createElement('div');
            notification.className = \`notification \${type}\`;
            notification.innerHTML = \`
                <div style="display: flex; align-items: center; justify-content: space-between;">
                    <span>\${message}</span>
                    <button onclick="this.parentElement.parentElement.remove()" style="background: none; border: none; cursor: pointer;">×</button>
                </div>
            \`;
            
            container.appendChild(notification);
            setTimeout(() => notification.remove(), 5000);
        }

        function logout() {
            currentUser = null;
            document.getElementById('main-app').classList.add('hidden');
            document.getElementById('auth-screens').classList.remove('hidden');
            showNotification('Sessão terminada', 'info');
        }

        // Demo data for fallback
        const database = ${JSON.stringify(database, null, 2)};

        // Initialize
        document.addEventListener('DOMContentLoaded', function() {
            setTimeout(() => {
                document.getElementById('loading-screen').classList.add('hidden');
                document.getElementById('auth-screens').classList.remove('hidden');
            }, 2000);

            document.getElementById('demo-login-btn').addEventListener('click', handleDemoLogin);
            
            document.getElementById('login-form').addEventListener('submit', function(e) {
                e.preventDefault();
                const email = document.getElementById('login-email').value;
                const password = document.getElementById('login-password').value;
                handleLogin(email, password);
            });
        });
    </script>
</body>
</html>`;

// =============================================
// API ROUTES - SIMPLIFIED
// =============================================

// Health Check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'OK', 
    service: 'Great Nexus',
    timestamp: new Date().toISOString() 
  });
});

// Serve frontend
app.get('/', (req, res) => {
  res.send(frontendHtml);
});

// AUTHENTICATION
app.post('/api/v1/auth/login', (req, res) => {
  const { email, password } = req.body;
  console.log('Login attempt:', email);

  const user = database.users.find(u => u.email === email && u.password === password);
  
  if (user) {
    let tenant = null;
    if (user.role !== 'super_admin') {
      tenant = database.tenants.find(t => t.id === user.tenant_id);
    }

    res.json({
      success: true,
      data: {
        message: 'Login successful!',
        user: user,
        tenant: tenant,
        accessToken: 'demo-token-' + Date.now()
      }
    });
  } else {
    res.status(401).json({
      success: false,
      error: 'Invalid credentials'
    });
  }
});

// PRODUCTS
app.get('/api/v1/erp/products', (req, res) => {
  res.json({
    success: true,
    data: {
      products: database.products
    }
  });
});

// SALES
app.get('/api/v1/erp/sales', (req, res) => {
  res.json({
    success: true,
    data: {
      sales: database.sales
    }
  });
});

// INVESTMENTS
app.get('/api/v1/mola/investments', (req, res) => {
  res.json({
    success: true,
    data: {
      investments: database.investments
    }
  });
});

// Catch-all route
app.get('*', (req, res) => {
  res.send(frontendHtml);
});

// =============================================
// START SERVER
// =============================================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
🚀 GREAT NEXUS - SISTEMA INICIADO!

📍 Port: ${PORT}
🌍 URL: http://localhost:${PORT}

🔐 CREDENCIAIS:
   👑 Super Admin: admin@greatnexus.com / admin123
   👨‍💼 Demo Cliente: demo@greatnexus.com / demo123

✅ Sistema 100% funcional!
✅ Frontend integrado
✅ API simplificada
✅ Dados de demonstração

Acesse: http://localhost:${PORT}
  `);
});

module.exports = app;
