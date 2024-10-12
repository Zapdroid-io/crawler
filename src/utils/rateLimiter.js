const Bottleneck = require('bottleneck');
const config = require('../config');

// Global rate limiter
const globalLimiter = new Bottleneck({
  reservoir: config.globalRateLimit, // initial number of requests
  reservoirRefreshAmount: config.globalRateLimit,
  reservoirRefreshInterval: 1000, // refresh every second
  maxConcurrent: config.globalRateLimit,
});

// Per-domain rate limiters
const domainLimiters = {};

const getDomainLimiter = (domain) => {
  if (!domainLimiters[domain]) {
    domainLimiters[domain] = new Bottleneck({
      reservoir: config.perDomainRateLimit,
      reservoirRefreshAmount: config.perDomainRateLimit,
      reservoirRefreshInterval: 1000,
      maxConcurrent: config.perDomainRateLimit,
    });
  }
  return domainLimiters[domain];
};

module.exports = {
  globalLimiter,
  getDomainLimiter,
};
