/**
 * Pinecone API Types
 *
 * Type definitions for Pinecone API requests and responses.
 */

// =============================================================================
// Index Types
// =============================================================================

export interface IndexModel {
  name: string;
  dimension: number;
  metric: 'cosine' | 'euclidean' | 'dotproduct';
  host: string;
  spec: IndexSpec;
  status: IndexStatus;
  deletion_protection?: 'enabled' | 'disabled';
  tags?: Record<string, string>;
}

export interface IndexSpec {
  serverless?: ServerlessSpec;
  pod?: PodSpec;
}

export interface ServerlessSpec {
  cloud: 'aws' | 'gcp' | 'azure';
  region: string;
}

export interface PodSpec {
  environment: string;
  pod_type: string;
  pods?: number;
  replicas?: number;
  shards?: number;
  metadata_config?: MetadataConfig;
  source_collection?: string;
}

export interface MetadataConfig {
  indexed?: string[];
}

export interface IndexStatus {
  ready: boolean;
  state: 'Initializing' | 'ScalingUp' | 'ScalingDown' | 'Terminating' | 'Ready' | 'InitializationFailed';
}

export interface ListIndexesResponse {
  indexes: IndexModel[];
}

export interface CreateIndexRequest {
  name: string;
  dimension: number;
  metric?: 'cosine' | 'euclidean' | 'dotproduct';
  spec: IndexSpec;
  deletion_protection?: 'enabled' | 'disabled';
  tags?: Record<string, string>;
}

export interface ConfigureIndexRequest {
  spec?: {
    pod?: {
      replicas?: number;
      pod_type?: string;
    };
  };
  deletion_protection?: 'enabled' | 'disabled';
  tags?: Record<string, string>;
}

// =============================================================================
// Vector Types
// =============================================================================

export interface Vector {
  id: string;
  values: number[];
  metadata?: Record<string, unknown>;
  sparseValues?: SparseValues;
}

export interface SparseValues {
  indices: number[];
  values: number[];
}

export interface ScoredVector {
  id: string;
  score: number;
  values?: number[];
  metadata?: Record<string, unknown>;
  sparseValues?: SparseValues;
}

export interface UpsertRequest {
  vectors: Vector[];
  namespace?: string;
}

export interface UpsertResponse {
  upsertedCount: number;
}

export interface QueryRequest {
  namespace?: string;
  topK: number;
  vector?: number[];
  id?: string;
  sparseVector?: SparseValues;
  filter?: Record<string, unknown>;
  includeValues?: boolean;
  includeMetadata?: boolean;
}

export interface QueryResponse {
  matches: ScoredVector[];
  namespace: string;
  usage?: Usage;
}

export interface FetchResponse {
  vectors: Record<string, Vector>;
  namespace: string;
  usage?: Usage;
}

export interface UpdateRequest {
  id: string;
  values?: number[];
  sparseValues?: SparseValues;
  setMetadata?: Record<string, unknown>;
  namespace?: string;
}

export interface DeleteRequest {
  ids?: string[];
  deleteAll?: boolean;
  namespace?: string;
  filter?: Record<string, unknown>;
}

export interface ListVectorsRequest {
  namespace?: string;
  prefix?: string;
  limit?: number;
  paginationToken?: string;
}

export interface ListVectorsResponse {
  vectors: { id: string }[];
  pagination?: { next?: string };
  namespace: string;
  usage?: Usage;
}

// =============================================================================
// Index Stats Types
// =============================================================================

export interface DescribeIndexStatsRequest {
  filter?: Record<string, unknown>;
}

export interface DescribeIndexStatsResponse {
  namespaces: Record<string, NamespaceStats>;
  dimension: number;
  indexFullness: number;
  totalVectorCount: number;
}

export interface NamespaceStats {
  vectorCount: number;
}

// =============================================================================
// Collection Types
// =============================================================================

export interface CollectionModel {
  name: string;
  size: number;
  status: 'Initializing' | 'Ready' | 'Terminating';
  dimension: number;
  vector_count: number;
  environment: string;
}

export interface ListCollectionsResponse {
  collections: CollectionModel[];
}

export interface CreateCollectionRequest {
  name: string;
  source: string;
}

// =============================================================================
// Backup Types
// =============================================================================

export interface BackupModel {
  backup_id: string;
  source_index_name: string;
  name?: string;
  description?: string;
  status: 'Initializing' | 'Ready' | 'Failed';
  cloud: string;
  region: string;
  dimension: number;
  metric: string;
  record_count: number;
  namespace_count: number;
  size_bytes: number;
  tags?: Record<string, string>;
  created_at: string;
}

export interface ListBackupsResponse {
  backups: BackupModel[];
  pagination?: { next?: string };
}

export interface CreateBackupRequest {
  name?: string;
  description?: string;
}

export interface CreateIndexFromBackupRequest {
  name: string;
  backup_id: string;
  deletion_protection?: 'enabled' | 'disabled';
  tags?: Record<string, string>;
}

// =============================================================================
// Restore Job Types
// =============================================================================

export interface RestoreJobModel {
  restore_job_id: string;
  backup_id: string;
  target_index_name: string;
  status: 'Pending' | 'Running' | 'Completed' | 'Failed';
  created_at: string;
  completed_at?: string;
  percent_complete?: number;
}

export interface ListRestoreJobsResponse {
  restore_jobs: RestoreJobModel[];
  pagination?: { next?: string };
}

// =============================================================================
// Import Types
// =============================================================================

export interface ImportModel {
  id: string;
  uri: string;
  status: 'Pending' | 'InProgress' | 'Completed' | 'Failed' | 'Cancelled';
  created_at: string;
  finished_at?: string;
  percent_complete?: number;
  records_imported?: number;
  error?: string;
}

export interface StartImportRequest {
  uri: string;
  integration_id?: string;
  error_mode?: {
    on_error?: 'abort' | 'continue';
  };
}

export interface ListImportsResponse {
  imports: ImportModel[];
  pagination?: { next?: string };
}

// =============================================================================
// Namespace Types
// =============================================================================

export interface NamespaceModel {
  name: string;
  vector_count: number;
}

export interface ListNamespacesResponse {
  namespaces: NamespaceModel[];
}

// =============================================================================
// Inference Types
// =============================================================================

export interface EmbedRequest {
  model: string;
  inputs: { text: string }[];
  parameters?: {
    input_type?: 'query' | 'passage';
    truncate?: 'END' | 'NONE';
  };
}

export interface EmbedResponse {
  model: string;
  data: { values: number[] }[];
  usage: { total_tokens: number };
}

export interface RerankRequest {
  model: string;
  query: string;
  documents: Record<string, unknown>[];
  top_n?: number;
  return_documents?: boolean;
  rank_fields?: string[];
  parameters?: Record<string, unknown>;
}

export interface RerankResponse {
  model: string;
  data: {
    index: number;
    score: number;
    document?: Record<string, unknown>;
  }[];
  usage: { rerank_units: number };
}

export interface ModelInfo {
  name: string;
  type: string;
  supported_parameters?: string[];
  vector_type?: string;
  default_dimension?: number;
}

export interface ListModelsResponse {
  models: ModelInfo[];
}

// =============================================================================
// Common Types
// =============================================================================

export interface Usage {
  readUnits?: number;
  writeUnits?: number;
}

export interface ErrorResponse {
  status: number;
  error: {
    code: string;
    message: string;
  };
}
