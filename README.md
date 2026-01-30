# Pinecone MCP Server

[![Primrose MCP](https://img.shields.io/badge/Primrose-MCP-blue)](https://primrose.dev/mcp/pinecone)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

A Model Context Protocol (MCP) server for the Pinecone API. This server enables AI assistants to interact with Pinecone vector databases for similarity search and AI applications.

## Features

- **Indexes** - Create and manage vector indexes
- **Vectors** - Upsert, query, fetch, and delete vectors
- **Collections** - Manage static snapshots of indexes
- **Namespaces** - Organize vectors into namespaces
- **Backups** - Create and restore index backups
- **Imports** - Bulk import data from external sources
- **Inference** - Generate embeddings using Pinecone's inference API

## Quick Start

The easiest way to get started is using the [Primrose SDK](https://github.com/primrose-ai/primrose-mcp):

```bash
npm install primrose-mcp
```

```typescript
import { createMCPClient } from 'primrose-mcp';

const client = createMCPClient('pinecone', {
  headers: {
    'X-Pinecone-Api-Key': 'your-api-key'
  }
});
```

## Manual Installation

Clone and install dependencies:

```bash
git clone https://github.com/primrose-ai/primrose-mcp-pinecone.git
cd primrose-mcp-pinecone
npm install
```

## Configuration

### Required Headers

| Header | Description |
|--------|-------------|
| `X-Pinecone-Api-Key` | Your Pinecone API key |

### Getting Your API Key

1. Log into [Pinecone Console](https://app.pinecone.io)
2. Navigate to API Keys
3. Copy your API key

## Available Tools

### Index Tools
- `pinecone_list_indexes` - List all indexes
- `pinecone_describe_index` - Get index details
- `pinecone_create_index` - Create a new index
- `pinecone_delete_index` - Delete an index
- `pinecone_configure_index` - Update index configuration
- `pinecone_describe_index_stats` - Get index statistics

### Vector Tools
- `pinecone_upsert` - Upsert vectors to an index
- `pinecone_query` - Query vectors by similarity
- `pinecone_fetch` - Fetch vectors by ID
- `pinecone_delete` - Delete vectors
- `pinecone_update` - Update vector metadata

### Collection Tools
- `pinecone_list_collections` - List all collections
- `pinecone_describe_collection` - Get collection details
- `pinecone_create_collection` - Create from index snapshot
- `pinecone_delete_collection` - Delete a collection

### Namespace Tools
- `pinecone_list_namespaces` - List namespaces in an index
- `pinecone_delete_namespace` - Delete a namespace

### Backup Tools
- `pinecone_list_backups` - List index backups
- `pinecone_create_backup` - Create a backup
- `pinecone_delete_backup` - Delete a backup
- `pinecone_restore_backup` - Restore from backup

### Import Tools
- `pinecone_start_import` - Start a bulk import job
- `pinecone_describe_import` - Get import job status
- `pinecone_list_imports` - List import jobs
- `pinecone_cancel_import` - Cancel an import job

### Inference Tools
- `pinecone_embed` - Generate embeddings for text

## Usage Examples

### Creating an Index

```typescript
const result = await client.callTool('pinecone_create_index', {
  name: 'my-index',
  dimension: 1536,
  metric: 'cosine',
  spec: {
    serverless: {
      cloud: 'aws',
      region: 'us-east-1'
    }
  }
});
```

### Upserting Vectors

```typescript
const result = await client.callTool('pinecone_upsert', {
  indexName: 'my-index',
  vectors: [
    {
      id: 'vec1',
      values: [0.1, 0.2, 0.3, ...], // 1536 dimensions
      metadata: { category: 'technology' }
    }
  ]
});
```

### Querying Vectors

```typescript
const result = await client.callTool('pinecone_query', {
  indexName: 'my-index',
  vector: [0.1, 0.2, 0.3, ...],
  topK: 10,
  filter: { category: { $eq: 'technology' } },
  includeMetadata: true
});
```

## Development

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build

# Run tests
npm test

# Type check
npm run typecheck

# Lint
npm run lint
```

## Related Resources

- [Primrose SDK](https://github.com/primrose-ai/primrose-mcp) - Unified SDK for all Primrose MCP servers
- [Pinecone Documentation](https://docs.pinecone.io/)
- [Pinecone API Reference](https://docs.pinecone.io/reference/api/introduction)
- [Model Context Protocol](https://modelcontextprotocol.io/)
