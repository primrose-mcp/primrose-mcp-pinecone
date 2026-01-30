/**
 * Vector Tools
 *
 * MCP tools for Pinecone vector operations (Data Plane).
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { PineconeClient } from '../client.js';
import type { Vector } from '../types/pinecone.js';
import { formatError, formatResponse, formatSuccess } from '../utils/formatters.js';

/**
 * Register all vector-related tools
 */
export function registerVectorTools(server: McpServer, client: PineconeClient): void {
  // ===========================================================================
  // Upsert Vectors
  // ===========================================================================
  server.tool(
    'pinecone_upsert_vectors',
    `Upsert vectors into an index.

Args:
  - indexName: The name of the index
  - vectors: Array of vectors, each with id, values, and optional metadata
  - namespace: Optional namespace to upsert into

Each vector should have:
  - id: Unique identifier (string)
  - values: Array of numbers (must match index dimension)
  - metadata: Optional key-value pairs

Returns the count of upserted vectors.`,
    {
      indexName: z.string().describe('Index name'),
      vectors: z
        .array(
          z.object({
            id: z.string().describe('Vector ID'),
            values: z.array(z.number()).describe('Vector values'),
            metadata: z.record(z.string(), z.unknown()).optional().describe('Metadata'),
            sparseValues: z
              .object({
                indices: z.array(z.number()),
                values: z.array(z.number()),
              })
              .optional()
              .describe('Sparse values'),
          })
        )
        .min(1)
        .max(1000)
        .describe('Vectors to upsert (max 1000)'),
      namespace: z.string().optional().describe('Target namespace'),
    },
    async ({ indexName, vectors, namespace }) => {
      try {
        const result = await client.upsertVectors(indexName, {
          vectors: vectors as Vector[],
          namespace,
        });
        return formatSuccess(`Upserted ${result.upsertedCount} vectors`, result);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Query Vectors
  // ===========================================================================
  server.tool(
    'pinecone_query_vectors',
    `Query an index for similar vectors.

Args:
  - indexName: The name of the index
  - vector: Query vector (array of numbers)
  - topK: Number of results to return (1-10000)
  - namespace: Optional namespace to query
  - filter: Optional metadata filter
  - includeValues: Include vector values in response
  - includeMetadata: Include metadata in response
  - id: Alternative to vector - query by existing vector ID

Returns matched vectors with scores.`,
    {
      indexName: z.string().describe('Index name'),
      vector: z.array(z.number()).optional().describe('Query vector'),
      id: z.string().optional().describe('Query by vector ID instead of vector values'),
      topK: z.number().int().min(1).max(10000).describe('Number of results'),
      namespace: z.string().optional().describe('Namespace to query'),
      filter: z.record(z.string(), z.unknown()).optional().describe('Metadata filter'),
      includeValues: z.boolean().default(false).describe('Include vector values'),
      includeMetadata: z.boolean().default(true).describe('Include metadata'),
    },
    async ({ indexName, vector, id, topK, namespace, filter, includeValues, includeMetadata }) => {
      try {
        if (!vector && !id) {
          return formatError(new Error('Must provide either vector or id'));
        }

        const result = await client.queryVectors(indexName, {
          vector,
          id,
          topK,
          namespace,
          filter,
          includeValues,
          includeMetadata,
        });

        return formatResponse({
          matches: result.matches,
          namespace: result.namespace,
          matchCount: result.matches.length,
          usage: result.usage,
        });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Fetch Vectors
  // ===========================================================================
  server.tool(
    'pinecone_fetch_vectors',
    `Fetch vectors by their IDs.

Args:
  - indexName: The name of the index
  - ids: Array of vector IDs to fetch
  - namespace: Optional namespace

Returns the requested vectors with their values and metadata.`,
    {
      indexName: z.string().describe('Index name'),
      ids: z.array(z.string()).min(1).describe('Vector IDs to fetch'),
      namespace: z.string().optional().describe('Namespace'),
    },
    async ({ indexName, ids, namespace }) => {
      try {
        const result = await client.fetchVectors(indexName, ids, namespace);
        return formatResponse({
          vectors: result.vectors,
          namespace: result.namespace,
          fetchedCount: Object.keys(result.vectors).length,
          usage: result.usage,
        });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Update Vector
  // ===========================================================================
  server.tool(
    'pinecone_update_vector',
    `Update a vector's values or metadata.

Args:
  - indexName: The name of the index
  - id: The vector ID to update
  - values: New vector values (optional)
  - setMetadata: Metadata to set or update (optional)
  - namespace: Optional namespace

At least one of values or setMetadata must be provided.`,
    {
      indexName: z.string().describe('Index name'),
      id: z.string().describe('Vector ID'),
      values: z.array(z.number()).optional().describe('New vector values'),
      setMetadata: z.record(z.string(), z.unknown()).optional().describe('Metadata to set'),
      namespace: z.string().optional().describe('Namespace'),
    },
    async ({ indexName, id, values, setMetadata, namespace }) => {
      try {
        if (!values && !setMetadata) {
          return formatError(new Error('Must provide either values or setMetadata'));
        }

        await client.updateVector(indexName, {
          id,
          values,
          setMetadata,
          namespace,
        });

        return formatSuccess(`Vector '${id}' updated successfully`);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Delete Vectors
  // ===========================================================================
  server.tool(
    'pinecone_delete_vectors',
    `Delete vectors from an index.

Args:
  - indexName: The name of the index
  - ids: Array of vector IDs to delete (max 1000)
  - deleteAll: Delete all vectors in the namespace
  - filter: Delete vectors matching this metadata filter
  - namespace: Optional namespace

Provide one of: ids, deleteAll, or filter.`,
    {
      indexName: z.string().describe('Index name'),
      ids: z.array(z.string()).max(1000).optional().describe('Vector IDs to delete'),
      deleteAll: z.boolean().optional().describe('Delete all vectors'),
      filter: z.record(z.string(), z.unknown()).optional().describe('Metadata filter'),
      namespace: z.string().optional().describe('Namespace'),
    },
    async ({ indexName, ids, deleteAll, filter, namespace }) => {
      try {
        if (!ids && !deleteAll && !filter) {
          return formatError(new Error('Must provide ids, deleteAll, or filter'));
        }

        await client.deleteVectors(indexName, {
          ids,
          deleteAll,
          filter,
          namespace,
        });

        if (deleteAll) {
          return formatSuccess(`All vectors deleted from namespace '${namespace || 'default'}'`);
        } else if (ids) {
          return formatSuccess(`Deleted ${ids.length} vectors`);
        } else {
          return formatSuccess('Vectors matching filter deleted');
        }
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // List Vector IDs
  // ===========================================================================
  server.tool(
    'pinecone_list_vector_ids',
    `List vector IDs in an index (serverless indexes only).

Args:
  - indexName: The name of the index
  - namespace: Optional namespace
  - prefix: Optional ID prefix to filter by
  - limit: Maximum number of IDs to return (default 100)
  - paginationToken: Token for pagination

Returns a list of vector IDs and pagination info.`,
    {
      indexName: z.string().describe('Index name'),
      namespace: z.string().optional().describe('Namespace'),
      prefix: z.string().optional().describe('ID prefix filter'),
      limit: z.number().int().min(1).max(100).default(100).describe('Max results'),
      paginationToken: z.string().optional().describe('Pagination token'),
    },
    async ({ indexName, namespace, prefix, limit, paginationToken }) => {
      try {
        const result = await client.listVectorIds(indexName, {
          namespace,
          prefix,
          limit,
          paginationToken,
        });

        return formatResponse({
          vectorIds: result.vectors.map((v) => v.id),
          count: result.vectors.length,
          namespace: result.namespace,
          nextToken: result.pagination?.next,
          hasMore: !!result.pagination?.next,
          usage: result.usage,
        });
      } catch (error) {
        return formatError(error);
      }
    }
  );
}
