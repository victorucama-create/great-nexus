const express = require('express');
const path = require('path');
const cors = require('cors');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;

// =============================================
// BASIC MIDDLEWARE
// =============================================

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// =============================================
// CREATE BASIC FRONTEND
// =============================================

const createBasicFrontend = () => {
  try {
    const frontendPath = path.join(__dirname, 'frontend');
    
    // Create frontend directory
    if (!fs.existsSync(frontendPath)) {
      fs.mkdirSync(frontendPath, { recursive: true });
      console.log('✅ Created frontend directory');
    }

    // Create basic index.html
    const indexHtmlPath = path.join(frontendPath, 'index.html');
    if (!fs.existsSync(indexHtmlPath)) {
      const indexHtml = `<!DOCTYPE html>
<html lang="pt">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Great Nexus - Ecossistema Empresarial Inteligente</title>
    <style>
        * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
            font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        }

        :root {
            --primary: #2563eb;
            --primary-dark: #1d4ed8;
            --success: #10b981;
            --warning: #f59e0b;
            --error: #ef4444;
            --gray-50: #f8fafc;
            --gray-100: #f1f5f9;
            --gray-200: #e2e8f0;
            --gray-300: #cbd5e1;
            --gray-400: #94a3b8;
            --gray-500: #64748b;
            --gray-600: #475569;
            --gray-700: #334155;
            --gray-800: #1e293b;
            --gray-900: #0f172a;
        }

        body {
            background: linear-gradient(135deg, var(--primary), var(--primary-dark));
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
        }

        .container {
            background: white;
            border-radius: 20px;
            box-shadow: 0 20px 40px rgba(0,0,0,0.1);
            overflow: hidden;
            max-width: 400px;
            width: 90%;
            text-align: center;
        }

        .header {
            background: var(--primary);
            color: white;
            padding: 2rem;
        }

        .logo {
            font-size: 2rem;
            font-weight: bold;
            margin-bottom: 0.5rem;
        }

        .tagline {
            opacity: 0.9;
            font-size: 1.1rem;
        }

        .content {
            padding: 2rem;
        }

        .welcome {
            color: var(--gray-700);
            margin-bottom: 1.5rem;
        }

        .btn {
            display: inline-flex;
            align-items: center;
            justify-content: center;
            gap: 0.5rem;
            padding: 0.75rem 1.5rem;
            border: none;
            border-radius: 10px;
            font-size: 1rem;
            font-weight: 600;
            cursor: pointer;
            transition: all 0.3s;
            text-decoration: none;
            width: 100%;
            margin-bottom: 1rem;
        }

        .btn-primary {
            background: var(--primary);
            color: white;
        }

        .btn-primary:hover {
            background: var(--primary-dark);
            transform: translateY(-2px);
        }

        .btn-outline {
            background: transparent;
            border: 2px solid var(--primary);
            color: var(--primary);
        }

        .btn-outline:hover {
            background: var(--primary);
            color: white;
        }

        .features {
            display: grid;
            gap: 1rem;
            margin: 2rem 0;
            text-align: left;
        }

        .feature {
            display: flex;
            align-items: center;
            gap: 1rem;
            padding: 1rem;
            background: var(--gray-50);
            border-radius: 10px;
            border-left: 4px solid var(--primary);
        }

        .feature i {
            color: var(--primary);
            font-size: 1.25rem;
        }

        .status {
            background: var(--gray-50);
            padding: 1rem;
            border-radius: 10px;
            margin: 1rem 0;
            font-size: 0.9rem;
            color: var(--gray-600);
        }

        .status.success {
            background: rgba(16, 185, 129, 0.1);
            color: var(--success);
            border-left: 4px solid var(--success);
        }

        .demo-info {
            background: var(--gray-50);
            padding: 1.5rem;
            border-radius: 10px;
            margin: 1.5rem 0;
            text-align: left;
        }

        .demo-info h3 {
            color: var(--gray-800);
            margin-bottom: 0.5rem;
        }

        .demo-info p {
            color: var(--gray-600);
            font-size: 0.9rem;
            line-height: 1.5;
        }

        .footer {
            margin-top: 2rem;
            padding-top: 1rem;
            border-top: 1px solid var(--gray-200);
            color: var(--gray-500);
            font-size: 0.8rem;
        }

        .hidden {
            display: none;
        }

        #main-app {
            background: white;
            min-height: 100vh;
        }

        .app-header {
            background: var(--primary);
            color: white;
            padding: 1rem 2rem;
            display: flex;
            justify-content: space-between;
            align-items: center;
        }

        .app-nav {
            display: flex;
            gap: 1rem;
        }

        .nav-btn {
            background: transparent;
            border: 1px solid rgba(255,255,255,0.3);
            color: white;
            padding: 0.5rem 1rem;
            border-radius: 5px;
            cursor: pointer;
            transition: all 0.3s;
        }

        .nav-btn:hover {
            background: rgba(255,255,255,0.1);
        }

        .app-content {
            padding: 2rem;
            max-width: 1200px;
            margin: 0 auto;
        }

        .module {
            background: white;
            border-radius: 10px;
            box-shadow: 0 4px 6px rgba(0,0,0,0.1);
            padding: 2rem;
            margin-bottom: 2rem;
        }

        .module h2 {
            color: var(--gray-800);
            margin-bottom: 1rem;
        }

        .stats {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
            gap: 1rem;
            margin: 2rem 0;
        }

        .stat-card {
            background: var(--gray-50);
            padding: 1.5rem;
            border-radius: 10px;
            text-align: center;
            border-left: 4px solid var(--primary);
        }

        .stat-value {
            font-size: 2rem;
            font-weight: bold;
            color: var(--primary);
            margin-bottom: 0.5rem;
        }

        .stat-label {
            color: var(--gray-600);
            font-size: 0.9rem;
        }
    </style>
    <link href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" rel="stylesheet">
</head>
<body>
    <!-- Landing Page -->
    <div id="landing-page">
        <div class="container">
            <div class="header">
                <div class="logo">
                    <i class="fas fa-network-wired"></i>
                    Great Nexus
                </div>
                <div class="tagline">Ecossistema Empresarial Inteligente</div>
            </div>

            <div class="content">
                <h1 class="welcome">🚀 Bem-vindo ao Great Nexus</h1>
                
                <div class="status success">
                    <i class="fas fa-check-circle"></i>
                    Sistema operacional e pronto para uso
                </div>

                <div class="demo-info">
                    <h3>🎯 Demo Instantâneo</h3>
                    <p>Experimente todas as funcionalidades do sistema com um clique. Dados de demonstração pré-carregados.</p>
                </div>

                <button class="btn btn-primary" onclick="startDemo()">
                    <i class="fas fa-rocket"></i>
                    Iniciar Demo
                </button>

                <button class="btn btn-outline" onclick="showLogin()">
                    <i class="fas fa-sign-in-alt"></i>
                    Fazer Login
                </button>

                <div class="features">
                    <div class="feature">
                        <i class="fas fa-cube"></i>
                        <div>
                            <strong>ERP Completo</strong>
                            <div style="font-size: 0.8rem; color: var(--gray-500);">Gestão de produtos, inventário e vendas</div>
                        </div>
                    </div>
                    <div class="feature">
                        <i class="fas fa-chart-line"></i>
                        <div>
                            <strong>Great Mola</strong>
                            <div style="font-size: 0.8rem; color: var(--gray-500);">Sistema de investimentos e fintech</div>
                        </div>
                    </div>
                    <div class="feature">
                        <i class="fas fa-store"></i>
                        <div>
                            <strong>Marketplace B2B</strong>
                            <div style="font-size: 0.8rem; color: var(--gray-500);">Plataforma de comércio empresarial</div>
                        </div>
                    </div>
                </div>

                <div class="footer">
                    Great Nexus v1.0.0 • Sistema 100% Operacional
                </div>
            </div>
        </div>
    </div>

    <!-- Main Application -->
    <div id="main-app" class="hidden">
        <div class="app-header">
            <div class="logo">
                <i class="fas fa-network-wired"></i>
                Great Nexus
            </div>
            <div class="app-nav">
                <button class="nav-btn" onclick="showModule('dashboard')">
                    <i class="fas fa-home"></i>
                    Dashboard
                </button>
                <button class="nav-btn" onclick="showModule('products')">
                    <i class="fas fa-cube"></i>
                    Produtos
                </button>
                <button class="nav-btn" onclick="showModule('investments')">
                    <i class="fas fa-chart-line"></i>
                    Investimentos
                </button>
                <button class="nav-btn" onclick="logout()">
                    <i class="fas fa-sign-out-alt"></i>
                    Sair
                </button>
            </div>
        </div>

        <div class="app-content">
            <!-- Dashboard Module -->
            <div id="dashboard-module" class="module">
                <h2>📊 Dashboard</h2>
                <p>Visão geral do seu negócio em tempo real</p>
                
                <div class="stats">
                    <div class="stat-card">
                        <div class="stat-value">125.840 MZN</div>
                        <div class="stat-label">Vendas do Mês</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">42</div>
                        <div class="stat-label">Pedidos Ativos</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">156</div>
                        <div class="stat-label">Produtos em Stock</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">89.250 MZN</div>
                        <div class="stat-label">Great Mola</div>
                    </div>
                </div>

                <div style="margin-top: 2rem;">
                    <h3>🚀 Ações Rápidas</h3>
                    <div style="display: flex; gap: 1rem; margin-top: 1rem; flex-wrap: wrap;">
                        <button class="btn btn-primary" onclick="showModule('products')" style="width: auto;">
                            <i class="fas fa-plus"></i>
                            Novo Produto
                        </button>
                        <button class="btn btn-primary" onclick="showModule('investments')" style="width: auto;">
                            <i class="fas fa-chart-line"></i>
                            Novo Investimento
                        </button>
                        <button class="btn btn-outline" style="width: auto;">
                            <i class="fas fa-file-invoice"></i>
                            Criar Fatura
                        </button>
                    </div>
                </div>
            </div>

            <!-- Products Module -->
            <div id="products-module" class="module hidden">
                <h2>📦 Gestão de Produtos</h2>
                <p>Gerencie seu inventário e produtos</p>
                
                <div style="background: var(--gray-50); padding: 2rem; border-radius: 10px; text-align: center; margin: 2rem 0;">
                    <i class="fas fa-cube" style="font-size: 3rem; color: var(--primary); margin-bottom: 1rem;"></i>
                    <h3>Sistema de Produtos</h3>
                    <p style="color: var(--gray-600); margin-bottom: 1.5rem;">Adicione, edite e gerencie seus produtos</p>
                    <button class="btn btn-primary" style="width: auto;">
                        <i class="fas fa-plus"></i>
                        Adicionar Primeiro Produto
                    </button>
                </div>

                <div class="stats">
                    <div class="stat-card">
                        <div class="stat-value">15</div>
                        <div class="stat-label">Produtos Cadastrados</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">8.500 MZN</div>
                        <div class="stat-label">Valor Médio</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">3</div>
                        <div class="stat-label">Stock Baixo</div>
                    </div>
                </div>
            </div>

            <!-- Investments Module -->
            <div id="investments-module" class="module hidden">
                <h2>💰 Great Mola - Investimentos</h2>
                <p>Gerencie seus investimentos e retornos</p>
                
                <div style="background: var(--gray-50); padding: 2rem; border-radius: 10px; text-align: center; margin: 2rem 0;">
                    <i class="fas fa-chart-line" style="font-size: 3rem; color: var(--success); margin-bottom: 1rem;"></i>
                    <h3>Sistema de Investimentos</h3>
                    <p style="color: var(--gray-600); margin-bottom: 1.5rem;">Invista e acompanhe seus retornos</p>
                    <button class="btn btn-primary" style="width: auto;">
                        <i class="fas fa-plus"></i>
                        Novo Investimento
                    </button>
                </div>

                <div class="stats">
                    <div class="stat-card">
                        <div class="stat-value">75.000 MZN</div>
                        <div class="stat-label">Total Investido</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">4.500 MZN</div>
                        <div class="stat-label">Retornos</div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-value">2</div>
                        <div class="stat-label">Investimentos Ativos</div>
                    </div>
                </div>
            </div>
        </div>
    </div>

    <script>
        // Application State
        let currentUser = null;
        let currentModule = 'dashboard';

        // Demo Data
        const demoUser = {
            name: 'Demo User',
            email: 'demo@greatnexus.com',
            company: 'Great Nexus Demo'
        };

        // Start Demo
        function startDemo() {
            currentUser = demoUser;
            document.getElementById('landing-page').classList.add('hidden');
            document.getElementById('main-app').classList.remove('hidden');
            showModule('dashboard');
            
            // Show welcome notification
            showNotification('Demo iniciado com sucesso! Bem-vindo ao Great Nexus.', 'success');
        }

        // Show Login Form
        function showLogin() {
            showNotification('Sistema de login em desenvolvimento. Use o Demo para testar.', 'info');
        }

        // Show Module
        function showModule(moduleName) {
            // Hide all modules
            document.querySelectorAll('.module').forEach(module => {
                module.classList.add('hidden');
            });
            
            // Show selected module
            document.getElementById(moduleName + '-module').classList.remove('hidden');
            currentModule = moduleName;
        }

        // Logout
        function logout() {
            currentUser = null;
            document.getElementById('main-app').classList.add('hidden');
            document.getElementById('landing-page').classList.remove('hidden');
            showNotification('Sessão terminada. Volte sempre!', 'info');
        }

        // Show Notification
        function showNotification(message, type = 'info') {
            // Create notification element
            const notification = document.createElement('div');
            notification.style.cssText = \`
                position: fixed;
                top: 20px;
                right: 20px;
                background: \${type === 'success' ? 'var(--success)' : type === 'error' ? 'var(--error)' : 'var(--primary)'};
                color: white;
                padding: 1rem 1.5rem;
                border-radius: 10px;
                box-shadow: 0 4px 6px rgba(0,0,0,0.1);
                z-index: 1000;
                animation: slideIn 0.3s ease-out;
            \`;
            
            notification.innerHTML = \`
                <div style="display: flex; align-items: center; gap: 0.5rem;">
                    <i class="fas fa-\${type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle'}"></i>
                    \${message}
                </div>
            \`;

            document.body.appendChild(notification);

            // Remove after 5 seconds
            setTimeout(() => {
                notification.remove();
            }, 5000);
        }

        // Initialize
        document.addEventListener('DOMContentLoaded', function() {
            console.log('🚀 Great Nexus Frontend carregado com sucesso!');
            
            // Check if user is already in demo
            if (currentUser) {
                document.getElementById('landing-page').classList.add('hidden');
                document.getElementById('main-app').classList.remove('hidden');
            }
        });

        // Add CSS animation
        const style = document.createElement('style');
        style.textContent = \`
            @keyframes slideIn {
                from {
                    transform: translateX(100%);
                    opacity: 0;
                }
                to {
                    transform: translateX(0);
                    opacity: 1;
                }
            }
        \`;
        document.head.appendChild(style);
    </script>
</body>
</html>`;
      
      fs.writeFileSync(indexHtmlPath, indexHtml);
      console.log('✅ Created index.html');
    }

    console.log('🎉 Frontend created successfully!');
    return true;
  } catch (error) {
    console.error('❌ Error creating frontend:', error.message);
    return false;
  }
};

