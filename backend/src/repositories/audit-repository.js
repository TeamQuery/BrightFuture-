import pool from '../db/index.js';

function mapAuditRow(row) {
  return {
    id: row.id,
    requestId: row.requestId,
    actorUserId: row.actorUserId,
    targetUserId: row.targetUserId,
    action: row.action,
    resourceType: row.resourceType,
    resourceId: row.resourceId,
    status: row.status,
    ipAddress: row.ipAddress,
    userAgent: row.userAgent,
    metadata: row.metadata,
    createdAt: row.createdAt,
  };
}

export async function insertAuditLog(entry, client = pool) {
  const result = await client.query(
    `
      INSERT INTO audit_logs (
        request_id,
        actor_user_id,
        target_user_id,
        action,
        resource_type,
        resource_id,
        status,
        ip_address,
        user_agent,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8::inet, $9, $10::jsonb)
      RETURNING
        id,
        request_id AS "requestId",
        actor_user_id AS "actorUserId",
        target_user_id AS "targetUserId",
        action,
        resource_type AS "resourceType",
        resource_id AS "resourceId",
        status,
        ip_address::text AS "ipAddress",
        user_agent AS "userAgent",
        metadata,
        created_at AS "createdAt"
    `,
    [
      entry.requestId,
      entry.actorUserId ?? null,
      entry.targetUserId ?? null,
      entry.action,
      entry.resourceType,
      entry.resourceId ?? null,
      entry.status ?? 'success',
      entry.ipAddress ?? null,
      entry.userAgent ?? null,
      JSON.stringify(entry.metadata ?? {}),
    ],
  );

  return mapAuditRow(result.rows[0]);
}

export async function listAuditLogs({ limit = 100, page = 1 } = {}, client = pool) {
  const safeLimit = Math.max(1, Number(limit) || 100);
  const safePage = Math.max(1, Number(page) || 1);
  const offset = (safePage - 1) * safeLimit;

  const result = await client.query(
    `
      SELECT
        id,
        request_id AS "requestId",
        actor_user_id AS "actorUserId",
        target_user_id AS "targetUserId",
        action,
        resource_type AS "resourceType",
        resource_id AS "resourceId",
        status,
        ip_address::text AS "ipAddress",
        user_agent AS "userAgent",
        metadata,
        created_at AS "createdAt"
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT $1 OFFSET $2
    `,
    [safeLimit, offset],
  );
  const countResult = await client.query('SELECT COUNT(*)::int AS total FROM audit_logs');

  const total = countResult.rows[0]?.total || 0;

  return {
    auditLogs: result.rows.map(mapAuditRow),
    pagination: {
      page: safePage,
      limit: safeLimit,
      total,
      totalPages: Math.max(1, Math.ceil(total / safeLimit)),
    },
  };
}

export async function listRecentAuditLogs(limit = 100, client = pool) {
  const result = await client.query(
    `
      SELECT
        id,
        request_id AS "requestId",
        actor_user_id AS "actorUserId",
        target_user_id AS "targetUserId",
        action,
        resource_type AS "resourceType",
        resource_id AS "resourceId",
        status,
        ip_address::text AS "ipAddress",
        user_agent AS "userAgent",
        metadata,
        created_at AS "createdAt"
      FROM audit_logs
      ORDER BY created_at DESC
      LIMIT $1
    `,
    [limit],
  );

  return result.rows.map(mapAuditRow);
}
