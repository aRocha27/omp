IF OBJECT_ID(N'dbo.Order_Audit_Trail', N'U') IS NULL
BEGIN
  CREATE TABLE dbo.Order_Audit_Trail (
    ID_Audit bigint IDENTITY(1,1) NOT NULL CONSTRAINT PK_Order_Audit_Trail PRIMARY KEY,
    ID_Order int NULL,
    ID_User nvarchar(100) NULL,
    DT_Audit datetime2 NOT NULL CONSTRAINT DF_Order_Audit_Trail_DT_Audit DEFAULT SYSUTCDATETIME(),
    Action nvarchar(50) NOT NULL,
    Changes nvarchar(max) NULL
  );
END;
