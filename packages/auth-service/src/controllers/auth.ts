import { Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { pool } from '../config/database';
import { createTenant } from './tenants';

export const register = async (req: Request, res: Response) => {
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

    // Create tenant first
    const tenantResult = await client.query(
      `INSERT INTO tenants (name, country, currency, plan) 
       VALUES ($1, $2, $3, $4) RETURNING id`,
      [companyName, country, currency, 'starter']
    );
    const tenantId = tenantResult.rows[0].id;

    // Create user
    const userResult = await client.query(
      `INSERT INTO users (tenant_id, email, password_hash, name, role) 
       VALUES ($1, $2, $3, $4, $5) RETURNING id, email, name, role`,
      [tenantId, email, passwordHash, name, 'tenant_admin']
    );
    const user = userResult.rows[0];

    // Create default company
    await client.query(
      `INSERT INTO companies (tenant_id, name, currency) 
       VALUES ($1, $2, $3)`,
      [tenantId, companyName, currency]
    );

    await client.query('COMMIT');

    // Generate tokens
    const tokens = generateTokens(user.id, tenantId, user.role);

    res.status(201).json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role
      },
      tenant: {
        id: tenantId,
        name: companyName
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

export const login = async (req: Request, res: Response) => {
  try {
    const { email, password } = req.body;

    // Find user
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

function generateTokens(userId: string, tenantId: string, role: string) {
  const privateKey = process.env.JWT_PRIVATE_KEY!;
  
  const accessToken = jwt.sign(
    { 
      user_id: userId, 
      tenant_id: tenantId, 
      role: role 
    },
    privateKey,
    { 
      algorithm: 'RS256',
      expiresIn: '15m'
    }
  );

  const refreshToken = jwt.sign(
    { 
      user_id: userId, 
      tenant_id: tenantId 
    },
    privateKey,
    { 
      algorithm: 'RS256',
      expiresIn: '7d'
    }
  );

  return { accessToken, refreshToken };
}

export const refreshToken = async (req: Request, res: Response) => {
  // Implementation for token refresh
};

export const logout = async (req: Request, res: Response) => {
  // Implementation for logout
};
