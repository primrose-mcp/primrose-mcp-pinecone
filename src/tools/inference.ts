/**
 * Inference Tools
 *
 * MCP tools for Pinecone inference operations (embeddings and reranking).
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { PineconeClient } from '../client.js';
import { formatError, formatResponse } from '../utils/formatters.js';

/**
 * Register all inference-related tools
 */
export function registerInferenceTools(server: McpServer, client: PineconeClient): void {
  // ===========================================================================
  // Generate Embeddings
  // ===========================================================================
  server.tool(
    'pinecone_generate_embeddings',
    `Generate vector embeddings for text inputs.

Args:
  - model: The embedding model to use (e.g., 'multilingual-e5-large', 'llama-text-embed-v2')
  - inputs: Array of text strings to embed
  - inputType: Optional - 'query' or 'passage' for asymmetric models
  - truncate: How to handle long inputs - 'END' (truncate) or 'NONE' (error)

Returns embeddings (arrays of numbers) for each input.`,
    {
      model: z.string().describe('Embedding model name'),
      inputs: z.array(z.string()).min(1).describe('Text inputs to embed'),
      inputType: z.enum(['query', 'passage']).optional().describe('Input type for asymmetric models'),
      truncate: z.enum(['END', 'NONE']).default('END').describe('Truncation handling'),
    },
    async ({ model, inputs, inputType, truncate }) => {
      try {
        const result = await client.generateEmbeddings({
          model,
          inputs: inputs.map((text) => ({ text })),
          parameters: {
            ...(inputType && { input_type: inputType }),
            truncate,
          },
        });

        return formatResponse({
          model: result.model,
          embeddings: result.data.map((d) => d.values),
          count: result.data.length,
          dimension: result.data[0]?.values.length,
          usage: result.usage,
        });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Rerank Documents
  // ===========================================================================
  server.tool(
    'pinecone_rerank_documents',
    `Rerank documents by relevance to a query.

Args:
  - model: The reranking model to use (e.g., 'bge-reranker-v2-m3')
  - query: The query to rank documents against
  - documents: Array of document objects to rerank
  - topN: Number of top results to return (default: all)
  - returnDocuments: Include document content in response (default: true)
  - rankFields: Fields to consider for ranking (default: ['text'])

Returns documents sorted by relevance score.`,
    {
      model: z.string().describe('Reranking model name'),
      query: z.string().describe('Query text'),
      documents: z
        .array(z.record(z.string(), z.unknown()))
        .min(1)
        .describe('Documents to rerank'),
      topN: z.number().int().min(1).optional().describe('Number of top results'),
      returnDocuments: z.boolean().default(true).describe('Include documents in response'),
      rankFields: z.array(z.string()).optional().describe('Fields to rank by'),
    },
    async ({ model, query, documents, topN, returnDocuments, rankFields }) => {
      try {
        const result = await client.rerankDocuments({
          model,
          query,
          documents,
          ...(topN && { top_n: topN }),
          return_documents: returnDocuments,
          ...(rankFields && { rank_fields: rankFields }),
        });

        return formatResponse({
          model: result.model,
          results: result.data,
          count: result.data.length,
          usage: result.usage,
        });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // List Models
  // ===========================================================================
  server.tool(
    'pinecone_list_models',
    `List available inference models.

Returns information about available embedding and reranking models.`,
    {},
    async () => {
      try {
        const models = await client.listModels();
        return formatResponse({ models, count: models.length });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Describe Model
  // ===========================================================================
  server.tool(
    'pinecone_describe_model',
    `Get detailed information about a specific model.

Args:
  - modelName: The name of the model

Returns model details including supported parameters and configuration.`,
    {
      modelName: z.string().describe('Model name'),
    },
    async ({ modelName }) => {
      try {
        const model = await client.describeModel(modelName);
        return formatResponse(model);
      } catch (error) {
        return formatError(error);
      }
    }
  );
}
