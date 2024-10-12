# Zapdroid Website Crawler

## Table of Contents
- [Overview](#overview)
- [Features](#features)
- [Getting Started](#getting-started)
  - [Prerequisites](#prerequisites)
  - [Installation](#installation)
  - [Configuration](#configuration)
  - [Running the Application](#running-the-application)
- [API Documentation](#api-documentation)
- [Usage](#usage)
  - [Submitting a Crawl Request](#submitting-a-crawl-request)
  - [Retrieving Crawl Results](#retrieving-crawl-results)
- [Project Structure](#project-structure)
- [Contributing](#contributing)
- [License](#license)
- [Contact](#contact)

## Overview

The **Node.js Multi-Threaded Website Crawler** is an open-source, scalable, and efficient web crawler built with Node.js. It allows users to submit crawl requests via a RESTful API, processes these requests concurrently using multiple worker threads, adheres to `robots.txt` guidelines, implements robust rate limiting and retry mechanisms, and provides comprehensive API documentation through Swagger.

## Features

- **RESTful API**: Submit crawl requests and retrieve results via HTTP endpoints.
- **Multi-Threading**: Leverages multiple CPU cores for concurrent processing.
- **Job Queue Management**: Utilizes Redis and Bull for efficient job queuing and processing.
- **Retry Mechanism**: Implements up to 3 retries with configurable intervals (10s, 20s, 1m) for failed requests.
- **Rate Limiting**: Supports global and per-domain rate limits to prevent server overloads.
- **Robots.txt Compliance**: Respects crawling rules defined in `robots.txt` files.
- **Result Retrieval**: Fetch crawl results using a unique `queueId`.
- **API Documentation**: Comprehensive API specs and interactive UI with Swagger.
- **Logging**: Detailed logging using Winston for monitoring and debugging.
- **Configuration Management**: Easily configurable via environment variables.

1. **API Server (Express.js)**:
   - **Endpoints**:
     - `POST /crawl`: Submit new crawl requests.
     - `GET /getQueueResult/{queueId}`: Retrieve crawl results.
   - **Swagger UI**: Accessible at `/api-docs` for interactive API exploration.

2. **Worker Process**:
   - **Job Processing**: Consumes jobs from the Bull queue.
   - **Crawling Logic**: Fetches URLs, parses content, and extracts links.
   - **Concurrency**: Utilizes multiple threads based on CPU cores.

3. **Redis**:
   - **Bull Queue**: Manages job queuing, processing, and retries.
   - **Result Storage**: Stores crawl results with expiration policies.

4. **Utilities**:
   - **Rate Limiter**: Manages global and per-domain request rates.
   - **Robots Manager**: Handles `robots.txt` fetching and parsing.
   - **Logger**: Centralized logging for all components.

## Getting Started

### Prerequisites

- **Node.js**: Version 14.x or higher
- **Redis**: Version 6.x or higher
- **npm**: Comes with Node.js

### Installation

1. **Clone the Repository**

   ```bash
   git clone git@github.com:Zapdroid-io/crawler.git
   cd crawler
   ```

2. **Install Dependencies**

   ```bash
   npm install
   ```

### Configuration

Create a `.env` file in the root directory to configure environment variables:

```env
# .env

PORT=3000
REDIS_URL=redis://127.0.0.1:6379
GLOBAL_RATE_LIMIT=10         # Requests per second globally
PER_DOMAIN_RATE_LIMIT=5      # Requests per second per domain
```

**Environment Variables:**
- `PORT`: Port on which the API server will run.
- `REDIS_URL`: Connection string for the Redis server.
- `GLOBAL_RATE_LIMIT`: Maximum number of requests per second across all domains.
- `PER_DOMAIN_RATE_LIMIT`: Maximum number of requests per second to a single domain.

### Running the Application

1. **Start Redis Server**

   Ensure Redis is installed and running. If not installed, follow the [Redis Quick Start Guide](https://redis.io/topics/quickstart).

   ```bash
   redis-server
   ```

2. **Start the API Server**

   In a new terminal window, navigate to the project root and run:

   ```bash
   npm start
   ```

   **Output:**
   ```
   YYYY-MM-DDTHH:MM:SS.sssZ [INFO]: API server listening on port 3000
   ```

3. **Start the Worker Process**

   Open another terminal window and run:

   ```bash
   npm run worker
   ```

   **Output:**
   ```
   YYYY-MM-DDTHH:MM:SS.sssZ [INFO]: Job 1 completed.
   ```

## API Documentation

Access the Swagger UI for detailed API documentation and interactive testing:

[http://localhost:3000/api-docs](http://localhost:3000/api-docs)

## Usage

### Submitting a Crawl Request

**Endpoint:**
```bash
POST /crawl
```

**Request Body:**
```json
{
  "url": "https://example.com",
  "recursive": true,
  "depth": 2,
  "rate_limit": 5
}
```

**Parameters:**
- `url` (string, required): The target URL to crawl.
- `recursive` (boolean, required): Whether to crawl links recursively.
- `depth` (integer, required): The depth of recursion.
- `rate_limit` (integer, optional): Maximum number of requests per second for this crawl.

**Example using `curl`:**
```bash
curl -X POST http://localhost:3000/crawl \
  -H "Content-Type: application/json" \
  -d '{
        "url": "https://example.com",
        "recursive": true,
        "depth": 2,
        "rate_limit": 5
      }'
```

**Response:**
```json
{
  "queueId": "1"
}
```

- `queueId` (string): Unique identifier for the crawl job.

### Retrieving Crawl Results

**Endpoint:**
```bash
GET /getQueueResult/{queueId}
```

**Parameters:**
- `queueId` (string, required): The ID of the crawl job.

**Example using `curl`:**
```bash
curl http://localhost:3000/getQueueResult/1
```

**Response:**
```json
[
  {
    "url": "https://example.com",
    "content": "<!doctype html>...",
    "error": false
  },
  {
    "url": "https://example.com/about",
    "content": "<!doctype html>...",
    "error": false
  },
  {
    "url": "https://example.com/contact",
    "content": null,
    "error": true
  }
]
```

- `url` (string): The crawled URL.
- `content` (string|null): The fetched content of the URL. `null` if an error occurred.
- `error` (boolean): Indicates whether an error occurred during fetching.

**Response Codes:**
- `200 OK`: Successfully retrieved crawl results.
- `404 Not Found`: Results not found or job is still in progress.
- `500 Internal Server Error`: An error occurred while retrieving results.

## Project Structure

```
crawler/
├── src/
│   ├── api/
│   │   ├── routes/
│   │   │   └── crawl.js
│   │   ├── swagger.js
│   │   └── server.js
│   ├── worker/
│   │   └── crawler.js
│   ├── config/
│   │   └── index.js
│   ├── utils/
│   │   ├── logger.js
│   │   └── rateLimiter.js
│   └── robots/
│       └── robotsManager.js
├── .env
├── package.json
├── README.md
└── LICENSE
```

- **src/api/**: Contains the API server setup, routes, and Swagger configuration.
- **src/worker/**: Contains the worker process for processing crawl jobs.
- **src/config/**: Manages configuration settings.
- **src/utils/**: Utility modules for logging and rate limiting.
- **src/robots/**: Manages `robots.txt` compliance.
- **.env**: Environment variable configurations.
- **package.json**: Project metadata and dependencies.
- **README.md**: Project documentation.
- **LICENSE**: Licensing information.

## Contributing

Contributions are welcome! Please follow these steps to contribute:

1. **Fork the Repository**

   Click the "Fork" button at the top-right corner of this page.

2. **Clone Your Fork**

   ```bash
   git clone git@github.com:Zapdroid-io/crawler.git
   cd crawler
   ```

3. **Create a New Branch**

   ```bash
   git checkout -b feature/your-feature-name
   ```

4. **Make Your Changes**

   Implement your feature or bug fix.

5. **Commit Your Changes**

   ```bash
   git commit -m "Add feature: your feature description"
   ```

6. **Push to Your Fork**

   ```bash
   git push origin feature/your-feature-name
   ```

7. **Create a Pull Request**

   Navigate to the original repository and click "Compare & pull request".

**Guidelines:**
- Follow the existing code style and conventions.
- Ensure your code is well-documented and tested.
- Update the README.md if necessary.

## License

This project is licensed under the [MIT License](LICENSE).

## Contact

For any questions or suggestions, feel free to reach out:

- **Email**: hi@zapdroid.io
- **GitHub**: [@zapdroid-io](https://github.com/zapdroid-io)
- **Homepage**: [https://zapdroid.io](https://zapdroid.io) (AI agent framework)