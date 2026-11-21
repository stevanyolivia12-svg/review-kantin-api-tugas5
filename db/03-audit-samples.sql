SET NOCOUNT ON;

-- Daftar/filter/pagination yang ditiru oleh endpoint GET /api/audit-logs.
SELECT TOP (20)
  a.id,
  a.user_id,
  u.name AS user_name,
  u.email AS user_email,
  a.action,
  a.target_table,
  a.target_id,
  a.metadata,
  a.created_at
FROM dbo.AUDIT_LOGS AS a
INNER JOIN dbo.USERS AS u ON u.id = a.user_id
ORDER BY a.created_at DESC, a.id DESC;

-- Verifikasi role dan bentuk metadata login/logout.
SELECT TOP (20)
  id,
  user_id,
  action,
  target_table,
  target_id,
  metadata,
  created_at
FROM dbo.AUDIT_LOGS
WHERE action IN (N'LOGIN', N'LOGOUT')
  AND ISJSON(metadata) = 1
ORDER BY created_at DESC, id DESC;

-- Test append-only: update dan delete no-op harus ditolak trigger.
DECLARE @updateRejected bit = 0;
DECLARE @deleteRejected bit = 0;

BEGIN TRY
  UPDATE dbo.AUDIT_LOGS SET action = action WHERE 1 = 0;
END TRY
BEGIN CATCH
  IF ERROR_NUMBER() = 50010
    SET @updateRejected = 1;
  ELSE
    THROW;
END CATCH;

BEGIN TRY
  DELETE FROM dbo.AUDIT_LOGS WHERE 1 = 0;
END TRY
BEGIN CATCH
  IF ERROR_NUMBER() = 50010
    SET @deleteRejected = 1;
  ELSE
    THROW;
END CATCH;

IF @updateRejected = 0 OR @deleteRejected = 0
  THROW 50011, 'Trigger append-only tidak menolak UPDATE dan DELETE.', 1;

SELECT @updateRejected AS update_rejected, @deleteRejected AS delete_rejected;
