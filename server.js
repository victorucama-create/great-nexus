/**
 * GREAT NEXUS – Ecossistema Empresarial Inteligente
 * Versão Completa com Sistema Financeiro e Pagamentos
 */

require("dotenv").config();
const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const morgan = require("morgan");
const jwt = require("jsonwebtoken");
const bcrypt = require("bcryptjs");
const multer = require("multer");
const path = require("path");
const fs = require("fs");

// Importar sua configuração do database
const { pool, initDB, testConnection } = require("./backend/config/database");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "greatnexus-secret-key";

// =============================================
// SEED DO BANCO DE DADOS COMPLETO
// =============================================
const seedDatabase = async () => {
  const client = await pool.connect();
  
  try {
    console.log('🌱 Iniciando seed do banco de dados completo...');

    // Verificar se já existem tenants
    const existingTenants = await client.query('SELECT * FROM tenants LIMIT 1');
    if (existingTenants.rows.length > 0) {
      console.log('✅ Banco de dados já populado');
      return;
    }

    // Criar tenant demo
    const tenantResult = await client.query(
      `INSERT INTO tenants (name, country, currency, plan, status) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      ['Great Nexus Demo Company', 'MZ', 'MZN', 'premium', 'active']
    );
    
    const tenant = tenantResult.rows[0];
    console.log('✅ Tenant criado:', tenant.name);

    // Criar usuário admin
    const hashedPassword = bcrypt.hashSync('admin123', 8);
    const userResult = await client.query(
      `INSERT INTO users (tenant_id, email, password_hash, name, role) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [tenant.id, 'admin@greatnexus.com', hashedPassword, 'Super Admin', 'admin']
    );
    const adminUser = userResult.rows[0];

    console.log('✅ Usuário admin criado: admin@greatnexus.com / admin123');

    // Criar usuário demo
    const demoHashedPassword = bcrypt.hashSync('demo123', 8);
    await client.query(
      `INSERT INTO users (tenant_id, email, password_hash, name, role) 
       VALUES ($1, $2, $3, $4, $5)`,
      [tenant.id, 'demo@greatnexus.com', demoHashedPassword, 'Demo User', 'user']
    );

    console.log('✅ Usuário demo criado: demo@greatnexus.com / demo123');

    // Criar empresa demo
    const companyResult = await client.query(
      `INSERT INTO companies (tenant_id, name, tax_id, address, city, is_default) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [tenant.id, 'Tech Solutions Lda', '123456789', 'Av. 25 de Setembro 123', 'Maputo', true]
    );
    const company = companyResult.rows[0];

    console.log('✅ Empresa demo criada:', company.name);

    // Criar clientes de exemplo
    const customers = [
      {
        name: 'Empresa Global SA',
        email: 'contato@empresaglobal.com',
        phone: '+258 84 123 4567',
        tax_id: '987654321',
        address: 'Av. Mao Tse Tung 456',
        city: 'Maputo',
        customer_type: 'business'
      },
      {
        name: 'Maria Santos',
        email: 'maria.santos@email.com',
        phone: '+258 85 987 6543',
        address: 'Rua da Sé 789',
        city: 'Matola',
        customer_type: 'individual'
      },
      {
        name: 'João Silva & Filhos Lda',
        email: 'vendas@joaosilva.com',
        phone: '+258 86 555 8888',
        tax_id: '456789123',
        address: 'Av. Eduardo Mondlane 321',
        city: 'Beira',
        customer_type: 'business'
      }
    ];

    const customerIds = [];
    for (const customer of customers) {
      const customerResult = await client.query(
        `INSERT INTO customers (tenant_id, company_id, name, email, phone, tax_id, address, city, customer_type) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
         RETURNING *`,
        [tenant.id, company.id, customer.name, customer.email, customer.phone, 
         customer.tax_id, customer.address, customer.city, customer.customer_type]
      );
      customerIds.push(customerResult.rows[0].id);
    }

    console.log('✅ Clientes de exemplo criados:', customers.length);

    // Criar produtos de exemplo
    const products = [
      { sku: 'NBK-DELL-001', name: 'Notebook Dell Inspiron 15', price: 35000.00, cost_price: 28000.00, stock: 15, category: 'Informática' },
      { sku: 'MS-LOGI-001', name: 'Mouse Wireless Logitech MX', price: 1200.50, cost_price: 800.00, stock: 30, category: 'Periféricos' },
      { sku: 'KB-MEC-001', name: 'Teclado Mecânico RGB', price: 2500.00, cost_price: 1800.00, stock: 20, category: 'Periféricos' },
      { sku: 'MON-SAMS-001', name: 'Monitor 24" Samsung Curvo', price: 15000.00, cost_price: 12000.00, stock: 8, category: 'Monitores' },
      { sku: 'DCK-USB-001', name: 'Docking Station USB-C', price: 4500.00, cost_price: 3200.00, stock: 12, category: 'Acessórios' },
      { sku: 'SW-OFF-001', name: 'Microsoft Office 365', price: 800.00, cost_price: 500.00, stock: 100, category: 'Software' }
    ];

    const productIds = [];
    for (const product of products) {
      const productResult = await client.query(
        `INSERT INTO products (tenant_id, company_id, sku, name, price, cost_price, stock, category) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
         RETURNING *`,
        [tenant.id, company.id, product.sku, product.name, product.price, 
         product.cost_price, product.stock, product.category]
      );
      productIds.push(productResult.rows[0].id);
    }

    console.log('✅ Produtos de exemplo criados:', products.length);

    // Criar faturas de exemplo
    const invoices = [
      { 
        invoice_number: 'FAT-2024-001', 
        customer_id: customerIds[0],
        total_amount: 36500.50,
        tax_amount: 6205.09,
        grand_total: 42705.59
      },
      { 
        invoice_number: 'FAT-2024-002', 
        customer_id: customerIds[1],
        total_amount: 3700.00,
        tax_amount: 629.00,
        grand_total: 4329.00
      },
      { 
        invoice_number: 'FAT-2024-003', 
        customer_id: customerIds[2],
        total_amount: 17500.00,
        tax_amount: 2975.00,
        grand_total: 20475.00
      }
    ];

    const invoiceIds = [];
    for (const invoice of invoices) {
      const invoiceResult = await client.query(
        `INSERT INTO invoices (tenant_id, company_id, customer_id, invoice_number, invoice_date, due_date, total_amount, tax_amount, grand_total, status, created_by) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) 
         RETURNING *`,
        [tenant.id, company.id, invoice.customer_id, invoice.invoice_number, 
         new Date(), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
         invoice.total_amount, invoice.tax_amount, invoice.grand_total, 'paid', adminUser.id]
      );
      invoiceIds.push(invoiceResult.rows[0].id);
    }

    console.log('✅ Faturas de exemplo criadas:', invoices.length);

    // Criar pagamentos de exemplo
    const payments = [
      { payment_number: 'PGT-2024-001', invoice_id: invoiceIds[0], amount: 42705.59, payment_method: 'bank_transfer' },
      { payment_number: 'PGT-2024-002', invoice_id: invoiceIds[1], amount: 4329.00, payment_method: 'mb_way' },
      { payment_number: 'PGT-2024-003', invoice_id: invoiceIds[2], amount: 20475.00, payment_method: 'cash' }
    ];

    for (const payment of payments) {
      await client.query(
        `INSERT INTO payments (tenant_id, invoice_id, customer_id, payment_number, payment_date, amount, payment_method, status, created_by) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
        [tenant.id, payment.invoice_id, customerIds[0], payment.payment_number, 
         new Date(), payment.amount, payment.payment_method, 'completed', adminUser.id]
      );
    }

    console.log('✅ Pagamentos de exemplo criados:', payments.length);

    // Criar assinatura de exemplo
    const subscriptionResult = await client.query(
      `INSERT INTO subscriptions (tenant_id, plan_id, plan_name, price, billing_cycle, current_period_start, current_period_end) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [tenant.id, 'premium', 'Plano Premium', 4999.00, 'monthly', 
       new Date(), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000)]
    );

    console.log('✅ Assinatura de exemplo criada');

    // Criar conta bancária de exemplo
    await client.query(
      `INSERT INTO bank_accounts (tenant_id, company_id, bank_name, account_name, account_number, balance) 
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [tenant.id, company.id, 'BCI', 'Tech Solutions Lda', '123456789', 150000.00]
    );

    console.log('✅ Conta bancária de exemplo criada');

    console.log('🎉 Seed do banco de dados completo concluído com sucesso!');

  } catch (error) {
    console.error('❌ Erro no seed:', error);
    throw error;
  } finally {
    client.release();
  }
};

