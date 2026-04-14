@echo off
chcp 65001 >nul
setlocal EnableExtensions

set "APP_DIR=C:\Users\Micro\Documents\SalesStoker"
set PYTHONUTF8=1
set PYTHONIOENCODING=utf-8

set DB2_DSN=CISSODBC
set DB2_UID=CONSULTA
set DB2_PWD=qazwsx@123
set DB2_HOST=192.168.1.200
set DATABASE_URL=postgresql://postgres:1234@127.0.0.1:5435/database
set PORT=9001
set SESSION_SECRET=conectubos_secret_2024
set NODE_ENV=development

cd /d "%APP_DIR%"

REM Instala dependencias Node
echo Instalando dependencias Node...
call npm install

REM Instala dependencias Python
echo Instalando dependencias Python...
py -m pip install pyodbc psycopg2-binary python-dotenv --quiet

REM Janela 1 — Servidor web
start "CONECTUBOS - Servidor Web" cmd /k "node_modules\.bin\tsx.cmd server/index.ts"

REM Aguarda o servidor criar as tabelas no banco
echo Aguardando servidor iniciar...
timeout /t 25 /nobreak >nul

REM Janela 2 — Sync DB2
start "CONECTUBOS - Sync DB2" cmd /k ^
  "python sync/bootstrap_historico.py && :loop & python sync/erp_sync.py all & timeout /t 300 /nobreak >nul & goto loop"

endlocal