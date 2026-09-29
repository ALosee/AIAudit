import { z } from 'zod'

const configSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  HTTP_HOST: z.string().min(1).default('127.0.0.1'),
  HTTP_PORT: z.coerce.number().int().min(1).max(65_535).default(3000),
  HTTP_TRUST_PROXY: z
    .enum(['true', 'false'])
    .default('false')
    .transform((value) => value === 'true'),
  DATABASE_URL: z
    .url()
    .startsWith('postgres')
    .default('postgres://jingwei:jingwei@127.0.0.1:5432/jingwei'),
  APP_ORIGIN: z.url().default('http://localhost:5173'),
  COOKIE_SECURE: z
    .enum(['true', 'false'])
    .transform((value) => value === 'true')
    .optional(),
  BOOTSTRAP_TENANT_CODE: z.string().trim().min(1).max(80).default('default'),
  AUTH_ACCESS_TOKEN_SECONDS: z.coerce.number().int().positive().default(600),
  AUTH_REFRESH_IDLE_SECONDS: z.coerce.number().int().positive().default(1_800),
  AUTH_REFRESH_ABSOLUTE_SECONDS: z.coerce.number().int().positive().default(604_800),
  AUTH_REFRESH_REUSE_GRACE_SECONDS: z.coerce.number().int().min(0).max(30).default(5),
  AUTH_LOGIN_MAX_FAILED_ATTEMPTS: z.coerce.number().int().min(3).max(20).default(5),
  AUTH_LOGIN_LOCK_SECONDS: z.coerce.number().int().min(60).max(86_400).default(900),
  OBJECT_STORAGE_ENDPOINT: z.url().optional(),
  OBJECT_STORAGE_PUBLIC_ENDPOINT: z.url().optional(),
  OBJECT_STORAGE_REGION: z.string().trim().min(1).default('us-east-1'),
  OBJECT_STORAGE_BUCKET: z
    .string()
    .trim()
    .regex(/^[a-z0-9][a-z0-9.-]{1,61}[a-z0-9]$/)
    .optional(),
  OBJECT_STORAGE_ACCESS_KEY: z.string().min(1).optional(),
  OBJECT_STORAGE_SECRET_KEY: z.string().min(1).optional(),
})

export interface ObjectStorageConfig {
  readonly endpoint: string
  readonly publicEndpoint: string
  readonly region: string
  readonly bucket: string
  readonly accessKey: string
  readonly secretKey: string
}

export interface AppConfig {
  readonly environment: 'development' | 'test' | 'production'
  readonly http: {
    readonly host: string
    readonly port: number
    readonly trustProxy: boolean
    readonly secureCookies: boolean
  }
  readonly databaseUrl: string
  readonly appOrigin: string
  readonly bootstrapTenantCode: string
  readonly session: {
    readonly accessSeconds: number
    readonly refreshIdleSeconds: number
    readonly refreshAbsoluteSeconds: number
    readonly refreshReuseGraceSeconds: number
  }
  readonly login: {
    readonly maxFailedAttempts: number
    readonly lockSeconds: number
  }
  readonly objectStorage: ObjectStorageConfig | null
}

/**
 * Parses untrusted environment variables into the immutable application configuration.
 * Call once at the process composition root so invalid values fail before the server listens.
 *
 * @throws {z.ZodError} For missing, malformed, or out-of-range values.
 * @throws {Error} When idle session expiry is not below absolute expiry.
 */
