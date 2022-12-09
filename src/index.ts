import type { Filter, FindOptions, Sort, UpdateFilter, Document } from 'mongodb'

// https://github.com/surmon-china/mongodb-data-api/pull/3/files @maxfi
type Projection = FindOptions['projection']

// https://github.com/surmon-china/mongodb-data-api/pull/4/files @maxfi
type NoInfer<A extends any> = [A][A extends any ? 0 : never]

type AnyKeys<T> = { [P in keyof T]?: T[P] | any }
type Without<T, U> = { [P in Exclude<keyof T, keyof U>]?: never }
type XOR<T, U> = T | U extends object ? (Without<T, U> & U) | (Without<U, T> & T) : T | U

type ExtendBaseParams<T> = BaseParams & T
interface BaseParams {
  dataSource?: string
  database?: string
  collection?: string
  [key: string]: any
}

interface BaseConfig {
  /**
   * Specific Data API key.
   * @link https://www.mongodb.com/docs/atlas/api/data-api/#2.-create-a-data-api-key
   */
  apiKey: string
}

interface UrlEndpointConfig extends BaseConfig {
  /**
   * Specific URL Endpoint.
   * @link https://www.mongodb.com/docs/atlas/api/data-api/#3.-send-a-data-api-request
   */
  urlEndpoint: string
}

interface PackEndpointConfig extends BaseConfig {
  /**
   * Specific Data App ID.
   * @link https://www.mongodb.com/docs/atlas/api/data-api/#3.-send-a-data-api-request
   */
  appId: string
  /**
   * Specific region name of endpoint.
   * @link https://www.mongodb.com/docs/atlas/api/data-api-resources/#regional-requests
   */
  region?: string
  /**
   * Specific cloud provider of endpoint.
   * @link https://www.mongodb.com/docs/atlas/api/data-api-resources/#regional-requests
   */
  cloud?: string
}

export type Config = XOR<UrlEndpointConfig, PackEndpointConfig>

export class MongoDBDataAPI<InnerDoc = Document> {
  #config: Config
  #baseParams: BaseParams

  constructor (config: Config, baseParams?: BaseParams) {
    if (!config.apiKey) {
      throw new Error('Invalid API key!')
    }

    this.#config = config
    this.#baseParams = baseParams || {}
  }

  #newAPI<D> (params: BaseParams) {
    return new MongoDBDataAPI<D>(
      { ...this.#config },
      {
        ...this.#baseParams,
        ...params
      }
    )
  }

  /** Select a cluster. */
  public $cluster (clusterName: string) {
    return this.#newAPI<InnerDoc>({ dataSource: clusterName }) as Omit<
      MongoDBDataAPI<InnerDoc>,
      '$cluster' | '$collection'
    >
  }

  /** Select a database. */
  public $database (database: string) {
    return this.#newAPI<InnerDoc>({ database }) as Omit<
      MongoDBDataAPI<InnerDoc>,
      '$cluster' | '$database'
    >
  }

  /** Select a collection. */
  public $collection<Doc = InnerDoc> (collection: string) {
    return this.#newAPI<Doc>({ collection }) as Omit<
      MongoDBDataAPI<Doc>,
      '$cluster' | '$database' | '$collection'
    >
  }

