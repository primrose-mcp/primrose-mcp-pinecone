/**
 * Collection Tools
 *
 * MCP tools for Pinecone collection management (Control Plane).
 * Collections are static snapshots of indexes used for backup and to create new indexes.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { PineconeClient } from '../client.js';
import { formatError, formatResponse, formatSuccess } from '../utils/formatters.js';

/**
 * Register all collection-related tools
 */
export function registerCollectionTools(server: McpServer, client: PineconeClient): void {
  // ===========================================================================
  // List Collections
  // ===========================================================================
  server.tool(
    'pinecone_list_collections',
    `List all collections in the project.

Returns an array of collection objects with name, size, status, dimension, and vector count.`,
    {},
    async () => {
      try {
        const collections = await client.listCollections();
        return formatResponse({ collections, count: collections.length });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Create Collection
  // ===========================================================================
  server.tool(
    'pinecone_create_collection',
    `Create a new collection from an existing index.

Args:
  - name: Collection name (1-45 chars, lowercase alphanumeric or hyphens)
  - source: Name of the source index to create collection from

The collection will be a static snapshot of the source index.`,
    {
      name: z.string().min(1).max(45).describe('Collection name'),
      source: z.string().describe('Source index name'),
    },
    async ({ name, source }) => {
      try {
        const collection = await client.createCollection({ name, source });
        return formatSuccess('Collection created successfully', collection);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Describe Collection
  // ===========================================================================
  server.tool(
    'pinecone_describe_collection',
    `Get detailed information about a specific collection.

Args:
  - collectionName: The name of the collection

Returns the collection details including name, size, status, dimension, and vector count.`,
    {
      collectionName: z.string().describe('Collection name'),
    },
    async ({ collectionName }) => {
      try {
        const collection = await client.describeCollection(collectionName);
        return formatResponse(collection);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Delete Collection
  // ===========================================================================
  server.tool(
    'pinecone_delete_collection',
    `Delete a collection.

Args:
  - collectionName: The name of the collection to delete

WARNING: This operation is irreversible.`,
    {
      collectionName: z.string().describe('Collection name to delete'),
    },
    async ({ collectionName }) => {
      try {
        await client.deleteCollection(collectionName);
        return formatSuccess(`Collection '${collectionName}' deleted successfully`);
      } catch (error) {
        return formatError(error);
      }
    }
  );
}
