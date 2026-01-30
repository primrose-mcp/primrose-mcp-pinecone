/**
 * Import Tools
 *
 * MCP tools for Pinecone bulk import operations (Data Plane).
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { PineconeClient } from '../client.js';
import { formatError, formatResponse, formatSuccess } from '../utils/formatters.js';

/**
 * Register all import-related tools
 */
export function registerImportTools(server: McpServer, client: PineconeClient): void {
  // ===========================================================================
  // Start Import
  // ===========================================================================
  server.tool(
    'pinecone_start_import',
    `Start a bulk import operation from cloud storage.

Args:
  - indexName: The name of the index to import into
  - uri: The URI of the data to import (e.g., s3://bucket/path/)
  - integrationId: Optional integration ID for cloud storage access
  - errorMode: How to handle errors ('abort' or 'continue')

Returns the import job details.`,
    {
      indexName: z.string().describe('Index name'),
      uri: z.string().describe('Source data URI'),
      integrationId: z.string().optional().describe('Cloud storage integration ID'),
      errorMode: z.enum(['abort', 'continue']).optional().describe('Error handling mode'),
    },
    async ({ indexName, uri, integrationId, errorMode }) => {
      try {
        const importJob = await client.startImport(indexName, {
          uri,
          ...(integrationId && { integration_id: integrationId }),
          ...(errorMode && { error_mode: { on_error: errorMode } }),
        });
        return formatSuccess('Import started successfully', importJob);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // List Imports
  // ===========================================================================
  server.tool(
    'pinecone_list_imports',
    `List all import operations for an index.

Args:
  - indexName: The name of the index

Returns an array of import job objects with status and progress information.`,
    {
      indexName: z.string().describe('Index name'),
    },
    async ({ indexName }) => {
      try {
        const imports = await client.listImports(indexName);
        return formatResponse({ imports, count: imports.length });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Describe Import
  // ===========================================================================
  server.tool(
    'pinecone_describe_import',
    `Get detailed information about an import operation.

Args:
  - indexName: The name of the index
  - importId: The import job ID

Returns import job details including status, progress, and any errors.`,
    {
      indexName: z.string().describe('Index name'),
      importId: z.string().describe('Import job ID'),
    },
    async ({ indexName, importId }) => {
      try {
        const importJob = await client.describeImport(indexName, importId);
        return formatResponse(importJob);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Cancel Import
  // ===========================================================================
  server.tool(
    'pinecone_cancel_import',
    `Cancel a running import operation.

Args:
  - indexName: The name of the index
  - importId: The import job ID to cancel

Note: Vectors already imported before cancellation will remain in the index.`,
    {
      indexName: z.string().describe('Index name'),
      importId: z.string().describe('Import job ID to cancel'),
    },
    async ({ indexName, importId }) => {
      try {
        await client.cancelImport(indexName, importId);
        return formatSuccess(`Import '${importId}' cancelled successfully`);
      } catch (error) {
        return formatError(error);
      }
    }
  );
}