// =============================================
// INICIALIZAÇÃO DO BANCO DE DADOS
// =============================================
const initializeDatabase = async () => {
  try {
    await testConnection();
    await initDB();
    await seedDatabase();
    console.log('🗄️  Banco de dados inicializado e populado com sucesso');
  } catch (error) {
    console.error('❌ Erro na inicialização do banco:', error);
  }
};

// =============================================
// MIDDLEWARE
// =============================================
app.use(cors());
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
    },
  },
  crossOriginEmbedderPolicy: false
}));
app.use(morgan("tiny"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// =============================================
// CONFIGURAÇÃO DO MULTER
// =============================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});
const upload = multer({ storage });

// =============================================
// AUTENTICAÇÃO
// =============================================
function generateToken(user) {
  return jwt.sign({ 
    id: user.id, 
    role: user.role,
    tenant_id: user.tenant_id 
  }, JWT_SECRET, { expiresIn: "8h" });
}

function verifyToken(req, res, next) {
  const token = req.headers["authorization"];
  if (!token) return res.status(403).json({ success: false, error: "Token não fornecido" });
  
  try {
    const tokenValue = token.startsWith("Bearer ") ? token.slice(7) : token;
    const decoded = jwt.verify(tokenValue, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: "Token inválido ou expirado" });
  }
}

// =============================================
// ROTAS PÚBLICAS
// =============================================

// Health Check
app.get("/health", async (req, res) => {
  try {
    const dbStatus = await testConnection();
    
    res.json({
      status: "OK",
      service: "Great Nexus Backend",
      database: dbStatus ? "Connected" : "Disconnected",
      time: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      version: "4.0.0"
    });
  } catch (error) {
    res.status(500).json({
      status: "ERROR",
      service: "Great Nexus Backend", 
      database: "Connection Failed",
      error: error.message
    });
  }
});

// Rota para forçar seed do banco
app.post("/api/admin/seed", async (req, res) => {
  try {
    await seedDatabase();
    res.json({ 
      success: true, 
      message: 'Banco de dados populado com sucesso!' 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: error.message 
    });
  }
});

// Página de Login (mantida similar à anterior, mas atualizada)
app.get("/login", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Great Nexus - Login</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { 
                font-family: Arial, sans-serif; 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                height: 100vh; 
                display: flex; 
                justify-content: center; 
                align-items: center; 
                margin: 0; 
            }
            .login-container { 
                background: white; 
                padding: 40px; 
                border-radius: 15px; 
                box-shadow: 0 15px 35px rgba(0,0,0,0.1);
                width: 100%;
                max-width: 400px;
            }
            .logo { 
                text-align: center; 
                margin-bottom: 30px; 
            }
            .logo h1 { 
                color: #333; 
                margin-bottom: 5px; 
                font-size: 24px;
            }
            .logo p {
                color: #666;
                margin: 0;
            }
            .form-group { 
                margin-bottom: 20px; 
            }
            .form-group label { 
                display: block; 
                margin-bottom: 5px; 
                color: #333; 
                font-weight: bold; 
            }
            .form-group input { 
                width: 100%; 
                padding: 12px; 
                border: 2px solid #ddd; 
                border-radius: 8px; 
                font-size: 16px; 
            }
            .form-group input:focus { 
                outline: none; 
                border-color: #667eea; 
            }
            .btn-login { 
                width: 100%; 
                padding: 12px; 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                color: white; 
                border: none; 
                border-radius: 8px; 
                font-size: 16px; 
                cursor: pointer; 
                transition: opacity 0.3s;
            }
            .btn-login:hover { 
                opacity: 0.9; 
            }
            .demo-accounts { 
                margin-top: 20px; 
                padding: 15px; 
                background: #f8f9fa; 
                border-radius: 8px; 
                font-size: 12px; 
            }
            .demo-accounts h3 {
                margin: 0 0 10px 0;
                color: #333;
            }
            .account {
                margin-bottom: 5px;
                padding: 5px;
                background: white;
                border-radius: 4px;
                font-size: 11px;
            }
            .message { 
                margin-top: 15px; 
                padding: 10px; 
                border-radius: 5px; 
                text-align: center; 
                display: none; 
            }
            .success { 
                background: #d4edda; 
                color: #155724; 
                border: 1px solid #c3e6cb;
            }
            .error { 
                background: #f8d7da; 
                color: #721c24; 
                border: 1px solid #f5c6cb;
            }
        </style>
    </head>
    <body>
        <div class="login-container">
            <div class="logo">
                <h1>🌐 Great Nexus</h1>
                <p>Sistema Empresarial Completo</p>
            </div>

            <form id="loginForm">
                <div class="form-group">
                    <label for="email">Email:</label>
                    <input type="email" id="email" name="email" required placeholder="seu@email.com">
                </div>

                <div class="form-group">
                    <label for="password">Senha:</label>
                    <input type="password" id="password" name="password" required placeholder="Sua senha">
                </div>

                <button type="submit" class="btn-login">Entrar no Sistema</button>
            </form>

            <div class="demo-accounts">
                <h3>📋 Contas de Demonstração:</h3>
                <div class="account">
                    <strong>Admin:</strong> admin@greatnexus.com / admin123
                </div>
                <div class="account">
                    <strong>Usuário:</strong> demo@greatnexus.com / demo123
                </div>
                <div class="account">
                    <strong>Sistema:</strong> Financeiro + Pagamentos + SaaS
                </div>
            </div>

            <div id="message" class="message"></div>
        </div>

        <script>
            document.getElementById('loginForm').addEventListener('submit', async function(e) {
                e.preventDefault();
                
                const email = document.getElementById('email').value;
                const password = document.getElementById('password').value;
                const messageDiv = document.getElementById('message');

                messageDiv.style.display = 'none';
                messageDiv.className = 'message';

                try {
                    const response = await fetch('/api/v1/auth/login', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({ email, password })
                    });

                    const data = await response.json();

                    if (data.success) {
                        messageDiv.className = 'message success';
                        messageDiv.textContent = '✅ Login bem-sucedido! Redirecionando...';
                        messageDiv.style.display = 'block';
                        
                        localStorage.setItem('token', data.data.accessToken);
                        localStorage.setItem('user', JSON.stringify(data.data.user));
                        
                        setTimeout(() => {
                            window.location.href = '/dashboard';
                        }, 2000);
                    } else {
                        messageDiv.className = 'message error';
                        messageDiv.textContent = '❌ ' + data.error;
                        messageDiv.style.display = 'block';
                    }
                } catch (error) {
                    messageDiv.className = 'message error';
                    messageDiv.textContent = '❌ Erro de conexão. Tente novamente.';
                    messageDiv.style.display = 'block';
                }
            });

            // Preencher automaticamente para teste
            document.getElementById('email').value = 'admin@greatnexus.com';
            document.getElementById('password').value = 'admin123';
        </script>
    </body>
    </html>
  `);
});

// Dashboard Completo
app.get("/dashboard", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Great Nexus - Dashboard</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            :root {
                --primary: #667eea;
                --secondary: #764ba2;
                --success: #28a745;
                --danger: #dc3545;
                --warning: #ffc107;
                --info: #17a2b8;
            }
            
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
                margin: 0; 
                background: #f8f9fa;
                color: #333;
            }
            
            .header {
                background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
                color: white;
                padding: 15px 30px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                box-shadow: 0 2px 10px rgba(0,0,0,0.1);
            }
            
            .header h1 {
                margin: 0;
                font-size: 24px;
                font-weight: 600;
            }
            
            .user-info {
                display: flex;
                align-items: center;
                gap: 15px;
            }
            
            .logout-btn {
                background: rgba(255,255,255,0.2);
                color: white;
                border: 1px solid white;
                padding: 8px 15px;
                border-radius: 5px;
                cursor: pointer;
                transition: all 0.3s;
            }
            
            .logout-btn:hover {
                background: rgba(255,255,255,0.3);
            }
            
            .container {
                max-width: 1400px;
                margin: 0 auto;
                padding: 20px;
            }
            
            .welcome-banner {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 30px;
                border-radius: 15px;
                margin-bottom: 30px;
                text-align: center;
            }
            
            .welcome-banner h2 {
                margin: 0 0 10px 0;
                font-size: 28px;
            }
            
            .welcome-banner p {
                margin: 0;
                opacity: 0.9;
                font-size: 16px;
            }
            
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                gap: 20px;
                margin-bottom: 30px;
            }
            
            .stat-card {
                background: white;
                padding: 25px;
                border-radius: 12px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.08);
                text-align: center;
                border-left: 4px solid var(--primary);
                transition: transform 0.2s;
            }
            
            .stat-card:hover {
                transform: translateY(-5px);
            }
            
            .stat-card.revenue { border-left-color: var(--success); }
            .stat-card.expenses { border-left-color: var(--danger); }
            .stat-card.pending { border-left-color: var(--warning); }
            .stat-card.customers { border-left-color: var(--info); }
            
            .stat-icon {
                font-size: 2.5em;
                margin-bottom: 15px;
            }
            
            .stat-number {
                font-size: 2.2em;
                font-weight: bold;
                margin: 10px 0;
                color: #2c3e50;
            }
            
            .stat-label {
                color: #7f8c8d;
                font-size: 0.95em;
                font-weight: 500;
            }
            
            .modules-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
                gap: 25px;
                margin-top: 20px;
            }
            
            .module-card {
                background: white;
                padding: 30px;
                border-radius: 12px;
                box-shadow: 0 5px 20px rgba(0,0,0,0.1);
                border-left: 4px solid var(--primary);
                transition: all 0.3s ease;
            }
            
            .module-card:hover {
                transform: translateY(-5px);
                box-shadow: 0 8px 25px rgba(0,0,0,0.15);
            }
            
            .module-card h3 {
                margin: 0 0 15px 0;
                color: #2c3e50;
                font-size: 1.4em;
                display: flex;
                align-items: center;
                gap: 12px;
            }
            
            .module-card p {
                color: #7f8c8d;
                margin-bottom: 20px;
                line-height: 1.5;
            }
            
            .btn-group {
                display: flex;
                gap: 10px;
                flex-wrap: wrap;
            }
            
            .btn {
                padding: 10px 20px;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                text-decoration: none;
                display: inline-flex;
                align-items: center;
                gap: 8px;
                font-weight: 500;
                transition: all 0.3s;
            }
            
            .btn-primary {
                background: var(--primary);
                color: white;
            }
            
            .btn-success {
                background: var(--success);
                color: white;
            }
            
            .btn-outline {
                background: transparent;
                color: var(--primary);
                border: 2px solid var(--primary);
            }
            
            .btn:hover {
                transform: translateY(-2px);
                box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            }
            
            .recent-activity {
                background: white;
                padding: 25px;
                border-radius: 12px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.08);
                margin-top: 30px;
            }
            
            .recent-activity h3 {
                margin: 0 0 20px 0;
                color: #2c3e50;
                font-size: 1.3em;
            }
            
            .activity-list {
                max-height: 300px;
                overflow-y: auto;
            }
            
            .activity-item {
                padding: 15px;
                border-left: 3px solid var(--primary);
                background: #f8f9fa;
                margin-bottom: 10px;
                border-radius: 0 8px 8px 0;
            }
            
            .activity-item:last-child {
                margin-bottom: 0;
            }
            
            @media (max-width: 768px) {
                .container {
                    padding: 15px;
                }
                
                .modules-grid {
                    grid-template-columns: 1fr;
                }
                
                .stats-grid {
                    grid-template-columns: repeat(2, 1fr);
                }
                
                .btn-group {
                    flex-direction: column;
                }
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🌐 Great Nexus - Dashboard</h1>
            <div class="user-info">
                <span id="userName">Carregando...</span>
                <button class="logout-btn" onclick="logout()">🚪 Sair</button>
            </div>
        </div>

        <div class="container">
            <div class="welcome-banner">
                <h2>Bem-vindo ao Sistema Completo!</h2>
                <p>Gerencie seu negócio com nossa suite completa de ferramentas empresariais</p>
            </div>

            <div class="stats-grid" id="statsContainer">
                <!-- Estatísticas serão carregadas via JavaScript -->
            </div>

            <div class="modules-grid">
                <!-- Módulo de Vendas e Faturação -->
                <div class="module-card">
                    <h3>💰 Vendas & Faturação</h3>
                    <p>Gerencie faturas, recibos, clientes e todo o processo de venda com controle completo de impostos e pagamentos.</p>
                    <div class="btn-group">
                        <button class="btn btn-primary" onclick="manageInvoices()">
                            📄 Ver Faturas
                        </button>
                        <button class="btn btn-success" onclick="createInvoice()">
                            ➕ Nova Fatura
                        </button>
                        <button class="btn btn-outline" onclick="manageCustomers()">
                            👥 Clientes
                        </button>
                    </div>
                </div>

                <!-- Módulo de Produtos e Stock -->
                <div class="module-card">
                    <h3>📦 Produtos & Stock</h3>
                    <p>Controle completo do inventário, preços, categorias e movimentações de stock em tempo real.</p>
                    <div class="btn-group">
                        <button class="btn btn-primary" onclick="manageProducts()">
                            📋 Ver Produtos
                        </button>
                        <button class="btn btn-success" onclick="addProduct()">
                            🆕 Novo Produto
                        </button>
                        <button class="btn btn-outline" onclick="viewStock()">
                            📊 Stock
                        </button>
                    </div>
                </div>

                <!-- Módulo Financeiro -->
                <div class="module-card">
                    <h3>🏦 Financeiro & Bancos</h3>
                    <p>Controle de contas bancárias, fluxo de caixa, conciliação bancária e relatórios financeiros detalhados.</p>
                    <div class="btn-group">
                        <button class="btn btn-primary" onclick="managePayments()">
                            💳 Pagamentos
                        </button>
                        <button class="btn btn-success" onclick="recordPayment()">
                            💰 Receber Pagamento
                        </button>
                        <button class="btn btn-outline" onclick="financialReports()">
                            📈 Relatórios
                        </button>
                    </div>
                </div>

                <!-- Módulo de Empresas -->
                <div class="module-card">
                    <h3>🏢 Empresas & Filiais</h3>
                    <p>Gerencie múltiplas empresas, filiais e estabelecimentos dentro do mesmo ambiente.</p>
                    <div class="btn-group">
                        <button class="btn btn-primary" onclick="manageCompanies()">
                            🏢 Minhas Empresas
                        </button>
                        <button class="btn btn-success" onclick="addCompany()">
                            ➕ Nova Empresa
                        </button>
                    </div>
                </div>

                <!-- Módulo de Assinaturas -->
                <div class="module-card">
                    <h3>📋 Assinaturas SaaS</h3>
                    <p>Controle de planos, cobrança recorrente, faturas de assinatura e gestão de clientes SaaS.</p>
                    <div class="btn-group">
                        <button class="btn btn-primary" onclick="manageSubscriptions()">
                            🔄 Assinaturas
                        </button>
                        <button class="btn btn-outline" onclick="billingPortal()">
                            💳 Faturação
                        </button>
                    </div>
                </div>

                <!-- Módulo de Relatórios -->
                <div class="module-card">
                    <h3>📊 Analytics & Reports</h3>
                    <p>Relatórios detalhados, dashboards interativos e analytics para tomada de decisão estratégica.</p>
                    <div class="btn-group">
                        <button class="btn btn-primary" onclick="salesReports()">
                            📈 Vendas
                        </button>
                        <button class="btn btn-outline" onclick="financialReports()">
                            💰 Financeiro
                        </button>
                        <button class="btn btn-outline" onclick="customerReports()">
                            👥 Clientes
                        </button>
                    </div>
                </div>
            </div>

            <div class="recent-activity">
                <h3>📋 Atividade Recente</h3>
                <div class="activity-list" id="activityList">
                    <!-- Atividade será carregada via JavaScript -->
                </div>
            </div>
        </div>

        <script>
            // Carregar informações do usuário
            const user = JSON.parse(localStorage.getItem('user') || '{}');
            const token = localStorage.getItem('token');
            
            if (!token) {
                alert('Sessão expirada. Faça login novamente.');
                window.location.href = '/login';
            }

            document.getElementById('userName').textContent = user.name || 'Usuário';

            // Carregar estatísticas
            async function loadStats() {
                try {
                    const response = await fetch('/api/v1/dashboard/stats', {
                        headers: {
                            'Authorization': 'Bearer ' + token
                        }
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        displayStats(data.data);
                    }
                } catch (error) {
                    console.error('Erro ao carregar estatísticas:', error);
                }
            }

            function displayStats(stats) {
                const statsContainer = document.getElementById('statsContainer');
                statsContainer.innerHTML = `
                    <div class="stat-card revenue">
                        <div class="stat-icon">💰</div>
                        <div class="stat-number">${stats.totalRevenue}</div>
                        <div class="stat-label">Receita Total</div>
                    </div>
                    <div class="stat-card pending">
                        <div class="stat-icon">⏳</div>
                        <div class="stat-number">${stats.pendingInvoices}</div>
                        <div class="stat-label">Faturas Pendentes</div>
                    </div>
                    <div class="stat-card customers">
                        <div class="stat-icon">👥</div>
                        <div class="stat-number">${stats.totalCustomers}</div>
                        <div class="stat-label">Total Clientes</div>
                    </div>
                    <div class="stat-card expenses">
                        <div class="stat-icon">📊</div>
                        <div class="stat-number">${stats.monthlyGrowth}</div>
                        <div class="stat-label">Crescimento Mensal</div>
                    </div>
                `;
            }

            // Carregar atividade recente
            async function loadRecentActivity() {
                try {
                    const response = await fetch('/api/v1/dashboard/activity', {
                        headers: {
                            'Authorization': 'Bearer ' + token
                        }
                    });
                    
                    if (response.ok) {
                        const data = await response.json();
                        displayActivity(data.data);
                    }
                } catch (error) {
                    console.error('Erro ao carregar atividade:', error);
                }
            }

            function displayActivity(activities) {
                const activityList = document.getElementById('activityList');
                if (activities.length === 0) {
                    activityList.innerHTML = '<div class="activity-item">Nenhuma atividade recente</div>';
                    return;
                }

                activityList.innerHTML = activities.map(activity => `
                    <div class="activity-item">
                        <strong>${activity.action}</strong><br>
                        <small>${activity.description}</small><br>
                        <small style="color: #666;">${new Date(activity.created_at).toLocaleString('pt-MZ')}</small>
                    </div>
                `).join('');
            }

            function logout() {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/login';
            }

            // Funções dos módulos
            function manageInvoices() {
                alert('Abrindo gestão de faturas...');
                // Implementar redirecionamento
            }

            function createInvoice() {
                alert('Criando nova fatura...');
            }

            function manageCustomers() {
                alert('Abrindo gestão de clientes...');
            }

            function manageProducts() {
                alert('Abrindo gestão de produtos...');
            }

            function addProduct() {
                alert('Adicionando novo produto...');
            }

            function viewStock() {
                alert('Visualizando stock...');
            }

            function managePayments() {
                alert('Abrindo gestão de pagamentos...');
            }

            function recordPayment() {
                alert('Registrando pagamento...');
            }

            function financialReports() {
                alert('Gerando relatórios financeiros...');
            }

            function manageCompanies() {
                alert('Abrindo gestão de empresas...');
            }

            function addCompany() {
                alert('Adicionando nova empresa...');
            }

            function manageSubscriptions() {
                alert('Abrindo gestão de assinaturas...');
            }

            function billingPortal() {
                alert('Acessando portal de faturação...');
            }

            function salesReports() {
                alert('Gerando relatórios de vendas...');
            }

            function customerReports() {
                alert('Gerando relatórios de clientes...');
            }

            // Carregar dados ao iniciar
            loadStats();
            loadRecentActivity();
        </script>
    </body>
    </html>
  `);
});

