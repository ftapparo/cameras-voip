#!/bin/bash

# Script para iniciar a aplicação com HTTPS

echo "🚀 Iniciando Portaria VoIP com HTTPS..."
echo ""
echo "⚠️  Importante: Use HTTPS, não HTTP"
echo "📍 Acesse em: https://192.168.0.250:5173"
echo ""
echo "🔐 Certificado SSL será gerado automaticamente..."
echo ""

npm run dev -- --host 0.0.0.0
