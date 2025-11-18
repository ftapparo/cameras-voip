@echo off
echo.
echo 🚀 Iniciando Portaria VoIP com HTTPS...
echo.
echo ⚠️  Importante: Use HTTPS, nao HTTP
echo 📍 Acesse em: https://192.168.0.250:5173
echo.
echo 🔐 Certificado SSL sera gerado automaticamente...
echo.
echo Aguarde...
echo.

npm run dev -- --host 0.0.0.0

pause