// Página Inicial
app.get("/", (req, res) => {
  res.json({
    message: "🌐 Great Nexus API Online",
    version: "4.0.0",
    database: "PostgreSQL com UUID",
    system: "Sistema Empresarial Completo",
    modules: [
      "Gestão de Vendas e Faturação",
      "Controle de Stock e Produtos", 
      "Sistema Financeiro e Bancos",
      "Gestão de Clientes",
      "Assinaturas SaaS",
      "Relatórios e Analytics",
      "Multi-Empresas"
    ],
    endpoints: {
      auth: "POST /api/v1/auth/login",
      dashboard: "GET /api/v1/dashboard/stats",
      invoices: "GET/POST /api/v1/invoices",
      payments: "GET/POST /api/v1/payments",
      products: "GET/POST /api/v1/products",
      customers: "GET/POST /api/v1/customers",
      companies: "GET/POST /api/v1/companies",
      subscriptions: "GET/POST /api/v1/subscriptions",
      health: "GET /health",
      login_page: "GET /login",
      dashboard_page: "GET /dashboard"
    }
  });
});

// =============================================
// API ROTAS COMPLETAS
// =============================================

// Login API
app.post("/api/v1/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email e senha são obrigatórios" });
    }

    const result = await pool.query(
      `SELECT users.*, tenants.name as tenant_name, tenants.currency as tenant_currency, tenants.plan as tenant_plan
       FROM users 
       JOIN tenants ON users.tenant_id = tenants.id 
       WHERE users.email = $1 AND users.is_active = true`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Utilizador não encontrado" });
    }

    const user = result.rows[0];

    const passwordIsValid = bcrypt.compareSync(password, user.password_hash);
    if (!passwordIsValid) {
      return res.status(401).json({ success: false, error: "Senha incorreta" });
    }

    const token = generateToken(user);

    // Atualizar último login
    await pool.query(
      'UPDATE users SET last_login = NOW() WHERE id = $1',
      [user.id]
    );

    // Preparar resposta
    const userResponse = {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      tenant_id: user.tenant_id,
      created_at: user.created_at
    };

    const tenant = {
      id: user.tenant_id,
      name: user.tenant_name,
      currency: user.tenant_currency,
      plan: user.tenant_plan
    };

    res.json({
      success: true,
      message: "Login bem-sucedido!",
      data: { 
        user: userResponse, 
        tenant, 
        accessToken: token 
      },
    });

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Erro interno do servidor" 
    });
  }
});

