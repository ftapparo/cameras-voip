# Configuração HTTPS para Portaria VoIP

## 🔐 Por que HTTPS é necessário?

Os navegadores modernos **bloqueiam permissões de câmera, microfone e som em conexões HTTP inseguras**. Para acessar via IP (192.168.0.250), você **precisa usar HTTPS**.

## ✅ Como usar com HTTPS

### Opção 1: Modo Desenvolvimento (npm run dev)

1. **Inicie o servidor dev com HTTPS:**
```bash
npm run dev
```

2. **O Vite gerará certificados SSL automaticamente** na primeira execução

3. **Acesse via HTTPS:**
```
https://192.168.0.250:5173
```

4. **Aceite o aviso de certificado:**
   - Clique em "Avançado" ou "Mais Informações"
   - Clique em "Continuar de qualquer forma" ou "Prosseguir"

### Opção 2: Modo Produção (npm run preview)

1. **Faça o build:**
```bash
npm run build
```

2. **Inicie o preview:**
```bash
npm run preview
```

3. **Acesse via HTTPS:**
```
https://192.168.0.250:4173
```

## 🛡️ Certificado SSL Self-Signed

O certificado é gerado automaticamente pela dependência `@vitejs/plugin-basic-ssl`.

### Arquivos gerados:
- `certs/key.pem` - Chave privada
- `certs/cert.pem` - Certificado

### ⚠️ Aviso de Segurança:

É normal ver um aviso do navegador dizendo "Sua conexão não é privada" porque o certificado é **self-signed** (não é de uma autoridade certificadora confiável).

**Isto é SEGURO para uso local/interno.** O certificado apenas **encripta a conexão**, não verifica identidade.

## 📱 Permissões do Navegador

Quando abrir a aplicação, será solicitado permissão para:

1. **Câmera** 📷 - Para transmissão de vídeo
2. **Microfone** 🎤 - Para captura de áudio
3. **Som** 🔊 - Para reprodução de áudio

### Se as permissões forem bloqueadas:

1. Clique no **ícone de cadeado** na barra de endereço
2. Procure por "Câmera" e "Microfone"
3. Altere para "Permitir"
4. Recarregue a página (F5)

## 🌐 Acessar de Outros Dispositivos

Uma vez que o servidor está rodando:

```
https://192.168.0.250:5173  (desenvolvimento)
https://192.168.0.250:4173  (produção)
```

**Do mesmo IP em browsers diferentes:**
- Chrome, Firefox, Safari, Edge funcionarão

**De diferentes IPs/dispositivos:**
- Certifique-se que o IP 192.168.0.250 é acessível na rede

## 🔧 Troubleshooting

### "Não consigo acessar em HTTPS"

1. Verifique se o servidor está rodando
2. Verifique se o firewall permite a porta (5173 ou 4173)
3. Tente acessar de outro navegador

### "Permissões continuam bloqueadas"

1. Limpe o cache do navegador
2. Tente em incógnito/privado
3. Verifique as configurações de privacidade do SO

### "Certificado inválido"

É normal! O certificado é self-signed. Basta aceitar o aviso.

## 📝 Notas

- O certificado é válido por **365 dias**
- Novos certificados são gerados automaticamente a cada 365 dias
- A configuração HTTPS é **transparente** - o Vite cuida disso automaticamente
