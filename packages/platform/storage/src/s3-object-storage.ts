import {
  DeleteObjectCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  S3ServiceException,
} from '@aws-sdk/client-s3'
import { getSignedUrl } from '@aws-sdk/s3-request-presigner'

import type { ObjectStorage, StoredObject } from './index.js'

export interface S3ObjectStorageOptions {
  readonly endpoint: string
  readonly publicEndpoint: string
  readonly region: string
  readonly bucket: string
  readonly accessKey: string
  readonly secretKey: string
}

function validKey(key: string): void {
  let hasForbiddenCharacter = false
  for (let index = 0; index < key.length; index++) {
    const code = key.charCodeAt(index)
    if (code === 92 || code < 32 || code === 127) {
      hasForbiddenCharacter = true
      break
    }
  }
  if (
    key.length === 0 ||
    key.length > 1024 ||
    key.startsWith('/') ||
    key.split('/').some((segment) => segment === '' || segment === '.' || segment === '..') ||
    hasForbiddenCharacter
  ) {
    throw new Error('Invalid object key')
  }
}

function createClient(options: S3ObjectStorageOptions, endpoint: string): S3Client {
  return new S3Client({
    endpoint,
    region: options.region,
    forcePathStyle: true,
    credentials: { accessKeyId: options.accessKey, secretAccessKey: options.secretKey },
    requestChecksumCalculation: 'WHEN_REQUIRED',
    responseChecksumValidation: 'WHEN_REQUIRED',
  })
}

/** S3-compatible storage adapter. The bucket is provisioned by operations, not at app startup. */
export class S3ObjectStorage implements ObjectStorage {
  private readonly client: S3Client
  private readonly publicClient: S3Client

  constructor(private readonly options: S3ObjectStorageOptions) {
    this.client = createClient(options, options.endpoint)
    this.publicClient =
      options.publicEndpoint === options.endpoint
        ? this.client
        : createClient(options, options.publicEndpoint)
  }

  async put(input: {
    readonly key: string
    readonly body: Uint8Array
    readonly contentType: string
  }): Promise<StoredObject> {
    validKey(input.key)
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.options.bucket,
        Key: input.key,
        Body: input.body,
        ContentType: input.contentType,
      }),
    )
    return { key: input.key, contentType: input.contentType, size: input.body.byteLength }
  }

  async get(key: string): Promise<Uint8Array | null> {
    validKey(key)
    try {
      const result = await this.client.send(
        new GetObjectCommand({ Bucket: this.options.bucket, Key: key }),
      )
      return (await result.Body?.transformToByteArray()) ?? null
    } catch (cause) {
      if (cause instanceof S3ServiceException && cause.$metadata.httpStatusCode === 404) return null
      throw cause
    }
  }

  async delete(key: string): Promise<void> {
    validKey(key)
    await this.client.send(new DeleteObjectCommand({ Bucket: this.options.bucket, Key: key }))
  }

  getSignedUrl(key: string, expiresInSeconds: number): Promise<string> {
    validKey(key)
    if (!Number.isInteger(expiresInSeconds) || expiresInSeconds < 1 || expiresInSeconds > 300) {
      throw new Error('Signed URL lifetime must be between 1 and 300 seconds')
    }
    return getSignedUrl(
      this.publicClient,
      new GetObjectCommand({ Bucket: this.options.bucket, Key: key }),
      { expiresIn: expiresInSeconds },
    )
  }

  dispose(): void {
    this.client.destroy()
    if (this.publicClient !== this.client) this.publicClient.destroy()
  }
}
