IF NOT EXISTS (
  SELECT 1 FROM sys.indexes
  WHERE object_id = OBJECT_ID(N'dbo.Utilizador')
    AND name = N'UX_Utilizador_User_Name'
)
BEGIN
  CREATE UNIQUE INDEX UX_Utilizador_User_Name
    ON dbo.Utilizador(User_Name)
    WHERE User_Name IS NOT NULL;
END;