  /**
   * Execute a API action.
   * @link https://www.mongodb.com/docs/atlas/api/data-api-resources/
   */
  public $$action<Result = unknown> (
    type: string,
    params: BaseParams = {}
  ): Promise<Result> {
    const mergedParams = {
      ...this.#baseParams,
      ...params
    }

    if (!mergedParams.dataSource || !mergedParams.database || !mergedParams.collection) {
      return Promise.reject('Invalid params: dataSource, database, collection')
    }

    // https://www.mongodb.com/docs/atlas/api/data-api-resources/#base-url
    // https://www.mongodb.com/docs/atlas/api/data-api-resources/#regional-requests
    const getUrlEndpoint = (appId: string, region?: string, cloud?: string) => {
      return region && cloud
        ? `https://${region}.${cloud}.data.mongodb-api.com/app/${appId}/endpoint/data/v1`
        : `https://data.mongodb-api.com/app/${appId}/endpoint/data/v1`
    }

    const getActionUrl = (endpoint: string, action: string) => {
      return `${endpoint}/action/${action}`
    }

    return fetch(
      this.#config.urlEndpoint
        ? getActionUrl(this.#config.urlEndpoint, type)
        : getActionUrl(
            getUrlEndpoint(this.#config.appId!, this.#config.region, this.#config.cloud),
            type
          ),
      {
        method: 'post',
        body: JSON.stringify(mergedParams),
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Request-Headers': '*',
          'api-key': this.#config.apiKey
        }
      }
    )
      .then((response: any) => {
        return response.json()
      })
      .catch((error: any) => {
        // https://www.mongodb.com/docs/atlas/api/data-api-resources/#error-codes
        return Promise.reject(error)
      })
  }

  /**
   * Find a Single Document.
   * @link https://www.mongodb.com/docs/atlas/api/data-api-resources/#find-a-single-document
   */
  public findOne<D = InnerDoc, T = NoInfer<D>> (
    params?: ExtendBaseParams<{
      filter?: Filter<T>
      projection?: Projection
    }>
  ) {
    return this.$$action<{ document: D | null }>('findOne', params)
  }

  /**
   * Find Multiple Documents.
   * @link https://www.mongodb.com/docs/atlas/api/data-api-resources/#find-multiple-documents
   */
  public find<D = InnerDoc, T = NoInfer<D>> (
    params?: ExtendBaseParams<{
      filter?: Filter<T>
      projection?: Projection
      sort?: Sort
      limit?: number
      skip?: number
    }>
  ) {
    return this.$$action<{ documents: Array<D> }>('find', params)
  }

  /**
   * Insert a Single Document.
   * @link https://www.mongodb.com/docs/atlas/api/data-api-resources/#insert-a-single-document
   */
  public insertOne<D = InnerDoc, T = NoInfer<D>> (
    params: ExtendBaseParams<{ document: AnyKeys<T> | Document }>
  ) {
    return this.$$action<{ insertedId: string }>('insertOne', params)
  }

  /**
   * Insert Multiple Documents.
   * @link https://www.mongodb.com/docs/atlas/api/data-api-resources/#insert-multiple-documents
   */
  public insertMany<D = InnerDoc, T = NoInfer<D>> (
    params: ExtendBaseParams<{ documents: Array<AnyKeys<T> | Document> }>
  ) {
    return this.$$action<{ insertedIds: Array<string> }>('insertMany', params)
  }

  /**
   * Update a Single Document.
   * @link https://www.mongodb.com/docs/atlas/api/data-api-resources/#update-a-single-document
   */
  public updateOne<D = InnerDoc, T = NoInfer<D>> (
    params: ExtendBaseParams<{
      filter: Filter<T>
      update: UpdateFilter<T>
      upsert?: boolean
    }>
  ) {
    return this.$$action<{
      matchedCount: number
      modifiedCount: number
      upsertedId?: string
    }>('updateOne', params)
  }

  /**
   * Update Multiple Documents.
   * @link https://www.mongodb.com/docs/atlas/api/data-api-resources/#update-multiple-documents
   */
  public updateMany<D = InnerDoc, T = NoInfer<D>> (
    params: ExtendBaseParams<{
      filter: Filter<T>
      update: UpdateFilter<T>
      upsert?: boolean
    }>
  ) {
    return this.$$action<{
      matchedCount: number
      modifiedCount: number
      upsertedId?: string
    }>('updateMany', params)
  }

  /**
   * Replace a Single Document.
   * @link https://www.mongodb.com/docs/atlas/api/data-api-resources/#replace-a-single-document
   */
  public replaceOne<D = InnerDoc, T = NoInfer<D>> (
    params: ExtendBaseParams<{
      filter: Filter<T>
      replacement: any
      upsert?: boolean
    }>
  ) {
    return this.$$action<{
      matchedCount: number
      modifiedCount: number
      upsertedId?: string
    }>('replaceOne', params)
  }

  /**
   * Delete a Single Document.
   * @link https://www.mongodb.com/docs/atlas/api/data-api-resources/#delete-a-single-document
   */
  public deleteOne<D = InnerDoc, T = NoInfer<D>> (
    params: ExtendBaseParams<{ filter: Filter<T> }>
  ) {
    return this.$$action<{ deletedCount: number }>('deleteOne', params)
  }

  /**
   * Delete Multiple Documents.
   * @link https://www.mongodb.com/docs/atlas/api/data-api-resources/#delete-multiple-documents
   */
  public deleteMany<D = InnerDoc, T = NoInfer<D>> (
    params: ExtendBaseParams<{ filter: Filter<T> }>
  ) {
    return this.$$action<{ deletedCount: number }>('deleteMany', params)
  }

  /**
   * Run an Aggregation Pipeline.
   * @link https://www.mongodb.com/docs/atlas/api/data-api-resources/#run-an-aggregation-pipeline
   */
  public aggregate<T extends Array<any>> (
    params: ExtendBaseParams<{ pipeline: Array<Document> }>
  ) {
    return this.$$action<{ documents: T }>('aggregate', params)
  }
}

export const createMongoDBDataAPI = (config: Config) => {
  return new MongoDBDataAPI(config, void 0)
}