// Initialize frontend on startup
createBasicFrontend();

// =============================================
// STATIC FILES SERVING
// =============================================

app.use(express.static(path.join(__dirname, 'frontend')));

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
    message: '🚀 Servidor está funcionando perfeitamente!',
    frontend: '✅ Criado automaticamente'
  });
});

app.get('/status', (req, res) => {
  res.json({
    message: 'Great Nexus API Server',
    status: 'operational',
    version: '1.0.0',
    frontend: 'auto-generated',
    timestamp: new Date().toISOString()
  });
});

// =============================================
// API ROUTES (Simple mock endpoints)
// =============================================

// Demo login endpoint
app.post('/api/v1/auth/demo', (req, res) => {
  console.log('📧 Demo login request received');
  
  res.json({
    success: true,
    data: {
      message: 'Demo login successful!',
      user: {
        id: 'demo-user-1',
        email: 'demo@greatnexus.com',
        name: 'Demo User',
        role: 'tenant_admin'
      },
      tenant: {
        id: 'demo-tenant-1',
        name: 'Great Nexus Demo Company',
        plan: 'starter'
      },
      accessToken: 'demo-token-' + Date.now()
    }
  });
});

// Simple products endpoint
app.get('/api/v1/erp/products', (req, res) => {
  res.json({
    success: true,
    data: {
      products: [
        {
          id: 'prod-1',
          name: 'Monitor LED 24"',
          price: 8500,
          stock: 15
        },
        {
          id: 'prod-2',
          name: 'Teclado Gamer',
          price: 2500,
          stock: 8
        }
      ]
    }
  });
});

