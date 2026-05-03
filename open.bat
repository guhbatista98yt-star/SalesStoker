@echo off
chcp 65001 >nul

setlocal EnableExtensions EnableDelayedExpansion

set "APP_DIR=%~dp0"
if "%APP_DIR:~-1%"=="\" set "APP_DIR=%APP_DIR:~0,-1%"

set "DB2_DSN=CISSODBC"
set "DB2_UID=CONSULTA"
set "DB2_PWD=qazwsx@123"
set "DB2_HOST=192.168.1.200"
set "DATABASE_URL=postgresql://postgres:1234@127.0.0.1:5435/database"
set "PORT=9001"
set "SESSION_SECRET=conectubos_secret_2024"
set "NODE_ENV=development"

cd /d "%APP_DIR%"
if errorlevel 1 (
  echo ERRO: Nao foi possivel acessar o diretorio "%APP_DIR%"
  pause
  exit /b 1
)

echo Diretorio: %APP_DIR%
echo.

echo Instalando dependencias Node...
call npm install
if errorlevel 1 (
  echo ERRO: npm install falhou. Verifique se o Node.js esta instalado.
  pause
  exit /b 1
)

echo.
echo Instalando dependencias Python...
py -m pip install pyodbc psycopg2-binary python-dotenv --quiet 2>nul
if errorlevel 1 (
  echo AVISO: Falha ao instalar dependencias Python. Continuando...
)

echo.
echo Iniciando servidor web na porta %PORT%...
start "CONECTUBOS - Servidor Web" cmd /k "cd /d ""%APP_DIR%"" && node_modules\.bin\tsx.cmd server/index.ts"

echo Aguardando servidor iniciar (25s)...
timeout /t 25 /nobreak >nul

echo.
echo Iniciando Sync DB2...
start "CONECTUBOS - Sync DB2" cmd /k "cd /d ""%APP_DIR%"" && python sync/bootstrap_historico.py && :loop & python sync/erp_sync.py all & timeout /t 300 /nobreak >nul & goto loop"

echo.
echo Sistema iniciado! Acesse: http://localhost:%PORT%
echo.
endlocal
