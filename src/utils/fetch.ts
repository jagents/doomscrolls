// Rate-limited fetch with retry logic and timeout

interface FetchOptions {
  retries?: number;
  baseDelay?: number;
  rateLimit?: number;
  timeout?: number;
}

let lastFetchTime = 0;

async function sleep(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}

async function fetchWithTimeout(url: string, timeout: number): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeout);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    return response;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

export async function rateLimitedFetch(
  url: string,
  options: FetchOptions = {}
): Promise<Response> {
  const {
    retries = 5,
    baseDelay = 2000,
    rateLimit = 300,
    timeout = 30000
  } = options;

  // Rate limiting - enforce minimum delay between requests
  const now = Date.now();
  const timeSinceLastFetch = now - lastFetchTime;
  if (timeSinceLastFetch < rateLimit) {
    await sleep(rateLimit - timeSinceLastFetch);
  }
  lastFetchTime = Date.now();

  // Fetch with retry
  let lastError: Error | null = null;

  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const response = await fetchWithTimeout(url, timeout);

      if (response.ok) {
        return response;
      }

      if (response.status === 404) {
        throw new Error(`Not found: ${url}`);
      }

      if (response.status === 429) {
        // Rate limited, wait longer
        const waitTime = baseDelay * Math.pow(2, attempt + 1);
        console.log(`[Fetch] Rate limited, waiting ${waitTime}ms...`);
        await sleep(waitTime);
        continue;
      }

      // Server error, retry
      if (response.status >= 500) {
        lastError = new Error(`Server error ${response.status}: ${url}`);
        const waitTime = baseDelay * Math.pow(2, attempt);
        console.log(`[Fetch] Server error ${response.status}, retrying in ${waitTime}ms...`);
        await sleep(waitTime);
        continue;
      }

      throw new Error(`HTTP ${response.status}: ${url}`);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));

      // Don't retry 404s
      if (error instanceof Error && error.message.startsWith('Not found')) {
        throw error;
      }

      // Handle abort/timeout
      if (error instanceof Error && error.name === 'AbortError') {
        lastError = new Error(`Timeout after ${timeout}ms: ${url}`);
      }

      if (attempt < retries - 1) {
        const waitTime = baseDelay * Math.pow(2, attempt);
        console.log(`[Fetch] Error, retrying in ${waitTime}ms... (${lastError.message})`);
        await sleep(waitTime);
      }
    }
  }

  throw lastError ?? new Error(`Failed to fetch: ${url}`);
}

export async function fetchJson<T>(url: string, options?: FetchOptions): Promise<T> {
  const response = await rateLimitedFetch(url, options);
  return await response.json() as T;
}

export async function fetchText(url: string, options?: FetchOptions): Promise<string> {
  const response = await rateLimitedFetch(url, options);
  return await response.text();
}