export function loadConfig(environment: NodeJS.ProcessEnv): AppConfig {
  const value = configSchema.parse(environment)
  const secureCookies = value.COOKIE_SECURE ?? new URL(value.APP_ORIGIN).protocol === 'https:'

  if (new URL(value.APP_ORIGIN).protocol === 'https:' && !secureCookies) {
    throw new Error('COOKIE_SECURE must be true when APP_ORIGIN uses HTTPS')
  }

  if (value.AUTH_ACCESS_TOKEN_SECONDS >= value.AUTH_REFRESH_ABSOLUTE_SECONDS) {
    throw new Error('AUTH_ACCESS_TOKEN_SECONDS must be lower than AUTH_REFRESH_ABSOLUTE_SECONDS')
  }
  if (value.AUTH_REFRESH_IDLE_SECONDS >= value.AUTH_REFRESH_ABSOLUTE_SECONDS) {
    throw new Error('AUTH_REFRESH_IDLE_SECONDS must be lower than AUTH_REFRESH_ABSOLUTE_SECONDS')
  }
  if (value.AUTH_ACCESS_TOKEN_SECONDS >= value.AUTH_REFRESH_IDLE_SECONDS) {
    throw new Error('AUTH_ACCESS_TOKEN_SECONDS must be lower than AUTH_REFRESH_IDLE_SECONDS')
  }

  const storageFields = [
    value.OBJECT_STORAGE_ENDPOINT,
    value.OBJECT_STORAGE_BUCKET,
    value.OBJECT_STORAGE_ACCESS_KEY,
    value.OBJECT_STORAGE_SECRET_KEY,
  ]
  if (
    storageFields.some((field) => field !== undefined) &&
    storageFields.some((field) => field === undefined)
  ) {
    throw new Error('Object storage endpoint, bucket and credentials must be configured together')
  }
  if (
    value.OBJECT_STORAGE_PUBLIC_ENDPOINT !== undefined &&
    value.OBJECT_STORAGE_ENDPOINT === undefined
  ) {
    throw new Error('OBJECT_STORAGE_PUBLIC_ENDPOINT requires OBJECT_STORAGE_ENDPOINT')
  }
  const storageEndpoint = value.OBJECT_STORAGE_ENDPOINT
  const storagePublicEndpoint = value.OBJECT_STORAGE_PUBLIC_ENDPOINT ?? storageEndpoint
  const storageBucket = value.OBJECT_STORAGE_BUCKET
  const storageAccessKey = value.OBJECT_STORAGE_ACCESS_KEY
  const storageSecretKey = value.OBJECT_STORAGE_SECRET_KEY
  if (storageEndpoint !== undefined && storagePublicEndpoint !== undefined) {
    for (const endpoint of [storageEndpoint, storagePublicEndpoint]) {
      const protocol = new URL(endpoint).protocol
      if (protocol !== 'http:' && protocol !== 'https:')
        throw new Error('Object storage endpoints must use HTTP or HTTPS')
      if (value.NODE_ENV === 'production' && protocol !== 'https:') {
        throw new Error('Object storage endpoints must use HTTPS in production')
      }
    }
  }

  return Object.freeze({
    environment: value.NODE_ENV,
    http: Object.freeze({
      host: value.HTTP_HOST,
      port: value.HTTP_PORT,
      trustProxy: value.HTTP_TRUST_PROXY,
      secureCookies,
    }),
    databaseUrl: value.DATABASE_URL,
    appOrigin: value.APP_ORIGIN,
    bootstrapTenantCode: value.BOOTSTRAP_TENANT_CODE,
    session: Object.freeze({
      accessSeconds: value.AUTH_ACCESS_TOKEN_SECONDS,
      refreshIdleSeconds: value.AUTH_REFRESH_IDLE_SECONDS,
      refreshAbsoluteSeconds: value.AUTH_REFRESH_ABSOLUTE_SECONDS,
      refreshReuseGraceSeconds: value.AUTH_REFRESH_REUSE_GRACE_SECONDS,
    }),
    login: Object.freeze({
      maxFailedAttempts: value.AUTH_LOGIN_MAX_FAILED_ATTEMPTS,
      lockSeconds: value.AUTH_LOGIN_LOCK_SECONDS,
    }),
    objectStorage:
      storageEndpoint === undefined ||
      storageBucket === undefined ||
      storageAccessKey === undefined ||
      storageSecretKey === undefined
        ? null
        : Object.freeze({
            endpoint: storageEndpoint,
            publicEndpoint: storagePublicEndpoint ?? storageEndpoint,
            region: value.OBJECT_STORAGE_REGION,
            bucket: storageBucket,
            accessKey: storageAccessKey,
            secretKey: storageSecretKey,
          }),
  })
}
