/**
 * Pinecone API Client
 *
 * This file handles all HTTP communication with the Pinecone API.
 *
 * MULTI-TENANT: This client receives credentials per-request via TenantCredentials,
 * allowing a single server to serve multiple tenants with different API keys.
 *
 * Base URLs:
 * - Control Plane: https://api.pinecone.io
 * - Data Plane: https://{index-host} (retrieved from index description)
 * - Inference: https://api.pinecone.io
 */

import type { TenantCredentials } from './types/env.js';
import type {
  BackupModel,
  CollectionModel,
  ConfigureIndexRequest,
  CreateBackupRequest,
  CreateCollectionRequest,
  CreateIndexFromBackupRequest,
  CreateIndexRequest,
  DeleteRequest,
  DescribeIndexStatsRequest,
  DescribeIndexStatsResponse,
  EmbedRequest,
  EmbedResponse,
  FetchResponse,
  ImportModel,
  IndexModel,
  ListBackupsResponse,
  ListCollectionsResponse,
  ListImportsResponse,
  ListIndexesResponse,
  ListModelsResponse,
  ListNamespacesResponse,
  ListRestoreJobsResponse,
  ListVectorsRequest,
  ListVectorsResponse,
  ModelInfo,
  NamespaceModel,
  QueryRequest,
  QueryResponse,
  RerankRequest,
  RerankResponse,
  RestoreJobModel,
  StartImportRequest,
  UpdateRequest,
  UpsertRequest,
  UpsertResponse,
} from './types/pinecone.js';
import { AuthenticationError, PineconeApiError, RateLimitError } from './utils/errors.js';

// =============================================================================
// Configuration
// =============================================================================

const CONTROL_PLANE_URL = 'https://api.pinecone.io';
const API_VERSION = '2025-01';

// =============================================================================
// Pinecone Client Interface
// =============================================================================

export interface PineconeClient {
  // Connection
  testConnection(): Promise<{ connected: boolean; message: string }>;

  // ==========================================================================
  // Index Operations (Control Plane)
  // ==========================================================================
  listIndexes(): Promise<IndexModel[]>;
  createIndex(request: CreateIndexRequest): Promise<IndexModel>;
  describeIndex(indexName: string): Promise<IndexModel>;
  deleteIndex(indexName: string): Promise<void>;
  configureIndex(indexName: string, request: ConfigureIndexRequest): Promise<IndexModel>;

  // ==========================================================================
  // Collection Operations (Control Plane)
  // ==========================================================================
  listCollections(): Promise<CollectionModel[]>;
  createCollection(request: CreateCollectionRequest): Promise<CollectionModel>;
  describeCollection(collectionName: string): Promise<CollectionModel>;
  deleteCollection(collectionName: string): Promise<void>;

  // ==========================================================================
  // Backup Operations (Control Plane)
  // ==========================================================================
  listBackups(indexName?: string): Promise<BackupModel[]>;
  createBackup(indexName: string, request?: CreateBackupRequest): Promise<BackupModel>;
  describeBackup(backupId: string): Promise<BackupModel>;
  deleteBackup(backupId: string): Promise<void>;
  createIndexFromBackup(request: CreateIndexFromBackupRequest): Promise<IndexModel>;

  // ==========================================================================
  // Restore Job Operations (Control Plane)
  // ==========================================================================
  listRestoreJobs(): Promise<RestoreJobModel[]>;
  describeRestoreJob(restoreId: string): Promise<RestoreJobModel>;

  // ==========================================================================
  // Vector Operations (Data Plane)
  // ==========================================================================
  upsertVectors(indexName: string, request: UpsertRequest): Promise<UpsertResponse>;
  queryVectors(indexName: string, request: QueryRequest): Promise<QueryResponse>;
  fetchVectors(indexName: string, ids: string[], namespace?: string): Promise<FetchResponse>;
  updateVector(indexName: string, request: UpdateRequest): Promise<void>;
  deleteVectors(indexName: string, request: DeleteRequest): Promise<void>;
  listVectorIds(indexName: string, request?: ListVectorsRequest): Promise<ListVectorsResponse>;

  // ==========================================================================
  // Index Stats (Data Plane)
  // ==========================================================================
  describeIndexStats(
    indexName: string,
    request?: DescribeIndexStatsRequest
  ): Promise<DescribeIndexStatsResponse>;

