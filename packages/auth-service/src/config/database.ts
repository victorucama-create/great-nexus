import { Pool } from 'pg';

export const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: 20,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 2000,
});

// Initialize database schema
export const initDB = async () => {
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
        currency TEXT NOT NULL DEFAULT 'MZN',
        created_at TIMESTAMPTZ DEFAULT NOW(),
        updated_at TIMESTAMPTZ DEFAULT NOW()
      )
    `);

    // Enable Row Level Security
    await client.query('ALTER TABLE tenants FORCE ROW LEVEL SECURITY');
    await client.query('ALTER TABLE users FORCE ROW LEVEL SECURITY');
    await client.query('ALTER TABLE companies FORCE ROW LEVEL SECURITY');

    // Create RLS policies
    await client.query(`
      CREATE POLICY tenant_isolation_policy ON tenants
      USING (id = current_setting('app.current_tenant_id')::UUID)
    `);

    await client.query(`
      CREATE POLICY user_isolation_policy ON users
      USING (tenant_id = current_setting('app.current_tenant_id')::UUID)
    `);

    await client.query(`
      CREATE POLICY company_isolation_policy ON companies
      USING (tenant_id = current_setting('app.current_tenant_id')::UUID)
    `);

    console.log('Database initialized successfully');
  } catch (error) {
    console.error('Database initialization error:', error);
    throw error;
  } finally {
    client.release();
  }
};