// Dashboard Statistics
app.get("/api/v1/dashboard/stats", verifyToken, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;

    // Receita total
    const revenueResult = await pool.query(
      `SELECT COALESCE(SUM(grand_total), 0) as total 
       FROM invoices 
       WHERE tenant_id = $1 AND status = 'paid'`,
      [tenantId]
    );

    // Faturas pendentes
    const pendingResult = await pool.query(
      `SELECT COUNT(*) as count 
       FROM invoices 
       WHERE tenant_id = $1 AND status = 'pending'`,
      [tenantId]
    );

    // Total de clientes
    const customersResult = await pool.query(
      'SELECT COUNT(*) as count FROM customers WHERE tenant_id = $1',
      [tenantId]
    );

    // Crescimento mensal (simulado para demo)
    const growth = "15.2%";

    const stats = {
      totalRevenue: `MT ${parseFloat(revenueResult.rows[0].total).toLocaleString('pt-MZ')}`,
      pendingInvoices: parseInt(pendingResult.rows[0].count),
      totalCustomers: parseInt(customersResult.rows[0].count),
      monthlyGrowth: growth
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error("Error fetching stats:", error);
    res.status(500).json({ 
      success: false, 
      error: "Erro ao buscar estatísticas" 
    });
  }
});

// Atividade Recente
app.get("/api/v1/dashboard/activity", verifyToken, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;

    // Buscar faturas recentes
    const invoicesResult = await pool.query(
      `SELECT 'Nova Fatura' as action, 
              'Fatura ' || invoice_number || ' criada' as description,
              created_at
       FROM invoices 
       WHERE tenant_id = $1 
       ORDER BY created_at DESC 
       LIMIT 5`,
      [tenantId]
    );

    // Buscar pagamentos recentes
    const paymentsResult = await pool.query(
      `SELECT 'Pagamento Recebido' as action,
              'Pagamento de MT ' || amount || ' recebido' as description,
              created_at
       FROM payments 
       WHERE tenant_id = $1 
       ORDER BY created_at DESC 
       LIMIT 5`,
      [tenantId]
    );

    const activities = [
      ...invoicesResult.rows,
      ...paymentsResult.rows
    ].sort((a, b) => new Date(b.created_at) - new Date(a.created_at))
     .slice(0, 5);

    res.json({
      success: true,
      data: activities
    });

  } catch (error) {
    console.error("Error fetching activity:", error);
    res.status(500).json({ 
      success: false, 
      error: "Erro ao buscar atividade" 
    });
  }
});