  // ==========================================================================
  // Namespace Operations (Data Plane)
  // ==========================================================================
  listNamespaces(indexName: string): Promise<NamespaceModel[]>;
  describeNamespace(indexName: string, namespaceName: string): Promise<NamespaceModel>;
  deleteNamespace(indexName: string, namespaceName: string): Promise<void>;

  // ==========================================================================
  // Import Operations (Data Plane)
  // ==========================================================================
  startImport(indexName: string, request: StartImportRequest): Promise<ImportModel>;
  listImports(indexName: string): Promise<ImportModel[]>;
  describeImport(indexName: string, importId: string): Promise<ImportModel>;
  cancelImport(indexName: string, importId: string): Promise<void>;

  // ==========================================================================
  // Inference Operations
  // ==========================================================================
  generateEmbeddings(request: EmbedRequest): Promise<EmbedResponse>;
  rerankDocuments(request: RerankRequest): Promise<RerankResponse>;
  listModels(): Promise<ModelInfo[]>;
  describeModel(modelName: string): Promise<ModelInfo>;
}

// =============================================================================
// Pinecone Client Implementation
// =============================================================================

class PineconeClientImpl implements PineconeClient {
  private credentials: TenantCredentials;
  private indexHostCache: Map<string, string> = new Map();

  constructor(credentials: TenantCredentials) {
    this.credentials = credentials;
  }

  // ===========================================================================
  // HTTP Request Helpers
  // ===========================================================================

  private getAuthHeaders(): Record<string, string> {
    if (!this.credentials.apiKey) {
      throw new AuthenticationError(
        'No API key provided. Include X-Pinecone-Api-Key header.'
      );
    }

    return {
      'Api-Key': this.credentials.apiKey,
      'Content-Type': 'application/json',
      'X-Pinecone-Api-Version': API_VERSION,
    };
  }

  private async request<T>(
    url: string,
    options: RequestInit = {}
  ): Promise<T> {
    const response = await fetch(url, {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...(options.headers || {}),
      },
    });

    // Handle rate limiting
    if (response.status === 429) {
      const retryAfter = response.headers.get('Retry-After');
      throw new RateLimitError('Rate limit exceeded', retryAfter ? parseInt(retryAfter, 10) : 60);
    }

    // Handle authentication errors
    if (response.status === 401 || response.status === 403) {
      throw new AuthenticationError('Authentication failed. Check your API key.');
    }

    // Handle other errors
    if (!response.ok) {
      const errorBody = await response.text();
      let message = `API error: ${response.status}`;
      try {
        const errorJson = JSON.parse(errorBody);
        message = errorJson.error?.message || errorJson.message || message;
      } catch {
        // Use default message
      }
      throw new PineconeApiError(message, response.status);
    }

    // Handle 202 Accepted (async operations) and 204 No Content
    if (response.status === 202 || response.status === 204) {
      return undefined as T;
    }

    const text = await response.text();
    if (!text) {
      return undefined as T;
    }

