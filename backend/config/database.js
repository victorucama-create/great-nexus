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
        metadata JSONB,
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
        metadata JSONB,
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
        parameters JSONB,
        file_url TEXT,
        status TEXT DEFAULT 'pending',
        created_by UUID NOT NULL REFERENCES users(id),
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

    console.log('✅ Database schema initialized successfully');

    // Insert default payment methods
    await client.query(`
      INSERT INTO payment_methods (tenant_id, name, type) VALUES 
      ('00000000-0000-0000-0000-000000000000', 'Dinheiro', 'cash'),
      ('00000000-0000-0000-0000-000000000000', 'Transferência Bancária', 'bank_transfer'),
      ('00000000-0000-0000-0000-000000000000', 'MB Way', 'digital_wallet'),
      ('00000000-0000-0000-0000-000000000000', 'Cartão de Crédito', 'credit_card'),
      ('00000000-0000-0000-0000-000000000000', 'Cartão de Débito', 'debit_card'),
      ('00000000-0000-0000-0000-000000000000', 'Cheque', 'check')
      ON CONFLICT DO NOTHING
    `);

    // Insert default tax rates
    await client.query(`
      INSERT INTO tax_rates (tenant_id, name, rate, description) VALUES 
      ('00000000-0000-0000-0000-000000000000', 'IVA 17%', 17.00, 'IVA padrão em Moçambique'),
      ('00000000-0000-0000-0000-000000000000', 'Isento', 0.00, 'Produtos isentos de IVA'),
      ('00000000-0000-0000-0000-000000000000', 'Reduzido 7%', 7.00, 'Taxa reduzida')
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
