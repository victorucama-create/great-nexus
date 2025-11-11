const winston = require('winston');
const path = require('path');

// Definir formatos de log
const logFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json()
);

// Criar logger
const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'info' : 'debug',
  format: logFormat,
  defaultMeta: { service: 'great-nexus-api' },
  transports: [
    // Arquivo de logs de erro
    new winston.transports.File({ 
      filename: path.join(__dirname, '../../logs/error.log'), 
      level: 'error',
      maxsize: 5242880, // 5MB
      maxFiles: 5
    }),
    // Arquivo de logs combinados
    new winston.transports.File({ 
      filename: path.join(__dirname, '../../logs/combined.log'),
      maxsize: 5242880,
      maxFiles: 5
    })
  ]
});

// Em desenvolvimento, adicionar console logging
if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.combine(
      winston.format.colorize(),
      winston.format.simple()
    )
  }));
}

// Middleware de logging para Express
const requestLogger = (req, res, next) => {
  const start = Date.now();
  
  res.on('finish', () => {
    const duration = Date.now() - start;
    
    logger.info('HTTP Request', {
      method: req.method,
      url: req.url,
      status: res.statusCode,
      duration: `${duration}ms`,
      userAgent: req.get('User-Agent'),
      ip: req.ip,
      userId: req.user?.id || 'anonymous'
    });
  });
  
  next();
};

// Logger para automações
const automationLogger = {
  trigger: (ruleId, eventType, success = true) => {
    logger.info('Automation Trigger', {
      ruleId,
      eventType,
      success,
      timestamp: new Date().toISOString()
    });
  },
  
  error: (ruleId, eventType, error) => {
    logger.error('Automation Error', {
      ruleId,
      eventType,
      error: error.message,
      stack: error.stack
    });
  }
};

module.exports = {
  logger,
  requestLogger,
  automationLogger
};
