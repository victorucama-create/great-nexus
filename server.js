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
const JWT_SECRET = process.env.JWT_SECRET || "greatnexus-secret-key";

// =============================================
// MIDDLEWARE DE SEGURANÇA E PERFORMANCE
// =============================================
app.use(cors());
app.use(helmet());
app.use(morgan("tiny"));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use("/uploads", express.static(path.join(__dirname, "uploads")));

// =============================================
// UPLOAD DE DOCUMENTOS / COMPROVATIVOS
// =============================================
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, "uploads");
    if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir);
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + "-" + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + "-" + file.originalname);
  },
});
const upload = multer({ storage });

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
// FUNÇÕES DE AUTENTICAÇÃO
// =============================================

function generateToken(user) {
  return jwt.sign({ id: user.id, role: user.role }, JWT_SECRET, { expiresIn: "8h" });
}

function verifyToken(req, res, next) {
  const token = req.headers["authorization"];
  if (!token) return res.status(403).json({ success: false, error: "Token não fornecido" });
  try {
    const decoded = jwt.verify(token.split(" ")[1], JWT_SECRET);
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
  const { email, password } = req.body;
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
// ROTAS ERP / CRM / MRP / HR / MOLA
// =============================================

// ---- Produtos (ERP)
app.get("/api/v1/erp/products", verifyToken, (req, res) => {
  res.json({ success: true, data: db.products });
});

app.post("/api/v1/erp/products", verifyToken, (req, res) => {
  const { sku, name, price, stock, category } = req.body;
  const newProduct = { id: Date.now().toString(), sku, name, price, stock, category };
  db.products.push(newProduct);
  res.json({ success: true, message: "Produto adicionado com sucesso!", data: newProduct });
});

// ---- Vendas (ERP)
app.get("/api/v1/erp/sales", verifyToken, (req, res) => {
  res.json({ success: true, data: db.sales });
});

app.post("/api/v1/erp/sales", verifyToken, (req, res) => {
  const { invoice_number, total, status } = req.body;
  const newSale = { id: Date.now().toString(), invoice_number, total, status, created_at: new Date() };
  db.sales.push(newSale);
  res.json({ success: true, message: "Venda registrada!", data: newSale });
});

// ---- Mola Investimentos
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
  };
  db.investments.push(newInv);
  res.json({ success: true, data: newInv });
});

// ---- Upload de Documentos
app.post("/api/v1/documents/upload", verifyToken, upload.single("file"), (req, res) => {
  const file = req.file;
  const newDoc = {
    id: Date.now().toString(),
    user_id: req.user.id,
    path: "/uploads/" + file.filename,
    name: file.originalname,
    type: file.mimetype,
  };
  db.documents.push(newDoc);
  res.json({ success: true, message: "Documento carregado!", data: newDoc });
});

// =============================================
// HEALTH CHECK
// =============================================
app.get("/health", (req, res) => {
  res.json({
    status: "OK",
    service: "Great Nexus Backend",
    time: new Date().toISOString(),
  });
});

// =============================================
// FRONTEND (HTML SIMPLIFICADO TEMPORÁRIO)
// =============================================
app.get("/", (req, res) => {
  res.send("<h1>🌐 Great Nexus API Online</h1><p>Backend ativo e seguro.</p>");
});

// =============================================
// START SERVER
// =============================================
app.listen(PORT, "0.0.0.0", () => {
  console.log(`🚀 Great Nexus iniciado na porta ${PORT}`);
});

module.exports = app;
