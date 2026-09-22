import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

export interface ClientOptions {
  baseUrl: string;
  userAgent?: string;
  minIntervalMs?: number; // politeness: gap between requests
  retries?: number;
  cacheDir?: string | null; // null disables the on-disk cache
  cacheTtlMs?: number;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Small polite HTTP client: one request at a time, fixed gap between
// requests, exponential backoff on 429/5xx/network errors, optional disk
// cache so re-running a crawl during development doesn't hit the site.
export class Client {
  private lastRequestAt = 0;
  private queue: Promise<unknown> = Promise.resolve();
  private readonly opts: Required<ClientOptions>;

  constructor(opts: ClientOptions) {
    this.opts = {
      userAgent: "Sport1Crawler/1.0 (+staging; contact: quantd95.developer@gmail.com)",
      minIntervalMs: 1000,
      retries: 3,
      cacheDir: ".cache/crawl",
      cacheTtlMs: 6 * 60 * 60 * 1000,
      ...opts,
    };
  }

  async text(path: string, headers: Record<string, string> = {}): Promise<string> {
    const url = new URL(path, this.opts.baseUrl).toString();
    const cached = this.readCache(url);
    if (cached !== null) return cached;
    // Serialise requests so concurrent callers still respect the interval.
    const run = this.queue.then(() => this.fetchWithRetry(url, headers));
    this.queue = run.catch(() => undefined);
    const body = await run;
    this.writeCache(url, body);
    return body;
  }

  async json<T = unknown>(path: string, headers: Record<string, string> = {}): Promise<T> {
    return JSON.parse(await this.text(path, { Accept: "application/json", ...headers })) as T;
  }

  private async fetchWithRetry(url: string, headers: Record<string, string>): Promise<string> {
    let attempt = 0;
    for (;;) {
      const wait = this.lastRequestAt + this.opts.minIntervalMs - Date.now();
      if (wait > 0) await sleep(wait);
      this.lastRequestAt = Date.now();
      try {
        const res = await fetch(url, {
          headers: { "User-Agent": this.opts.userAgent, "Accept-Language": "vi,en;q=0.8", ...headers },
          signal: AbortSignal.timeout(20_000),
        });
        if (res.ok) return await res.text();
        if (res.status === 404) throw new HttpStatusError(url, 404);
        if ((res.status === 429 || res.status >= 500) && attempt < this.opts.retries) {
          attempt++;
          await sleep(1000 * 2 ** attempt);
          continue;
        }
        throw new HttpStatusError(url, res.status);
      } catch (err) {
        if (err instanceof HttpStatusError) throw err;
        if (attempt >= this.opts.retries) throw err;
        attempt++;
        await sleep(1000 * 2 ** attempt);
      }
    }
  }

  private cachePath(url: string) {
    if (!this.opts.cacheDir) return null;
    return join(this.opts.cacheDir, createHash("sha1").update(url).digest("hex") + ".txt");
  }

  private readCache(url: string): string | null {
    const p = this.cachePath(url);
    if (!p || !existsSync(p)) return null;
    const raw = readFileSync(p, "utf8");
    const nl = raw.indexOf("\n");
    const at = Number(raw.slice(0, nl));
    if (Date.now() - at > this.opts.cacheTtlMs) return null;
    return raw.slice(nl + 1);
  }

  private writeCache(url: string, body: string) {
    const p = this.cachePath(url);
    if (!p || !this.opts.cacheDir) return;
    mkdirSync(this.opts.cacheDir, { recursive: true });
    writeFileSync(p, `${Date.now()}\n${body}`);
  }
}

export class HttpStatusError extends Error {
  constructor(
    public url: string,
    public status: number,
  ) {
    super(`HTTP ${status} for ${url}`);
  }
}
