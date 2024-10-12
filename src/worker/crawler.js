// src/worker/crawler.js

const Bull = require('bull');
const axios = require('axios');
const cheerio = require('cheerio');
const url = require('url');
const { globalLimiter, getDomainLimiter } = require('../utils/rateLimiter');
const logger = require('../utils/logger');
const config = require('../config');
const { isAllowed } = require('../robots/robotsManager');

// Initialize Bull Queue
const crawlQueue = new Bull('crawlQueue', config.redisUrl);

// Define Retry Delays in milliseconds: 10s, 20s, 60s
const RETRY_DELAYS = [10000, 20000, 60000];

/**
 * Function to perform the crawl for a given job.
 * @param {Object} job - The Bull job object containing crawl data.
 * @returns {Array} results - An array of crawl results.
 */
const performCrawl = async (job) => {
  const { url: targetUrl, recursive, depth, queueId, rate_limit } = job.data;
  const visited = new Set();
  const results = [];

  /**
   * Recursive function to crawl URLs up to a specified depth.
   * @param {string} currentUrl - The URL to crawl.
   * @param {number} currentDepth - The current depth of recursion.
   */
  const crawl = async (currentUrl, currentDepth) => {
    if (visited.has(currentUrl) || currentDepth > depth) return;
    visited.add(currentUrl);

    const parsedUrl = url.parse(currentUrl);
    const domain = parsedUrl.host;

    // Respect robots.txt
    const allowed = await isAllowed(currentUrl);
    if (!allowed) {
      logger.info(`Crawling disallowed by robots.txt: ${currentUrl}`);
      results.push({ url: currentUrl, content: null, error: true });
      return;
    }

    // Rate limiting
    await globalLimiter.schedule(() => Promise.resolve());
    const domainLimiter = getDomainLimiter(domain, rate_limit);
    await domainLimiter.schedule(() => Promise.resolve());

    try {
      logger.info(`Fetching URL: ${currentUrl}`);
      const response = await axios.get(currentUrl, { timeout: 10000 });
      results.push({ url: currentUrl, content: response.data, error: false });

      if (recursive && currentDepth < depth) {
        const $ = cheerio.load(response.data);
        const links = $('a[href]')
          .map((i, el) => $(el).attr('href'))
          .get()
          .filter((href) => href.startsWith('http'));

        for (const link of links) {
          await crawl(link, currentDepth + 1);
        }
      }
    } catch (error) {
      logger.error(`Error fetching ${currentUrl}: ${error.message}`);
      results.push({ url: currentUrl, content: null, error: true });
      throw error; // Trigger Bull's retry mechanism
    }
  };

  // Start crawling from the target URL
  await crawl(targetUrl, 0);

  // Save results to Redis with expiration (e.g., 24 hours)
  const redis = crawlQueue.client;
  await redis.set(`result:${queueId}`, JSON.stringify(results), 'EX', 86400);

  return results;
};

// Configure the worker with concurrency based on CPU cores
const NUM_WORKERS = require('os').cpus().length;

// Process jobs with specified concurrency
crawlQueue.process(NUM_WORKERS, async (job) => {
  return performCrawl(job);
});

// Event Listener: Job Completed
crawlQueue.on('completed', (job, result) => {
  logger.info(`Job ${job.id} completed.`);
});

// Event Listener: Job Failed
crawlQueue.on('failed', (job, err) => {
  if (job.attemptsMade < 4) {
    logger.warn(`Job ${job.id} failed on attempt ${job.attemptsMade}. Retrying...`);
  } else {
    logger.error(`Job ${job.id} failed after ${job.attemptsMade} attempts: ${err.message}`);
  }
});

// Event Listener: Global Errors
crawlQueue.on('error', (error) => {
  logger.error(`Bull Queue Error: ${error.message}`);
});
