// src/api/routes/crawl.js

const express = require('express');
const Bull = require('bull');
const config = require('../../config');
const logger = require('../../utils/logger');

const router = express.Router();

// Initialize Bull Queue
const crawlQueue = new Bull('crawlQueue', config.redisUrl);

/**
 * @swagger
 * components:
 *   schemas:
 *     CrawlRequest:
 *       type: object
 *       required:
 *         - url
 *         - recursive
 *         - depth
 *         - rate_limit
 *       properties:
 *         url:
 *           type: string
 *           description: The URL to crawl.
 *         recursive:
 *           type: boolean
 *           description: Whether to crawl links recursively.
 *         depth:
 *           type: integer
 *           description: The depth of recursion.
 *         rate_limit:
 *           type: integer
 *           description: Maximum number of requests per second for this crawl.
 *       example:
 *         url: "https://example.com"
 *         recursive: true
 *         depth: 2
 *         rate_limit: 5
 */

/**
 * @swagger
 * /crawl:
 *   post:
 *     summary: Submit a new crawl request
 *     tags: [Crawl]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             $ref: '#/components/schemas/CrawlRequest'
 *     responses:
 *       202:
 *         description: Crawl request accepted
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 queueId:
 *                   type: string
 *                   description: The ID of the queued crawl job.
 *       400:
 *         description: Invalid request format
 *       500:
 *         description: Internal server error
 */
router.post('/crawl', async (req, res) => {
  const { url, recursive, depth, rate_limit } = req.body;

  // Input Validation
  if (
    !url ||
    typeof recursive !== 'boolean' ||
    typeof depth !== 'number' ||
    (rate_limit && typeof rate_limit !== 'number')
  ) {
    return res.status(400).json({ error: 'Invalid request format.' });
  }

  try {
    // Define Retry Options
    const retryOptions = {
      attempts: 4, // Initial attempt + 3 retries
      backoff: {
        type: 'fixed',
        delay: RETRY_DELAYS[0], // Start with 10 seconds
      },
      removeOnComplete: true,
      removeOnFail: false,
    };

    // Add job to the queue
    const job = await crawlQueue.add(
      {
        url,
        recursive,
        depth,
        rate_limit: rate_limit || config.perDomainRateLimit,
      },
      {
        attempts: retryOptions.attempts,
        backoff: {
          type: 'fixed',
          delay: RETRY_DELAYS[0], // Initial delay
        },
        removeOnComplete: true,
        removeOnFail: false,
      }
    );

    // Set custom retry delays by updating the job options
    // Note: Bull v3 does not support dynamic backoff strategies directly
    // This workaround adjusts the delay for each retry
    crawlQueue.on('failed', async (failedJob, err) => {
      if (failedJob.attemptsMade < RETRY_DELAYS.length + 1) {
        const delay = RETRY_DELAYS[failedJob.attemptsMade - 1] || RETRY_DELAYS[RETRY_DELAYS.length - 1];
        await failedJob.retry().catch((retryErr) => {
          logger.error(`Failed to retry job ${failedJob.id}: ${retryErr.message}`);
        });
        await crawlQueue.delay(failedJob.id, delay);
      }
    });

    // Respond with the job ID as queueId
    res.status(202).json({ queueId: job.id });
  } catch (error) {
    logger.error(`Failed to add job to queue: ${error.message}`);
    res.status(500).json({ error: 'Failed to enqueue crawl request.' });
  }
});

/**
 * @swagger
 * /getQueueResult/{queueId}:
 *   get:
 *     summary: Get crawl results for a specific queue ID
 *     tags: [Crawl]
 *     parameters:
 *       - in: path
 *         name: queueId
 *         schema:
 *           type: string
 *         required: true
 *         description: The ID of the crawl job
 *     responses:
 *       200:
 *         description: Array of crawl results
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 type: object
 *                 properties:
 *                   url:
 *                     type: string
 *                   content:
 *                     type: string
 *                     nullable: true
 *                   error:
 *                     type: boolean
 *       404:
 *         description: Results not found for the given queue ID
 *       500:
 *         description: Internal server error
 */
router.get('/getQueueResult/:queueId', async (req, res) => {
  const { queueId } = req.params;

  try {
    const redis = crawlQueue.client;
    const result = await redis.get(`result:${queueId}`);

    if (!result) {
      return res.status(404).json({ error: 'Results not found or job is still in progress.' });
    }

    res.status(200).json(JSON.parse(result));
  } catch (error) {
    logger.error(`Failed to retrieve results: ${error.message}`);
    res.status(500).json({ error: 'Failed to retrieve crawl results.' });
  }
});

module.exports = router;
