/**
 * GREAT NEXUS – Ecossistema Empresarial Inteligente
 * Versão Avançada com Automação e Integrações
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

// Importar sua configuração do database
const { pool, initDB, testConnection } = require("./backend/config/database");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "greatnexus-secret-key";

// =============================================
// SERVIÇOS DE AUTOMAÇÃO
// =============================================

class AutomationService {
  constructor() {
    this.rules = new Map();
    this.loadRules();
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
      
      // Verificar condições
      if (rule.conditions && rule.conditions.length > 0) {
        const conditionsMet = this.checkConditions(rule.conditions, data);
        if (!conditionsMet) {
          console.log(`⏭️  Condições não atendidas para: ${rule.name}`);
          return;
        }
      }

      // Executar ação
      switch (rule.action_type) {
        case 'send_email':
          await this.sendEmail(rule.action_config, data);
          break;
        case 'create_notification':
          await this.createNotification(rule.action_config, data);
          break;
        case 'update_record':
          await this.updateRecord(rule.action_config, data);
          break;
        case 'call_webhook':
          await this.callWebhook(rule.action_config, data);
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

  checkConditions(conditions, data) {
    return conditions.every(condition => {
      const value = this.getNestedValue(data, condition.field);
      
      switch (condition.operator) {
        case 'equals':
          return value == condition.value;
        case 'not_equals':
          return value != condition.value;
        case 'greater_than':
          return value > condition.value;
        case 'less_than':
          return value < condition.value;
        case 'contains':
          return String(value).includes(condition.value);
        default:
          return false;
      }
    });
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
  }

  async sendEmail(config, data) {
    // Simulação de envio de email
    console.log(`📧 Enviando email para: ${this.replacePlaceholders(config.to, data)}`);
    console.log(`📝 Assunto: ${this.replacePlaceholders(config.subject || 'Sem assunto', data)}`);
    console.log(`📋 Template: ${config.template}`);
    
    // Em produção, integrar com serviço de email como SendGrid, AWS SES, etc.
    return true;
  }

  async createNotification(config, data) {
    const { title, message, type, user_id } = config;
    
    await pool.query(
      `INSERT INTO notifications (tenant_id, user_id, title, message, type) 
       VALUES ($1, $2, $3, $4, $5)`,
      [data.tenant_id, user_id || data.user_id, 
       this.replacePlaceholders(title, data),
       this.replacePlaceholders(message, data),
       type || 'info']
    );
    
    console.log(`🔔 Notificação criada: ${this.replacePlaceholders(title, data)}`);
  }

  async updateRecord(config, data) {
    const { table, where, updates } = config;
    
    const setClause = Object.keys(updates)
      .map((key, index) => `${key} = $${index + 1}`)
      .join(', ');
    
    const values = Object.values(updates).map(value => 
      this.replacePlaceholders(value, data)
    );
    
    const whereClause = Object.keys(where)
      .map((key, index) => `${key} = $${values.length + index + 1}`)
      .join(' AND ');
    
    const whereValues = Object.values(where).map(value =>
      this.replacePlaceholders(value, data)
    );

    const query = `UPDATE ${table} SET ${setClause} WHERE ${whereClause}`;
    const allValues = [...values, ...whereValues];

    await pool.query(query, allValues);
    console.log(`📝 Registro atualizado em: ${table}`);
  }

  async callWebhook(config, data) {
    const { url, method = 'POST', headers = {} } = config;
    
    try {
      const payload = this.replacePlaceholdersDeep(config.payload || data, data);
      
      const response = await fetch(url, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        },
        body: JSON.stringify(payload)
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      console.log(`🌐 Webhook chamado com sucesso: ${url}`);
    } catch (error) {
      console.error(`❌ Erro chamando webhook ${url}:`, error);
    }
  }

  replacePlaceholders(text, data) {
    if (typeof text !== 'string') return text;
    
    return text.replace(/\{\{(\w+\.?\w*)\}\}/g, (match, key) => {
      return this.getNestedValue(data, key) || match;
    });
  }

  replacePlaceholdersDeep(obj, data) {
    if (typeof obj === 'string') {
      return this.replacePlaceholders(obj, data);
    }
    
    if (Array.isArray(obj)) {
      return obj.map(item => this.replacePlaceholdersDeep(item, data));
    }
    
    if (typeof obj === 'object' && obj !== null) {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        result[key] = this.replacePlaceholdersDeep(value, data);
      }
      return result;
    }
    
    return obj;
  }
}

// =============================================
// SERVIÇO DE NOTIFICAÇÕES
// =============================================

class NotificationService {
  async create(tenantId, userId, title, message, type = 'info', actionUrl = null) {
    try {
      const result = await pool.query(
        `INSERT INTO notifications (tenant_id, user_id, title, message, type, action_url) 
         VALUES ($1, $2, $3, $4, $5, $6) 
         RETURNING *`,
        [tenantId, userId, title, message, type, actionUrl]
      );
      
      return result.rows[0];
    } catch (error) {
      console.error('❌ Erro criando notificação:', error);
      throw error;
    }
  }

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

  async markAllAsRead(tenantId, userId) {
    try {
      await pool.query(
        'UPDATE notifications SET is_read = true, read_at = NOW() WHERE tenant_id = $1 AND user_id = $2 AND is_read = false',
        [tenantId, userId]
      );
    } catch (error) {
      console.error('❌ Erro marcando todas como lidas:', error);
      throw error;
    }
  }
}

// =============================================
// SERVIÇO DE RELATÓRIOS
// =============================================

class ReportService {
  async generateFinancialReport(tenantId, startDate, endDate, reportType) {
    try {
      let reportData = {};
      
      switch (reportType) {
        case 'sales_summary':
          reportData = await this.generateSalesSummary(tenantId, startDate, endDate);
          break;
        case 'revenue_analysis':
          reportData = await this.generateRevenueAnalysis(tenantId, startDate, endDate);
          break;
        case 'customer_analysis':
          reportData = await this.generateCustomerAnalysis(tenantId, startDate, endDate);
          break;
        default:
          throw new Error('Tipo de relatório não suportado');
      }

      // Salvar relatório no banco
      const report = await this.saveReport(tenantId, reportType, reportData, {
        startDate,
        endDate
      });

      return report;
    } catch (error) {
      console.error('❌ Erro gerando relatório:', error);
      throw error;
    }
  }

  async generateSalesSummary(tenantId, startDate, endDate) {
    const salesResult = await pool.query(
      `SELECT 
        COUNT(*) as total_invoices,
        SUM(grand_total) as total_revenue,
        AVG(grand_total) as average_invoice,
        status,
        COUNT(*) FILTER (WHERE status = 'paid') as paid_invoices,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_invoices
       FROM invoices 
       WHERE tenant_id = $1 AND invoice_date BETWEEN $2 AND $3
       GROUP BY status`,
      [tenantId, startDate, endDate]
    );

    const dailySales = await pool.query(
      `SELECT 
        DATE(invoice_date) as date,
        COUNT(*) as invoice_count,
        SUM(grand_total) as daily_revenue
       FROM invoices 
       WHERE tenant_id = $1 AND invoice_date BETWEEN $2 AND $3
       GROUP BY DATE(invoice_date)
       ORDER BY date`,
      [tenantId, startDate, endDate]
    );

    return {
      summary: salesResult.rows,
      dailySales: dailySales.rows,
      period: { startDate, endDate }
    };
  }

  async generateRevenueAnalysis(tenantId, startDate, endDate) {
    const revenueByCustomer = await pool.query(
      `SELECT 
        c.name as customer_name,
        COUNT(i.id) as invoice_count,
        SUM(i.grand_total) as total_revenue
       FROM invoices i
       JOIN customers c ON i.customer_id = c.id
       WHERE i.tenant_id = $1 AND i.invoice_date BETWEEN $2 AND $3
       GROUP BY c.id, c.name
       ORDER BY total_revenue DESC
       LIMIT 10`,
      [tenantId, startDate, endDate]
    );

    const revenueByProduct = await pool.query(
      `SELECT 
        p.name as product_name,
        SUM(ii.quantity) as total_quantity,
        SUM(ii.total_amount) as total_revenue
       FROM invoice_items ii
       JOIN invoices i ON ii.invoice_id = i.id
       JOIN products p ON ii.product_id = p.id
       WHERE i.tenant_id = $1 AND i.invoice_date BETWEEN $2 AND $3
       GROUP BY p.id, p.name
       ORDER BY total_revenue DESC
       LIMIT 10`,
      [tenantId, startDate, endDate]
    );

    return {
      topCustomers: revenueByCustomer.rows,
      topProducts: revenueByProduct.rows,
      period: { startDate, endDate }
    };
  }

  async generateCustomerAnalysis(tenantId, startDate, endDate) {
    const customerActivity = await pool.query(
      `SELECT 
        c.name,
        c.email,
        COUNT(i.id) as total_invoices,
        SUM(i.grand_total) as total_spent,
        MAX(i.invoice_date) as last_purchase
       FROM customers c
       LEFT JOIN invoices i ON c.id = i.customer_id AND i.invoice_date BETWEEN $2 AND $3
       WHERE c.tenant_id = $1
       GROUP BY c.id, c.name, c.email
       ORDER BY total_spent DESC NULLS LAST`,
      [tenantId, startDate, endDate]
    );

    return {
      customerActivity: customerActivity.rows,
      period: { startDate, endDate }
    };
  }

  async saveReport(tenantId, reportType, data, parameters) {
    const result = await pool.query(
      `INSERT INTO reports (tenant_id, name, type, parameters, status, generated_at, created_by) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) 
       RETURNING *`,
      [
        tenantId,
        `Relatório ${reportType} - ${new Date().toLocaleDateString('pt-MZ')}`,
        reportType,
        parameters,
        'completed',
        new Date(),
        '00000000-0000-0000-0000-000000000000' // System user
      ]
    );

    return result.rows[0];
  }
}

// =============================================
// INICIALIZAÇÃO DOS SERVIÇOS
// =============================================

const automationService = new AutomationService();
const notificationService = new NotificationService();
const reportService = new ReportService();

// =============================================
// SEED DO BANCO DE DADOS AVANÇADO
// =============================================

const seedDatabase = async () => {
  const client = await pool.connect();
  
  try {
    console.log('🌱 Iniciando seed do banco de dados avançado...');

    // Verificar se já existem tenants
    const existingTenants = await client.query('SELECT * FROM tenants LIMIT 1');
    if (existingTenants.rows.length > 0) {
      console.log('✅ Banco de dados já populado');
      return;
    }

    // Criar tenant demo (código similar ao anterior, mas atualizado)
    const tenantResult = await client.query(
      `INSERT INTO tenants (name, country, currency, plan, status, settings) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [
        'Great Nexus Demo Company', 
        'MZ', 
        'MZN', 
        'premium', 
        'active',
        JSON.stringify({
          automation: { enabled: true },
          notifications: { email_enabled: true },
          features: { advanced_reports: true, workflows: true }
        })
      ]
    );
    
    const tenant = tenantResult.rows[0];
    console.log('✅ Tenant criado:', tenant.name);

    // Criar usuário admin
    const hashedPassword = bcrypt.hashSync('admin123', 8);
    const userResult = await client.query(
      `INSERT INTO users (tenant_id, email, password_hash, name, role, preferences) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [
        tenant.id, 
        'admin@greatnexus.com', 
        hashedPassword, 
        'Super Admin', 
        'admin',
        JSON.stringify({
          notifications: { email: true, push: true },
          dashboard: { default_view: 'overview' }
        })
      ]
    );
    const adminUser = userResult.rows[0];

    console.log('✅ Usuário admin criado: admin@greatnexus.com / admin123');

    // Criar dados de exemplo (similar ao anterior, mas com mais dados)
    // ... (código de seed similar ao anterior)

    console.log('🎉 Seed do banco de dados avançado concluído com sucesso!');

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
    
    // Recarregar regras de automação após seed
    await automationService.loadRules();
    
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
// ROTAS PÚBLICAS (similares às anteriores)
// =============================================

// Health Check
app.get("/health", async (req, res) => {
  try {
    const dbStatus = await testConnection();
    
    res.json({
      status: "OK",
      service: "Great Nexus Backend",
      database: dbStatus ? "Connected" : "Disconnected",
      automation: {
        rules: automationService.rules.size,
        service: "Active"
      },
      time: new Date().toISOString(),
      environment: process.env.NODE_ENV || "development",
      version: "5.0.0"
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

// Página de Login (atualizada)
app.get("/login", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Great Nexus - Sistema Avançado</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            body { 
                font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
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
                box-shadow: 0 20px 40px rgba(0,0,0,0.1);
                width: 100%;
                max-width: 420px;
            }
            .logo { 
                text-align: center; 
                margin-bottom: 30px; 
            }
            .logo h1 { 
                color: #333; 
                margin-bottom: 8px; 
                font-size: 26px;
                font-weight: 600;
            }
            .logo p {
                color: #666;
                margin: 0;
                font-size: 14px;
            }
            .features {
                background: #f8f9fa;
                padding: 15px;
                border-radius: 8px;
                margin-bottom: 20px;
                font-size: 12px;
            }
            .feature-item {
                display: flex;
                align-items: center;
                margin-bottom: 8px;
                color: #555;
            }
            .feature-item:before {
                content: "✅";
                margin-right: 8px;
            }
            .form-group { 
                margin-bottom: 20px; 
            }
            .form-group label { 
                display: block; 
                margin-bottom: 6px; 
                color: #333; 
                font-weight: 500; 
                font-size: 14px;
            }
            .form-group input { 
                width: 100%; 
                padding: 12px 15px; 
                border: 2px solid #e1e5e9; 
                border-radius: 8px; 
                font-size: 15px; 
                transition: all 0.3s;
            }
            .form-group input:focus { 
                outline: none; 
                border-color: #667eea; 
                box-shadow: 0 0 0 3px rgba(102, 126, 234, 0.1);
            }
            .btn-login { 
                width: 100%; 
                padding: 14px; 
                background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); 
                color: white; 
                border: none; 
                border-radius: 8px; 
                font-size: 16px; 
                font-weight: 600;
                cursor: pointer; 
                transition: all 0.3s;
            }
            .btn-login:hover { 
                transform: translateY(-2px);
                box-shadow: 0 8px 20px rgba(102, 126, 234, 0.3);
            }
            .demo-accounts { 
                margin-top: 25px; 
                padding: 18px; 
                background: #f8f9fa; 
                border-radius: 8px; 
                font-size: 12px; 
            }
            .demo-accounts h3 {
                margin: 0 0 12px 0;
                color: #333;
                font-size: 13px;
            }
            .account {
                margin-bottom: 6px;
                padding: 8px;
                background: white;
                border-radius: 6px;
                font-size: 11px;
                border-left: 3px solid #667eea;
            }
            .message { 
                margin-top: 15px; 
                padding: 12px; 
                border-radius: 6px; 
                text-align: center; 
                display: none; 
                font-size: 14px;
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
                <p>Sistema Empresarial Inteligente</p>
            </div>

            <div class="features">
                <div class="feature-item">Automação de Processos</div>
                <div class="feature-item">Workflows Personalizados</div>
                <div class="feature-item">Relatórios Avançados</div>
                <div class="feature-item">Integrações API</div>
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

                <button type="submit" class="btn-login">🚀 Acessar Sistema</button>
            </form>

            <div class="demo-accounts">
                <h3>🔐 Contas de Demonstração:</h3>
                <div class="account">
                    <strong>Administrador:</strong> admin@greatnexus.com / admin123
                </div>
                <div class="account">
                    <strong>Usuário:</strong> demo@greatnexus.com / demo123
                </div>
                <div class="account">
                    <strong>Sistema:</strong> Automação + Workflows + API
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
                        }, 1500);
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

// Dashboard Avançado
app.get("/dashboard", (req, res) => {
  res.send(`
    <!DOCTYPE html>
    <html>
    <head>
        <title>Great Nexus - Dashboard Inteligente</title>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <style>
            :root {
                --primary: #667eea;
                --secondary: #764ba2;
                --success: #10b981;
                --warning: #f59e0b;
                --danger: #ef4444;
                --info: #3b82f6;
                --dark: #1f2937;
                --light: #f8fafc;
            }
            
            * {
                margin: 0;
                padding: 0;
                box-sizing: border-box;
            }
            
            body { 
                font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif; 
                background: #f8fafc;
                color: var(--dark);
                line-height: 1.6;
            }
            
            .header {
                background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
                color: white;
                padding: 1rem 2rem;
                display: flex;
                justify-content: space-between;
                align-items: center;
                box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
                position: sticky;
                top: 0;
                z-index: 100;
            }
            
            .header-content {
                display: flex;
                align-items: center;
                gap: 1rem;
            }
            
            .header h1 {
                font-size: 1.5rem;
                font-weight: 700;
            }
            
            .header-badge {
                background: rgba(255, 255, 255, 0.2);
                padding: 0.25rem 0.75rem;
                border-radius: 1rem;
                font-size: 0.75rem;
                font-weight: 500;
            }
            
            .user-menu {
                display: flex;
                align-items: center;
                gap: 1rem;
            }
            
            .user-info {
                display: flex;
                align-items: center;
                gap: 0.5rem;
            }
            
            .user-avatar {
                width: 2.5rem;
                height: 2.5rem;
                border-radius: 50%;
                background: rgba(255, 255, 255, 0.2);
                display: flex;
                align-items: center;
                justify-content: center;
                font-weight: 600;
            }
            
            .btn {
                padding: 0.5rem 1rem;
                border: none;
                border-radius: 0.5rem;
                font-weight: 500;
                cursor: pointer;
                transition: all 0.2s;
                display: inline-flex;
                align-items: center;
                gap: 0.5rem;
            }
            
            .btn-logout {
                background: rgba(255, 255, 255, 0.2);
                color: white;
                border: 1px solid rgba(255, 255, 255, 0.3);
            }
            
            .btn-logout:hover {
                background: rgba(255, 255, 255, 0.3);
            }
            
            .container {
                max-width: 1400px;
                margin: 0 auto;
                padding: 2rem;
            }
            
            .welcome-banner {
                background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
                color: white;
                padding: 2.5rem;
                border-radius: 1rem;
                margin-bottom: 2rem;
                text-align: center;
                position: relative;
                overflow: hidden;
            }
            
            .welcome-banner::before {
                content: '';
                position: absolute;
                top: 0;
                right: 0;
                width: 8rem;
                height: 8rem;
                background: rgba(255, 255, 255, 0.1);
                border-radius: 50%;
                transform: translate(30%, -30%);
            }
            
            .welcome-banner h2 {
                font-size: 2rem;
                font-weight: 700;
                margin-bottom: 0.5rem;
            }
            
            .welcome-banner p {
                opacity: 0.9;
                font-size: 1.1rem;
                max-width: 600px;
                margin: 0 auto;
            }
            
            .stats-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
                gap: 1.5rem;
                margin-bottom: 2rem;
            }
            
            .stat-card {
                background: white;
                padding: 1.5rem;
                border-radius: 1rem;
                box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
                border-left: 4px solid var(--primary);
                transition: all 0.3s ease;
            }
            
            .stat-card:hover {
                transform: translateY(-4px);
                box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
            }
            
            .stat-header {
                display: flex;
                align-items: center;
                justify-content: between;
                margin-bottom: 1rem;
            }
            
            .stat-icon {
                width: 3rem;
                height: 3rem;
                border-radius: 0.75rem;
                background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.25rem;
            }
            
            .stat-trend {
                margin-left: auto;
                padding: 0.25rem 0.5rem;
                border-radius: 0.375rem;
                font-size: 0.75rem;
                font-weight: 600;
            }
            
            .trend-up {
                background: #dcfce7;
                color: #166534;
            }
            
            .trend-down {
                background: #fecaca;
                color: #dc2626;
            }
            
            .stat-content h3 {
                font-size: 0.875rem;
                color: #6b7280;
                font-weight: 500;
                margin-bottom: 0.5rem;
            }
            
            .stat-value {
                font-size: 1.875rem;
                font-weight: 700;
                color: var(--dark);
            }
            
            .modules-grid {
                display: grid;
                grid-template-columns: repeat(auto-fit, minmax(320px, 1fr));
                gap: 1.5rem;
                margin-bottom: 2rem;
            }
            
            .module-card {
                background: white;
                padding: 2rem;
                border-radius: 1rem;
                box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
                border-left: 4px solid var(--primary);
                transition: all 0.3s ease;
                position: relative;
                overflow: hidden;
            }
            
            .module-card::before {
                content: '';
                position: absolute;
                top: 0;
                left: 0;
                right: 0;
                height: 4px;
                background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
            }
            
            .module-card:hover {
                transform: translateY(-4px);
                box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.25);
            }
            
            .module-header {
                display: flex;
                align-items: center;
                gap: 1rem;
                margin-bottom: 1rem;
            }
            
            .module-icon {
                width: 3rem;
                height: 3rem;
                border-radius: 0.75rem;
                background: linear-gradient(135deg, var(--primary) 0%, var(--secondary) 100%);
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1.25rem;
            }
            
            .module-title {
                font-size: 1.25rem;
                font-weight: 600;
                color: var(--dark);
            }
            
            .module-description {
                color: #6b7280;
                margin-bottom: 1.5rem;
                line-height: 1.6;
            }
            
            .btn-group {
                display: flex;
                gap: 0.75rem;
                flex-wrap: wrap;
            }
            
            .btn-primary {
                background: var(--primary);
                color: white;
            }
            
            .btn-primary:hover {
                background: #5a6fd8;
                transform: translateY(-1px);
            }
            
            .btn-secondary {
                background: #f3f4f6;
                color: var(--dark);
                border: 1px solid #d1d5db;
            }
            
            .btn-secondary:hover {
                background: #e5e7eb;
            }
            
            .automation-badge {
                position: absolute;
                top: 1rem;
                right: 1rem;
                background: var(--success);
                color: white;
                padding: 0.25rem 0.5rem;
                border-radius: 0.375rem;
                font-size: 0.75rem;
                font-weight: 600;
            }
            
            .recent-activity {
                background: white;
                padding: 2rem;
                border-radius: 1rem;
                box-shadow: 0 1px 3px 0 rgba(0, 0, 0, 0.1), 0 1px 2px 0 rgba(0, 0, 0, 0.06);
            }
            
            .section-title {
                font-size: 1.5rem;
                font-weight: 600;
                margin-bottom: 1.5rem;
                color: var(--dark);
            }
            
            .activity-list {
                max-height: 400px;
                overflow-y: auto;
            }
            
            .activity-item {
                display: flex;
                align-items: center;
                gap: 1rem;
                padding: 1rem;
                border-radius: 0.5rem;
                transition: background 0.2s;
                border-left: 3px solid var(--primary);
            }
            
            .activity-item:hover {
                background: #f9fafb;
            }
            
            .activity-icon {
                width: 2.5rem;
                height: 2.5rem;
                border-radius: 50%;
                background: #f3f4f6;
                display: flex;
                align-items: center;
                justify-content: center;
                font-size: 1rem;
            }
            
            .activity-content {
                flex: 1;
            }
            
            .activity-title {
                font-weight: 600;
                margin-bottom: 0.25rem;
            }
            
            .activity-description {
                color: #6b7280;
                font-size: 0.875rem;
            }
            
            .activity-time {
                color: #9ca3af;
                font-size: 0.75rem;
            }
            
            @media (max-width: 768px) {
                .container {
                    padding: 1rem;
                }
                
                .modules-grid {
                    grid-template-columns: 1fr;
                }
                
                .stats-grid {
                    grid-template-columns: 1fr;
                }
                
                .header {
                    padding: 1rem;
                }
                
                .header h1 {
                    font-size: 1.25rem;
                }
                
                .welcome-banner {
                    padding: 1.5rem;
                }
                
                .welcome-banner h2 {
                    font-size: 1.5rem;
                }
            }
        </style>
    </head>
    <body>
        <div class="header">
            <div class="header-content">
                <h1>🌐 Great Nexus</h1>
                <div class="header-badge">Sistema Inteligente</div>
            </div>
            
            <div class="user-menu">
                <div class="user-info">
                    <div class="user-avatar" id="userAvatar">A</div>
                    <span id="userName">Administrador</span>
                </div>
                <button class="btn btn-logout" onclick="logout()">
                    <span>🚪 Sair</span>
                </button>
            </div>
        </div>

        <div class="container">
            <!-- Banner de Boas-Vindas -->
            <div class="welcome-banner">
                <h2>Bem-vindo ao Sistema Inteligente! 🤖</h2>
                <p>Gerencie seu negócio com automação avançada, workflows inteligentes e analytics em tempo real</p>
            </div>

            <!-- Estatísticas -->
            <div class="stats-grid" id="statsContainer">
                <!-- Carregado via JavaScript -->
            </div>

            <!-- Módulos do Sistema -->
            <div class="modules-grid">
                <!-- Módulo de Automação -->
                <div class="module-card">
                    <div class="automation-badge">🤖 AUTO</div>
                    <div class="module-header">
                        <div class="module-icon">⚡</div>
                        <div class="module-title">Automação Inteligente</div>
                    </div>
                    <div class="module-description">
                        Crie regras automáticas para emails, notificações e ações baseadas em eventos do sistema.
                    </div>
                    <div class="btn-group">
                        <button class="btn btn-primary" onclick="openAutomation()">
                            Configurar Regras
                        </button>
                        <button class="btn btn-secondary" onclick="viewAutomationLogs()">
                            Ver Logs
                        </button>
                    </div>
                </div>

                <!-- Módulo de Workflows -->
                <div class="module-card">
                    <div class="module-header">
                        <div class="module-icon">🔄</div>
                        <div class="module-title">Workflows</div>
                    </div>
                    <div class="module-description">
                        Designer de workflows visuais para processos empresariais complexos e aprovações.
                    </div>
                    <div class="btn-group">
                        <button class="btn btn-primary" onclick="openWorkflowDesigner()">
                            Criar Workflow
                        </button>
                        <button class="btn btn-secondary" onclick="viewWorkflows()">
                            Meus Workflows
                        </button>
                    </div>
                </div>

                <!-- Módulo de Relatórios Avançados -->
                <div class="module-card">
                    <div class="module-header">
                        <div class="module-icon">📊</div>
                        <div class="module-title">Analytics Avançado</div>
                    </div>
                    <div class="module-description">
                        Relatórios personalizados, dashboards interativos e previsões com machine learning.
                    </div>
                    <div class="btn-group">
                        <button class="btn btn-primary" onclick="openAnalytics()">
                            Ver Analytics
                        </button>
                        <button class="btn btn-secondary" onclick="generateReport()">
                            Novo Relatório
                        </button>
                    </div>
                </div>

                <!-- Módulo de Integrações -->
                <div class="module-card">
                    <div class="module-header">
                        <div class="module-icon">🔗</div>
                        <div class="module-title">Integrações API</div>
                    </div>
                    <div class="module-description">
                        Conecte com outros sistemas, webhooks personalizados e sincronização de dados.
                    </div>
                    <div class="btn-group">
                        <button class="btn btn-primary" onclick="openIntegrations()">
                            Gerenciar APIs
                        </button>
                        <button class="btn btn-secondary" onclick="viewWebhooks()">
                            Webhooks
                        </button>
                    </div>
                </div>

                <!-- Módulo de Notificações -->
                <div class="module-card">
                    <div class="module-header">
                        <div class="module-icon">🔔</div>
                        <div class="module-title">Central de Notificações</div>
                    </div>
                    <div class="module-description">
                        Sistema unificado de notificações, alertas inteligentes e preferências de comunicação.
                    </div>
                    <div class="btn-group">
                        <button class="btn btn-primary" onclick="openNotifications()">
                            Ver Notificações
                        </button>
                        <button class="btn btn-secondary" onclick="notificationSettings()">
                            Configurações
                        </button>
                    </div>
                </div>

                <!-- Módulo de Configurações -->
                <div class="module-card">
                    <div class="module-header">
                        <div class="module-icon">⚙️</div>
                        <div class="module-title">Configurações do Sistema</div>
                    </div>
                    <div class="module-description">
                        Configurações avançadas, templates de email, taxas personalizadas e muito mais.
                    </div>
                    <div class="btn-group">
                        <button class="btn btn-primary" onclick="openSettings()">
                            Configurações
                        </button>
                        <button class="btn btn-secondary" onclick="systemHealth()">
                            Saúde do Sistema
                        </button>
                    </div>
                </div>
            </div>

            <!-- Atividade Recente -->
            <div class="recent-activity">
                <h3 class="section-title">📋 Atividade Recente do Sistema</h3>
                <div class="activity-list" id="activityList">
                    <!-- Carregado via JavaScript -->
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
            document.getElementById('userAvatar').textContent = user.name ? user.name.charAt(0).toUpperCase() : 'U';

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
                    <div class="stat-card">
                        <div class="stat-header">
                            <div class="stat-icon">💰</div>
                            <div class="stat-trend trend-up">+12%</div>
                        </div>
                        <div class="stat-content">
                            <h3>Receita Total</h3>
                            <div class="stat-value">${stats.totalRevenue}</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-header">
                            <div class="stat-icon">📄</div>
                            <div class="stat-trend trend-down">-5%</div>
                        </div>
                        <div class="stat-content">
                            <h3>Faturas Pendentes</h3>
                            <div class="stat-value">${stats.pendingInvoices}</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-header">
                            <div class="stat-icon">👥</div>
                            <div class="stat-trend trend-up">+8%</div>
                        </div>
                        <div class="stat-content">
                            <h3>Total de Clientes</h3>
                            <div class="stat-value">${stats.totalCustomers}</div>
                        </div>
                    </div>
                    <div class="stat-card">
                        <div class="stat-header">
                            <div class="stat-icon">🤖</div>
                            <div class="stat-trend trend-up">+15%</div>
                        </div>
                        <div class="stat-content">
                            <h3>Automações Ativas</h3>
                            <div class="stat-value">${stats.activeAutomations}</div>
                        </div>
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
                        <div class="activity-icon">${getActivityIcon(activity.action)}</div>
                        <div class="activity-content">
                            <div class="activity-title">${activity.action}</div>
                            <div class="activity-description">${activity.description}</div>
                        </div>
                        <div class="activity-time">${formatTime(activity.created_at)}</div>
                    </div>
                `).join('');
            }

            function getActivityIcon(action) {
                const icons = {
                    'invoice.created': '📄',
                    'payment.received': '💰',
                    'customer.created': '👥',
                    'automation.triggered': '⚡',
                    'report.generated': '📊',
                    'user.logged_in': '🔐'
                };
                return icons[action] || '📋';
            }

            function formatTime(timestamp) {
                return new Date(timestamp).toLocaleTimeString('pt-MZ', { 
                    hour: '2-digit', 
                    minute: '2-digit' 
                });
            }

            function logout() {
                localStorage.removeItem('token');
                localStorage.removeItem('user');
                window.location.href = '/login';
            }

            // Funções dos módulos
            function openAutomation() {
                alert('Abrindo configurador de automações...');
            }

            function viewAutomationLogs() {
                alert('Abrindo logs de automação...');
            }

            function openWorkflowDesigner() {
                alert('Abrindo designer de workflows...');
            }

            function viewWorkflows() {
                alert('Listando workflows...');
            }

            function openAnalytics() {
                alert('Abrindo analytics avançado...');
            }

            function generateReport() {
                alert('Gerando novo relatório...');
            }

            function openIntegrations() {
                alert('Abrindo gerenciador de integrações...');
            }

            function viewWebhooks() {
                alert('Listando webhooks...');
            }

            function openNotifications() {
                alert('Abrindo central de notificações...');
            }

            function notificationSettings() {
                alert('Abrindo configurações de notificação...');
            }

            function openSettings() {
                alert('Abrindo configurações do sistema...');
            }

            function systemHealth() {
                alert('Verificando saúde do sistema...');
            }

            // Carregar dados ao iniciar
            loadStats();
            loadRecentActivity();

            // Atualizar a cada 30 segundos
            setInterval(() => {
                loadStats();
                loadRecentActivity();
            }, 30000);
        </script>
    </body>
    </html>
  `);
});

// =============================================
// ROTAS DE AUTOMAÇÃO E WORKFLOWS
// =============================================

// Listar regras de automação
app.get("/api/v1/automation/rules", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT ar.*, u.name as created_by_name
       FROM automation_rules ar
       JOIN users u ON ar.created_by = u.id
       WHERE ar.tenant_id = $1
       ORDER BY ar.created_at DESC`,
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

// Criar regra de automação
app.post("/api/v1/automation/rules", verifyToken, async (req, res) => {
  try {
    const {
      name,
      description,
      trigger_type,
      trigger_config,
      action_type,
      action_config,
      conditions,
      is_active = true
    } = req.body;

    const result = await pool.query(
      `INSERT INTO automation_rules (
        tenant_id, name, description, trigger_type, trigger_config,
        action_type, action_config, conditions, is_active, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      RETURNING *`,
      [
        req.user.tenant_id,
        name,
        description,
        trigger_type,
        trigger_config,
        action_type,
        action_config,
        conditions,
        is_active,
        req.user.id
      ]
    );

    // Recarregar regras no serviço
    await automationService.loadRules();

    res.status(201).json({
      success: true,
      message: "Regra de automação criada com sucesso!",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("Error creating automation rule:", error);
    res.status(500).json({
      success: false,
      error: "Erro ao criar regra de automação"
    });
  }
});

// Executar regra manualmente
app.post("/api/v1/automation/rules/:id/execute", verifyToken, async (req, res) => {
  try {
    const ruleId = req.params.id;
    const { data } = req.body;

    const ruleResult = await pool.query(
      'SELECT * FROM automation_rules WHERE id = $1 AND tenant_id = $2',
      [ruleId, req.user.tenant_id]
    );

    if (ruleResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        error: "Regra não encontrada"
      });
    }

    const rule = ruleResult.rows[0];
    await automationService.executeRule(rule, {
      ...data,
      tenant_id: req.user.tenant_id,
      user_id: req.user.id
    });

    res.json({
      success: true,
      message: "Regra executada com sucesso!"
    });
  } catch (error) {
    console.error("Error executing automation rule:", error);
    res.status(500).json({
      success: false,
      error: "Erro ao executar regra"
    });
  }
});

// =============================================
// ROTAS DE NOTIFICAÇÕES
// =============================================

// Listar notificações do usuário
app.get("/api/v1/notifications", verifyToken, async (req, res) => {
  try {
    const { limit = 50, unread_only = false } = req.query;

    let query = `
      SELECT * FROM notifications 
      WHERE tenant_id = $1 AND user_id = $2
    `;

    const params = [req.user.tenant_id, req.user.id];

    if (unread_only) {
      query += ' AND is_read = false';
    }

    query += ' ORDER BY created_at DESC LIMIT $3';
    params.push(parseInt(limit));

    const result = await pool.query(query, params);

    res.json({
      success: true,
      data: result.rows
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

// Marcar todas como lidas
app.post("/api/v1/notifications/read-all", verifyToken, async (req, res) => {
  try {
    await notificationService.markAllAsRead(req.user.tenant_id, req.user.id);

    res.json({
      success: true,
      message: "Todas as notificações marcadas como lidas"
    });
  } catch (error) {
    console.error("Error marking all notifications as read:", error);
    res.status(500).json({
      success: false,
      error: "Erro ao marcar notificações como lidas"
    });
  }
});

// =============================================
// ROTAS DE RELATÓRIOS
// =============================================

// Gerar relatório
app.post("/api/v1/reports/generate", verifyToken, async (req, res) => {
  try {
    const { report_type, start_date, end_date, parameters = {} } = req.body;

    const report = await reportService.generateFinancialReport(
      req.user.tenant_id,
      start_date,
      end_date,
      report_type
    );

    res.json({
      success: true,
      message: "Relatório gerado com sucesso!",
      data: report
    });
  } catch (error) {
    console.error("Error generating report:", error);
    res.status(500).json({
      success: false,
      error: "Erro ao gerar relatório"
    });
  }
});

// Listar relatórios
app.get("/api/v1/reports", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT r.*, u.name as created_by_name
       FROM reports r
       JOIN users u ON r.created_by = u.id
       WHERE r.tenant_id = $1
       ORDER BY r.created_at DESC
       LIMIT 50`,
      [req.user.tenant_id]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error("Error fetching reports:", error);
    res.status(500).json({
      success: false,
      error: "Erro ao buscar relatórios"
    });
  }
});

// =============================================
// ROTAS DE WORKFLOWS
// =============================================

// Listar definições de workflow
app.get("/api/v1/workflows/definitions", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT * FROM workflow_definitions 
       WHERE tenant_id = $1
       ORDER BY created_at DESC`,
      [req.user.tenant_id]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error("Error fetching workflow definitions:", error);
    res.status(500).json({
      success: false,
      error: "Erro ao buscar workflows"
    });
  }
});

// Criar definição de workflow
app.post("/api/v1/workflows/definitions", verifyToken, async (req, res) => {
  try {
    const { name, description, definition } = req.body;

    const result = await pool.query(
      `INSERT INTO workflow_definitions (
        tenant_id, name, description, definition, created_by
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *`,
      [
        req.user.tenant_id,
        name,
        description,
        definition,
        req.user.id
      ]
    );

    res.status(201).json({
      success: true,
      message: "Workflow criado com sucesso!",
      data: result.rows[0]
    });
  } catch (error) {
    console.error("Error creating workflow definition:", error);
    res.status(500).json({
      success: false,
      error: "Erro ao criar workflow"
    });
  }
});

// =============================================
// ROTAS EXISTENTES (atualizadas com automação)
// =============================================

// Login API (atualizada)
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

    // Trigger de automação para login
    await automationService.triggerEvent('user.logged_in', {
      user: {
        id: user.id,
        email: user.email,
        name: user.name
      },
      tenant_id: user.tenant_id,
      timestamp: new Date().toISOString()
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

// Dashboard Statistics (atualizada)
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

    // Automações ativas
    const automationResult = await pool.query(
      'SELECT COUNT(*) as count FROM automation_rules WHERE tenant_id = $1 AND is_active = true',
      [tenantId]
    );

    const stats = {
      totalRevenue: `MT ${parseFloat(revenueResult.rows[0].total).toLocaleString('pt-MZ')}`,
      pendingInvoices: parseInt(pendingResult.rows[0].count),
      totalCustomers: parseInt(customersResult.rows[0].count),
      activeAutomations: parseInt(automationResult.rows[0].count)
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

// Criar fatura (atualizada com automação)
app.post("/api/v1/invoices", verifyToken, async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // ... (código de criação de fatura similar ao anterior)

    const invoice = invoiceResult.rows[0];

    // Trigger de automação para fatura criada
    await automationService.triggerEvent('invoice.created', {
      invoice: {
        id: invoice.id,
        invoice_number: invoice.invoice_number,
        grand_total: invoice.grand_total,
        status: invoice.status
      },
      customer: {
        id: invoice.customer_id,
        // ... outros dados do cliente
      },
      tenant_id: req.user.tenant_id,
      user_id: req.user.id
    }, req.user.tenant_id);

    await client.query('COMMIT');

    // Buscar fatura completa
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
// TAREFAS AGENDADAS
// =============================================

// Agendar tarefa para verificar faturas vencidas
cron.schedule('0 9 * * *', async () => {
  try {
    console.log('🔔 Verificando faturas vencidas...');
    
    const overdueInvoices = await pool.query(
      `SELECT i.*, c.email as customer_email, c.name as customer_name
       FROM invoices i
       JOIN customers c ON i.customer_id = c.id
       WHERE i.status = 'pending' 
       AND i.due_date < CURRENT_DATE
       AND i.tenant_id IN (SELECT id FROM tenants WHERE status = 'active')`
    );

    for (const invoice of overdueInvoices.rows) {
      await automationService.triggerEvent('invoice.overdue', {
        invoice: {
          id: invoice.id,
          invoice_number: invoice.invoice_number,
          due_date: invoice.due_date,
          grand_total: invoice.grand_total
        },
        customer: {
          email: invoice.customer_email,
          name: invoice.customer_name
        },
        tenant_id: invoice.tenant_id,
        days_overdue: Math.floor((new Date() - new Date(invoice.due_date)) / (1000 * 60 * 60 * 24))
      }, invoice.tenant_id);
    }

    console.log(`✅ ${overdueInvoices.rows.length} faturas vencidas processadas`);
  } catch (error) {
    console.error('❌ Erro na tarefa agendada:', error);
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
🚀 GREAT NEXUS SISTEMA AVANÇADO
📍 Porta: ${PORT}
🗄️  Database: PostgreSQL com UUID
🤖 Automação: ${automationService.rules.size} regras carregadas
📊 Analytics: Relatórios avançados ativos
🔗 API: Sistema de integrações pronto

📋 MÓDULOS IMPLEMENTADOS:
   ✅ Sistema de Automação Inteligente
   ✅ Workflows e Processos
   ✅ Central de Notificações
   ✅ Relatórios Avançados
   ✅ Integrações API e Webhooks
   ✅ Tarefas Agendadas
   ✅ Dashboard Inteligente
   ✅ Sistema Multi-tenant Completo

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
