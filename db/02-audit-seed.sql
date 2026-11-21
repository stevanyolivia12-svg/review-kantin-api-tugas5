SET NOCOUNT ON;
GO

-- Data audit baru dibuat lewat backend. Seed ini hanya menambah contoh
-- historis jika entitas yang direferensikan sudah tersedia.
DECLARE @adminId INT =
  (SELECT TOP (1) id FROM dbo.USERS WHERE LOWER(role) = N'admin' ORDER BY id);
DECLARE @customerId INT =
  (SELECT TOP (1) id FROM dbo.USERS WHERE LOWER(role) = N'customer' ORDER BY id);

IF @adminId IS NOT NULL
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM dbo.AUDIT_LOGS
    WHERE action = N'LOGIN'
      AND target_table = N'USERS'
      AND target_id = @adminId
      AND metadata = N'{"role":"admin","result":"success","seed":"02-audit-seed"}'
  )
    INSERT dbo.AUDIT_LOGS (user_id, action, target_table, target_id, metadata)
    VALUES (
      @adminId,
      N'LOGIN',
      N'USERS',
      @adminId,
      N'{"role":"admin","result":"success","seed":"02-audit-seed"}'
    );
END;

IF @customerId IS NOT NULL
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM dbo.AUDIT_LOGS
    WHERE action = N'LOGOUT'
      AND target_table = N'USERS'
      AND target_id = @customerId
      AND metadata = N'{"role":"customer","result":"success","seed":"02-audit-seed"}'
  )
    INSERT dbo.AUDIT_LOGS (user_id, action, target_table, target_id, metadata)
    VALUES (
      @customerId,
      N'LOGOUT',
      N'USERS',
      @customerId,
      N'{"role":"customer","result":"success","seed":"02-audit-seed"}'
    );
END;

SELECT COUNT(*) AS seed_audit_rows
FROM dbo.AUDIT_LOGS
WHERE metadata LIKE N'%02-audit-seed%';
GO