    return JSON.parse(text) as T;
  }

  private async controlPlaneRequest<T>(
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    return this.request<T>(`${CONTROL_PLANE_URL}${endpoint}`, options);
  }

  private async getIndexHost(indexName: string): Promise<string> {
    // Check cache first
    const cached = this.indexHostCache.get(indexName);
    if (cached) {
      return cached;
    }

    // Fetch index details to get host
    const index = await this.describeIndex(indexName);
    this.indexHostCache.set(indexName, index.host);
    return index.host;
  }

  private async dataPlaneRequest<T>(
    indexName: string,
    endpoint: string,
    options: RequestInit = {}
  ): Promise<T> {
    const host = await this.getIndexHost(indexName);
    return this.request<T>(`https://${host}${endpoint}`, options);
  }

  // ===========================================================================
  // Connection
  // ===========================================================================

  async testConnection(): Promise<{ connected: boolean; message: string }> {
    try {
      await this.listIndexes();
      return { connected: true, message: 'Successfully connected to Pinecone' };
    } catch (error) {
      return {
        connected: false,
        message: error instanceof Error ? error.message : 'Connection failed',
      };
    }
  }

  // ===========================================================================
  // Index Operations (Control Plane)
  // ===========================================================================

  async listIndexes(): Promise<IndexModel[]> {
    const response = await this.controlPlaneRequest<ListIndexesResponse>('/indexes');
    return response.indexes || [];
  }

  async createIndex(request: CreateIndexRequest): Promise<IndexModel> {
    return this.controlPlaneRequest<IndexModel>('/indexes', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async describeIndex(indexName: string): Promise<IndexModel> {
    return this.controlPlaneRequest<IndexModel>(`/indexes/${encodeURIComponent(indexName)}`);
  }

  async deleteIndex(indexName: string): Promise<void> {
    await this.controlPlaneRequest<void>(`/indexes/${encodeURIComponent(indexName)}`, {
      method: 'DELETE',
    });
    // Clear from cache
    this.indexHostCache.delete(indexName);
  }

  async configureIndex(indexName: string, request: ConfigureIndexRequest): Promise<IndexModel> {
    return this.controlPlaneRequest<IndexModel>(`/indexes/${encodeURIComponent(indexName)}`, {
      method: 'PATCH',
      body: JSON.stringify(request),
    });
  }

  // ===========================================================================
  // Collection Operations (Control Plane)
  // ===========================================================================

  async listCollections(): Promise<CollectionModel[]> {
    const response = await this.controlPlaneRequest<ListCollectionsResponse>('/collections');
    return response.collections || [];
  }

  async createCollection(request: CreateCollectionRequest): Promise<CollectionModel> {
    return this.controlPlaneRequest<CollectionModel>('/collections', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async describeCollection(collectionName: string): Promise<CollectionModel> {
    return this.controlPlaneRequest<CollectionModel>(
      `/collections/${encodeURIComponent(collectionName)}`
    );
  }

  async deleteCollection(collectionName: string): Promise<void> {
    await this.controlPlaneRequest<void>(
      `/collections/${encodeURIComponent(collectionName)}`,
      { method: 'DELETE' }
    );
  }

  // ===========================================================================
  // Backup Operations (Control Plane)
  // ===========================================================================

  async listBackups(indexName?: string): Promise<BackupModel[]> {
    const endpoint = indexName
      ? `/indexes/${encodeURIComponent(indexName)}/backups`
      : '/backups';
    const response = await this.controlPlaneRequest<ListBackupsResponse>(endpoint);
    return response.backups || [];
  }

  async createBackup(indexName: string, request?: CreateBackupRequest): Promise<BackupModel> {
    return this.controlPlaneRequest<BackupModel>(
      `/indexes/${encodeURIComponent(indexName)}/backups`,
      {
        method: 'POST',
        body: JSON.stringify(request || {}),
      }
    );
  }

  async describeBackup(backupId: string): Promise<BackupModel> {
    return this.controlPlaneRequest<BackupModel>(`/backups/${encodeURIComponent(backupId)}`);
  }

  async deleteBackup(backupId: string): Promise<void> {
    await this.controlPlaneRequest<void>(`/backups/${encodeURIComponent(backupId)}`, {
      method: 'DELETE',
    });
  }

  async createIndexFromBackup(request: CreateIndexFromBackupRequest): Promise<IndexModel> {
    return this.controlPlaneRequest<IndexModel>('/indexes/from_backup', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  // ===========================================================================
  // Restore Job Operations (Control Plane)
  // ===========================================================================

  async listRestoreJobs(): Promise<RestoreJobModel[]> {
    const response = await this.controlPlaneRequest<ListRestoreJobsResponse>('/restore_jobs');
    return response.restore_jobs || [];
  }

  async describeRestoreJob(restoreId: string): Promise<RestoreJobModel> {
    return this.controlPlaneRequest<RestoreJobModel>(
      `/restore_jobs/${encodeURIComponent(restoreId)}`
    );
  }

  // ===========================================================================
  // Vector Operations (Data Plane)
  // ===========================================================================

  async upsertVectors(indexName: string, request: UpsertRequest): Promise<UpsertResponse> {
    return this.dataPlaneRequest<UpsertResponse>(indexName, '/vectors/upsert', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async queryVectors(indexName: string, request: QueryRequest): Promise<QueryResponse> {
    return this.dataPlaneRequest<QueryResponse>(indexName, '/query', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async fetchVectors(
    indexName: string,
    ids: string[],
    namespace?: string
  ): Promise<FetchResponse> {
    const params = new URLSearchParams();
    for (const id of ids) {
      params.append('ids', id);
    }
    if (namespace) {
      params.append('namespace', namespace);
    }
    return this.dataPlaneRequest<FetchResponse>(indexName, `/vectors/fetch?${params.toString()}`);
  }

  async updateVector(indexName: string, request: UpdateRequest): Promise<void> {
    await this.dataPlaneRequest<object>(indexName, '/vectors/update', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async deleteVectors(indexName: string, request: DeleteRequest): Promise<void> {
    await this.dataPlaneRequest<object>(indexName, '/vectors/delete', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async listVectorIds(
    indexName: string,
    request?: ListVectorsRequest
  ): Promise<ListVectorsResponse> {
    const params = new URLSearchParams();
    if (request?.namespace) params.append('namespace', request.namespace);
    if (request?.prefix) params.append('prefix', request.prefix);
    if (request?.limit) params.append('limit', String(request.limit));
    if (request?.paginationToken) params.append('paginationToken', request.paginationToken);

    const queryString = params.toString();
    const endpoint = queryString ? `/vectors/list?${queryString}` : '/vectors/list';
    return this.dataPlaneRequest<ListVectorsResponse>(indexName, endpoint);
  }

  // ===========================================================================
  // Index Stats (Data Plane)
  // ===========================================================================

  async describeIndexStats(
    indexName: string,
    request?: DescribeIndexStatsRequest
  ): Promise<DescribeIndexStatsResponse> {
    return this.dataPlaneRequest<DescribeIndexStatsResponse>(indexName, '/describe_index_stats', {
      method: 'POST',
      body: JSON.stringify(request || {}),
    });
  }

  // ===========================================================================
  // Namespace Operations (Data Plane)
  // ===========================================================================

  async listNamespaces(indexName: string): Promise<NamespaceModel[]> {
    const response = await this.dataPlaneRequest<ListNamespacesResponse>(indexName, '/namespaces');
    return response.namespaces || [];
  }

  async describeNamespace(indexName: string, namespaceName: string): Promise<NamespaceModel> {
    return this.dataPlaneRequest<NamespaceModel>(
      indexName,
      `/namespaces/${encodeURIComponent(namespaceName)}`
    );
  }

  async deleteNamespace(indexName: string, namespaceName: string): Promise<void> {
    await this.dataPlaneRequest<void>(
      indexName,
      `/namespaces/${encodeURIComponent(namespaceName)}`,
      { method: 'DELETE' }
    );
  }

  // ===========================================================================
  // Import Operations (Data Plane)
  // ===========================================================================

  async startImport(indexName: string, request: StartImportRequest): Promise<ImportModel> {
    return this.dataPlaneRequest<ImportModel>(indexName, '/bulk/imports', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async listImports(indexName: string): Promise<ImportModel[]> {
    const response = await this.dataPlaneRequest<ListImportsResponse>(indexName, '/bulk/imports');
    return response.imports || [];
  }

  async describeImport(indexName: string, importId: string): Promise<ImportModel> {
    return this.dataPlaneRequest<ImportModel>(
      indexName,
      `/bulk/imports/${encodeURIComponent(importId)}`
    );
  }

  async cancelImport(indexName: string, importId: string): Promise<void> {
    await this.dataPlaneRequest<void>(
      indexName,
      `/bulk/imports/${encodeURIComponent(importId)}/cancel`,
      { method: 'POST' }
    );
  }

  // ===========================================================================
  // Inference Operations
  // ===========================================================================

  async generateEmbeddings(request: EmbedRequest): Promise<EmbedResponse> {
    return this.controlPlaneRequest<EmbedResponse>('/embed', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async rerankDocuments(request: RerankRequest): Promise<RerankResponse> {
    return this.controlPlaneRequest<RerankResponse>('/rerank', {
      method: 'POST',
      body: JSON.stringify(request),
    });
  }

  async listModels(): Promise<ModelInfo[]> {
    const response = await this.controlPlaneRequest<ListModelsResponse>('/models');
    return response.models || [];
  }

  async describeModel(modelName: string): Promise<ModelInfo> {
    return this.controlPlaneRequest<ModelInfo>(`/models/${encodeURIComponent(modelName)}`);
  }
}

// =============================================================================
// Factory Function
// =============================================================================

/**
 * Create a Pinecone client instance with tenant-specific credentials.
 *
 * MULTI-TENANT: Each request provides its own credentials via headers,
 * allowing a single server deployment to serve multiple tenants.
 *
 * @param credentials - Tenant credentials parsed from request headers
 */
export function createPineconeClient(credentials: TenantCredentials): PineconeClient {
  return new PineconeClientImpl(credentials);
}
