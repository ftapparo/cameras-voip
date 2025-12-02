import fs from 'fs';
import ini from 'ini';

// Utilitário para ajudar na configuração das câmeras

class CameraConfigHelper {
  constructor(configFile = 'cameras.conf') {
    this.configFile = configFile;
  }
  
  // Carrega configuração existente
  loadConfig() {
    try {
      if (!fs.existsSync(this.configFile)) {
        console.log('⚠️  Arquivo de configuração não existe');
        return {};
      }
      
      const configContent = fs.readFileSync(this.configFile, 'utf8');
      return ini.parse(configContent);
    } catch (error) {
      console.error('❌ Erro ao carregar configuração:', error);
      return {};
    }
  }
  
  // Salva configuração
  saveConfig(config) {
    try {
      const configContent = ini.stringify(config);
      fs.writeFileSync(this.configFile, configContent, 'utf8');
      console.log('✅ Configuração salva com sucesso');
      return true;
    } catch (error) {
      console.error('❌ Erro ao salvar configuração:', error);
      return false;
    }
  }
  
  // Lista todas as câmeras
  listCameras() {
    const config = this.loadConfig();
    
    console.log('\n📹 Câmeras configuradas:');
    console.log('='.repeat(80));
    
    if (Object.keys(config).length === 0) {
      console.log('  ⚠️  Nenhuma câmera configurada');
      return;
    }
    
    Object.entries(config).forEach(([id, camera]) => {
      console.log(`\n🎥 ${id}:`);
      console.log(`  Nome: ${camera.nome}`);
      console.log(`  IP: ${camera.ip}`);
      console.log(`  Ramal: ${camera.ramal || 'N/A'}`);
      console.log(`  Usuário: ${camera.usuario}`);
      console.log(`  Senha: ${'*'.repeat(camera.senha?.length || 0)}`);
      console.log(`  Descrição: ${camera.descricao}`);
    });
    
    console.log('\n='.repeat(80));
  }
  
  // Valida configuração
  validateConfig() {
    const config = this.loadConfig();
    const errors = [];
    const warnings = [];
    
    Object.entries(config).forEach(([id, camera]) => {
      // Validações obrigatórias
      if (!camera.nome) errors.push(`${id}: Nome não informado`);
      if (!camera.ip) errors.push(`${id}: IP não informado`);
      if (!camera.usuario) errors.push(`${id}: Usuário não informado`);
      if (!camera.senha) errors.push(`${id}: Senha não informada`);
      
      // Validação do IP
      if (camera.ip && !/^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/.test(camera.ip)) {
        errors.push(`${id}: Formato de IP inválido`);
      }
      
      // Validação do ramal
      if (camera.ramal && camera.ramal.trim() && !/^\d+$/.test(camera.ramal.trim())) {
        errors.push(`${id}: Formato de ramal inválido (apenas números)`);
      }
      
      // Avisos
      if (!camera.descricao) warnings.push(`${id}: Descrição não informada`);
    });
    
    console.log('\n🔍 Validação da configuração:');
    console.log('='.repeat(50));
    
    if (errors.length === 0) {
      console.log('✅ Configuração válida!');
    } else {
      console.log('❌ Erros encontrados:');
      errors.forEach(error => console.log(`  - ${error}`));
    }
    
    if (warnings.length > 0) {
      console.log('\n⚠️  Avisos:');
      warnings.forEach(warning => console.log(`  - ${warning}`));
    }
    
    console.log('='.repeat(50));
    
    return errors.length === 0;
  }
}

// Exemplo de uso via linha de comando
if (process.argv[2]) {
  const helper = new CameraConfigHelper();
  
  switch (process.argv[2]) {
    case 'list':
      helper.listCameras();
      break;
      
    case 'validate':
      helper.validateConfig();
      break;
      
    default:
      console.log('Comandos disponíveis:');
      console.log('  list       - Lista câmeras configuradas');
      console.log('  validate   - Valida configuração');
  }
}

export default CameraConfigHelper;