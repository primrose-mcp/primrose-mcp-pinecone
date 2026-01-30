/**
 * Index Tools
 *
 * MCP tools for Pinecone index management (Control Plane).
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { PineconeClient } from '../client.js';
import type { IndexSpec } from '../types/pinecone.js';
import { formatError, formatResponse, formatSuccess } from '../utils/formatters.js';

/**
 * Register all index-related tools
 */
export function registerIndexTools(server: McpServer, client: PineconeClient): void {
  // ===========================================================================
  // List Indexes
  // ===========================================================================
  server.tool(
    'pinecone_list_indexes',
    `List all Pinecone indexes in the project.

Returns an array of index objects with name, dimension, metric, host, spec, and status.`,
    {},
    async () => {
      try {
        const indexes = await client.listIndexes();
        return formatResponse({ indexes, count: indexes.length });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Create Index
  // ===========================================================================
  server.tool(
    'pinecone_create_index',
    `Create a new Pinecone index.

Args:
  - name: Index name (1-45 chars, lowercase alphanumeric or hyphens)
  - dimension: Vector dimension (1-20000)
  - metric: Distance metric (cosine, euclidean, dotproduct). Default: cosine
  - cloud: Cloud provider (aws, gcp, azure) for serverless
  - region: Cloud region for serverless
  - environment: Pod environment (for pod-based indexes)
  - podType: Pod type like p1.x1 (for pod-based indexes)
  - pods: Number of pods (for pod-based indexes)
  - replicas: Number of replicas (for pod-based indexes)
  - deletionProtection: Enable deletion protection (enabled/disabled)

Returns the created index configuration.`,
    {
      name: z.string().min(1).max(45).describe('Index name'),
      dimension: z.number().int().min(1).max(20000).describe('Vector dimension'),
      metric: z
        .enum(['cosine', 'euclidean', 'dotproduct'])
        .default('cosine')
        .describe('Distance metric'),
      // Serverless spec
      cloud: z.enum(['aws', 'gcp', 'azure']).optional().describe('Cloud provider for serverless'),
      region: z.string().optional().describe('Cloud region for serverless'),
      // Pod spec
      environment: z.string().optional().describe('Pod environment'),
      podType: z.string().optional().describe('Pod type (e.g., p1.x1)'),
      pods: z.number().int().min(1).optional().describe('Number of pods'),
      replicas: z.number().int().min(1).optional().describe('Number of replicas'),
      // Common
      deletionProtection: z
        .enum(['enabled', 'disabled'])
        .optional()
        .describe('Deletion protection'),
      tags: z.record(z.string(), z.string()).optional().describe('Custom tags'),
    },
    async ({
      name,
      dimension,
      metric,
      cloud,
      region,
      environment,
      podType,
      pods,
      replicas,
      deletionProtection,
      tags,
    }) => {
      try {
        // Build spec based on provided parameters
        let spec: IndexSpec;

        if (cloud && region) {
          // Serverless spec
          spec = {
            serverless: { cloud, region },
          };
        } else if (environment && podType) {
          // Pod spec
          spec = {
            pod: {
              environment,
              pod_type: podType,
              ...(pods && { pods }),
              ...(replicas && { replicas }),
            },
          };
        } else {
          return formatError(
            new Error(
              'Must provide either (cloud + region) for serverless or (environment + podType) for pod-based index'
            )
          );
        }

        const index = await client.createIndex({
          name,
          dimension,
          metric,
          spec,
          ...(deletionProtection && { deletion_protection: deletionProtection }),
          ...(tags && { tags }),
        });

        return formatSuccess('Index created successfully', index);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Describe Index
  // ===========================================================================
  server.tool(
    'pinecone_describe_index',
    `Get detailed information about a specific index.

Args:
  - indexName: The name of the index

Returns the index configuration including name, dimension, metric, host, spec, and status.`,
    {
      indexName: z.string().describe('Index name'),
    },
    async ({ indexName }) => {
      try {
        const index = await client.describeIndex(indexName);
        return formatResponse(index);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Delete Index
  // ===========================================================================
  server.tool(
    'pinecone_delete_index',
    `Delete a Pinecone index.

Args:
  - indexName: The name of the index to delete

WARNING: This operation is irreversible. All data in the index will be permanently deleted.`,
    {
      indexName: z.string().describe('Index name to delete'),
    },
    async ({ indexName }) => {
      try {
        await client.deleteIndex(indexName);
        return formatSuccess(`Index '${indexName}' deleted successfully`);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Configure Index
  // ===========================================================================
  server.tool(
    'pinecone_configure_index',
    `Update the configuration of an existing index.

Args:
  - indexName: The name of the index to configure
  - replicas: Number of replicas (pod-based indexes only)
  - podType: Pod type (pod-based indexes only)
  - deletionProtection: Enable or disable deletion protection
  - tags: Custom tags to set

Returns the updated index configuration.`,
    {
      indexName: z.string().describe('Index name'),
      replicas: z.number().int().min(1).optional().describe('Number of replicas'),
      podType: z.string().optional().describe('Pod type'),
      deletionProtection: z
        .enum(['enabled', 'disabled'])
        .optional()
        .describe('Deletion protection'),
      tags: z.record(z.string(), z.string()).optional().describe('Custom tags'),
    },
    async ({ indexName, replicas, podType, deletionProtection, tags }) => {
      try {
        const request: {
          spec?: { pod?: { replicas?: number; pod_type?: string } };
          deletion_protection?: 'enabled' | 'disabled';
          tags?: Record<string, string>;
        } = {};

        if (replicas !== undefined || podType !== undefined) {
          request.spec = {
            pod: {
              ...(replicas !== undefined && { replicas }),
              ...(podType !== undefined && { pod_type: podType }),
            },
          };
        }

        if (deletionProtection !== undefined) {
          request.deletion_protection = deletionProtection;
        }

        if (tags !== undefined) {
          request.tags = tags;
        }

        const index = await client.configureIndex(indexName, request);
        return formatSuccess('Index configured successfully', index);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Index Stats
  // ===========================================================================
  server.tool(
    'pinecone_describe_index_stats',
    `Get statistics about an index.

Args:
  - indexName: The name of the index
  - filter: Optional metadata filter to get stats for matching vectors only

Returns dimension, total vector count, index fullness, and per-namespace statistics.`,
    {
      indexName: z.string().describe('Index name'),
      filter: z.record(z.string(), z.unknown()).optional().describe('Metadata filter'),
    },
    async ({ indexName, filter }) => {
      try {
        const stats = await client.describeIndexStats(indexName, filter ? { filter } : undefined);
        return formatResponse(stats);
      } catch (error) {
        return formatError(error);
      }
    }
  );
}
