/**
 * Namespace Tools
 *
 * MCP tools for Pinecone namespace management (Data Plane).
 * Namespaces partition vectors within an index.
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { PineconeClient } from '../client.js';
import { formatError, formatResponse, formatSuccess } from '../utils/formatters.js';

/**
 * Register all namespace-related tools
 */
export function registerNamespaceTools(server: McpServer, client: PineconeClient): void {
  // ===========================================================================
  // List Namespaces
  // ===========================================================================
  server.tool(
    'pinecone_list_namespaces',
    `List all namespaces in an index.

Args:
  - indexName: The name of the index

Returns an array of namespaces with their vector counts.`,
    {
      indexName: z.string().describe('Index name'),
    },
    async ({ indexName }) => {
      try {
        const namespaces = await client.listNamespaces(indexName);
        return formatResponse({ namespaces, count: namespaces.length });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Describe Namespace
  // ===========================================================================
  server.tool(
    'pinecone_describe_namespace',
    `Get information about a specific namespace.

Args:
  - indexName: The name of the index
  - namespaceName: The name of the namespace

Returns the namespace details including vector count.`,
    {
      indexName: z.string().describe('Index name'),
      namespaceName: z.string().describe('Namespace name'),
    },
    async ({ indexName, namespaceName }) => {
      try {
        const namespace = await client.describeNamespace(indexName, namespaceName);
        return formatResponse(namespace);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Delete Namespace
  // ===========================================================================
  server.tool(
    'pinecone_delete_namespace',
    `Delete a namespace and all its vectors.

Args:
  - indexName: The name of the index
  - namespaceName: The name of the namespace to delete

WARNING: This will delete all vectors in the namespace.`,
    {
      indexName: z.string().describe('Index name'),
      namespaceName: z.string().describe('Namespace name to delete'),
    },
    async ({ indexName, namespaceName }) => {
      try {
        await client.deleteNamespace(indexName, namespaceName);
        return formatSuccess(`Namespace '${namespaceName}' deleted successfully`);
      } catch (error) {
        return formatError(error);
      }
    }
  );
}
