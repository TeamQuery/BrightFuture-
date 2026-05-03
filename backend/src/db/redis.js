import { createClient } from 'redis';
import { env } from '../config/env.js';
import { logger } from '../lib/logger.js';

function createMemoryRedisClient() {
  const store = new Map();

  function now() {
    return Date.now();
  }

  function getEntry(key) {
    const entry = store.get(key);

    if (entry?.expiresAt && entry.expiresAt <= now()) {
      store.delete(key);
      return undefined;
    }

    return entry;
  }

  function setEntry(key, type, value) {
    const existing = getEntry(key);
    const expiresAt = existing?.expiresAt;
    store.set(key, { type, value, expiresAt });
  }

  function expire(key, seconds) {
    const entry = getEntry(key);

    if (!entry) {
      return 0;
    }

    entry.expiresAt = now() + seconds * 1000;
    return 1;
  }

  const client = {
    isOpen: false,
    async connect() {
      this.isOpen = true;
      return this;
    },
    async quit() {
      this.isOpen = false;
    },
    async ping() {
      return 'PONG';
    },
    async incr(key) {
      const entry = getEntry(key);
      const nextValue = Number(entry?.value ?? 0) + 1;
      setEntry(key, 'string', String(nextValue));
      return nextValue;
    },
    async expire(key, seconds) {
      return expire(key, seconds);
    },
    async ttl(key) {
      const entry = getEntry(key);

      if (!entry) {
        return -2;
      }

      if (!entry.expiresAt) {
        return -1;
      }

      return Math.max(0, Math.ceil((entry.expiresAt - now()) / 1000));
    },
    async hSet(key, values) {
      const entry = getEntry(key);
      const hash = entry?.type === 'hash' ? { ...entry.value } : {};
      Object.assign(hash, values);
      setEntry(key, 'hash', hash);
      return Object.keys(values).length;
    },
    async hGetAll(key) {
      const entry = getEntry(key);
      return entry?.type === 'hash' ? { ...entry.value } : {};
    },
    async sAdd(key, value) {
      const entry = getEntry(key);
      const set = entry?.type === 'set' ? new Set(entry.value) : new Set();
      const hadValue = set.has(value);
      set.add(value);
      setEntry(key, 'set', set);
      return hadValue ? 0 : 1;
    },
    async sRem(key, value) {
      const entry = getEntry(key);

      if (entry?.type !== 'set') {
        return 0;
      }

      return entry.value.delete(value) ? 1 : 0;
    },
    async sMembers(key) {
      const entry = getEntry(key);
      return entry?.type === 'set' ? Array.from(entry.value) : [];
    },
    async del(key) {
      return store.delete(key) ? 1 : 0;
    },
    async set(key, value, options = {}) {
      store.set(key, {
        type: 'string',
        value,
        expiresAt: options.EX ? now() + options.EX * 1000 : undefined,
      });
      return 'OK';
    },
    async exists(key) {
      return getEntry(key) ? 1 : 0;
    },
    on() {
      return this;
    },
    multi() {
      const commands = [];

      return {
        hSet: (...args) => commands.push(() => client.hSet(...args)),
        expire: (...args) => commands.push(() => client.expire(...args)),
        sAdd: (...args) => commands.push(() => client.sAdd(...args)),
        sRem: (...args) => commands.push(() => client.sRem(...args)),
        del: (...args) => commands.push(() => client.del(...args)),
        async exec() {
          return Promise.all(commands.map((command) => command()));
        },
      };
    },
  };

  return client;
}

const redisClient = env.REDIS_URL.startsWith('memory://')
  ? createMemoryRedisClient()
  : createClient({
      url: env.REDIS_URL,
      socket: {
        reconnectStrategy(retries) {
          return Math.min(retries * 100, 3000);
        },
      },
    });

redisClient.on('error', (error) => {
  logger.error({ error }, 'Redis client error.');
});

let connectPromise;

export async function getRedisClient() {
  if (redisClient.isOpen) {
    return redisClient;
  }

  if (!connectPromise) {
    connectPromise = redisClient.connect().finally(() => {
      if (!redisClient.isOpen) {
        connectPromise = undefined;
      }
    });
  }

  await connectPromise;
  return redisClient;
}

export async function checkRedisHealth() {
  const client = await getRedisClient();
  const startedAt = Date.now();
  const response = await client.ping();

  return {
    status: response === 'PONG' ? 'ok' : 'degraded',
    latencyMs: Date.now() - startedAt,
  };
}

export async function closeRedisClient() {
  if (redisClient.isOpen) {
    await redisClient.quit();
  }
}
