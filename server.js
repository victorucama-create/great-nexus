/**
 * GREAT NEXUS – Ecossistema Empresarial Inteligente
 * Versão Híbrida SaaS / Node.js Backend
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

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "greatnexus-secret-key";

// =============================================
// MIDDLEWARE
// =============================================
app.use(cors());
app.use(helmet());
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
// BANCO DE DADOS TEMPORÁRIO
// =============================================
const db = {
  users: [
    {
      id: "super-admin-1",
      email: "admin@greatnexus.com",
      name: "Super Admin",
      password: bcrypt.hashSync("admin123", 8),
      role: "super_admin",
      tenant_id: null,
    },
    {
      id: "tenant-admin-1",
      email: "demo@greatnexus.com",
      name: "Demo Admin",
      password: bcrypt.hashSync("demo123", 8),
      role: "tenant_admin",
      tenant_id: "tenant-1",
    },
  ],
  tenants: [
    { id: "tenant-1", name: "Great Nexus Demo Company", country: "MZ", currency: "MZN" },
  ],
  products: [],
  sales: [],
  investments: [],
  documents: [],
};

// =============================================
// AUTENTICAÇÃO
// =============================================
function generateToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "8h" });
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
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    service: "Great Nexus Backend",
    time: new Date().toISOString(),
    environment: process.env.NODE_ENV || "development"
  });
});

// Página de Login
app.get("/login", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Great Nexus - Login</title>
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
                            alert('Login realizado com sucesso!\\n\\nToken: ' + data.data.accessToken + '\\nUsuário: ' + data.data.user.name + '\\n\\nAgora você pode usar as APIs protegidas.');
                        }, 1000);
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

// Página Inicial
app.get("/", (req, res) => {
  res.json({
    message: "🌐 Great Nexus API Online",
    version: "1.0.0",
    endpoints: {
      auth: "POST /api/v1/auth/login",
      products: "GET/POST /api/v1/erp/products",
      sales: "GET/POST /api/v1/erp/sales",
      investments: "POST /api/v1/mola/invest",
      health: "GET /health",
      login_page: "GET /login"
    }
  });
});

// Login
app.post("/api/v1/auth/login", (req, res) => {
  console.log("📨 Login attempt:", req.body);
  
  const { email, password } = req.body;
  if (!email || !password) {
    return res.status(400).json({ success: false, error: "Email e senha são obrigatórios" });
  }

  const user = db.users.find(u => u.email === email);
  if (!user) return res.status(404).json({ success: false, error: "Utilizador não encontrado" });

  const passwordIsValid = bcrypt.compareSync(password, user.password);
  if (!passwordIsValid) return res.status(401).json({ success: false, error: "Senha incorreta" });

  const token = generateToken(user);
  const tenant = db.tenants.find(t => t.id === user.tenant_id);

  res.json({
    success: true,
    message: "Login bem-sucedido!",
    data: { user, tenant, accessToken: token },
  });
});

// =============================================
// ROTAS PROTEGIDAS
// =============================================

// Produtos
app.get("/api/v1/erp/products", verifyToken, (req, res) => {
  res.json({ success: true, data: db.products });
});

app.post("/api/v1/erp/products", verifyToken, (req, res) => {
  const { sku, name, price, stock, category } = req.body;
  const newProduct = { 
    id: Date.now().toString(), 
    sku, 
    name, 
    price, 
    stock, 
    category,
    created_at: new Date().toISOString()
  };
  db.products.push(newProduct);
  res.json({ success: true, message: "Produto adicionado com sucesso!", data: newProduct });
});

// Vendas
app.get("/api/v1/erp/sales", verifyToken, (req, res) => {
  res.json({ success: true, data: db.sales });
});

app.post("/api/v1/erp/sales", verifyToken, (req, res) => {
  const { invoice_number, total, status } = req.body;
  const newSale = { 
    id: Date.now().toString(), 
    invoice_number, 
    total, 
    status, 
    created_at: new Date().toISOString() 
  };
  db.sales.push(newSale);
  res.json({ success: true, message: "Venda registrada!", data: newSale });
});

// Investimentos Mola
app.post("/api/v1/mola/invest", verifyToken, (req, res) => {
  const { capital, diasUteis } = req.body;
  const taxa = 0.003;
  const rendimento = capital * diasUteis * taxa;
  const irps = rendimento * 0.2;
  const liquido = rendimento - irps;

  const newInv = {
    id: "inv-" + Date.now(),
    user_id: req.user.id,
    capital,
    rendimento_liquido: liquido,
    status: "active",
    created_at: new Date().toISOString()
  };
  db.investments.push(newInv);
  res.json({ success: true, data: newInv });
});

// Upload de Documentos
app.post("/api/v1/documents/upload", verifyToken, upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ success: false, error: "Nenhum arquivo enviado" });
  }

  const newDoc = {
    id: Date.now().toString(),
    user_id: req.user.id,
    path: "/uploads/" + req.file.filename,
    name: req.file.originalname,
    type: req.file.mimetype,
    created_at: new Date().toISOString()
  };
  db.documents.push(newDoc);
  res.json({ success: true, message: "Documento carregado!", data: newDoc });
});

// =============================================
// ROTA DE FALLBACK
// =============================================
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Rota não encontrada",
    path: req.url,
    method: req.method,
    available_routes: [
      "GET /",
      "GET /health", 
      "GET /login",
      "POST /api/v1/auth/login",
      "GET /api/v1/erp/products",
      "POST /api/v1/erp/products",
      "GET /api/v1/erp/sales",
      "POST /api/v1/erp/sales",
      "POST /api/v1/mola/invest",
      "POST /api/v1/documents/upload"
    ]
  });
});

// =============================================
// INICIAR SERVIDOR
// =============================================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`
🚀 Great Nexus iniciado na porta ${PORT}
📍 Health: http://localhost:${PORT}/health
🔐 Login Page: http://localhost:${PORT}/login
🔐 API Login: POST http://localhost:${PORT}/api/v1/auth/login
  `);
});

module.exports = app;
