const { Pool } = require('pg');

// Database connection pool
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : false,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Initialize database schema
const initDB = async () => {
  const client = await pool.connect();
  
  try {
    // Enable UUID extension
    await client.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp"');

    // Create tenants table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tenants (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        name TEXT NOT NULL,
        country TEXT NOT NULL,
        currency TEXT NOT NULL DEFAULT 'MZN',
        plan TEXT NOT NULL DEFAULT 'starter',
        status TEXT NOT NULL DEFAULT 'active',
        subscription_id TEXT,
        billing_cycle TEXT DEFAULT 'monthly',
        next_billing_date TIMESTAMPTZ,
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create users table
    await client.query(`
      CREATE TABLE IF NOT EXISTS users (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        email TEXT NOT NULL,
        password_hash TEXT NOT NULL,
        name TEXT NOT NULL,
        role TEXT NOT NULL DEFAULT 'user',
        phone TEXT,
        avatar_url TEXT,
        last_login TIMESTAMPTZ,
        is_active BOOLEAN DEFAULT true,
        preferences JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(tenant_id, email)
      )
    `);

    // Create companies table
    await client.query(`
      CREATE TABLE IF NOT EXISTS companies (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        tax_id TEXT,
        address TEXT,
        city TEXT,
        country TEXT DEFAULT 'MZ',
        currency TEXT NOT NULL DEFAULT 'MZN',
        phone TEXT,
        email TEXT,
        website TEXT,
        logo_url TEXT,
        is_default BOOLEAN DEFAULT false,
        settings JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create customers table
    await client.query(`
      CREATE TABLE IF NOT EXISTS customers (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        company_id UUID REFERENCES companies(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        email TEXT,
        phone TEXT,
        tax_id TEXT,
        address TEXT,
        city TEXT,
        country TEXT DEFAULT 'MZ',
        customer_type TEXT DEFAULT 'individual',
        status TEXT DEFAULT 'active',
        credit_limit NUMERIC(15,2) DEFAULT 0,
        current_balance NUMERIC(15,2) DEFAULT 0,
        notes TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create products table
    await client.query(`
      CREATE TABLE IF NOT EXISTS products (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        sku TEXT NOT NULL,
        name TEXT NOT NULL,
        description TEXT,
        price NUMERIC(15,2) DEFAULT 0,
        cost_price NUMERIC(15,2) DEFAULT 0,
        stock INTEGER DEFAULT 0,
        min_stock INTEGER DEFAULT 0,
        category TEXT,
        barcode TEXT,
        unit TEXT DEFAULT 'unidade',
        is_active BOOLEAN DEFAULT true,
        image_url TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(tenant_id, sku)
      )
    `);

    // Create invoices table
    await client.query(`
      CREATE TABLE IF NOT EXISTS invoices (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
        invoice_number TEXT UNIQUE NOT NULL,
        invoice_date DATE NOT NULL,
        due_date DATE NOT NULL,
        status TEXT NOT NULL DEFAULT 'draft',
        total_amount NUMERIC(15,2) DEFAULT 0,
        tax_amount NUMERIC(15,2) DEFAULT 0,
        discount_amount NUMERIC(15,2) DEFAULT 0,
        grand_total NUMERIC(15,2) DEFAULT 0,
        currency TEXT NOT NULL DEFAULT 'MZN',
        notes TEXT,
        terms TEXT,
        created_by UUID NOT NULL REFERENCES users(id),
        paid_at TIMESTAMPTZ,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create invoice_items table
    await client.query(`
      CREATE TABLE IF NOT EXISTS invoice_items (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        invoice_id UUID NOT NULL REFERENCES invoices(id) ON DELETE CASCADE,
        product_id UUID REFERENCES products(id) ON DELETE SET NULL,
        description TEXT NOT NULL,
        quantity NUMERIC(10,2) NOT NULL,
        unit_price NUMERIC(15,2) NOT NULL,
        discount NUMERIC(5,2) DEFAULT 0,
        tax_rate NUMERIC(5,2) DEFAULT 0,
        total_amount NUMERIC(15,2) NOT NULL,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create payments table
    await client.query(`
      CREATE TABLE IF NOT EXISTS payments (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        invoice_id UUID REFERENCES invoices(id) ON DELETE SET NULL,
        customer_id UUID REFERENCES customers(id) ON DELETE SET NULL,
        payment_number TEXT UNIQUE NOT NULL,
        payment_date DATE NOT NULL,
        amount NUMERIC(15,2) NOT NULL,
        currency TEXT NOT NULL DEFAULT 'MZN',
        payment_method TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'completed',
        transaction_id TEXT,
        reference TEXT,
        notes TEXT,
        created_by UUID NOT NULL REFERENCES users(id),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create subscriptions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscriptions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        plan_id TEXT NOT NULL,
        plan_name TEXT NOT NULL,
        status TEXT NOT NULL DEFAULT 'active',
        price NUMERIC(15,2) NOT NULL,
        currency TEXT NOT NULL DEFAULT 'MZN',
        billing_cycle TEXT NOT NULL DEFAULT 'monthly',
        current_period_start TIMESTAMPTZ NOT NULL,
        current_period_end TIMESTAMPTZ NOT NULL,
        cancel_at_period_end BOOLEAN DEFAULT false,
        canceled_at TIMESTAMPTZ,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create subscription_invoices table
    await client.query(`
      CREATE TABLE IF NOT EXISTS subscription_invoices (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        subscription_id UUID NOT NULL REFERENCES subscriptions(id) ON DELETE CASCADE,
        invoice_number TEXT UNIQUE NOT NULL,
        period_start TIMESTAMPTZ NOT NULL,
        period_end TIMESTAMPTZ NOT NULL,
        amount NUMERIC(15,2) NOT NULL,
        currency TEXT NOT NULL DEFAULT 'MZN',
        status TEXT NOT NULL DEFAULT 'pending',
        due_date TIMESTAMPTZ,
        paid_at TIMESTAMPTZ,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create expenses table
    await client.query(`
      CREATE TABLE IF NOT EXISTS expenses (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        amount NUMERIC(15,2) NOT NULL,
        currency TEXT NOT NULL DEFAULT 'MZN',
        expense_date DATE NOT NULL,
        payment_method TEXT,
        reference TEXT,
        receipt_url TEXT,
        status TEXT DEFAULT 'completed',
        created_by UUID NOT NULL REFERENCES users(id),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create bank_accounts table
    await client.query(`
      CREATE TABLE IF NOT EXISTS bank_accounts (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        bank_name TEXT NOT NULL,
        account_name TEXT NOT NULL,
        account_number TEXT NOT NULL,
        iban TEXT,
        currency TEXT NOT NULL DEFAULT 'MZN',
        balance NUMERIC(15,2) DEFAULT 0,
        is_active BOOLEAN DEFAULT true,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create transactions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS transactions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        company_id UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
        bank_account_id UUID REFERENCES bank_accounts(id) ON DELETE CASCADE,
        type TEXT NOT NULL,
        category TEXT NOT NULL,
        description TEXT NOT NULL,
        amount NUMERIC(15,2) NOT NULL,
        currency TEXT NOT NULL DEFAULT 'MZN',
        transaction_date DATE NOT NULL,
        reference TEXT,
        status TEXT DEFAULT 'completed',
        metadata JSONB DEFAULT '{}',
        created_by UUID NOT NULL REFERENCES users(id),
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create tax_rates table
    await client.query(`
      CREATE TABLE IF NOT EXISTS tax_rates (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        rate NUMERIC(5,2) NOT NULL,
        description TEXT,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create payment_methods table
    await client.query(`
      CREATE TABLE IF NOT EXISTS payment_methods (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create reports table
    await client.query(`
      CREATE TABLE IF NOT EXISTS reports (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        parameters JSONB DEFAULT '{}',
        file_url TEXT,
        status TEXT DEFAULT 'pending',
        generated_at TIMESTAMPTZ,
        created_by UUID NOT NULL REFERENCES users(id),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create audit_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS audit_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE SET NULL,
        action TEXT NOT NULL,
        resource_type TEXT NOT NULL,
        resource_id UUID,
        old_values JSONB,
        new_values JSONB,
        ip_address TEXT,
        user_agent TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create system_settings table
    await client.query(`
      CREATE TABLE IF NOT EXISTS system_settings (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        setting_key TEXT NOT NULL,
        setting_value JSONB NOT NULL,
        description TEXT,
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        UNIQUE(tenant_id, setting_key)
      )
    `);

    // =============================================
    // NOVAS TABELAS PARA AUTOMAÇÃO E INTEGRAÇÕES
    // =============================================

    // Create automation_rules table
    await client.query(`
      CREATE TABLE IF NOT EXISTS automation_rules (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        trigger_type TEXT NOT NULL,
        trigger_config JSONB DEFAULT '{}',
        action_type TEXT NOT NULL,
        action_config JSONB DEFAULT '{}',
        conditions JSONB DEFAULT '[]',
        is_active BOOLEAN DEFAULT true,
        last_triggered_at TIMESTAMPTZ,
        created_by UUID NOT NULL REFERENCES users(id),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create email_templates table
    await client.query(`
      CREATE TABLE IF NOT EXISTS email_templates (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        subject TEXT NOT NULL,
        body TEXT NOT NULL,
        variables JSONB DEFAULT '[]',
        is_active BOOLEAN DEFAULT true,
        created_by UUID NOT NULL REFERENCES users(id),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create scheduled_tasks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS scheduled_tasks (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        task_type TEXT NOT NULL,
        schedule_config JSONB DEFAULT '{}',
        last_run_at TIMESTAMPTZ,
        next_run_at TIMESTAMPTZ,
        status TEXT DEFAULT 'active',
        created_by UUID NOT NULL REFERENCES users(id),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create integrations table
    await client.query(`
      CREATE TABLE IF NOT EXISTS integrations (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        type TEXT NOT NULL,
        provider TEXT NOT NULL,
        config JSONB DEFAULT '{}',
        status TEXT DEFAULT 'active',
        last_sync_at TIMESTAMPTZ,
        created_by UUID NOT NULL REFERENCES users(id),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create webhooks table
    await client.query(`
      CREATE TABLE IF NOT EXISTS webhooks (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        url TEXT NOT NULL,
        events JSONB DEFAULT '[]',
        secret TEXT,
        is_active BOOLEAN DEFAULT true,
        last_triggered_at TIMESTAMPTZ,
        created_by UUID NOT NULL REFERENCES users(id),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create notifications table
    await client.query(`
      CREATE TABLE IF NOT EXISTS notifications (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        user_id UUID REFERENCES users(id) ON DELETE CASCADE,
        title TEXT NOT NULL,
        message TEXT NOT NULL,
        type TEXT NOT NULL,
        is_read BOOLEAN DEFAULT false,
        action_url TEXT,
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        read_at TIMESTAMPTZ
      )
    `);

    // Create data_exports table
    await client.query(`
      CREATE TABLE IF NOT EXISTS data_exports (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        format TEXT NOT NULL,
        filters JSONB DEFAULT '{}',
        file_url TEXT,
        status TEXT DEFAULT 'processing',
        created_by UUID NOT NULL REFERENCES users(id),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      )
    `);

    // Create api_keys table
    await client.query(`
      CREATE TABLE IF NOT EXISTS api_keys (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        key_hash TEXT NOT NULL,
        permissions JSONB DEFAULT '[]',
        expires_at TIMESTAMPTZ,
        last_used_at TIMESTAMPTZ,
        is_active BOOLEAN DEFAULT true,
        created_by UUID NOT NULL REFERENCES users(id),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create workflow_definitions table
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflow_definitions (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        name TEXT NOT NULL,
        description TEXT,
        version INTEGER DEFAULT 1,
        definition JSONB NOT NULL,
        is_active BOOLEAN DEFAULT true,
        created_by UUID NOT NULL REFERENCES users(id),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Create workflow_instances table
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflow_instances (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        workflow_definition_id UUID NOT NULL REFERENCES workflow_definitions(id) ON DELETE CASCADE,
        status TEXT NOT NULL DEFAULT 'running',
        current_step TEXT,
        context JSONB DEFAULT '{}',
        created_by UUID NOT NULL REFERENCES users(id),
        metadata JSONB DEFAULT '{}',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ
      )
    `);

    // Create workflow_execution_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS workflow_execution_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        workflow_instance_id UUID NOT NULL REFERENCES workflow_instances(id) ON DELETE CASCADE,
        step_name TEXT NOT NULL,
        status TEXT NOT NULL,
        input_data JSONB,
        output_data JSONB,
        error_message TEXT,
        duration_ms INTEGER,
        executed_at TIMESTAMPTZ DEFAULT NOW(),
        metadata JSONB DEFAULT '{}'
      )
    `);

    // Create data_sync_logs table
    await client.query(`
      CREATE TABLE IF NOT EXISTS data_sync_logs (
        id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
        tenant_id UUID NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
        integration_id UUID NOT NULL REFERENCES integrations(id) ON DELETE CASCADE,
        sync_type TEXT NOT NULL,
        records_processed INTEGER DEFAULT 0,
        records_created INTEGER DEFAULT 0,
        records_updated INTEGER DEFAULT 0,
        records_failed INTEGER DEFAULT 0,
        status TEXT NOT NULL,
        started_at TIMESTAMPTZ DEFAULT NOW(),
        completed_at TIMESTAMPTZ,
        error_message TEXT,
        metadata JSONB DEFAULT '{}'
      )
    `);

    console.log('✅ Database schema initialized successfully');

    // Insert default payment methods
    await client.query(`
      INSERT INTO payment_methods (tenant_id, name, type) VALUES 
      ('00000000-0000-0000-0000-000000000000', 'Dinheiro', 'cash'),
      ('00000000-0000-0000-0000-000000000000', 'Transferência Bancária', 'bank_transfer'),
      ('00000000-0000-0000-0000-000000000000', 'MB Way', 'digital_wallet'),
      ('00000000-0000-0000-0000-000000000000', 'Cartão de Crédito', 'credit_card'),
      ('00000000-0000-0000-0000-000000000000', 'Cartão de Débito', 'debit_card'),
      ('00000000-0000-0000-0000-000000000000', 'Cheque', 'check'),
      ('00000000-0000-0000-0000-000000000000', 'PayPal', 'digital_wallet'),
      ('00000000-0000-0000-0000-000000000000', 'Stripe', 'digital_wallet')
      ON CONFLICT DO NOTHING
    `);

    // Insert default tax rates
    await client.query(`
      INSERT INTO tax_rates (tenant_id, name, rate, description) VALUES 
      ('00000000-0000-0000-0000-000000000000', 'IVA 17%', 17.00, 'IVA padrão em Moçambique'),
      ('00000000-0000-0000-0000-000000000000', 'Isento', 0.00, 'Produtos isentos de IVA'),
      ('00000000-0000-0000-0000-000000000000', 'Reduzido 7%', 7.00, 'Taxa reduzida'),
      ('00000000-0000-0000-0000-000000000000', 'IVA 16%', 16.00, 'IVA para alguns produtos')
      ON CONFLICT DO NOTHING
    `);

    // Insert default email templates
    await client.query(`
      INSERT INTO email_templates (tenant_id, name, subject, body, variables, created_by) VALUES 
      (
        '00000000-0000-0000-0000-000000000000',
        'Fatura Criada',
        'Nova Fatura {{invoice_number}}',
        'Prezado {{customer_name}},\n\nA sua fatura {{invoice_number}} no valor de {{amount}} foi criada.\n\nData de vencimento: {{due_date}}\n\nAtenciosamente,\n{{company_name}}',
        '["invoice_number", "customer_name", "amount", "due_date", "company_name"]',
        '00000000-0000-0000-0000-000000000000'
      ),
      (
        '00000000-0000-0000-0000-000000000000',
        'Lembrete de Pagamento',
        'Lembrete: Fatura {{invoice_number}} Vencendo',
        'Prezado {{customer_name}},\n\nLembramos que a fatura {{invoice_number}} no valor de {{amount}} vence em {{due_date}}.\n\nAtenciosamente,\n{{company_name}}',
        '["invoice_number", "customer_name", "amount", "due_date", "company_name"]',
        '00000000-0000-0000-0000-000000000000'
      ),
      (
        '00000000-0000-0000-0000-000000000000',
        'Pagamento Recebido',
        'Pagamento Confirmado - Fatura {{invoice_number}}',
        'Prezado {{customer_name}},\n\nO pagamento da fatura {{invoice_number}} no valor de {{amount}} foi confirmado.\n\nObrigado!\n{{company_name}}',
        '["invoice_number", "customer_name", "amount", "company_name"]',
        '00000000-0000-0000-0000-000000000000'
      )
      ON CONFLICT DO NOTHING
    `);

    // Insert default automation rules
    await client.query(`
      INSERT INTO automation_rules (tenant_id, name, description, trigger_type, trigger_config, action_type, action_config, conditions, created_by) VALUES 
      (
        '00000000-0000-0000-0000-000000000000',
        'Notificar Fatura Criada',
        'Envia email automaticamente quando uma fatura é criada',
        'invoice.created',
        '{"event": "invoice.created"}',
        'send_email',
        '{"template": "Fatura Criada", "to": "{{customer_email}}"}',
        '[{"field": "invoice.status", "operator": "equals", "value": "draft"}]',
        '00000000-0000-0000-0000-000000000000'
      ),
      (
        '00000000-0000-0000-0000-000000000000',
        'Lembrete Vencimento',
        'Envia lembrete 3 dias antes do vencimento',
        'scheduled',
        '{"schedule": "0 9 * * *", "condition": "days_before_due <= 3"}',
        'send_email',
        '{"template": "Lembrete de Pagamento", "to": "{{customer_email}}"}',
        '[{"field": "invoice.status", "operator": "equals", "value": "pending"}]',
        '00000000-0000-0000-0000-000000000000'
      ),
      (
        '00000000-0000-0000-0000-000000000000',
        'Confirmar Pagamento',
        'Envia confirmação quando pagamento é recebido',
        'payment.received',
        '{"event": "payment.received"}',
        'send_email',
        '{"template": "Pagamento Recebido", "to": "{{customer_email}}"}',
        '[]',
        '00000000-0000-0000-0000-000000000000'
      )
      ON CONFLICT DO NOTHING
    `);

    // Insert default system settings
    await client.query(`
      INSERT INTO system_settings (tenant_id, setting_key, setting_value, description) VALUES 
      (
        '00000000-0000-0000-0000-000000000000',
        'company.default_currency',
        '"MZN"',
        'Moeda padrão do sistema'
      ),
      (
        '00000000-0000-0000-0000-000000000000',
        'invoice.default_terms',
        '"Pagamento devido em 30 dias. Multa de 2% ao mês por atraso."',
        'Termos padrão das faturas'
      ),
      (
        '00000000-0000-0000-0000-000000000000',
        'notification.email_enabled',
        'true',
        'Habilitar notificações por email'
      ),
      (
        '00000000-0000-0000-0000-000000000000',
        'automation.enabled',
        'true',
        'Habilitar automações'
      ),
      (
        '00000000-0000-0000-0000-000000000000',
        'backup.auto_enabled',
        'true',
        'Habilitar backup automático'
      )
      ON CONFLICT DO NOTHING
    `);

    console.log('✅ Default data inserted successfully');

  } catch (error) {
    console.error('❌ Database initialization error:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Test database connection
const testConnection = async () => {
  try {
    const client = await pool.connect();
    console.log('✅ Database connected successfully');
    client.release();
    return true;
  } catch (error) {
    console.error('❌ Database connection failed:', error.message);
    return false;
  }
};

module.exports = {
  pool,
  initDB,
  testConnection
};
