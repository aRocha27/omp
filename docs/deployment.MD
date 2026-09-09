1. Servidor de produção
- Linux/Windows/VPS/Azure/AWS, com Node.js 20+.
- Acesso à rede/VPN onde está o SQL Server (substituir pelo host interno do seu ambiente).
2. Backend
- Copiar server/ para o servidor.
- Criar server/.env com credenciais de produção.
- Usar:
NODE_ENV=production
HOST=127.0.0.1
PORT=4000
CORS_ORIGIN=https://app.teudominio.com
HTTPS_ENFORCED=true
ADMIN_API_TOKEN=<token-forte>
- Executar:
pnpm install --frozen-lockfile
pnpm build
pnpm start
3. Frontend
- Em app/.env:
VITE_DATA_MODE=api
VITE_API_BASE_URL=/api
- Criar o build:
pnpm install --frozen-lockfile
pnpm build
- Servir app/dist através de Nginx, Caddy, IIS ou equivalente.
4. Domínio e HTTPS
- Apontar o domínio para o servidor.
- Configurar certificado HTTPS.
- Encaminhar:
/       -> app/dist
/api    -> http://127.0.0.1:4000
5. Firewall
- Expor apenas 80 e 443.
- Não expor publicamente 4000 nem 1433.
- Permitir SQL apenas entre o servidor de aplicação e o SQL Server.
6. Utilizadores
- Cada pessoa precisa de um registo válido em dbo.Utilizador.
- As credenciais de login da aplicação não são as credenciais SQL.
7. Email
- Só configurar as variáveis SMTP_* se forem necessários emails.
- Usar uma app password nova, nunca a que foi publicada.