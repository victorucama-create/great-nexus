const { pool } = require('../config/database');
const bcrypt = require('bcryptjs');

const seedDatabase = async () => {
  const client = await pool.connect();
  
  try {
    console.log('🌱 Iniciando seed do banco de dados...');

    // Criar tenant demo
    const tenantResult = await client.query(
      `INSERT INTO tenants (name, country, currency, plan) 
       VALUES ($1, $2, $3, $4) 
       RETURNING *`,
      ['Great Nexus Demo Company', 'MZ', 'MZN', 'premium']
    );
    
    const tenant = tenantResult.rows[0];
    console.log('✅ Tenant criado:', tenant.name);

    // Criar usuário admin
    const hashedPassword = bcrypt.hashSync('admin123', 8);
    const userResult = await client.query(
      `INSERT INTO users (tenant_id, email, password_hash, name, role) 
       VALUES ($1, $2, $3, $4, $5) 
       RETURNING *`,
      [tenant.id, 'admin@greatnexus.com', hashedPassword, 'Super Admin', 'admin']
    );

    console.log('✅ Usuário admin criado: admin@greatnexus.com / admin123');

    // Criar empresa demo
    const companyResult = await client.query(
      `INSERT INTO companies (tenant_id, name, currency) 
       VALUES ($1, $2, $3) 
       RETURNING *`,
      [tenant.id, 'Empresa Principal', 'MZN']
    );

    console.log('✅ Empresa demo criada');

    // Criar alguns produtos de exemplo
    const products = [
      { sku: 'NBK-001', name: 'Notebook Dell', price: 25000.00, stock: 10 },
      { sku: 'MS-001', name: 'Mouse Wireless', price: 850.50, stock: 50 },
      { sku: 'KB-001', name: 'Teclado Mecânico', price: 1200.00, stock: 25 },
    ];

    for (const product of products) {
      await client.query(
        `INSERT INTO products (tenant_id, company_id, sku, name, price, stock) 
         VALUES ($1, $2, $3, $4, $5, $6)`,
        [tenant.id, companyResult.rows[0].id, product.sku, product.name, product.price, product.stock]
      );
    }

    console.log('✅ Produtos de exemplo criados');
    console.log('🎉 Seed do banco de dados concluído com sucesso!');

  } catch (error) {
    console.error('❌ Erro no seed:', error);
    throw error;
  } finally {
    client.release();
  }
};

// Executar se chamado diretamente
if (require.main === module) {
  seedDatabase()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = seedDatabase;
