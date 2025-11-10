const { pool, initDB } = require('../packages/auth-service/src/config/database');

async function initializeDatabase() {
  try {
    await initDB();
    console.log('✅ Database initialized successfully');
    process.exit(0);
  } catch (error) {
    console.error('❌ Database initialization failed:', error);
    process.exit(1);
  }
}

initializeDatabase();
