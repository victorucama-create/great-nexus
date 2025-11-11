const rateLimit = require('express-rate-limit');
const helmet = require('helmet');
const compression = require('compression');
const { validationResult } = require('express-validator');

// Rate Limiting por tipo de usuário
const createRateLimit = (windowMs, max, message) => {
  return rateLimit({
    windowMs,
    max,
    message: { success: false, error: message },
    standardHeaders: true,
    legacyHeaders: false,
    keyGenerator: (req) => {
      return req.user?.id || req.ip;
    }
  });
};

// Limites específicos
const rateLimiters = {
  // Limite geral para usuários não autenticados
  general: createRateLimit(
    15 * 60 * 1000, // 15 minutos
    100, // 100 requests
    'Muitas requisições. Tente novamente em 15 minutos.'
  ),
  
  // Limite para usuários autenticados
  authenticated: createRateLimit(
    15 * 60 * 1000,
    1000,
    'Limite de requisições excedido. Tente novamente em 15 minutos.'
  ),
  
  // Limite mais restritivo para login
  auth: createRateLimit(
    15 * 60 * 1000,
    5,
    'Muitas tentativas de login. Tente novamente em 15 minutos.'
  ),
  
  // Limite para criação de recursos
  create: createRateLimit(
    60 * 60 * 1000, // 1 hora
    50, // 50 criações por hora
    'Limite de criação excedido. Tente novamente em 1 hora.'
  )
};

// Configuração de Segurança com Helmet
const securityHeaders = helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'", "https:"],
      scriptSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'", "https:"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: false,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  }
});

// Validação de dados de entrada
const validateRequest = (validations) => {
  return async (req, res, next) => {
    await Promise.all(validations.map(validation => validation.run(req)));
    
    const errors = validationResult(req);
    if (errors.isEmpty()) {
      return next();
    }
    
    return res.status(400).json({
      success: false,
      error: 'Dados de entrada inválidos',
      details: errors.array()
    });
  };
};

// Sanitização de dados
const sanitizeInput = (req, res, next) => {
  // Sanitizar body
  if (req.body) {
    Object.keys(req.body).forEach(key => {
      if (typeof req.body[key] === 'string') {
        req.body[key] = req.body[key].trim();
        
        // Remover scripts maliciosos
        req.body[key] = req.body[key].replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '');
      }
    });
  }
  
  // Sanitizar query params
  if (req.query) {
    Object.keys(req.query).forEach(key => {
      if (typeof req.query[key] === 'string') {
        req.query[key] = req.query[key].trim();
      }
    });
  }
  
  next();
};

// Compression middleware
const compressionMiddleware = compression({
  level: 6,
  threshold: 100 * 1024 // Comprimir responses > 100KB
});

module.exports = {
  rateLimiters,
  securityHeaders,
  validateRequest,
  sanitizeInput,
  compressionMiddleware
};
