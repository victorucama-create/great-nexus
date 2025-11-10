import { Request, Response } from 'express';
import { pool } from '../config/database';

export const getProducts = async (req: Request, res: Response) => {
  try {
    const { page = 1, limit = 50, search } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    
    let query = `
      SELECT p.*, c.name as company_name 
      FROM products p 
      JOIN companies c ON p.company_id = c.id 
      WHERE p.tenant_id = $1
    `;
    let countQuery = `SELECT COUNT(*) FROM products WHERE tenant_id = $1`;
    const params: any[] = [req.user.tenant_id];
    
    if (search) {
      query += ` AND (p.name ILIKE $2 OR p.sku ILIKE $2)`;
      countQuery += ` AND (name ILIKE $2 OR sku ILIKE $2)`;
      params.push(`%${search}%`);
    }
    
    query += ` ORDER BY p.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
    params.push(Number(limit), offset);
    
    const [productsResult, countResult] = await Promise.all([
      pool.query(query, params),
      pool.query(countQuery, params.slice(0, search ? 2 : 1))
    ]);
    
    res.json({
      products: productsResult.rows,
      pagination: {
        page: Number(page),
        limit: Number(limit),
        total: parseInt(countResult.rows[0].count),
        pages: Math.ceil(parseInt(countResult.rows[0].count) / Number(limit))
      }
    });
  } catch (error) {
    console.error('Get products error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};

export const createProduct = async (req: Request, res: Response) => {
  try {
    const { company_id, sku, name, price, stock } = req.body;
    
    const result = await pool.query(
      `INSERT INTO products (tenant_id, company_id, sku, name, price, stock) 
       VALUES ($1, $2, $3, $4, $5, $6) 
       RETURNING *`,
      [req.user.tenant_id, company_id, sku, name, price, stock]
    );
    
    res.status(201).json({ product: result.rows[0] });
  } catch (error) {
    console.error('Create product error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
};
