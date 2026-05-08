@echo off
chcp 65001 >nul
setlocal EnableExtensions

set "APP_DIR=%~dp0"
if "%APP_DIR:~-1%"=="\" set "APP_DIR=%APP_DIR:~0,-1%"

cd /d "%APP_DIR%"
if errorlevel 1 (
  echo ERRO: Nao foi possivel acessar o diretorio "%APP_DIR%"
  pause
  exit /b 1
)

if not exist ".env" (
  echo ERRO: arquivo .env nao encontrado.
  echo Crie o .env a partir do .env.example antes de abrir o sistema.
  pause
  exit /b 1
)

call :load_env ".env"
if "%PORT%"=="" set "PORT=9001"
if "%NODE_ENV%"=="" set "NODE_ENV=development"
if "%PGSSLMODE%"=="" set "PGSSLMODE=disable"

if "%DATABASE_URL%"=="" (
  echo ERRO: DATABASE_URL nao configurada no .env.
  pause
  exit /b 1
)

if "%SESSION_SECRET%"=="" (
  echo ERRO: SESSION_SECRET nao configurada no .env.
  pause
  exit /b 1
)

set "SYNC_ENABLED=1"
if exist "sync\.env" (
  call :load_env "sync\.env"
) else (
  set "SYNC_ENABLED=0"
  echo AVISO: sync\.env nao encontrado. O servidor web abrira, mas o ERP/DB2 nao sera sincronizado.
)

if "%DB2_DSN%"=="" set "SYNC_ENABLED=0"
if "%DB2_UID%"=="" set "SYNC_ENABLED=0"
if "%DB2_PWD%"=="" set "SYNC_ENABLED=0"

echo Diretorio: %APP_DIR%
echo Porta web: %PORT%
echo Ambiente: %NODE_ENV%
echo.

rem Dependencias Node (pula se node_modules ja existe)
if not exist "node_modules\." (
  echo Instalando dependencias Node...
  call npm install
  if errorlevel 1 (
    echo ERRO: npm install falhou. Verifique se o Node.js esta instalado.
    pause
    exit /b 1
  )
  echo.
) else (
  echo Dependencias Node OK.
)

rem Dependencias Python (pula se marker file existe)
if not exist "sync\.pip_ok" (
  echo Instalando dependencias Python...
  py -m pip install pyodbc psycopg2-binary python-dotenv --quiet 2>nul
  if not errorlevel 1 (
    echo ok > "sync\.pip_ok"
    echo Dependencias Python instaladas.
  ) else (
    echo AVISO: Falha ao instalar dependencias Python. Continuando sem bloquear o servidor web.
  )
  echo.
) else (
  echo Dependencias Python OK.
)

echo.
echo Iniciando servidor web na porta %PORT%...
start "CONECTUBOS - Servidor Web" cmd /k "cd /d ""%APP_DIR%"" && node --env-file-if-exists=.env --import tsx/esm server/index.ts"

echo Aguardando servidor iniciar (15s)...
timeout /t 15 /nobreak >nul

if "%SYNC_ENABLED%"=="1" (
  echo.
  echo Iniciando Sync ERP incremental (DB2 -> PostgreSQL, ciclo 180s)...
  start "CONECTUBOS - Sync ERP" cmd /k "cd /d ""%APP_DIR%"" && py sync/erp_sync.py all --loop 180"

  echo Iniciando carga historica (janela separada)...
  if exist "sync\.campanhas_refresh_needed" (
    echo    [campanhas] Reprocessamento forcado solicitado...
    start "CONECTUBOS - Bootstrap Historico" cmd /k "cd /d ""%APP_DIR%"" && py sync/bootstrap_historico.py --rotina campanhas --force && del /f "sync\.campanhas_refresh_needed" && echo. && echo Bootstrap campanhas concluido. Esta janela pode ser fechada."
  ) else (
    start "CONECTUBOS - Bootstrap Historico" cmd /k "cd /d ""%APP_DIR%"" && py sync/bootstrap_historico.py && echo. && echo Bootstrap concluido. Esta janela pode ser fechada."
  )
) else (
  echo.
  echo AVISO: Sync ERP nao iniciado. Configure sync\.env com DB2_DSN, DB2_UID e DB2_PWD para atualizar dados reais.
)

echo.
echo ====================================================
echo   Sistema CONECTUBOS iniciado!
echo   Acesse: http://localhost:%PORT%
echo ====================================================
echo.
echo Este CMD pode ser fechado. A janela [Servidor Web] deve ficar aberta.
if "%SYNC_ENABLED%"=="1" echo A janela [Sync ERP] tambem deve ficar aberta para atualizar dados do ERP.
echo.
pause
endlocal
exit /b 0

:load_env
for /f "usebackq eol=# tokens=1,* delims==" %%A in ("%~1") do (
  if not "%%A"=="" set "%%A=%%B"
)
exit /b 0