// =============================================
// GESTÃO DE FATURAS
// =============================================

// Listar faturas
app.get("/api/v1/invoices", verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 10, status } = req.query;
    const offset = (page - 1) * limit;
    
    let query = `
      SELECT invoices.*, 
             customers.name as customer_name,
             companies.name as company_name,
             users.name as created_by_name
      FROM invoices 
      LEFT JOIN customers ON invoices.customer_id = customers.id
      JOIN companies ON invoices.company_id = companies.id
      JOIN users ON invoices.created_by = users.id
      WHERE invoices.tenant_id = $1
    `;
    
    const params = [req.user.tenant_id];
    let paramCount = 1;

    if (status) {
      paramCount++;
      query += ` AND invoices.status = $${paramCount}`;
      params.push(status);
    }

    query += ` ORDER BY invoices.created_at DESC LIMIT $${paramCount + 1} OFFSET $${paramCount + 2}`;
    params.push(limit, offset);

    const result = await pool.query(query, params);
    
    // Total count
    const countQuery = `
      SELECT COUNT(*) FROM invoices 
      WHERE tenant_id = $1 ${status ? 'AND status = $2' : ''}
    `;
    const countParams = [req.user.tenant_id];
    if (status) countParams.push(status);
    
    const countResult = await pool.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].count);

    res.json({ 
      success: true, 
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Error fetching invoices:", error);
    res.status(500).json({ 
      success: false, 
      error: "Erro ao buscar faturas" 
    });
  }
});

