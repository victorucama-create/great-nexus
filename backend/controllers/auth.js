const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { pool } = require('../config/database');

// Register new tenant and user
const register = async (req, res) => {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    const { email, password, name, companyName, country, currency } = req.body;

    // Check if user exists
    const userExists = await client.query(
      'SELECT id FROM users WHERE email = $1',
      [email]
    );

    if (userExists.rows.length > 0) {
      return res.status(400).json({ error: 'User already exists' });
    }

    // Hash password
    const saltRounds = 12;
    const passwordHash = await bcrypt.hash(password, saltRounds);

    // Create tenant
    const tenantResult = await client.query(
      `INSERT INTO tenants (name, country, currency, plan) 
       VALUES ($1, $2, $3, $4) RETURNING id, name`,
      [companyName, country, currency, 'starter']
    );
    const tenant = tenantResult.rows[0];

    // Create user
    const userResult = await client.query(
      `INSERT INTO users (tenant_id, email, password_hash, name, role) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id, email, name, role`,
      [tenant.id, email, passwordHash, name, 'tenant_admin']
    );
    const user = userResult.rows[0];

    // Create default company
    await client.query(
      `INSERT INTO companies (tenant_id, name, currency) 
       VALUES ($1, $2, $3)`,
      [tenant.id, companyName, currency]
    );

    await client.query('COMMIT');

    // Generate tokens
    const tokens = generateTokens(user.id, tenant.id, user.role);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      tenant: {
        id: tenant.id,
        name: tenant.name
      },
      ...tokens
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal server error' });
  } finally {
    client.release();
  }
};

// Login user
const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    // Find user with tenant info
    const result = await pool.query(
      `SELECT u.id, u.tenant_id, u.email, u.password_hash, u.name, u.role, t.name as tenant_name
       FROM users u 
       JOIN tenants t ON u.tenant_id = t.id 
       WHERE u.email = $1`,
      [email]
    );

    if (result.rows.length === 0) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const user = result.rows[0];

    // Verify password
    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    // Generate tokens
    const tokens = generateTokens(user.id, user.tenant_id, user.role);

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      tenant: {
        id: user.tenant_id,
        name: user.tenant_name
      },
      ...tokens
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

// Generate JWT tokens
function generateTokens(userId, tenantId, role) {
  const jwtSecret = process.env.JWT_SECRET || 'fallback-secret';
  
  const accessToken = jwt.sign(
    { 
      user_id: userId, 
      tenant_id: tenantId, 
      role: role 
    },
    jwtSecret,
    { 
      expiresIn: '15m'
    }
  );

  const refreshToken = jwt.sign(
    { 
      user_id: userId, 
      tenant_id: tenantId 
    },
    jwtSecret,
    { 
      expiresIn: '7d'
    }
  );

  return { accessToken, refreshToken };
}

// Refresh token
const refreshToken = async (req, res) => {
  try {
    const { refreshToken } = req.body;
    const jwtSecret = process.env.JWT_SECRET || 'fallback-secret';

    if (!refreshToken) {
      return res.status(401).json({ error: 'Refresh token required' });
    }

    const decoded = jwt.verify(refreshToken, jwtSecret);
    
    // Generate new access token
    const accessToken = jwt.sign(
      { 
        user_id: decoded.user_id, 
        tenant_id: decoded.tenant_id, 
        role: decoded.role 
      },
      jwtSecret,
      { expiresIn: '15m' }
    );

    res.json({ accessToken });
  } catch (error) {
    console.error('Token refresh error:', error);
    res.status(401).json({ error: 'Invalid refresh token' });
  }
};

// Logout
const logout = async (req, res) => {
  // In a real app, you might want to blacklist the token
  res.json({ message: 'Logged out successfully' });
};

module.exports = {
  register,
  login,
  refreshToken,
  logout
};
