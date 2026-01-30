/**
 * Backup Tools
 *
 * MCP tools for Pinecone backup and restore operations (Control Plane).
 */

import type { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { z } from 'zod';
import type { PineconeClient } from '../client.js';
import { formatError, formatResponse, formatSuccess } from '../utils/formatters.js';

/**
 * Register all backup-related tools
 */
export function registerBackupTools(server: McpServer, client: PineconeClient): void {
  // ===========================================================================
  // List Backups
  // ===========================================================================
  server.tool(
    'pinecone_list_backups',
    `List backups in the project.

Args:
  - indexName: Optional - filter backups for a specific index

Returns an array of backup objects with status, metadata, and size information.`,
    {
      indexName: z.string().optional().describe('Filter by index name'),
    },
    async ({ indexName }) => {
      try {
        const backups = await client.listBackups(indexName);
        return formatResponse({ backups, count: backups.length });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Create Backup
  // ===========================================================================
  server.tool(
    'pinecone_create_backup',
    `Create a backup of an index.

Args:
  - indexName: The name of the index to backup
  - name: Optional name for the backup
  - description: Optional description

Returns the backup details.`,
    {
      indexName: z.string().describe('Index name to backup'),
      name: z.string().optional().describe('Backup name'),
      description: z.string().optional().describe('Backup description'),
    },
    async ({ indexName, name, description }) => {
      try {
        const backup = await client.createBackup(indexName, { name, description });
        return formatSuccess('Backup created successfully', backup);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Describe Backup
  // ===========================================================================
  server.tool(
    'pinecone_describe_backup',
    `Get detailed information about a specific backup.

Args:
  - backupId: The backup ID

Returns backup details including status, size, and metadata.`,
    {
      backupId: z.string().describe('Backup ID'),
    },
    async ({ backupId }) => {
      try {
        const backup = await client.describeBackup(backupId);
        return formatResponse(backup);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Delete Backup
  // ===========================================================================
  server.tool(
    'pinecone_delete_backup',
    `Delete a backup.

Args:
  - backupId: The backup ID to delete

WARNING: This operation is irreversible.`,
    {
      backupId: z.string().describe('Backup ID to delete'),
    },
    async ({ backupId }) => {
      try {
        await client.deleteBackup(backupId);
        return formatSuccess(`Backup '${backupId}' deleted successfully`);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Create Index From Backup
  // ===========================================================================
  server.tool(
    'pinecone_create_index_from_backup',
    `Create a new index from a backup.

Args:
  - name: Name for the new index
  - backupId: The backup ID to restore from
  - deletionProtection: Optional deletion protection setting
  - tags: Optional custom tags

Returns the new index configuration.`,
    {
      name: z.string().min(1).max(45).describe('New index name'),
      backupId: z.string().describe('Backup ID to restore from'),
      deletionProtection: z
        .enum(['enabled', 'disabled'])
        .optional()
        .describe('Deletion protection'),
      tags: z.record(z.string(), z.string()).optional().describe('Custom tags'),
    },
    async ({ name, backupId, deletionProtection, tags }) => {
      try {
        const index = await client.createIndexFromBackup({
          name,
          backup_id: backupId,
          ...(deletionProtection && { deletion_protection: deletionProtection }),
          ...(tags && { tags }),
        });
        return formatSuccess('Index created from backup successfully', index);
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // List Restore Jobs
  // ===========================================================================
  server.tool(
    'pinecone_list_restore_jobs',
    `List all restore jobs in the project.

Returns an array of restore job objects with status and progress information.`,
    {},
    async () => {
      try {
        const jobs = await client.listRestoreJobs();
        return formatResponse({ restore_jobs: jobs, count: jobs.length });
      } catch (error) {
        return formatError(error);
      }
    }
  );

  // ===========================================================================
  // Describe Restore Job
  // ===========================================================================
  server.tool(
    'pinecone_describe_restore_job',
    `Get detailed information about a restore job.

Args:
  - restoreId: The restore job ID

Returns restore job details including status and progress.`,
    {
      restoreId: z.string().describe('Restore job ID'),
    },
    async ({ restoreId }) => {
      try {
        const job = await client.describeRestoreJob(restoreId);
        return formatResponse(job);
      } catch (error) {
        return formatError(error);
      }
    }
  );
}
