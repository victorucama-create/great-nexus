/**
 * GREAT NEXUS – Ecossistema Empresarial Inteligente
 * Versão com PostgreSQL Database
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
const db = require("./database"); // Importar database

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "greatnexus-secret-key";

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
app.get("/health", async (req, res) => {
  try {
    // Testar conexão com o banco
    await db.query('SELECT 1');
    res.json({
      status: "OK",
      service: "Great Nexus Backend",
      database: "Connected",
      time: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development"
    });
  } catch (error) {
    res.status(500).json({
      status: "ERROR",
      service: "Great Nexus Backend", 
      database: "Disconnected",
      error: error.message
    });
  }
});

// Página de Login (mantida igual)
app.get("/login", (req, res) => {
  // ... (código da página de login anterior)
  res.send(`...`); // Manter o HTML completo da página login
});

// Dashboard (mantido igual) 
app.get("/dashboard", (req, res) => {
  // ... (código do dashboard anterior)
  res.send(`...`); // Manter o HTML completo do dashboard
});

// Página Inicial
app.get("/", (req, res) => {
  res.json({
    message: "🌐 Great Nexus API Online",
    version: "2.0.0",
    database: "PostgreSQL",
    endpoints: {
      auth: "POST /api/v1/auth/login",
      products: "GET/POST /api/v1/erp/products",
      sales: "GET/POST /api/v1/erp/sales",
      investments: "POST /api/v1/mola/invest",
      health: "GET /health",
      login_page: "GET /login",
      dashboard: "GET /dashboard"
    }
  });
});

// =============================================
// API ROTAS COM BANCO DE DADOS
// =============================================

// Login API
app.post("/api/v1/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email e senha são obrigatórios" });
    }

    // Buscar usuário no banco
    const result = await db.query(
      'SELECT * FROM users WHERE email = $1',
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, error: "Utilizador não encontrado" });
    }

    const user = result.rows[0];

    // Verificar senha
    const passwordIsValid = bcrypt.compareSync(password, user.password);
    if (!passwordIsValid) {
      return res.status(401).json({ success: false, error: "Senha incorreta" });
    }

    // Buscar tenant se existir
    let tenant = null;
    if (user.tenant_id) {
      const tenantResult = await db.query(
        'SELECT * FROM tenants WHERE id = $1',
        [user.tenant_id]
      );
      tenant = tenantResult.rows[0];
    }

    const token = generateToken(user);

    // Remover password da resposta
    const { password: _, ...userWithoutPassword } = user;

    res.json({
      success: true,
      message: "Login bem-sucedido!",
      data: { 
        user: userWithoutPassword, 
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
// ROTAS PROTEGIDAS COM BANCO DE DADOS
// =============================================

// Produtos - Listar
app.get("/api/v1/erp/products", verifyToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM products WHERE tenant_id = $1 ORDER BY created_at DESC',
      [req.user.tenant_id || 'tenant-1']
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
    const { sku, name, price, stock, category, description } = req.body;
    
    if (!name || !price) {
      return res.status(400).json({ 
        success: false, 
        error: "Nome e preço são obrigatórios" 
      });
    }

    const productId = `prod-${Date.now()}`;
    const tenantId = req.user.tenant_id || 'tenant-1';

    const result = await db.query(
      `INSERT INTO products (id, sku, name, price, stock, category, description, tenant_id, created_by) 
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) 
       RETURNING *`,
      [productId, sku || `SKU-${Date.now()}`, name, price, stock || 0, category, description, tenantId, req.user.id]
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

// Vendas - Listar
app.get("/api/v1/erp/sales", verifyToken, async (req, res) => {
  try {
    const result = await db.query(
      'SELECT * FROM sales WHERE tenant_id = $1 ORDER BY created_at DESC',
      [req.user.tenant_id || 'tenant-1']
    );
    
    res.json({ 
      success: true, 
      data: result.rows,
      count: result.rows.length
    });
  } catch (error) {
    console.error("Error fetching sales:", error);
    res.status(500).json({ 
      success: false, 
      error: "Erro ao buscar vendas" 
    });
  }
});

// Vendas - Criar
app.post("/api/v1/erp/sales", verifyToken, async (req, res) => {
  try {
    const { invoice_number, total, status, customer_name } = req.body;
    
    if (!invoice_number || !total) {
      return res.status(400).json({ 
        success: false, 
        error: "Número da fatura e total são obrigatórios" 
      });
    }

    const saleId = `sale-${Date.now()}`;
    const tenantId = req.user.tenant_id || 'tenant-1';

    const result = await db.query(
      `INSERT INTO sales (id, invoice_number, total, status, customer_name, tenant_id, created_by) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [saleId, invoice_number, total, status || 'pending', customer_name, tenantId, req.user.id]
    );

    const newSale = result.rows[0];
    
    res.status(201).json({ 
      success: true, 
      message: "Venda registrada com sucesso!", 
      data: newSale 
    });
  } catch (error) {
    console.error("Error creating sale:", error);
    res.status(500).json({ 
      success: false, 
      error: "Erro ao registrar venda" 
    });
  }
});

// Investimentos Mola
app.post("/api/v1/mola/invest", verifyToken, async (req, res) => {
  try {
    const { capital, diasUteis } = req.body;
    
    if (!capital || !diasUteis) {
      return res.status(400).json({ 
        success: false, 
        error: "Capital e dias úteis são obrigatórios" 
      });
    }

    const capitalNum = parseFloat(capital);
    const diasUteisNum = parseInt(diasUteis);
    
    if (capitalNum <= 0 || diasUteisNum <= 0) {
      return res.status(400).json({ 
        success: false, 
        error: "Capital e dias úteis devem ser maiores que zero" 
      });
    }

    const taxa = 0.003;
    const rendimento = capitalNum * diasUteisNum * taxa;
    const irps = rendimento * 0.2;
    const liquido = rendimento - irps;

    const investmentId = `inv-${Date.now()}`;

    const result = await db.query(
      `INSERT INTO investments (id, user_id, capital, dias_uteis, rendimento_bruto, irps, rendimento_liquido) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [investmentId, req.user.id, capitalNum, diasUteisNum, rendimento, irps, liquido]
    );

    const newInvestment = result.rows[0];
    
    res.status(201).json({ 
      success: true, 
      message: "Investimento simulado com sucesso!",
      data: newInvestment 
    });
  } catch (error) {
    console.error("Error creating investment:", error);
    res.status(500).json({ 
      success: false, 
      error: "Erro ao simular investimento" 
    });
  }
});

// Upload de Documentos
app.post("/api/v1/documents/upload", verifyToken, upload.single("file"), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: "Nenhum arquivo enviado" 
      });
    }

    const docId = `doc-${Date.now()}`;

    const result = await db.query(
      `INSERT INTO documents (id, user_id, name, path, type, size) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [docId, req.user.id, req.file.originalname, `/uploads/${req.file.filename}`, req.file.mimetype, req.file.size]
    );

    const newDoc = result.rows[0];
    
    res.status(201).json({ 
      success: true, 
      message: "Documento carregado com sucesso!", 
      data: newDoc 
    });
  } catch (error) {
    console.error("Error uploading document:", error);
    res.status(500).json({ 
      success: false, 
      error: "Erro ao fazer upload do documento" 
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
// INICIAR SERVIDOR
// =============================================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`
🚀 Great Nexus com PostgreSQL iniciado na porta ${PORT}
🗄️  Database: ${process.env.DATABASE_URL ? 'Conectado' : 'Não configurado'}
📍 Health: http://localhost:${PORT}/health
🔐 Login Page: http://localhost:${PORT}/login
📊 Dashboard: http://localhost:${PORT}/dashboard
  `);
});

module.exports = app;
