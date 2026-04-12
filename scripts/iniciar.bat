@echo off
cd /d "%~dp0.."
echo Definindo NODE_ENV=development...
set NODE_ENV=development
echo Iniciando servidor na porta 9001...
echo Acesse: http://localhost:9001
npx tsx server/index.ts
