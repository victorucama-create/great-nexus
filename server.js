/**
 * GREAT NEXUS – Ecossistema Empresarial Inteligente
 * Versão Híbrida SaaS / Node.js Backend
 * Atualizado: Novembro/2025
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
const JWT_SECRET = process.env.JWT_SECRET || "greatnexus-secret-key-change-in-production";

// =============================================
// MIDDLEWARE DE SEGURANÇA E PERFORMANCE
// =============================================
app.use(cors({
  origin: process.env.FRONTEND_URL || "*",
  credentials: true
}));

app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false
}));

app.use(morgan("combined"));
app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Criar diretório de uploads se não existir
const uploadsDir = path.join(__dirname, "uploads");
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
}
app.use("/uploads", express.static(uploadsDir));

// =============================================
// UPLOAD DE DOCUMENTOS / COMPROVATIVOS
// =============================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, uploadsDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    const safeFilename = file.originalname.replace(/[^a-zA-Z0-9.\-]/g, "_");
    cb(null, uniqueSuffix + "-" + safeFilename);
  },
});

const upload = multer({ 
  storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
  fileFilter: (req, file, cb) => {
    // Permitir apenas certos tipos de arquivo
    const allowedMimes = [
      'image/jpeg',
      'image/png',
      'image/gif',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    ];
    
    if (allowedMimes.includes(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Tipo de arquivo não permitido'), false);
    }
  }
});

// =============================================
// BANCO DE DADOS SIMPLIFICADO (mock temporário)
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
      created_at: new Date().toISOString()
    },
    {
      id: "tenant-admin-1",
      email: "demo@greatnexus.com",
      name: "Demo Admin",
      password: bcrypt.hashSync("demo123", 8),
      role: "tenant_admin",
      tenant_id: "tenant-1",
      created_at: new Date().toISOString()
    },
  ],
  tenants: [
    { 
      id: "tenant-1", 
      name: "Great Nexus Demo Company", 
      country: "MZ", 
      currency: "MZN",
      created_at: new Date().toISOString()
    },
  ],
  products: [],
  sales: [],
  investments: [],
  documents: [],
};

// =============================================
// FUNÇÕES DE AUTENTICAÇÃO
// =============================================

function generateToken(user) {
  return jwt.sign({ 
    id: user.id, 
    role: user.role,
    tenant_id: user.tenant_id 
  }, JWT_SECRET, { expiresIn: "8h" });
}

function verifyToken(req, res, next) {
  const authHeader = req.headers["authorization"];
  if (!authHeader) {
    return res.status(403).json({ success: false, error: "Token de autorização não fornecido" });
  }
  
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : authHeader;
  
  if (!token) {
    return res.status(403).json({ success: false, error: "Token não fornecido" });
  }

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (err) {
    return res.status(401).json({ success: false, error: "Token inválido ou expirado" });
  }
}

// =============================================
// ROTA DE AUTENTICAÇÃO
// =============================================
app.post("/api/v1/auth/login", (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ 
        success: false, 
        error: "Email e senha são obrigatórios" 
      });
    }

    const user = db.users.find(u => u.email === email);
    if (!user) {
      return res.status(404).json({ 
        success: false, 
        error: "Utilizador não encontrado" 
      });
    }

    const passwordIsValid = bcrypt.compareSync(password, user.password);
    if (!passwordIsValid) {
      return res.status(401).json({ 
        success: false, 
        error: "Senha incorreta" 
      });
    }

    const token = generateToken(user);
    const tenant = db.tenants.find(t => t.id === user.tenant_id);

    // Remover password do objeto user antes de enviar
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
// ROTAS PROTEGIDAS
// =============================================

// ---- Middleware para verificar roles de admin
function requireAdmin(req, res, next) {
  if (req.user.role !== "super_admin" && req.user.role !== "tenant_admin") {
    return res.status(403).json({ 
      success: false, 
      error: "Acesso negado. Permissões de administrador necessárias." 
    });
  }
  next();
}

// ---- Produtos (ERP)
app.get("/api/v1/erp/products", verifyToken, (req, res) => {
  try {
    res.json({ 
      success: true, 
      data: db.products,
      count: db.products.length
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: "Erro ao buscar produtos" 
    });
  }
});

app.post("/api/v1/erp/products", verifyToken, requireAdmin, (req, res) => {
  try {
    const { sku, name, price, stock, category, description } = req.body;
    
    if (!name || !price) {
      return res.status(400).json({ 
        success: false, 
        error: "Nome e preço são obrigatórios" 
      });
    }

    const newProduct = { 
      id: Date.now().toString(), 
      sku: sku || `SKU-${Date.now()}`,
      name, 
      price: parseFloat(price),
      stock: parseInt(stock) || 0, 
      category: category || "Geral",
      description: description || "",
      created_by: req.user.id,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    };
    
    db.products.push(newProduct);
    
    res.status(201).json({ 
      success: true, 
      message: "Produto adicionado com sucesso!", 
      data: newProduct 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: "Erro ao criar produto" 
    });
  }
});

// ---- Vendas (ERP)
app.get("/api/v1/erp/sales", verifyToken, (req, res) => {
  try {
    res.json({ 
      success: true, 
      data: db.sales,
      count: db.sales.length
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: "Erro ao buscar vendas" 
    });
  }
});

app.post("/api/v1/erp/sales", verifyToken, (req, res) => {
  try {
    const { invoice_number, total, status, customer_name, items } = req.body;
    
    if (!invoice_number || !total) {
      return res.status(400).json({ 
        success: false, 
        error: "Número da fatura e total são obrigatórios" 
      });
    }

    const newSale = { 
      id: Date.now().toString(), 
      invoice_number, 
      total: parseFloat(total),
      status: status || "pending",
      customer_name: customer_name || "Cliente Anônimo",
      items: items || [],
      created_by: req.user.id,
      created_at: new Date().toISOString()
    };
    
    db.sales.push(newSale);
    
    res.status(201).json({ 
      success: true, 
      message: "Venda registrada com sucesso!", 
      data: newSale 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: "Erro ao registrar venda" 
    });
  }
});

// ---- Mola Investimentos
app.post("/api/v1/mola/invest", verifyToken, (req, res) => {
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

    const newInv = {
      id: "inv-" + Date.now(),
      user_id: req.user.id,
      capital: capitalNum,
      dias_uteis: diasUteisNum,
      rendimento_bruto: rendimento,
      irps: irps,
      rendimento_liquido: liquido,
      status: "active",
      created_at: new Date().toISOString()
    };
    
    db.investments.push(newInv);
    
    res.status(201).json({ 
      success: true, 
      message: "Investimento simulado com sucesso!",
      data: newInv 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: "Erro ao simular investimento" 
    });
  }
});

// ---- Upload de Documentos
app.post("/api/v1/documents/upload", verifyToken, upload.single("file"), (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false, 
        error: "Nenhum arquivo enviado" 
      });
    }

    const newDoc = {
      id: Date.now().toString(),
      user_id: req.user.id,
      path: "/uploads/" + req.file.filename,
      name: req.file.originalname,
      type: req.file.mimetype,
      size: req.file.size,
      created_at: new Date().toISOString()
    };
    
    db.documents.push(newDoc);
    
    res.status(201).json({ 
      success: true, 
      message: "Documento carregado com sucesso!", 
      data: newDoc 
    });
  } catch (error) {
    res.status(500).json({ 
      success: false, 
      error: "Erro ao fazer upload do documento" 
    });
  }
});

// =============================================
// MIDDLEWARE DE TRATAMENTO DE ERROS
// =============================================

// Middleware para errors do Multer
app.use((error, req, res, next) => {
  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      return res.status(400).json({
        success: false,
        error: "Arquivo muito grande. Tamanho máximo permitido: 10MB"
      });
    }
  }
  
  if (error) {
    return res.status(400).json({
      success: false,
      error: error.message
    });
  }
  
  next();
});

// Middleware para rotas não encontradas
app.use((req, res) => {
  res.status(404).json({
    success: false,
    error: "Rota não encontrada"
  });
});

// =============================================
// HEALTH CHECK
// =============================================
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    service: "Great Nexus Backend",
    version: "1.0.0",
    environment: process.env.NODE_ENV || "development",
    time: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// =============================================
// FRONTEND (HTML SIMPLIFICADO TEMPORÁRIO)
// =============================================
app.get("/", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html lang="pt">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Great Nexus - Ecossistema Empresarial Inteligente</title>
      <style>
        body { 
          font-family: Arial, sans-serif; 
          margin: 0; 
          padding: 40px; 
          background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
          color: white;
          text-align: center;
        }
        .container { 
          max-width: 800px; 
          margin: 0 auto; 
          background: rgba(255,255,255,0.1);
          padding: 40px;
          border-radius: 15px;
          backdrop-filter: blur(10px);
        }
        h1 { 
          font-size: 2.5em; 
          margin-bottom: 20px; 
        }
        .status { 
          background: rgba(255,255,255,0.2); 
          padding: 20px; 
          border-radius: 10px; 
          margin: 20px 0; 
        }
        .endpoints { 
          text-align: left; 
          background: rgba(255,255,255,0.1); 
          padding: 20px; 
          border-radius: 10px; 
          margin-top: 30px;
        }
        code { 
          background: rgba(0,0,0,0.3); 
          padding: 2px 6px; 
          border-radius: 4px; 
        }
      </style>
    </head>
    <body>
      <div class="container">
        <h1>🌐 Great Nexus API</h1>
        <p>Backend ativo e seguro</p>
        
        <div class="status">
          <h3>🚀 Status: Online</h3>
          <p>Sistema operacional e pronto para receber requisições</p>
        </div>
        
        <div class="endpoints">
          <h3>📚 Endpoints Disponíveis:</h3>
          <ul>
            <li><code>POST /api/v1/auth/login</code> - Autenticação</li>
            <li><code>GET /api/v1/erp/products</code> - Listar produtos</li>
            <li><code>POST /api/v1/erp/products</code> - Criar produto</li>
            <li><code>GET /api/v1/erp/sales</code> - Listar vendas</li>
            <li><code>POST /api/v1/erp/sales</code> - Registrar venda</li>
            <li><code>POST /api/v1/mola/invest</code> - Simular investimento</li>
            <li><code>POST /api/v1/documents/upload</code> - Upload de documentos</li>
            <li><code>GET /health</code> - Health check</li>
          </ul>
        </div>
        
        <p><strong>👤 Credenciais de teste:</strong><br>
        Admin: admin@greatnexus.com / admin123<br>
        Demo: demo@greatnexus.com / demo123</p>
      </div>
    </body>
    </html>
  `);
});

// =============================================
// START SERVER
// =============================================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`
🚀 Great Nexus iniciado na porta ${PORT}
📍 Ambiente: ${process.env.NODE_ENV || 'development'}
📊 Health check: http://localhost:${PORT}/health
🔐 API Base: http://localhost:${PORT}/api/v1
  `);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  process.exit(0);
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  process.exit(0);
});

module.exports = app;