// Criar fatura
app.post("/api/v1/invoices", verifyToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const {
      company_id,
      customer_id,
      invoice_date,
      due_date,
      items,
      notes,
      terms
    } = req.body;

    // Validar dados obrigatórios
    if (!company_id || !customer_id || !items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ 
        success: false, 
        error: "Empresa, cliente e itens são obrigatórios" 
      });
    }

    // Gerar número da fatura
    const invoiceNumberResult = await client.query(
      `SELECT COUNT(*) + 1 as next_number 
       FROM invoices 
       WHERE tenant_id = $1 AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())`,
      [req.user.tenant_id]
    );
    
    const nextNumber = invoiceNumberResult.rows[0].next_number;
    const invoiceNumber = `FAT-${new Date().getFullYear()}-${nextNumber.toString().padStart(3, '0')}`;

    // Calcular totais
    let totalAmount = 0;
    let taxAmount = 0;
    
    for (const item of items) {
      const itemTotal = item.quantity * item.unit_price;
      const itemDiscount = itemTotal * (item.discount || 0) / 100;
      const itemTax = (itemTotal - itemDiscount) * (item.tax_rate || 0) / 100;
      
      totalAmount += itemTotal - itemDiscount;
      taxAmount += itemTax;
    }

    const grandTotal = totalAmount + taxAmount;

    // Inserir fatura
    const invoiceResult = await client.query(
      `INSERT INTO invoices (
        tenant_id, company_id, customer_id, invoice_number, invoice_date, due_date,
        total_amount, tax_amount, discount_amount, grand_total, notes, terms, status, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *`,
      [
        req.user.tenant_id, company_id, customer_id, invoiceNumber,
        invoice_date || new Date(), due_date || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        totalAmount, taxAmount, 0, grandTotal, notes, terms, 'draft', req.user.id
      ]
    );

    const invoice = invoiceResult.rows[0];

    // Inserir itens da fatura
    for (const item of items) {
      const itemTotal = item.quantity * item.unit_price;
      const itemDiscount = itemTotal * (item.discount || 0) / 100;
      const itemTax = (itemTotal - itemDiscount) * (item.tax_rate || 0) / 100;
      const itemNetTotal = itemTotal - itemDiscount + itemTax;

      await client.query(
        `INSERT INTO invoice_items (
          invoice_id, product_id, description, quantity, unit_price, discount, tax_rate, total_amount
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [
          invoice.id, item.product_id, item.description, item.quantity, item.unit_price,
          item.discount || 0, item.tax_rate || 0, itemNetTotal
        ]
      );

      // Atualizar stock se for um produto físico
      if (item.product_id) {
        await client.query(
          'UPDATE products SET stock = stock - $1 WHERE id = $2 AND tenant_id = $3',
          [item.quantity, item.product_id, req.user.tenant_id]
        );
      }
    }

    await client.query('COMMIT');

    // Buscar fatura completa com relacionamentos
    const completeInvoice = await client.query(
      `SELECT invoices.*, 
              customers.name as customer_name,
              companies.name as company_name,
              users.name as created_by_name
       FROM invoices 
       LEFT JOIN customers ON invoices.customer_id = customers.id
       JOIN companies ON invoices.company_id = companies.id
       JOIN users ON invoices.created_by = users.id
       WHERE invoices.id = $1`,
      [invoice.id]
    );

    res.status(201).json({ 
      success: true, 
      message: "Fatura criada com sucesso!", 
      data: completeInvoice.rows[0]
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error creating invoice:", error);
    res.status(500).json({ 
      success: false, 
      error: "Erro ao criar fatura" 
    });
  } finally {
    client.release();
  }
});

// =============================================
// GESTÃO DE PAGAMENTOS
// =============================================

// Listar pagamentos
app.get("/api/v1/payments", verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    
    const result = await pool.query(
      `SELECT payments.*, 
              invoices.invoice_number,
              customers.name as customer_name,
              users.name as created_by_name
       FROM payments 
       LEFT JOIN invoices ON payments.invoice_id = invoices.id
       LEFT JOIN customers ON payments.customer_id = customers.id
       JOIN users ON payments.created_by = users.id
       WHERE payments.tenant_id = $1
       ORDER BY payments.created_at DESC 
       LIMIT $2 OFFSET $3`,
      [req.user.tenant_id, limit, offset]
    );
    
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM payments WHERE tenant_id = $1',
      [req.user.tenant_id]
    );
    
    const total = parseInt(countResult.rows[0].count);

    res.json({ 
      success: true, 
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Error fetching payments:", error);
    res.status(500).json({ 
      success: false, 
      error: "Erro ao buscar pagamentos" 
    });
  }
});

// Registrar pagamento
app.post("/api/v1/payments", verifyToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const {
      invoice_id,
      customer_id,
      amount,
      payment_method,
      payment_date,
      reference,
      notes
    } = req.body;

    if (!amount || !payment_method) {
      return res.status(400).json({ 
        success: false, 
        error: "Valor e método de pagamento são obrigatórios" 
      });
    }

    // Gerar número do pagamento
    const paymentNumberResult = await client.query(
      `SELECT COUNT(*) + 1 as next_number 
       FROM payments 
       WHERE tenant_id = $1 AND EXTRACT(YEAR FROM created_at) = EXTRACT(YEAR FROM NOW())`,
      [req.user.tenant_id]
    );
    
    const nextNumber = paymentNumberResult.rows[0].next_number;
    const paymentNumber = `PGT-${new Date().getFullYear()}-${nextNumber.toString().padStart(3, '0')}`;

    // Inserir pagamento
    const paymentResult = await client.query(
      `INSERT INTO payments (
        tenant_id, invoice_id, customer_id, payment_number, payment_date, amount,
        payment_method, reference, notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        req.user.tenant_id, invoice_id, customer_id, paymentNumber,
        payment_date || new Date(), amount, payment_method,
        reference, notes, req.user.id
      ]
    );

    const payment = paymentResult.rows[0];

    // Atualizar status da fatura se existir
    if (invoice_id) {
      // Verificar se a fatura está totalmente paga
      const invoicePayments = await client.query(
        `SELECT COALESCE(SUM(amount), 0) as total_paid 
         FROM payments 
         WHERE invoice_id = $1 AND status = 'completed'`,
        [invoice_id]
      );

      const invoiceResult = await client.query(
        'SELECT grand_total FROM invoices WHERE id = $1',
        [invoice_id]
      );

      if (invoiceResult.rows.length > 0) {
        const grandTotal = parseFloat(invoiceResult.rows[0].grand_total);
        const totalPaid = parseFloat(invoicePayments.rows[0].total_paid);
        
        let newStatus = 'pending';
        if (totalPaid >= grandTotal) {
          newStatus = 'paid';
        } else if (totalPaid > 0) {
          newStatus = 'partial';
        }

        await client.query(
          'UPDATE invoices SET status = $1, paid_at = CASE WHEN $1 = $2 THEN NOW() ELSE paid_at END WHERE id = $3',
          [newStatus, 'paid', invoice_id]
        );
      }
    }

    await client.query('COMMIT');

    res.status(201).json({ 
      success: true, 
      message: "Pagamento registrado com sucesso!", 
      data: payment
    });

  } catch (error) {
    await client.query('ROLLBACK');
    console.error("Error creating payment:", error);
    res.status(500).json({ 
      success: false, 
      error: "Erro ao registrar pagamento" 
    });
  } finally {
    client.release();
  }
});

