const RobotsParser = require('robots-parser');
const axios = require('axios');
const url = require('url');
const logger = require('../utils/logger');

const robotsCache = {};

const isAllowed = async (targetUrl) => {
  try {
    const parsedUrl = url.parse(targetUrl);
    const robotsUrl = `${parsedUrl.protocol}//${parsedUrl.host}/robots.txt`;

    if (!robotsCache[parsedUrl.host]) {
      const response = await axios.get(robotsUrl, { timeout: 5000 });
      robotsCache[parsedUrl.host] = RobotsParser(robotsUrl, response.data);
    }

    const parser = robotsCache[parsedUrl.host];
    return parser.isAllowed(targetUrl, 'NodeCrawler');
  } catch (error) {
    // If robots.txt is not found or an error occurs, default to allowed
    logger.warn(`Could not fetch robots.txt for ${targetUrl}: ${error.message}. Defaulting to allowed.`);
    return true;
  }
};

module.exports = {
  isAllowed,
};
