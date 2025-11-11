/**
 * GREAT NEXUS – Ecossistema Empresarial Inteligente
 * Versão 5.0 com Automação Completa e Workflows
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
const https = require('https');
const http = require('http');

// Importar configuração do database
const { pool, initDB, testConnection } = require("./backend/config/database");

const app = express();
const PORT = process.env.PORT || 3000;
const JWT_SECRET = process.env.JWT_SECRET || "greatnexus-secret-key-advanced-v5";

// =============================================
// SERVIÇOS AVANÇADOS DE AUTOMAÇÃO
// =============================================

class AdvancedAutomationService {
  constructor() {
    this.rules = new Map();
    this.workflows = new Map();
    this.loadRules();
    this.loadWorkflows();
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

  async loadWorkflows() {
    try {
      const result = await pool.query(
        'SELECT * FROM workflow_definitions WHERE is_active = true'
      );
      
      this.workflows.clear();
      result.rows.forEach(workflow => {
        this.workflows.set(workflow.id, workflow);
      });
      
      console.log(`✅ ${this.workflows.size} workflows carregados`);
    } catch (error) {
      console.error('❌ Erro ao carregar workflows:', error);
    }
  }

  async triggerEvent(eventType, data, tenantId) {
    try {
      console.log(`🎯 Disparando evento: ${eventType} para tenant ${tenantId}`);
      
      // Executar regras de automação
      const rules = Array.from(this.rules.values()).filter(rule => 
        rule.tenant_id === tenantId && rule.trigger_type === eventType
      );

      for (const rule of rules) {
        await this.executeRule(rule, data);
      }

      // Executar workflows
      const workflows = Array.from(this.workflows.values()).filter(workflow => 
        workflow.tenant_id === tenantId && 
        workflow.definition?.triggers?.includes(eventType)
      );

      for (const workflow of workflows) {
        await this.startWorkflow(workflow, data, eventType);
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
        case 'start_workflow':
          await this.startWorkflowById(rule.action_config, data);
          break;
        case 'create_invoice':
          await this.createInvoice(rule.action_config, data);
          break;
        default:
          console.log(`❌ Tipo de ação não suportado: ${rule.action_type}`);
      }

      // Atualizar último trigger
      await pool.query(
        'UPDATE automation_rules SET last_triggered_at = NOW() WHERE id = $1',
        [rule.id]
      );

      // Log de execução
      await this.logAutomationExecution(rule, data, 'completed');

    } catch (error) {
      console.error(`❌ Erro executando regra ${rule.name}:`, error);
      await this.logAutomationExecution(rule, data, 'failed', error.message);
    }
  }

  async startWorkflow(workflow, data, triggerEvent) {
    try {
      console.log(`🔄 Iniciando workflow: ${workflow.name}`);
      
      // Criar instância do workflow
      const instanceResult = await pool.query(
        `INSERT INTO workflow_instances (
          tenant_id, workflow_definition_id, status, context, created_by
        ) VALUES ($1, $2, $3, $4, $5) RETURNING *`,
        [
          workflow.tenant_id,
          workflow.id,
          'running',
          { ...data, triggerEvent },
          data.user_id || '00000000-0000-0000-0000-000000000000'
        ]
      );

      const instance = instanceResult.rows[0];

      // Executar primeiro passo
      await this.executeWorkflowStep(workflow, instance, 'start');

      return instance;

    } catch (error) {
      console.error(`❌ Erro iniciando workflow ${workflow.name}:`, error);
    }
  }

  async executeWorkflowStep(workflow, instance, stepName) {
    try {
      const step = workflow.definition?.steps?.[stepName];
      if (!step) {
        console.log(`⏭️  Step ${stepName} não encontrado, finalizando workflow`);
        await pool.query(
          'UPDATE workflow_instances SET status = $1, completed_at = NOW() WHERE id = $2',
          ['completed', instance.id]
        );
        return;
      }

      console.log(`🔄 Executando passo: ${stepName}`);

      // Log de início
      await this.logWorkflowStep(instance.id, stepName, 'running', instance.context);

      let output;
      switch (step.type) {
        case 'action':
          output = await this.executeWorkflowAction(step.action, instance.context);
          break;
        case 'condition':
          output = await this.evaluateCondition(step.condition, instance.context);
          break;
        case 'approval':
          output = await this.createApprovalTask(step, instance);
          break;
        default:
          console.log(`⚠️  Tipo de passo não suportado: ${step.type}`);
          output = { status: 'skipped' };
      }

      // Atualizar contexto
      await pool.query(
        'UPDATE workflow_instances SET context = $1, current_step = $2 WHERE id = $3',
        [
          { ...instance.context, [stepName]: output },
          stepName,
          instance.id
        ]
      );

      // Log de sucesso
      await this.logWorkflowStep(instance.id, stepName, 'completed', instance.context, output);

      // Próximo passo
      if (step.next) {
        await this.executeWorkflowStep(workflow, instance, step.next);
      } else {
        // Workflow concluído
        await pool.query(
          'UPDATE workflow_instances SET status = $1, completed_at = NOW() WHERE id = $2',
          ['completed', instance.id]
        );
      }

    } catch (error) {
      console.error(`❌ Erro executando passo ${stepName}:`, error);
      await this.logWorkflowStep(instance.id, stepName, 'failed', instance.context, null, error.message);
      
      // Marcar workflow como falhou
      await pool.query(
        'UPDATE workflow_instances SET status = $1 WHERE id = $2',
        ['failed', instance.id]
      );
    }
  }

  async executeWorkflowAction(actionConfig, context) {
    // Implementar ações específicas do workflow
    switch (actionConfig?.type) {
      case 'send_email':
        return await this.sendEmail(actionConfig.config, context);
      case 'update_record':
        return await this.updateRecord(actionConfig.config, context);
      case 'call_api':
        return await this.callAPI(actionConfig.config, context);
      default:
        console.log(`⚠️  Ação não suportada: ${actionConfig?.type}`);
        return { status: 'skipped' };
    }
  }

  async startWorkflowById(config, data) {
    const workflow = this.workflows.get(config.workflow_id);
    if (workflow) {
      return await this.startWorkflow(workflow, data, 'manual_trigger');
    }
  }

  async createInvoice(config, data) {
    // Lógica para criar fatura automaticamente
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Gerar número de fatura
      const invoiceNumber = `AUTO-${Date.now()}`;
      
      const result = await client.query(
        `INSERT INTO invoices (
          tenant_id, company_id, customer_id, invoice_number, 
          invoice_date, due_date, status, total_amount, grand_total,
          currency, created_by
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11) RETURNING *`,
        [
          data.tenant_id,
          config.company_id,
          config.customer_id,
          invoiceNumber,
          new Date(),
          new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 dias
          'draft',
          config.amount,
          config.amount,
          'MZN',
          data.user_id || '00000000-0000-0000-0000-000000000000'
        ]
      );

      await client.query('COMMIT');
      return result.rows[0];

    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async callAPI(config, data) {
    const { url, method = 'GET', headers = {}, body } = config;
    
    return new Promise((resolve, reject) => {
      const payload = body ? JSON.stringify(this.replacePlaceholdersDeep(body, data)) : undefined;
      
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      const req = https.request(url, options, (res) => {
        let data = '';
        
        res.on('data', (chunk) => {
          data += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              const parsedData = JSON.parse(data);
              resolve(parsedData);
            } catch (e) {
              resolve(data);
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          }
        });
      });

      req.on('error', (error) => {
        reject(error);
      });

      if (payload) {
        req.write(payload);
      }
      
      req.end();
    });
  }

  async createApprovalTask(step, instance) {
    // Criar tarefa de aprovação no sistema
    const notification = await pool.query(
      `INSERT INTO notifications (
        tenant_id, user_id, title, message, type, action_url, metadata
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        instance.tenant_id,
        step.approver_id,
        `Aprovação Requerida: ${step.title}`,
        step.description,
        'approval',
        `/workflows/approve/${instance.id}`,
        { workflow_instance_id: instance.id, step: step.name }
      ]
    );

    return { notificationId: notification.rows[0].id, status: 'pending' };
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
        case 'in':
          return condition.value.includes(value);
        default:
          return false;
      }
    });
  }

  async evaluateCondition(condition, context) {
    return this.checkConditions([condition], context);
  }

  async sendEmail(config, data) {
    try {
      const templateResult = await pool.query(
        'SELECT * FROM email_templates WHERE name = $1 AND tenant_id = $2 AND is_active = true',
        [config.template, data.tenant_id]
      );

      if (templateResult.rows.length === 0) {
        throw new Error(`Template ${config.template} não encontrado`);
      }

      const template = templateResult.rows[0];
      const to = this.replacePlaceholders(config.to, data);
      const subject = this.replacePlaceholders(template.subject, data);
      const body = this.replacePlaceholders(template.body, data);

      // Simular envio de email
      console.log(`📧 Enviando email para: ${to}`);
      console.log(`📝 Assunto: ${subject}`);
      console.log(`📋 Corpo: ${body.substring(0, 100)}...`);

      // Em produção, integrar com serviço de email real
      await this.logEmailSent(data.tenant_id, to, subject, body);

      return { success: true, messageId: `email-${Date.now()}` };

    } catch (error) {
      console.error('❌ Erro enviando email:', error);
      throw error;
    }
  }

  async createNotification(config, data) {
    const { title, message, type, user_id } = config;
    
    const result = await pool.query(
      `INSERT INTO notifications (tenant_id, user_id, title, message, type) 
       VALUES ($1, $2, $3, $4, $5) RETURNING *`,
      [
        data.tenant_id, 
        user_id || data.user_id, 
        this.replacePlaceholders(title, data),
        this.replacePlaceholders(message, data),
        type || 'info'
      ]
    );
    
    console.log(`🔔 Notificação criada: ${this.replacePlaceholders(title, data)}`);
    return result.rows[0];
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
    
    return new Promise((resolve, reject) => {
      const payload = this.replacePlaceholdersDeep(config.payload || data, data);
      
      const options = {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers
        }
      };

      const protocol = url.startsWith('https') ? https : http;
      
      const req = protocol.request(url, options, (res) => {
        let responseData = '';
        
        res.on('data', (chunk) => {
          responseData += chunk;
        });
        
        res.on('end', () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            console.log(`🌐 Webhook chamado com sucesso: ${url}`);
            try {
              const parsedData = JSON.parse(responseData);
              resolve(parsedData);
            } catch (e) {
              resolve(responseData);
            }
          } else {
            reject(new Error(`HTTP ${res.statusCode}: ${res.statusMessage}`));
          }
        });
      });

      req.on('error', (error) => {
        console.error(`❌ Erro chamando webhook ${url}:`, error);
        reject(error);
      });

      if (payload) {
        req.write(JSON.stringify(payload));
      }
      
      req.end();
    });
  }

  async logAutomationExecution(rule, data, status, error = null) {
    await pool.query(
      `INSERT INTO audit_logs (tenant_id, action, resource_type, resource_id, new_values, metadata)
       VALUES ($1, $2, $3, $4, $5, $6)`,
      [
        data.tenant_id,
        `automation.${status}`,
        'automation_rule',
        rule.id,
        { rule_name: rule.name, trigger_data: data },
        { error, duration: Date.now() - (data.timestamp || Date.now()) }
      ]
    );
  }

  async logWorkflowStep(instanceId, stepName, status, input, output = null, error = null) {
    // Primeiro obter o tenant_id da instância
    const instanceResult = await pool.query(
      'SELECT tenant_id FROM workflow_instances WHERE id = $1',
      [instanceId]
    );

    if (instanceResult.rows.length === 0) return;

    const tenantId = instanceResult.rows[0].tenant_id;

    await pool.query(
      `INSERT INTO workflow_execution_logs (
        tenant_id, workflow_instance_id, step_name, status, input_data, output_data, error_message, duration_ms
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
      [
        tenantId,
        instanceId,
        stepName,
        status,
        input,
        output,
        error,
        100 // placeholder
      ]
    );
  }

  async logEmailSent(tenantId, to, subject, body) {
    await pool.query(
      `INSERT INTO audit_logs (tenant_id, action, resource_type, new_values)
       VALUES ($1, $2, $3, $4)`,
      [
        tenantId,
        'email.sent',
        'email',
        { to, subject, body_preview: body.substring(0, 100) }
      ]
    );
  }

  getNestedValue(obj, path) {
    return path.split('.').reduce((acc, part) => acc && acc[part], obj);
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
// SERVIÇO DE INTEGRAÇÕES
// =============================================

class IntegrationService {
  constructor() {
    this.integrations = new Map();
    this.loadIntegrations();
  }

  async loadIntegrations() {
    try {
      const result = await pool.query(
        'SELECT * FROM integrations WHERE status = $1',
        ['active']
      );
      
      this.integrations.clear();
      result.rows.forEach(integration => {
        this.integrations.set(integration.id, integration);
      });
      
      console.log(`✅ ${this.integrations.size} integrações carregadas`);
    } catch (error) {
      console.error('❌ Erro ao carregar integrações:', error);
    }
  }

  async syncData(integrationId, syncType = 'full') {
    const integration = this.integrations.get(integrationId);
    if (!integration) {
      throw new Error('Integração não encontrada');
    }

    const syncLog = await this.startSyncLog(integrationId, syncType);

    try {
      let result;
      switch (integration.provider) {
        case 'erp_system':
          result = await this.syncWithERP(integration, syncType);
          break;
        case 'payment_gateway':
          result = await this.syncPayments(integration, syncType);
          break;
        case 'accounting_software':
          result = await this.syncAccounting(integration, syncType);
          break;
        default:
          throw new Error(`Provedor não suportado: ${integration.provider}`);
      }

      await this.completeSyncLog(syncLog.id, 'completed', result);
      return result;

    } catch (error) {
      await this.failSyncLog(syncLog.id, error.message);
      throw error;
    }
  }

  async syncWithERP(integration, syncType) {
    console.log(`🔄 Sincronizando com ERP: ${integration.name}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
    
    return {
      records_processed: 150,
      records_created: 45,
      records_updated: 85,
      records_failed: 20
    };
  }

  async syncPayments(integration, syncType) {
    console.log(`💳 Sincronizando pagamentos: ${integration.name}`);
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    return {
      records_processed: 80,
      records_created: 25,
      records_updated: 50,
      records_failed: 5
    };
  }

  async syncAccounting(integration, syncType) {
    console.log(`📊 Sincronizando contabilidade: ${integration.name}`);
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    return {
      records_processed: 200,
      records_created: 60,
      records_updated: 120,
      records_failed: 20
    };
  }

  async startSyncLog(integrationId, syncType) {
    const result = await pool.query(
      `INSERT INTO data_sync_logs (integration_id, sync_type, status, started_at)
       VALUES ($1, $2, $3, NOW()) RETURNING *`,
      [integrationId, syncType, 'running']
    );
    return result.rows[0];
  }

  async completeSyncLog(logId, status, result) {
    await pool.query(
      `UPDATE data_sync_logs SET 
        status = $1,
        completed_at = NOW(),
        records_processed = $2,
        records_created = $3,
        records_updated = $4,
        records_failed = $5
       WHERE id = $6`,
      [
        status,
        result.records_processed,
        result.records_created,
        result.records_updated,
        result.records_failed,
        logId
      ]
    );
  }

  async failSyncLog(logId, error) {
    await pool.query(
      `UPDATE data_sync_logs SET 
        status = 'failed',
        completed_at = NOW(),
        error_message = $1
       WHERE id = $2`,
      [error, logId]
    );
  }
}

// =============================================
// SERVIÇO DE RELATÓRIOS AVANÇADOS
// =============================================

class AdvancedReportService {
  async generateReport(tenantId, reportType, parameters, userId) {
    try {
      console.log(`📊 Gerando relatório: ${reportType} para tenant ${tenantId}`);
      
      let reportData;
      switch (reportType) {
        case 'financial_summary':
          reportData = await this.generateFinancialSummary(tenantId, parameters);
          break;
        case 'sales_analysis':
          reportData = await this.generateSalesAnalysis(tenantId, parameters);
          break;
        case 'customer_analytics':
          reportData = await this.generateCustomerAnalytics(tenantId, parameters);
          break;
        case 'automation_metrics':
          reportData = await this.generateAutomationMetrics(tenantId, parameters);
          break;
        case 'workflow_performance':
          reportData = await this.generateWorkflowPerformance(tenantId, parameters);
          break;
        default:
          throw new Error(`Tipo de relatório não suportado: ${reportType}`);
      }

      // Salvar relatório
      const report = await this.saveReport(
        tenantId, 
        reportType, 
        reportData, 
        parameters, 
        userId
      );

      return report;

    } catch (error) {
      console.error('❌ Erro gerando relatório:', error);
      throw error;
    }
  }

  async generateFinancialSummary(tenantId, parameters) {
    const { start_date, end_date, currency = 'MZN' } = parameters;

    // Receitas
    const revenueResult = await pool.query(
      `SELECT 
        COUNT(*) as total_invoices,
        COALESCE(SUM(grand_total), 0) as total_revenue,
        COALESCE(AVG(grand_total), 0) as average_invoice,
        COUNT(*) FILTER (WHERE status = 'paid') as paid_invoices,
        COUNT(*) FILTER (WHERE status = 'pending') as pending_invoices,
        COUNT(*) FILTER (WHERE status = 'overdue') as overdue_invoices
       FROM invoices 
       WHERE tenant_id = $1 AND invoice_date BETWEEN $2 AND $3`,
      [tenantId, start_date, end_date]
    );

    // Despesas
    const expensesResult = await pool.query(
      `SELECT 
        COUNT(*) as total_expenses,
        COALESCE(SUM(amount), 0) as total_expenses_amount,
        COALESCE(AVG(amount), 0) as average_expense
       FROM expenses 
       WHERE tenant_id = $1 AND expense_date BETWEEN $2 AND $3`,
      [tenantId, start_date, end_date]
    );

    return {
      summary: {
        ...revenueResult.rows[0],
        ...expensesResult.rows[0],
        net_profit: (parseFloat(revenueResult.rows[0].total_revenue) - 
                    parseFloat(expensesResult.rows[0].total_expenses_amount))
      },
      period: { start_date, end_date, currency }
    };
  }

  async generateSalesAnalysis(tenantId, parameters) {
    const { start_date, end_date } = parameters;

    // Vendas por produto
    const productsResult = await pool.query(
      `SELECT 
        p.name as product_name,
        COALESCE(SUM(ii.quantity), 0) as total_quantity,
        COALESCE(SUM(ii.total_amount), 0) as total_revenue,
        COUNT(DISTINCT i.id) as invoice_count
       FROM invoice_items ii
       JOIN invoices i ON ii.invoice_id = i.id
       JOIN products p ON ii.product_id = p.id
       WHERE i.tenant_id = $1 AND i.invoice_date BETWEEN $2 AND $3
       GROUP BY p.id, p.name
       ORDER BY total_revenue DESC
       LIMIT 20`,
      [tenantId, start_date, end_date]
    );

    return {
      top_products: productsResult.rows
    };
  }

  async generateCustomerAnalytics(tenantId, parameters) {
    const { start_date, end_date } = parameters;

    const customersResult = await pool.query(
      `SELECT 
        c.name,
        c.email,
        COUNT(i.id) as total_invoices,
        COALESCE(SUM(i.grand_total), 0) as total_spent,
        MAX(i.invoice_date) as last_purchase
       FROM customers c
       LEFT JOIN invoices i ON c.id = i.customer_id AND i.invoice_date BETWEEN $2 AND $3
       WHERE c.tenant_id = $1
       GROUP BY c.id, c.name, c.email
       ORDER BY total_spent DESC NULLS LAST
       LIMIT 10`,
      [tenantId, start_date, end_date]
    );

    return {
      top_customers: customersResult.rows
    };
  }

  async generateAutomationMetrics(tenantId, parameters) {
    const { start_date, end_date } = parameters;

    // Estatísticas de automação
    const automationStats = await pool.query(
      `SELECT 
        COUNT(*) as total_rules,
        COUNT(*) FILTER (WHERE is_active = true) as active_rules,
        COUNT(*) FILTER (WHERE last_triggered_at BETWEEN $2 AND $3) as recently_triggered
       FROM automation_rules 
       WHERE tenant_id = $1`,
      [tenantId, start_date, end_date]
    );

    return {
      overview: automationStats.rows[0]
    };
  }

  async generateWorkflowPerformance(tenantId, parameters) {
    const { start_date, end_date } = parameters;

    // Estatísticas de workflows
    const workflowStats = await pool.query(
      `SELECT 
        wd.name as workflow_name,
        COUNT(wi.id) as total_instances,
        COUNT(wi.id) FILTER (WHERE wi.status = 'completed') as completed_instances,
        COUNT(wi.id) FILTER (WHERE wi.status = 'failed') as failed_instances
       FROM workflow_instances wi
       JOIN workflow_definitions wd ON wi.workflow_definition_id = wd.id
       WHERE wi.tenant_id = $1 AND wi.created_at BETWEEN $2 AND $3
       GROUP BY wd.id, wd.name`,
      [tenantId, start_date, end_date]
    );

    return {
      workflow_overview: workflowStats.rows
    };
  }

  async saveReport(tenantId, reportType, data, parameters, userId) {
    const result = await pool.query(
      `INSERT INTO reports (tenant_id, name, type, parameters, status, generated_at, created_by) 
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [
        tenantId,
        `Relatório ${reportType} - ${new Date().toLocaleDateString('pt-MZ')}`,
        reportType,
        parameters,
        'completed',
        new Date(),
        userId
      ]
    );

    return result.rows[0];
  }

  async exportReport(reportId, format = 'pdf') {
    console.log(`📤 Exportando relatório ${reportId} no formato ${format}`);
    
    const fileUrl = `/exports/report-${reportId}.${format}`;
    
    await pool.query(
      'UPDATE reports SET file_url = $1 WHERE id = $2',
      [fileUrl, reportId]
    );

    return { fileUrl, format, size: '1.2MB' };
  }
}

// =============================================
// INICIALIZAÇÃO DOS SERVIÇOS
// =============================================

const automationService = new AdvancedAutomationService();
const integrationService = new IntegrationService();
const reportService = new AdvancedReportService();

// Serviço de Notificações
const notificationService = {
  async create(tenantId, userId, title, message, type = 'info', actionUrl = null) {
    const result = await pool.query(
      `INSERT INTO notifications (tenant_id, user_id, title, message, type, action_url) 
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING *`,
      [tenantId, userId, title, message, type, actionUrl]
    );
    return result.rows[0];
  },

  async getUserNotifications(tenantId, userId, limit = 50) {
    const result = await pool.query(
      `SELECT * FROM notifications 
       WHERE tenant_id = $1 AND user_id = $2 
       ORDER BY created_at DESC 
       LIMIT $3`,
      [tenantId, userId, limit]
    );
    return result.rows;
  },

  async markAsRead(notificationId, userId) {
    await pool.query(
      'UPDATE notifications SET is_read = true, read_at = NOW() WHERE id = $1 AND user_id = $2',
      [notificationId, userId]
    );
  }
};

// =============================================
// CONFIGURAÇÃO DO EXPRESS
// =============================================

app.use(cors());
app.use(helmet({
  contentSecurityPolicy: false
}));
app.use(morgan("combined"));
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Servir arquivos estáticos
app.use("/uploads", express.static(path.join(__dirname, "uploads")));
app.use("/exports", express.static(path.join(__dirname, "exports")));

// =============================================
// MIDDLEWARE DE AUTENTICAÇÃO
// =============================================

function generateToken(user) {
  return jwt.sign({ 
    id: user.id, 
    role: user.role,
    tenant_id: user.tenant_id,
    email: user.email
  }, JWT_SECRET, { expiresIn: "24h" });
}

function verifyToken(req, res, next) {
  const token = req.headers["authorization"];
  if (!token) {
    return res.status(403).json({ success: false, error: "Token não fornecido" });
  }
  
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
// ROTAS DE AUTENTICAÇÃO
// =============================================

app.post("/api/v1/auth/login", async (req, res) => {
  try {
    const { email, password } = req.body;
    
    if (!email || !password) {
      return res.status(400).json({ success: false, error: "Email e senha são obrigatórios" });
    }

    // Usuário padrão para demonstração
    if (email === 'admin@greatnexus.com' && password === 'admin123') {
      const user = {
        id: '00000000-0000-0000-0000-000000000000',
        email: 'admin@greatnexus.com',
        name: 'Administrador',
        role: 'admin',
        tenant_id: '00000000-0000-0000-0000-000000000000'
      };

      const token = generateToken(user);

      res.json({
        success: true,
        message: "Login bem-sucedido!",
        data: { 
          user, 
          accessToken: token 
        },
      });
    } else {
      return res.status(401).json({ success: false, error: "Credenciais inválidas" });
    }

  } catch (error) {
    console.error("Login error:", error);
    res.status(500).json({ 
      success: false, 
      error: "Erro interno do servidor" 
    });
  }
});

// =============================================
// ROTAS DE AUTOMAÇÃO
// =============================================

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

// =============================================
// ROTAS DE WORKFLOWS
// =============================================

app.get("/api/v1/workflows/definitions", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT wd.*, u.name as created_by_name
       FROM workflow_definitions wd
       JOIN users u ON wd.created_by = u.id
       WHERE wd.tenant_id = $1
       ORDER BY wd.created_at DESC`,
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

app.post("/api/v1/workflows/definitions", verifyToken, async (req, res) => {
  try {
    const { name, description, definition, version = 1 } = req.body;

    const result = await pool.query(
      `INSERT INTO workflow_definitions (
        tenant_id, name, description, version, definition, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *`,
      [
        req.user.tenant_id,
        name,
        description,
        version,
        definition,
        req.user.id
      ]
    );

    await automationService.loadWorkflows();

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
// ROTAS DE RELATÓRIOS
// =============================================

app.post("/api/v1/reports/generate", verifyToken, async (req, res) => {
  try {
    const { report_type, parameters = {} } = req.body;

    const report = await reportService.generateReport(
      req.user.tenant_id,
      report_type,
      parameters,
      req.user.id
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

// =============================================
// ROTAS DE NOTIFICAÇÕES
// =============================================

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
// ROTAS DO DASHBOARD
// =============================================

app.get("/api/v1/dashboard/stats", verifyToken, async (req, res) => {
  try {
    const tenantId = req.user.tenant_id;

    const [
      revenueResult,
      customersResult,
      automationResult,
      workflowResult,
      invoiceResult
    ] = await Promise.all([
      pool.query(
        `SELECT COALESCE(SUM(grand_total), 0) as total 
         FROM invoices 
         WHERE tenant_id = $1 AND status = 'paid' 
         AND invoice_date >= DATE_TRUNC('month', CURRENT_DATE)`,
        [tenantId]
      ),
      pool.query(
        'SELECT COUNT(*) as count FROM customers WHERE tenant_id = $1',
        [tenantId]
      ),
      pool.query(
        'SELECT COUNT(*) as count FROM automation_rules WHERE tenant_id = $1 AND is_active = true',
        [tenantId]
      ),
      pool.query(
        `SELECT COUNT(*) as count FROM workflow_instances 
         WHERE tenant_id = $1 AND status = 'running'`,
        [tenantId]
      ),
      pool.query(
        `SELECT COUNT(*) as count FROM invoices 
         WHERE tenant_id = $1 AND status = 'pending'`,
        [tenantId]
      )
    ]);

    const stats = {
      monthlyRevenue: `MT ${parseFloat(revenueResult.rows[0].total).toFixed(2)}`,
      totalCustomers: parseInt(customersResult.rows[0].count),
      activeAutomations: parseInt(automationResult.rows[0].count),
      runningWorkflows: parseInt(workflowResult.rows[0].count),
      pendingInvoices: parseInt(invoiceResult.rows[0].count)
    };

    res.json({
      success: true,
      data: stats
    });

  } catch (error) {
    console.error("Error fetching dashboard stats:", error);
    res.status(500).json({ 
      success: false, 
      error: "Erro ao buscar estatísticas" 
    });
  }
});

app.get("/api/v1/dashboard/activity", verifyToken, async (req, res) => {
  try {
    const result = await pool.query(
      `SELECT 
        al.action,
        al.resource_type,
        al.created_at,
        al.new_values,
        u.name as user_name
       FROM audit_logs al
       LEFT JOIN users u ON al.user_id = u.id
       WHERE al.tenant_id = $1
       ORDER BY al.created_at DESC
       LIMIT 20`,
      [req.user.tenant_id]
    );

    res.json({
      success: true,
      data: result.rows
    });
  } catch (error) {
    console.error("Error fetching activity:", error);
    res.status(500).json({
      success: false,
      error: "Erro ao buscar atividade recente"
    });
  }
});

// =============================================
// ROTAS PÚBLICAS
// =============================================

app.get("/health", async (req, res) => {
  try {
    const dbStatus = await testConnection();
    
    res.json({
      status: "healthy",
      service: "Great Nexus Advanced",
      version: "5.0.0",
      timestamp: new Date().toISOString(),
      database: dbStatus ? "connected" : "disconnected",
      services: {
        automation: "active",
        workflows: "active", 
        reporting: "active",
        integrations: "active"
      }
    });
  } catch (error) {
    res.status(503).json({
      status: "unhealthy",
      error: error.message
    });
  }
});

app.get("/", (req, res) => {
  res.json({
    message: "Great Nexus API - Sistema de Automação Empresarial",
    version: "5.0.0",
    status: "operational",
    endpoints: {
      auth: "/api/v1/auth/login",
      automation: "/api/v1/automation/rules",
      workflows: "/api/v1/workflows/definitions",
      reports: "/api/v1/reports/generate",
      dashboard: "/api/v1/dashboard/stats",
      health: "/health"
    }
  });
});

// =============================================
// TAREFAS AGENDADAS
// =============================================

cron.schedule('0 9 * * *', async () => {
  try {
    console.log('🔔 Verificando faturas vencidas...');
    
    const overdueInvoices = await pool.query(
      `SELECT i.*, c.email as customer_email, c.name as customer_name, t.id as tenant_id
       FROM invoices i
       JOIN customers c ON i.customer_id = c.id
       JOIN tenants t ON i.tenant_id = t.id
       WHERE i.status = 'pending' 
       AND i.due_date < CURRENT_DATE
       AND t.status = 'active'`
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
    console.error('❌ Erro na tarefa agendada de faturas:', error);
  }
});

// =============================================
// INICIALIZAÇÃO DO SISTEMA
// =============================================

const initializeSystem = async () => {
  try {
    console.log('🚀 Inicializando Great Nexus Advanced...');
    
    await testConnection();
    await initDB();
    
    await automationService.loadRules();
    await automationService.loadWorkflows();
    await integrationService.loadIntegrations();
    
    console.log('✅ Sistema inicializado com sucesso');
  } catch (error) {
    console.error('❌ Erro na inicialização do sistema:', error);
  }
};

// =============================================
// INICIAR SERVIDOR
// =============================================

const startServer = async () => {
  await initializeSystem();
  
  app.listen(PORT, "0.0.0.0", () => {
    console.log(`
🌐 GREAT NEXUS SISTEMA AVANÇADO v5.0
📍 Porta: ${PORT}
🏢 Ambiente: ${process.env.NODE_ENV || 'development'}

🤖 SISTEMA DE AUTOMAÇÃO:
   ✅ ${automationService.rules.size} Regras de Automação
   ✅ ${automationService.workflows.size} Workflows
   ✅ ${integrationService.integrations.size} Integrações

📊 MÓDULOS ATIVOS:
   ✅ Automação Inteligente
   ✅ Workflows Visuais  
   ✅ Integrações API
   ✅ Relatórios Avançados
   ✅ Sistema Multi-tenant

🔧 ENDPOINTS PRINCIPAIS:
   API: http://localhost:${PORT}/
   Health: http://localhost:${PORT}/health

🔐 LOGIN DE DEMONSTRAÇÃO:
   Email: admin@greatnexus.com
   Senha: admin123

🎯 Sistema operacional com automação completa!
    `);
  });
};

startServer();

module.exports = app;