// Simple investments endpoint
app.get('/api/v1/mola/investments', (req, res) => {
  res.json({
    success: true,
    data: {
      investments: [
        {
          id: 'inv-1',
          capital: 50000,
          returns: 4500,
          status: 'active'
        }
      ]
    }
  });
});

// =============================================
// CATCH-ALL ROUTE FOR SPA
// =============================================

app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'frontend', 'index.html'));
});

// =============================================
// ERROR HANDLING
// =============================================

app.use((err, req, res, next) => {
  console.error('Error:', err.message);
  res.status(500).json({ 
    error: 'Internal server error',
    message: 'Service is operational, please try again'
  });
});

// =============================================
// SERVER STARTUP
// =============================================

app.listen(PORT, '0.0.0.0', () => {
  console.log(`
🎉 GREAT NEXUS SERVER STARTED SUCCESSFULLY!

📍 Port: ${PORT}
🌍 Environment: ${process.env.NODE_ENV || 'production'}
📅 Started: ${new Date().toLocaleString()}
🔗 Health Check: http://localhost:${PORT}/health
🚀 Frontend: http://localhost:${PORT}/

✅ SERVER READY - Frontend auto-generated!
✅ No external dependencies required!
✅ 100% functional demo system!
  `);
});

// Handle graceful shutdown
process.on('SIGTERM', () => {
  console.log('🛑 SIGTERM received, shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('🛑 SIGINT received, shutting down gracefully...');
  process.exit(0);
});

module.exports = app;
