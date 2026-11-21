SET NOCOUNT ON;
GO

IF OBJECT_ID(N'dbo.AUDIT_LOGS', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.AUDIT_LOGS (
    id INT IDENTITY(1,1) NOT NULL,
    user_id INT NOT NULL,
    action NVARCHAR(50) NOT NULL,
    target_table NVARCHAR(50) NOT NULL,
    target_id INT NOT NULL,
    metadata NVARCHAR(MAX) NULL,
    created_at DATETIME2 NOT NULL
      CONSTRAINT DF_AUDIT_LOGS_created_at DEFAULT SYSUTCDATETIME(),
    CONSTRAINT PK_AUDIT_LOGS PRIMARY KEY (id),
    CONSTRAINT FK_AUDIT_LOGS_USERS FOREIGN KEY (user_id) REFERENCES dbo.USERS(id)
  );
END;
GO

IF COL_LENGTH(N'dbo.AUDIT_LOGS', N'id') IS NULL
  ALTER TABLE dbo.AUDIT_LOGS ADD id INT IDENTITY(1,1) NOT NULL;
IF COL_LENGTH(N'dbo.AUDIT_LOGS', N'user_id') IS NULL
  ALTER TABLE dbo.AUDIT_LOGS ADD user_id INT NULL;
IF COL_LENGTH(N'dbo.AUDIT_LOGS', N'action') IS NULL
  ALTER TABLE dbo.AUDIT_LOGS ADD action NVARCHAR(50) NULL;
IF COL_LENGTH(N'dbo.AUDIT_LOGS', N'target_table') IS NULL
  ALTER TABLE dbo.AUDIT_LOGS ADD target_table NVARCHAR(50) NULL;
IF COL_LENGTH(N'dbo.AUDIT_LOGS', N'target_id') IS NULL
  ALTER TABLE dbo.AUDIT_LOGS ADD target_id INT NULL;
IF COL_LENGTH(N'dbo.AUDIT_LOGS', N'metadata') IS NULL
  ALTER TABLE dbo.AUDIT_LOGS ADD metadata NVARCHAR(MAX) NULL;
IF COL_LENGTH(N'dbo.AUDIT_LOGS', N'created_at') IS NULL
  ALTER TABLE dbo.AUDIT_LOGS ADD created_at DATETIME2 NULL;
GO

IF EXISTS (
  SELECT 1
  FROM sys.columns
  WHERE object_id = OBJECT_ID(N'dbo.AUDIT_LOGS')
    AND name = N'metadata'
    AND (system_type_id <> TYPE_ID(N'nvarchar') OR max_length <> -1)
)
  ALTER TABLE dbo.AUDIT_LOGS ALTER COLUMN metadata NVARCHAR(MAX) NULL;
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes i
  JOIN sys.index_columns ic
    ON ic.object_id = i.object_id AND ic.index_id = i.index_id
  JOIN sys.columns c
    ON c.object_id = ic.object_id AND c.column_id = ic.column_id
  WHERE i.object_id = OBJECT_ID(N'dbo.AUDIT_LOGS')
    AND i.is_hypothetical = 0
    AND ic.key_ordinal = 1
    AND c.name = N'target_id'
)
  CREATE INDEX IX_AUDIT_LOGS_target_id ON dbo.AUDIT_LOGS(target_id);
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes i
  JOIN sys.index_columns ic
    ON ic.object_id = i.object_id AND ic.index_id = i.index_id
  JOIN sys.columns c
    ON c.object_id = ic.object_id AND c.column_id = ic.column_id
  WHERE i.object_id = OBJECT_ID(N'dbo.AUDIT_LOGS')
    AND i.is_hypothetical = 0
    AND ic.key_ordinal = 1
    AND c.name = N'user_id'
)
  CREATE INDEX IX_AUDIT_LOGS_user_id ON dbo.AUDIT_LOGS(user_id);
GO

IF NOT EXISTS (
  SELECT 1 FROM sys.indexes i
  JOIN sys.index_columns ic
    ON ic.object_id = i.object_id AND ic.index_id = i.index_id
  JOIN sys.columns c
    ON c.object_id = ic.object_id AND c.column_id = ic.column_id
  WHERE i.object_id = OBJECT_ID(N'dbo.AUDIT_LOGS')
    AND i.is_hypothetical = 0
    AND ic.key_ordinal = 1
    AND c.name = N'created_at'
)
  CREATE INDEX IX_AUDIT_LOGS_created_at ON dbo.AUDIT_LOGS(created_at);
GO

CREATE OR ALTER TRIGGER dbo.TR_AUDIT_LOGS_AppendOnly
ON dbo.AUDIT_LOGS
INSTEAD OF UPDATE, DELETE
AS
BEGIN
  SET NOCOUNT ON;
  ;THROW 50010, 'AUDIT_LOGS bersifat append-only.', 1;
END;
GO
