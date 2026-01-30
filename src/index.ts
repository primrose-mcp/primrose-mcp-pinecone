/**
 * Pinecone MCP Server - Main Entry Point
 *
 * This file sets up the MCP server using Cloudflare's Agents SDK.
 * It supports both stateless (McpServer) and stateful (McpAgent) modes.
 *
 * MULTI-TENANT ARCHITECTURE:
 * Tenant credentials (API keys) are parsed from request headers,
 * allowing a single server deployment to serve multiple customers.
 *
 * Required Headers:
 * - X-Pinecone-Api-Key: API key for Pinecone authentication
 */

import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { McpAgent } from 'agents/mcp';
import { createPineconeClient } from './client.js';
import {
  registerBackupTools,
  registerCollectionTools,
  registerImportTools,
  registerIndexTools,
  registerInferenceTools,
  registerNamespaceTools,
  registerVectorTools,
} from './tools/index.js';
import {
  type Env,
  type TenantCredentials,
  parseTenantCredentials,
  validateCredentials,
} from './types/env.js';

// =============================================================================
// MCP Server Configuration
// =============================================================================

const SERVER_NAME = 'primrose-mcp-pinecone';
const SERVER_VERSION = '1.0.0';

// =============================================================================
// MCP Agent (Stateful - uses Durable Objects)
// =============================================================================

/**
 * McpAgent provides stateful MCP sessions backed by Durable Objects.
 *
 * NOTE: For multi-tenant deployments, use the stateless mode (Option 2) instead.
 * The stateful McpAgent is better suited for single-tenant deployments where
 * credentials can be stored as wrangler secrets.
 *
 * @deprecated For multi-tenant support, use stateless mode with per-request credentials
 */
export class PineconeMcpAgent extends McpAgent<Env> {
  server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  async init() {
    // NOTE: Stateful mode requires credentials to be configured differently.
    // For multi-tenant, use the stateless /mcp endpoint with X-Pinecone-Api-Key header instead.
    throw new Error(
      'Stateful mode (McpAgent) is not supported for multi-tenant deployments. ' +
        'Use the stateless /mcp endpoint with X-Pinecone-Api-Key header instead.'
    );
  }
}

// =============================================================================
// Stateless MCP Server (Recommended - no Durable Objects needed)
// =============================================================================

/**
 * Creates a stateless MCP server instance with tenant-specific credentials.
 *
 * MULTI-TENANT: Each request provides credentials via headers, allowing
 * a single server deployment to serve multiple tenants.
 *
 * @param credentials - Tenant credentials parsed from request headers
 */
function createStatelessServer(credentials: TenantCredentials): McpServer {
  const server = new McpServer({
    name: SERVER_NAME,
    version: SERVER_VERSION,
  });

  // Create client with tenant-specific credentials
  const client = createPineconeClient(credentials);

  // Register all tool categories
  registerIndexTools(server, client);
  registerVectorTools(server, client);
  registerCollectionTools(server, client);
  registerNamespaceTools(server, client);
  registerBackupTools(server, client);
  registerImportTools(server, client);
  registerInferenceTools(server, client);

  // Test connection tool
  server.tool(
    'pinecone_test_connection',
    'Test the connection to the Pinecone API',
    {},
    async () => {
      try {
        const result = await client.testConnection();
        return {
          content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
        };
      } catch (error) {
        return {
          content: [
            {
              type: 'text',
              text: `Connection failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            },
          ],
          isError: true,
        };
      }
    }
  );

  return server;
}

// =============================================================================
// Worker Export
// =============================================================================

export default {
  /**
   * Main fetch handler for the Worker
   */
  async fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    // Health check endpoint
    if (url.pathname === '/health') {
      return new Response(JSON.stringify({ status: 'ok', server: SERVER_NAME }), {
        headers: { 'Content-Type': 'application/json' },
      });
    }

    // ==========================================================================
    // Option 1: Stateful MCP with McpAgent (requires Durable Objects)
    // ==========================================================================
    // Uncomment to use McpAgent for stateful sessions:
    //
    // if (url.pathname === '/sse' || url.pathname === '/mcp') {
    //   return PineconeMcpAgent.serveSSE('/sse').fetch(request, env, ctx);
    // }

    // ==========================================================================
    // Option 2: Stateless MCP with Streamable HTTP (Recommended for multi-tenant)
    // ==========================================================================
    if (url.pathname === '/mcp' && request.method === 'POST') {
      // Parse tenant credentials from request headers
      const credentials = parseTenantCredentials(request);

      // Validate credentials are present
      try {
        validateCredentials(credentials);
      } catch (error) {
        return new Response(
          JSON.stringify({
            error: 'Unauthorized',
            message: error instanceof Error ? error.message : 'Invalid credentials',
            required_headers: ['X-Pinecone-Api-Key'],
          }),
          {
            status: 401,
            headers: { 'Content-Type': 'application/json' },
          }
        );
      }

      // Create server with tenant-specific credentials
      const server = createStatelessServer(credentials);

      // Import and use createMcpHandler for streamable HTTP
      // This is the recommended approach for stateless MCP servers
      const { createMcpHandler } = await import('agents/mcp');
      const handler = createMcpHandler(server);
      return handler(request, env, ctx);
    }

    // SSE endpoint for legacy clients
    if (url.pathname === '/sse') {
      // For SSE, we need to use McpAgent with serveSSE
      // Enable Durable Objects in wrangler.jsonc to use this
      return new Response('SSE endpoint requires Durable Objects. Enable in wrangler.jsonc.', {
        status: 501,
      });
    }

    // Default response
    return new Response(
      JSON.stringify({
        name: SERVER_NAME,
        version: SERVER_VERSION,
        description: 'Multi-tenant Pinecone MCP Server',
        endpoints: {
          mcp: '/mcp (POST) - Streamable HTTP MCP endpoint',
          health: '/health - Health check',
        },
        authentication: {
          description: 'Pass tenant credentials via request headers',
          required_headers: {
            'X-Pinecone-Api-Key': 'API key for Pinecone authentication',
          },
        },
        tools: [
          // Index Management
          'pinecone_list_indexes',
          'pinecone_create_index',
          'pinecone_describe_index',
          'pinecone_delete_index',
          'pinecone_configure_index',
          'pinecone_describe_index_stats',
          // Vector Operations
          'pinecone_upsert_vectors',
          'pinecone_query_vectors',
          'pinecone_fetch_vectors',
          'pinecone_update_vector',
          'pinecone_delete_vectors',
          'pinecone_list_vector_ids',
          // Collections
          'pinecone_list_collections',
          'pinecone_create_collection',
          'pinecone_describe_collection',
          'pinecone_delete_collection',
          // Namespaces
          'pinecone_list_namespaces',
          'pinecone_describe_namespace',
          'pinecone_delete_namespace',
          // Backups
          'pinecone_list_backups',
          'pinecone_create_backup',
          'pinecone_describe_backup',
          'pinecone_delete_backup',
          'pinecone_create_index_from_backup',
          'pinecone_list_restore_jobs',
          'pinecone_describe_restore_job',
          // Imports
          'pinecone_start_import',
          'pinecone_list_imports',
          'pinecone_describe_import',
          'pinecone_cancel_import',
          // Inference
          'pinecone_generate_embeddings',
          'pinecone_rerank_documents',
          'pinecone_list_models',
          'pinecone_describe_model',
          // Connection
          'pinecone_test_connection',
        ],
      }),
      {
        headers: { 'Content-Type': 'application/json' },
      }
    );
  },
};