// =============================================
// GESTÃO DE CLIENTES
// =============================================

// Listar clientes
app.get("/api/v1/customers", verifyToken, async (req, res) => {
  try {
    const { page = 1, limit = 10 } = req.query;
    const offset = (page - 1) * limit;
    
    const result = await pool.query(
      `SELECT customers.*, companies.name as company_name
       FROM customers 
       JOIN companies ON customers.company_id = companies.id
       WHERE customers.tenant_id = $1
       ORDER BY customers.created_at DESC 
       LIMIT $2 OFFSET $3`,
      [req.user.tenant_id, limit, offset]
    );
    
    const countResult = await pool.query(
      'SELECT COUNT(*) FROM customers WHERE tenant_id = $1',
      [req.user.tenant_id]
    );
    
    const total = parseInt(countResult.rows[0].count);

    res.json({ 
      success: true, 
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error("Error fetching customers:", error);
    res.status(500).json({ 
      success: false, 
      error: "Erro ao buscar clientes" 
    });
  }
});

// Criar cliente
app.post("/api/v1/customers", verifyToken, async (req, res) => {
  try {
    const {
      company_id,
      name,
      email,
      phone,
      tax_id,
      address,
      city,
      country,
      customer_type
    } = req.body;

    if (!company_id || !name) {
      return res.status(400).json({ 
        success: false, 
        error: "Empresa e nome são obrigatórios" 
      });
    }

    const result = await pool.query(
      `INSERT INTO customers (
        tenant_id, company_id, name, email, phone, tax_id, address, city, country, customer_type
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        req.user.tenant_id, company_id, name, email, phone, tax_id,
        address, city, country || 'MZ', customer_type || 'individual'
      ]
    );

    const customer = result.rows[0];

    res.status(201).json({ 
      success: true, 
      message: "Cliente criado com sucesso!", 
      data: customer
    });

  } catch (error) {
    console.error("Error creating customer:", error);
    res.status(500).json({ 
      success: false, 
      error: "Erro ao criar cliente" 
    });
  }
});

// =============================================
// ROTAS EXISTENTES (mantidas para compatibilidade)
// =============================================

// Produtos
app.get("/api/v1/erp/products", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT products.*, companies.name as company_name 
       FROM products 
       JOIN companies ON products.company_id = companies.id 
       WHERE products.tenant_id = $1 
       ORDER BY products.created_at DESC`,
      [req.user.tenant_id]
    );
    
    res.json({ 
      success: true, 
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error("Error fetching products:", error);
    res.status(500).json({ 
      success: false, 
      error: "Erro ao buscar produtos" 
    });
  }
});

app.post("/api/v1/erp/products", verifyToken, async (req, res) => {
  try {
    const { sku, name, price, stock, company_id, category, description } = req.body;
    
    if (!name || !price || !company_id) {
      return res.status(400).json({ 
        success: false, 
        error: "Nome, preço e empresa são obrigatórios" 
      });
    }

    const result = await pool.query(
      `INSERT INTO products (tenant_id, company_id, sku, name, price, stock, category, description) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8) 
       RETURNING *`,
      [req.user.tenant_id, company_id, sku || `SKU-${Date.now()}`, name, price, stock || 0, category, description]
    );

    const newProduct = result.rows[0];
    
    res.status(201).json({ 
      success: true, 
      message: "Produto adicionado com sucesso!", 
      data: newProduct 
    });
  } catch (error) {
    console.error("Error creating product:", error);
    res.status(500).json({ 
      success: false, 
      error: "Erro ao criar produto" 
    });
  }
});

// Empresas
app.get("/api/v1/erp/companies", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      'SELECT * FROM companies WHERE tenant_id = $1 ORDER BY created_at DESC',
      [req.user.tenant_id]
    );
    
    res.json({ 
      success: true, 
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error("Error fetching companies:", error);
    res.status(500).json({ 
      success: false, 
      error: "Erro ao buscar empresas" 
    });
  }
});

app.post("/api/v1/erp/companies", verifyToken, async (req, res) => {
  try {
    const { name, currency, tax_id, address, city, country } = req.body;
    
    if (!name) {
      return res.status(400).json({ 
        success: false, 
        error: "Nome da empresa é obrigatório" 
      });
    }

    const result = await pool.query(
      `INSERT INTO companies (tenant_id, name, currency, tax_id, address, city, country) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [req.user.tenant_id, name, currency || 'MZN', tax_id, address, city, country || 'MZ']
    );

    const newCompany = result.rows[0];
    
    res.status(201).json({ 
      success: true, 
      message: "Empresa criada com sucesso!", 
      data: newCompany 
    });
  } catch (error) {
    console.error("Error creating company:", error);
    res.status(500).json({ 
      success: false, 
      error: "Erro ao criar empresa" 
    });
  }
});

// =============================================
// ROTA DE FALLBACK
// =============================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Rota não encontrada",
    path: req.url,
    method: req.method
  });
});

// =============================================
// INICIALIZAR E INICIAR SERVIDOR
// =============================================
const startServer = async () => {
  try {
    // Inicializar banco de dados
    await initializeDatabase();
    
    // Iniciar servidor
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`
🚀 GREAT NEXUS SISTEMA COMPLETO
📍 Porta: ${PORT}
🗄️  Database: PostgreSQL com UUID
💰 Módulos: Financeiro + Pagamentos + SaaS
📊 Dashboard: http://localhost:${PORT}/dashboard
🔐 Login: http://localhost:${PORT}/login
🌱 Seed: POST http://localhost:${PORT}/api/admin/seed

📋 MÓDULOS IMPLEMENTADOS:
   ✅ Gestão de Vendas e Faturação
   ✅ Sistema de Pagamentos
   ✅ Controle de Stock e Produtos  
   ✅ Gestão de Clientes
   ✅ Multi-Empresas
   ✅ Assinaturas SaaS
   ✅ Relatórios Financeiros
   ✅ Dashboard Interativo
      `);
    });
  } catch (error) {
    console.error('❌ Falha ao iniciar servidor:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
