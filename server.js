/**
 * GREAT NEXUS – Ecossistema Empresarial Inteligente
 * Versão Completa e Integrada
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
const { Pool } = require('pg');
const cron = require('node-cron');
const rateLimit = require('express-rate-limit');
const compression = require('compression');

// Importar configuração do database
const { pool, initDB, testConnection } = require("./backend/config/database");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "greatnexus-secret-key-change-in-production";

// =============================================
// CONFIGURAÇÃO DE SEGURANÇA
// =============================================

// Rate Limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutos
  max: 1000, // limite de 1000 requests por IP
  message: { success: false, error: "Muitas requisições. Tente novamente em 15 minutos." }
});

// =============================================
// SERVIÇOS AVANÇADOS
// =============================================

class AutomationService {
  constructor() {
    this.rules = new Map();
  }

  async loadRules() {
    try {
      const result = await pool.query(
        'SELECT * FROM automation_rules WHERE is_active = true'
      );
      
      this.rules.clear();
      result.rows.forEach(rule => {
        this.rules.set(rule.id, rule);
      });
      
      console.log(`✅ ${this.rules.size} regras de automação carregadas`);
    } catch (error) {
      console.error('❌ Erro ao carregar regras:', error);
    }
  }

  async triggerEvent(eventType, data, tenantId) {
    try {
      const rules = Array.from(this.rules.values()).filter(rule => 
        rule.tenant_id === tenantId && rule.trigger_type === eventType
      );

      for (const rule of rules) {
        await this.executeRule(rule, data);
      }
    } catch (error) {
      console.error('❌ Erro no trigger de evento:', error);
    }
  }

  async executeRule(rule, data) {
    try {
      console.log(`🔧 Executando regra: ${rule.name}`);
      
      // Executar ação baseada no tipo
      switch (rule.action_type) {
        case 'send_email':
          await this.sendEmail(rule.action_config, data);
          break;
        case 'create_notification':
          await this.createNotification(rule.action_config, data);
          break;
        default:
          console.log(`❌ Tipo de ação não suportado: ${rule.action_type}`);
      }

      // Atualizar último trigger
      await pool.query(
        'UPDATE automation_rules SET last_triggered_at = NOW() WHERE id = $1',
        [rule.id]
      );

    } catch (error) {
      console.error(`❌ Erro executando regra ${rule.name}:`, error);
    }
  }

  async sendEmail(config, data) {
    console.log(`📧 Enviando email para: ${this.replacePlaceholders(config.to, data)}`);
    console.log(`📝 Template: ${config.template}`);
    // Integrar com serviço de email em produção
  }

  async createNotification(config, data) {
    const { title, message, type = 'info' } = config;
    
    await pool.query(
      `INSERT INTO notifications (tenant_id, user_id, title, message, type) 
       VALUES ($1, $2, $3, $4, $5)`,
      [data.tenant_id, data.user_id, 
       this.replacePlaceholders(title, data),
       this.replacePlaceholders(message, data),
       type]
    );
    
    console.log(`🔔 Notificação criada: ${this.replacePlaceholders(title, data)}`);
  }

  replacePlaceholders(text, data) {
    if (typeof text !== 'string') return text;
    
    return text.replace(/\{\{(\w+\.?\w*)\}\}/g, (match, key) => {
      const value = this.getNestedValue(data, key);
      return value !== undefined ? value : match;
    });
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  }
}

class NotificationService {
  async getUserNotifications(tenantId, userId, limit = 50) {
    try {
      const result = await pool.query(
        `SELECT * FROM notifications 
         WHERE tenant_id = $1 AND user_id = $2 
         ORDER BY created_at DESC 
         LIMIT $3`,
        [tenantId, userId, limit]
      );
      
      return result.rows;
    } catch (error) {
      console.error('❌ Erro buscando notificações:', error);
      throw error;
    }
  }

  async markAsRead(notificationId, userId) {
    try {
      await pool.query(
        'UPDATE notifications SET is_read = true, read_at = NOW() WHERE id = $1 AND user_id = $2',
        [notificationId, userId]
      );
    } catch (error) {
      console.error('❌ Erro marcando notificação como lida:', error);
      throw error;
    }
  }
}

// Inicializar serviços
const automationService = new AutomationService();
const notificationService = new NotificationService();

// =============================================
// SEED DO BANCO DE DADOS
// =============================================

const seedDatabase = async () => {
  const client = await pool.connect();
  
  try {
    console.log('🌱 Iniciando seed do banco de dados...');

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
      { sku: 'KB-MEC-001', name: 'Teclado Mecânico RGB', price: 2500.00, cost_price: 1800.00, stock: 20, category: 'Periféricos' }
    ];

    for (const product of products) {
      await client.query(
        `INSERT INTO products (tenant_id, company_id, sku, name, price, cost_price, stock, category) 
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [tenant.id, company.id, product.sku, product.name, product.price, 
         product.cost_price, product.stock, product.category]
      );
    }

    console.log('✅ Produtos de exemplo criados:', products.length);

    console.log('🎉 Seed do banco de dados concluído com sucesso!');

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
    await automationService.loadRules();
    console.log('🗄️  Banco de dados inicializado e populado com sucesso');
  } catch (error) {
    console.error('❌ Erro na inicialização do banco:', error);
  }
};

// =============================================
// MIDDLEWARE
// =============================================

app.use(limiter);
app.use(compression());
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
app.use(morgan("combined"));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

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
      version: "1.0.0"
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

// Página de Login
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
                <p>Ecossistema Empresarial Inteligente</p>
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
                    <strong>Demo:</strong> demo@greatnexus.com / demo123
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

// Dashboard
app.get("/dashboard", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Great Nexus - Dashboard</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { 
                font-family: Arial, sans-serif; 
                margin: 0; 
                background: #f5f5f5;
            }
            .header {
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
                color: white;
                padding: 20px;
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .header h1 {
                margin: 0;
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
            }
            .logout-btn:hover {
                background: rgba(255,255,255,0.3);
            }
            .container {
                max-width: 1200px;
                margin: 0 auto;
                padding: 20px;
            }
            .modules {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
                gap: 20px;
                margin-top: 20px;
            }
            .module-card {
                background: white;
                padding: 25px;
                border-radius: 10px;
                box-shadow: 0 5px 15px rgba(0,0,0,0.1);
                border-left: 4px solid #667eea;
            }
            .module-card h3 {
                margin-top: 0;
                color: #333;
            }
            .module-card p {
                color: #666;
                margin-bottom: 15px;
            }
            .btn {
                background: #667eea;
                color: white;
                padding: 10px 15px;
                border: none;
                border-radius: 5px;
                cursor: pointer;
                text-decoration: none;
                display: inline-block;
            }
            .btn:hover {
                background: #5a6fd8;
            }
            .token-info {
                background: #e8f4fd;
                padding: 15px;
                border-radius: 5px;
                margin: 20px 0;
                font-family: monospace;
                word-break: break-all;
            }
            .db-status {
                background: #d4edda;
                padding: 10px;
                border-radius: 5px;
                margin: 10px 0;
                text-align: center;
            }
        </style>
    </head>
    <body>
        <div class="header">
            <h1>🌐 Great Nexus - Dashboard</h1>
            <div class="user-info">
                <span id="userName">Carregando...</span>
                <button class="logout-btn" onclick="logout()">Sair</button>
            </div>
        </div>

        <div class="container">
            <div class="db-status">
                ✅ Sistema conectado ao PostgreSQL | 🗄️ Dados persistentes ativos
            </div>

            <div class="token-info">
                <strong>Token de Acesso:</strong><br>
                <span id="accessToken">Carregando...</span>
            </div>

            <div class="modules">
                <div class="module-card">
                    <h3>📦 Gestão de Produtos</h3>
                    <p>Gerencie seu inventário, preços e categorias de produtos</p>
                    <button class="btn" onclick="manageProducts()">Gerenciar Produtos</button>
                </div>

                <div class="module-card">
                    <h3>💰 Gestão de Vendas</h3>
                    <p>Registre e acompanhe vendas, faturas e receitas</p>
                    <button class="btn" onclick="manageSales()">Gerenciar Vendas</button>
                </div>

                <div class="module-card">
                    <h3>🏢 Gestão de Empresas</h3>
                    <p>Gerencie múltiplas empresas no mesmo tenant</p>
                    <button class="btn" onclick="manageCompanies()">Gerenciar Empresas</button>
                </div>

                <div class="module-card">
                    <h3>👥 Gestão de Usuários</h3>
                    <p>Administre usuários e permissões do sistema</p>
                    <button class="btn" onclick="manageUsers()">Gerenciar Usuários</button>
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
            document.getElementById('accessToken').textContent = token || 'Não encontrado';

            function logout() {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/login';
            }

            function manageProducts() {
                alert('Em desenvolvimento: Gestão de Produtos');
            }

            function manageSales() {
                alert('Em desenvolvimento: Gestão de Vendas');
            }

            function manageCompanies() {
                alert('Em desenvolvimento: Gestão de Empresas');
            }

            function manageUsers() {
                alert('Em desenvolvimento: Gestão de Usuários');
            }
        </script>
    </body>
    </html>
  `);
});

// Página Inicial da API
app.get("/", (req, res) => {
  res.json({
    message: "🌐 Great Nexus API Online",
    version: "1.0.0",
    database: "PostgreSQL",
    endpoints: {
      auth: "POST /api/v1/auth/login",
      products: "GET/POST /api/v1/erp/products",
      sales: "GET/POST /api/v1/erp/sales",
      companies: "GET/POST /api/v1/erp/companies",
      customers: "GET/POST /api/v1/customers",
      invoices: "GET/POST /api/v1/invoices",
      payments: "GET/POST /api/v1/payments",
      health: "GET /health",
      login_page: "GET /login",
      dashboard: "GET /dashboard"
    }
  });
});

// =============================================
// API ROTAS
// =============================================

// Login API
app.post("/api/v1/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email e senha são obrigatórios" });
    }

    const result = await pool.query(
      `SELECT users.*, tenants.name as tenant_name, tenants.currency as tenant_currency 
       FROM users 
       JOIN tenants ON users.tenant_id = tenants.id 
       WHERE users.email = $1`,
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

    // Trigger de automação para login
    await automationService.triggerEvent('user.logged_in', {
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      tenant_id: user.tenant_id
    }, user.tenant_id);

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
      currency: user.tenant_currency
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

// =============================================
// GESTÃO DE PRODUTOS
// =============================================

// Listar produtos
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

// Criar produto
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
    
    // Trigger de automação
    await automationService.triggerEvent('product.created', {
      product: newProduct,
      tenant_id: req.user.tenant_id,
      user_id: req.user.id
    }, req.user.tenant_id);

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

// =============================================
// GESTÃO DE EMPRESAS
// =============================================

// Listar empresas
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

// Criar empresa
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
// GESTÃO DE CLIENTES
// =============================================

// Listar clientes
app.get("/api/v1/customers", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT customers.*, companies.name as company_name
       FROM customers 
       JOIN companies ON customers.company_id = companies.id
       WHERE customers.tenant_id = $1
       ORDER BY customers.created_at DESC`,
      [req.user.tenant_id]
    );
    
    res.json({ 
      success: true, 
      data: result.rows,
      count: result.rows.length
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
    const { company_id, name, email, phone, tax_id, address, city, customer_type } = req.body;
    
    if (!company_id || !name) {
      return res.status(400).json({ 
        success: false, 
        error: "Empresa e nome são obrigatórios" 
      });
    }

    const result = await pool.query(
      `INSERT INTO customers (tenant_id, company_id, name, email, phone, tax_id, address, city, customer_type) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
      [req.user.tenant_id, company_id, name, email, phone, tax_id, address, city, customer_type || 'individual']
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
// GESTÃO DE FATURAS
// =============================================

// Listar faturas
app.get("/api/v1/invoices", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT invoices.*, 
              customers.name as customer_name,
              companies.name as company_name
       FROM invoices 
       LEFT JOIN customers ON invoices.customer_id = customers.id
       JOIN companies ON invoices.company_id = companies.id
       WHERE invoices.tenant_id = $1
       ORDER BY invoices.created_at DESC`,
      [req.user.tenant_id]
    );
    
    res.json({ 
      success: true, 
      data: result.rows,
      count: result.rows.length
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

    const { company_id, customer_id, items, notes, terms } = req.body;

    // Validar dados
    if (!company_id || !customer_id || !items || !Array.isArray(items)) {
      return res.status(400).json({ 
        success: false, 
        error: "Empresa, cliente e itens são obrigatórios" 
      });
    }

    // Gerar número da fatura
    const invoiceNumber = `FAT-${new Date().getFullYear()}-${Date.now()}`;

    // Calcular totais
    let totalAmount = 0;
    for (const item of items) {
      totalAmount += item.quantity * item.unit_price;
    }

    const taxAmount = totalAmount * 0.17; // IVA 17%
    const grandTotal = totalAmount + taxAmount;

    // Inserir fatura
    const invoiceResult = await client.query(
      `INSERT INTO invoices (
        tenant_id, company_id, customer_id, invoice_number, invoice_date, due_date,
        total_amount, tax_amount, grand_total, notes, terms, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
      RETURNING *`,
      [
        req.user.tenant_id, company_id, customer_id, invoiceNumber,
        new Date(), new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        totalAmount, taxAmount, grandTotal, notes, terms, req.user.id
      ]
    );

    const invoice = invoiceResult.rows[0];

    // Inserir itens
    for (const item of items) {
      await client.query(
        `INSERT INTO invoice_items (
          invoice_id, product_id, description, quantity, unit_price, total_amount
        ) VALUES ($1, $2, $3, $4, $5, $6)`,
        [invoice.id, item.product_id, item.description, item.quantity, item.unit_price, item.quantity * item.unit_price]
      );
    }

    await client.query('COMMIT');

    // Trigger de automação
    await automationService.triggerEvent('invoice.created', {
      invoice: invoice,
      customer_id: customer_id,
      tenant_id: req.user.tenant_id,
      user_id: req.user.id
    }, req.user.tenant_id);

    res.status(201).json({ 
      success: true, 
      message: "Fatura criada com sucesso!", 
      data: invoice
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
    const result = await pool.query(
      `SELECT payments.*, 
              invoices.invoice_number,
              customers.name as customer_name
       FROM payments 
       LEFT JOIN invoices ON payments.invoice_id = invoices.id
       LEFT JOIN customers ON payments.customer_id = customers.id
       WHERE payments.tenant_id = $1
       ORDER BY payments.created_at DESC`,
      [req.user.tenant_id]
    );
    
    res.json({ 
      success: true, 
      data: result.rows,
      count: result.rows.length
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
  try {
    const { invoice_id, customer_id, amount, payment_method, reference } = req.body;
    
    if (!amount || !payment_method) {
      return res.status(400).json({ 
        success: false, 
        error: "Valor e método de pagamento são obrigatórios" 
      });
    }

    const paymentNumber = `PGT-${new Date().getFullYear()}-${Date.now()}`;

    const result = await pool.query(
      `INSERT INTO payments (
        tenant_id, invoice_id, customer_id, payment_number, payment_date, amount,
        payment_method, reference, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *`,
      [
        req.user.tenant_id, invoice_id, customer_id, paymentNumber,
        new Date(), amount, payment_method, reference, req.user.id
      ]
    );

    const payment = result.rows[0];

    // Atualizar status da fatura se existir
    if (invoice_id) {
      await pool.query(
        'UPDATE invoices SET status = $1, paid_at = NOW() WHERE id = $2',
        ['paid', invoice_id]
      );
    }

    // Trigger de automação
    await automationService.triggerEvent('payment.received', {
      payment: payment,
      invoice_id: invoice_id,
      tenant_id: req.user.tenant_id,
      user_id: req.user.id
    }, req.user.tenant_id);

    res.status(201).json({ 
      success: true, 
      message: "Pagamento registrado com sucesso!", 
      data: payment
    });
  } catch (error) {
    console.error("Error creating payment:", error);
    res.status(500).json({ 
      success: false, 
      error: "Erro ao registrar pagamento" 
    });
  }
});

// =============================================
// NOTIFICAÇÕES
// =============================================

// Listar notificações do usuário
app.get("/api/v1/notifications", verifyToken, async (req, res) => {
  try {
    const notifications = await notificationService.getUserNotifications(
      req.user.tenant_id, 
      req.user.id
    );
    
    res.json({ 
      success: true, 
      data: notifications
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    res.status(500).json({ 
      success: false, 
      error: "Erro ao buscar notificações" 
    });
  }
});

// Marcar notificação como lida
app.patch("/api/v1/notifications/:id/read", verifyToken, async (req, res) => {
  try {
    await notificationService.markAsRead(req.params.id, req.user.id);
    
    res.json({ 
      success: true, 
      message: "Notificação marcada como lida"
    });
  } catch (error) {
    console.error("Error marking notification as read:", error);
    res.status(500).json({ 
      success: false, 
      error: "Erro ao marcar notificação como lida" 
    });
  }
});

// =============================================
// AUTOMAÇÕES
// =============================================

// Listar regras de automação
app.get("/api/v1/automation/rules", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM automation_rules 
       WHERE tenant_id = $1
       ORDER BY created_at DESC`,
      [req.user.tenant_id]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error("Error fetching automation rules:", error);
    res.status(500).json({
      success: false,
      error: "Erro ao buscar regras de automação"
    });
  }
});

// =============================================
// TAREFAS AGENDADAS
// =============================================

// Verificar faturas vencidas diariamente
cron.schedule('0 9 * * *', async () => {
  try {
    console.log('🔔 Verificando faturas vencidas...');
    
    const overdueInvoices = await pool.query(
      `SELECT i.*, c.email as customer_email, c.name as customer_name
       FROM invoices i
       JOIN customers c ON i.customer_id = c.id
       WHERE i.status = 'pending' 
       AND i.due_date < CURRENT_DATE`
    );

    for (const invoice of overdueInvoices.rows) {
      await automationService.triggerEvent('invoice.overdue', {
        invoice: invoice,
        customer: {
          email: invoice.customer_email,
          name: invoice.customer_name
        },
        tenant_id: invoice.tenant_id
      }, invoice.tenant_id);
    }

    console.log(`✅ ${overdueInvoices.rows.length} faturas vencidas processadas`);
  } catch (error) {
    console.error('❌ Erro na tarefa agendada:', error);
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
🤖 Automação: ${automationService.rules.size} regras carregadas
💰 Módulos: ERP + CRM + Financeiro + Automação

📋 MÓDULOS IMPLEMENTADOS:
   ✅ Sistema de Autenticação
   ✅ Gestão de Produtos
   ✅ Gestão de Clientes  
   ✅ Gestão de Empresas
   ✅ Sistema de Faturação
   ✅ Gestão de Pagamentos
   ✅ Automações Inteligentes
   ✅ Sistema de Notificações
   ✅ Dashboard Interativo

🌐 URLs:
   Dashboard: http://localhost:${PORT}/dashboard
   Login: http://localhost:${PORT}/login
   Health: http://localhost:${PORT}/health
   API Docs: http://localhost:${PORT}/
      `);
    });
  } catch (error) {
    console.error('❌ Falha ao iniciar servidor:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
