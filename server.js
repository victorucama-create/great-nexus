/**
 * GREAT NEXUS – Ecossistema Empresarial Inteligente
 * Versão com PostgreSQL Database Integrado
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
// INICIALIZAÇÃO DO BANCO DE DADOS
// =============================================
const initializeDatabase = async () => {
  try {
    await testConnection();
    await initDB();
    console.log('🗄️  Banco de dados inicializado com sucesso');
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

// Health Check com verificação do banco
app.get("/health", async (req, res) => {
  try {
    const dbStatus = await testConnection();
    
    res.json({
      status: "OK",
      service: "Great Nexus Backend",
      database: dbStatus ? "Connected" : "Disconnected",
      time: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development"
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
                <h3>📋 Sistema com PostgreSQL</h3>
                <div class="account">
                    <strong>Banco:</strong> Dados persistentes ativos
                </div>
                <div class="account">
                    <strong>Segurança:</strong> UUIDs e relações
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
                ✅ Sistema conectado ao PostgreSQL com UUIDs
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

// Página Inicial
app.get("/", (req, res) => {
  res.json({
    message: "🌐 Great Nexus API Online",
    version: "2.0.0",
    database: "PostgreSQL com UUID",
    endpoints: {
      auth: "POST /api/v1/auth/login",
      products: "GET/POST /api/v1/erp/products",
      sales: "GET/POST /api/v1/erp/sales",
      companies: "GET/POST /api/v1/erp/companies",
      investments: "POST /api/v1/mola/invest",
      health: "GET /health",
      login_page: "GET /login",
      dashboard: "GET /dashboard"
    }
  });
});

// =============================================
// API ROTAS COM SEU BANCO DE DADOS
// =============================================

// Login API
app.post("/api/v1/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email e senha são obrigatórios" });
    }

    // Buscar usuário no banco
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

    // Verificar senha (usando bcrypt)
    const passwordIsValid = bcrypt.compareSync(password, user.password_hash);
    if (!passwordIsValid) {
      return res.status(401).json({ success: false, error: "Senha incorreta" });
    }

    const token = generateToken(user);

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
// ROTAS PROTEGIDAS COM SEU BANCO
// =============================================

// Produtos - Listar
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

// Produtos - Criar
app.post("/api/v1/erp/products", verifyToken, async (req, res) => {
  try {
    const { sku, name, price, stock, company_id } = req.body;
    
    if (!name || !price || !company_id) {
      return res.status(400).json({ 
        success: false, 
        error: "Nome, preço e empresa são obrigatórios" 
      });
    }

    const result = await pool.query(
      `INSERT INTO products (tenant_id, company_id, sku, name, price, stock) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [req.user.tenant_id, company_id, sku || `SKU-${Date.now()}`, name, price, stock || 0]
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

// Empresas - Listar
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

// Empresas - Criar
app.post("/api/v1/erp/companies", verifyToken, async (req, res) => {
  try {
    const { name, currency } = req.body;
    
    if (!name) {
      return res.status(400).json({ 
        success: false, 
        error: "Nome da empresa é obrigatório" 
      });
    }

    const result = await pool.query(
      `INSERT INTO companies (tenant_id, name, currency) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
      [req.user.tenant_id, name, currency || 'MZN']
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
// INICIALIZAR E INICIAR SERVIDOR
// =============================================
const startServer = async () => {
  try {
    // Inicializar banco de dados
    await initializeDatabase();
    
    // Iniciar servidor
    app.listen(PORT, "0.0.0.0", () => {
      console.log(`
🚀 Great Nexus com PostgreSQL iniciado na porta ${PORT}
🗄️  Database: PostgreSQL com UUID
📍 Health: http://localhost:${PORT}/health
🔐 Login Page: http://localhost:${PORT}/login
📊 Dashboard: http://localhost:${PORT}/dashboard
      `);
    });
  } catch (error) {
    console.error('❌ Falha ao iniciar servidor:', error);
    process.exit(1);
  }
};

startServer();

module.exports = app;
