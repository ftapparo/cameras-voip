@echo off
echo.
echo 🚀 Testando Build Completo do Electron v1.3.0
echo.
echo ⚙️  Instalando dependencias...
call npm install

echo.
echo 🔨 Fazendo build do React...
call npm run build

echo.
echo 📦 Empacotando Electron com backend...
call npm run electron:pack

echo.
echo ✅ Build concluido!
echo 📂 Verifique a pasta dist/ para o executavel
echo.
pause