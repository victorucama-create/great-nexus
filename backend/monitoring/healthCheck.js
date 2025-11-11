const { pool } = require('../config/database');
const { logger } = require('../utils/logger');

class HealthCheckService {
  constructor() {
    this.checks = new Map();
    this.setupChecks();
  }

  setupChecks() {
    // Check de banco de dados
    this.checks.set('database', {
      name: 'PostgreSQL Database',
      critical: true,
      check: this.checkDatabase.bind(this)
    });

    // Check de disco
    this.checks.set('disk', {
      name: 'Disk Space',
      critical: false,
      check: this.checkDiskSpace.bind(this)
    });

    // Check de memória
    this.checks.set('memory', {
      name: 'Memory Usage',
      critical: false,
      check: this.checkMemory.bind(this)
    });
  }

  async checkDatabase() {
    try {
      const start = Date.now();
      await pool.query('SELECT 1');
      const duration = Date.now() - start;

      return {
        status: 'healthy',
        responseTime: `${duration}ms`,
        details: {
          connection: 'established',
          responseTime: duration
        }
      };
    } catch (error) {
      logger.error('Database health check failed', { error: error.message });
      return {
        status: 'unhealthy',
        error: error.message,
        details: {
          connection: 'failed'
        }
      };
    }
  }

  async checkDiskSpace() {
    const checkDiskSpace = require('check-disk-space').default;
    
    try {
      const diskSpace = await checkDiskSpace('/');
      const usagePercent = ((diskSpace.size - diskSpace.free) / diskSpace.size) * 100;

      return {
        status: usagePercent > 90 ? 'warning' : 'healthy',
        details: {
          total: this.formatBytes(diskSpace.size),
          free: this.formatBytes(diskSpace.free),
          used: this.formatBytes(diskSpace.size - diskSpace.free),
          usagePercent: usagePercent.toFixed(2)
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  async checkMemory() {
    const os = require('os');
    
    try {
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usagePercent = ((totalMem - freeMem) / totalMem) * 100;

      return {
        status: usagePercent > 85 ? 'warning' : 'healthy',
        details: {
          total: this.formatBytes(totalMem),
          free: this.formatBytes(freeMem),
          used: this.formatBytes(totalMem - freeMem),
          usagePercent: usagePercent.toFixed(2)
        }
      };
    } catch (error) {
      return {
        status: 'unhealthy',
        error: error.message
      };
    }
  }

  formatBytes(bytes) {
    const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
    if (bytes === 0) return '0 Bytes';
    const i = parseInt(Math.floor(Math.log(bytes) / Math.log(1024)));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
  }

  async runAllChecks() {
    const results = {};
    let allHealthy = true;
    let anyCriticalFailed = false;

    for (const [key, check] of this.checks) {
      try {
        results[key] = await check.check();
        
        if (results[key].status !== 'healthy' && check.critical) {
          anyCriticalFailed = true;
        }
        
        if (results[key].status !== 'healthy') {
          allHealthy = false;
        }
      } catch (error) {
        results[key] = {
          status: 'unhealthy',
          error: error.message
        };
        allHealthy = false;
        
        if (check.critical) {
          anyCriticalFailed = true;
        }
      }
    }

    return {
      status: anyCriticalFailed ? 'critical' : (allHealthy ? 'healthy' : 'degraded'),
      timestamp: new Date().toISOString(),
      checks: results
    };
  }
}

// Métricas de performance
class PerformanceMetrics {
  constructor() {
    this.metrics = {
      requests: {},
      responseTimes: [],
      errors: []
    };
  }

  recordRequest(method, path, statusCode, duration) {
    const key = `${method}:${path}`;
    
    if (!this.metrics.requests[key]) {
      this.metrics.requests[key] = {
        count: 0,
        totalDuration: 0,
        errors: 0
      };
    }

    this.metrics.requests[key].count++;
    this.metrics.requests[key].totalDuration += duration;

    if (statusCode >= 400) {
      this.metrics.requests[key].errors++;
    }

    // Manter apenas as últimas 1000 medições de tempo
    this.metrics.responseTimes.push(duration);
    if (this.metrics.responseTimes.length > 1000) {
      this.metrics.responseTimes.shift();
    }
  }

  recordError(error, context = {}) {
    this.metrics.errors.push({
      timestamp: new Date().toISOString(),
      error: error.message,
      stack: error.stack,
      context
    });

    // Manter apenas os últimos 100 erros
    if (this.metrics.errors.length > 100) {
      this.metrics.errors.shift();
    }
  }

  getMetrics() {
    const avgResponseTime = this.metrics.responseTimes.length > 0 
      ? this.metrics.responseTimes.reduce((a, b) => a + b, 0) / this.metrics.responseTimes.length
      : 0;

    return {
      requests: this.metrics.requests,
      averageResponseTime: avgResponseTime,
      totalRequests: Object.values(this.metrics.requests).reduce((sum, metric) => sum + metric.count, 0),
      errorCount: this.metrics.errors.length,
      timestamp: new Date().toISOString()
    };
  }

  clear() {
    this.metrics = {
      requests: {},
      responseTimes: [],
      errors: []
    };
  }
}

module.exports = {
  HealthCheckService,
  PerformanceMetrics
};
