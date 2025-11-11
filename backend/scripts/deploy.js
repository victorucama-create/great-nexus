#!/usr/bin/env node

const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { Pool } = require('pg');

class DeployScript {
  constructor() {
    this.dbConfig = {
      connectionString: process.env.DATABASE_URL
    };
    this.backupDir = path.join(__dirname, '../../backups');
  }

  async run() {
    console.log('🚀 Iniciando deploy do Great Nexus...\n');

    try {
      // 1. Backup do banco de dados
      await this.backupDatabase();

      // 2. Executar migrações
      await this.runMigrations();

      // 3. Verificar saúde do sistema
      await this.healthCheck();

      // 4. Limpar cache se necessário
      this.clearCache();

      console.log('\n✅ Deploy concluído com sucesso!');
      
    } catch (error) {
      console.error('\n❌ Erro durante o deploy:', error.message);
      process.exit(1);
    }
  }

  async backupDatabase() {
    console.log('📦 Criando backup do banco de dados...');
    
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = path.join(this.backupDir, `backup-${timestamp}.sql`);
    
    // Criar diretório de backups se não existir
    if (!fs.existsSync(this.backupDir)) {
      fs.mkdirSync(this.backupDir, { recursive: true });
    }

    try {
      // Usar pg_dump para backup (requer pg_dump instalado)
      execSync(`pg_dump ${process.env.DATABASE_URL} > ${backupFile}`, {
        stdio: 'inherit'
      });
      
      console.log(`✅ Backup criado: ${backupFile}`);
    } catch (error) {
      console.warn('⚠️  Não foi possível criar backup com pg_dump, criando backup manual...');
      await this.createManualBackup(backupFile);
    }
  }

  async createManualBackup(backupFile) {
    const pool = new Pool(this.dbConfig);
    const client = await pool.connect();

    try {
      const tables = [
        'tenants', 'users', 'companies', 'customers', 'products',
        'invoices', 'invoice_items', 'payments', 'subscriptions'
      ];

      let backupSQL = '';

      for (const table of tables) {
        const result = await client.query(`SELECT * FROM ${table}`);
        backupSQL += `-- Data for table ${table}\n`;
        
        for (const row of result.rows) {
          const columns = Object.keys(row).join(', ');
          const values = Object.values(row).map(val => {
            if (val === null) return 'NULL';
            if (typeof val === 'string') return `'${val.replace(/'/g, "''")}'`;
            return val;
          }).join(', ');
          
          backupSQL += `INSERT INTO ${table} (${columns}) VALUES (${values});\n`;
        }
        backupSQL += '\n';
      }

      fs.writeFileSync(backupFile, backupSQL);
      console.log(`✅ Backup manual criado: ${backupFile}`);
    } finally {
      client.release();
      await pool.end();
    }
  }

  async runMigrations() {
    console.log('🔄 Executando migrações...');
    
    const pool = new Pool(this.dbConfig);
    const client = await pool.connect();

    try {
      // Verificar se a tabela de migrações existe
      await client.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          id SERIAL PRIMARY KEY,
          name VARCHAR(255) NOT NULL,
          executed_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);

      // Executar migrações pendentes
      const migrationFiles = fs.readdirSync(path.join(__dirname, '../migrations'))
        .filter(file => file.endsWith('.sql'))
        .sort();

      for (const file of migrationFiles) {
        const migrationName = path.basename(file, '.sql');
        
        // Verificar se a migração já foi executada
        const result = await client.query(
          'SELECT id FROM schema_migrations WHERE name = $1',
          [migrationName]
        );

        if (result.rows.length === 0) {
          console.log(`   Executando: ${migrationName}`);
          
          const migrationSQL = fs.readFileSync(
            path.join(__dirname, '../migrations', file), 
            'utf8'
          );
          
          await client.query('BEGIN');
          await client.query(migrationSQL);
          await client.query(
            'INSERT INTO schema_migrations (name) VALUES ($1)',
            [migrationName]
          );
          await client.query('COMMIT');
          
          console.log(`   ✅ ${migrationName} concluída`);
        }
      }
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
      await pool.end();
    }
  }

  async healthCheck() {
    console.log('❤️  Verificando saúde do sistema...');
    
    const { HealthCheckService } = require('../monitoring/healthCheck');
    const healthCheck = new HealthCheckService();
    
    const result = await healthCheck.runAllChecks();
    
    if (result.status === 'critical') {
      throw new Error('Sistema não está saudável. Verifique os logs.');
    }
    
    console.log(`✅ Saúde do sistema: ${result.status}`);
  }

  clearCache() {
    console.log('🧹 Limpando cache...');
    
    const cacheDir = path.join(__dirname, '../../cache');
    if (fs.existsSync(cacheDir)) {
      fs.rmSync(cacheDir, { recursive: true, force: true });
      fs.mkdirSync(cacheDir, { recursive: true });
    }
    
    console.log('✅ Cache limpo');
  }
}

// Executar se chamado diretamente
if (require.main === module) {
  const deploy = new DeployScript();
  deploy.run().catch(console.error);
}

module.exports = DeployScript;
