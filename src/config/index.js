require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3000,
  redisUrl: process.env.REDIS_URL || 'redis://127.0.0.1:6379',
  globalRateLimit: parseInt(process.env.GLOBAL_RATE_LIMIT, 10) || 10,
  perDomainRateLimit: parseInt(process.env.PER_DOMAIN_RATE_LIMIT, 10) || 5,
};
