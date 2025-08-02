// ==========================================================================
// Dados Iniciais
// ==========================================================================

// Lista de placas desejadas
const desiredPlates = [
  'RZO3G50', 'RZO2H73', 'SJE0D78', 'SJG1G06', 'QYY0G07',
  'SOD6G88', 'MAQ0003', 'MAQ0005', 'KII8770', 'PEW3772',
  'PCA5320'
];

// Placas específicas da CPR SUL
const placasCPRSUL = ['SJG1G06', 'SJE0D78', 'MAQ0003', 'RZO2H73'];

// Estado de manutenção dos veículos
let maintenanceState = {};

// Estado dos materiais diversos
let materialsState = {
  'Agua_Mineral': { current: 0, stock: 0 },
  'Gas_Cozinha': { current: 0, stock: 0 },
  'Oleo_Maquina': { current: 0, stock: 0 }
};

// Tabela atual processada
let currentTable = null;

// Preços médios iniciais de combustíveis (fallback estático)
const fuelPrices = {
  gasolina: 6.15,
  diesel: 5.79, 
  gnv: 4.72,
  etanol: 4.97,
  arla32: 5.75
};

// Variáveis de configuração do Supabase
const SUPABASE_URL = window.env?.SUPABASE_URL || 'https://wnuialureqofvgefdfol.supabase.co';
const SUPABASE_ANON_KEY = window.env?.SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndudWlhbHVyZXFvZnZnZWZkZm9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxNTQ2MzQsImV4cCI6MjA2OTczMDYzNH0.d_LEjNTIAuSagsaaJCsBWI9SaelBt4n8qzfxAPlRKgU';
let supabase = null;

// ==========================================================================
// Funções de Inicialização
// ==========================================================================

// Inicializa o cliente Supabase
async function initializeSupabase() {
  console.log('Tentando inicializar Supabase...');
  console.log('Variáveis de ambiente:', {
    url: SUPABASE_URL,
    key: SUPABASE_ANON_KEY ? '[presente]' : '[ausente]',
  });

  if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
    console.error('Erro: Variáveis do Supabase (URL ou chave) não definidas.');
    alert('Erro: Configuração do Supabase incompleta.');
    return false;
  }

  if (typeof supabaseClient === 'undefined') {
    console.error('Erro: Biblioteca Supabase (@supabase/supabase-js) não encontrada.');
    console.log('Verifique se o CDN está incluído no index.html: <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js"></script>');
    try {
      const response = await fetch('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js');
      if (!response.ok) {
        console.error(`Falha ao carregar CDN do Supabase: Status ${response.status}`);
      } else {
        console.log('CDN acessível, mas supabaseClient não foi definido. Possível problema de timing ou cache.');
      }
    } catch (err) {
      console.error('Erro ao testar CDN do Supabase:', err.message);
    }
    alert('Erro: Biblioteca Supabase não encontrada.');
    return false;
  }

  try {
    supabase = supabaseClient.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
    console.log('Cliente Supabase inicializado com sucesso.');

    // Testar conexão com maintenance_state
    const { error: maintenanceError } = await supabase
      .from('maintenance_state')
      .select('plate')
      .limit(1);
    if (maintenanceError) {
      console.error('Erro ao testar conexão com maintenance_state:', maintenanceError.message);
      alert('Erro ao conectar ao Supabase (maintenance_state): ' + maintenanceError.message);
      supabase = null;
      return false;
    }

    // Testar conexão com materials_state
    const { error: materialsError } = await supabase
      .from('materials_state')
      .select('material_id')
      .limit(1);
    if (materialsError) {
      console.error('Erro ao testar conexão com materials_state:', materialsError.message);
      alert('Erro ao conectar ao Supabase (materials_state): ' + materialsError.message);
      supabase = null;
      return false;
    }

    console.log('Conexão com Supabase testada com sucesso para ambas as tabelas.');
    return true;
  } catch (err) {
    console.error('Erro ao inicializar Supabase:', err.message);
    alert('Erro ao inicializar Supabase: ' + err.message);
    supabase = null;
    return false;
  }
}

// Inicializa os estados padrão de manutenção e materiais
async function initializeDefaultStates() {
  console.log('Inicializando estados padrão...');
  maintenanceState = {};
  desiredPlates.forEach(plate => {
    maintenanceState[plate] = false;
  });
  materialsState = {
    'Agua_Mineral': { current: 0, stock: 0 },
    'Gas_Cozinha': { current: 0, stock: 0 },
    'Oleo_Maquina': { current: 0, stock: 0 }
  };
  await loadStateFromSupabase();
}

// Carrega estados do Supabase
async function loadStateFromSupabase() {
  if (!supabase) {
    console.warn('Supabase não disponível. Usando estados padrão.');
    return;
  }

  console.log('Carregando dados do Supabase...');
  try {
    const { data: maintenanceData, error: maintenanceError } = await supabase
      .from('maintenance_state')
      .select('plate, is_in_maintenance');
    if (maintenanceError) {
      console.error('Erro ao carregar maintenance_state:', maintenanceError.message);
      alert('Erro ao carregar dados do Supabase: ' + maintenanceError.message);
      return;
    }
    maintenanceData.forEach(({ plate, is_in_maintenance }) => {
      if (desiredPlates.includes(plate)) {
        maintenanceState[plate] = is_in_maintenance;
      }
    });

    const { data: materialsData, error: materialsError } = await supabase
      .from('materials_state')
      .select('material_id, current_quantity, stock_quantity');
    if (materialsError) {
      console.error('Erro ao carregar materials_state:', materialsError.message);
      alert('Erro ao carregar dados do Supabase: ' + materialsError.message);
      return;
    }
    materialsData.forEach(({ material_id, current_quantity, stock_quantity }) => {
      if (['Agua_Mineral', 'Gas_Cozinha', 'Oleo_Maquina'].includes(material_id)) {
        materialsState[material_id] = { current: current_quantity, stock: stock_quantity };
      }
    });

    console.log('Dados carregados do Supabase com sucesso:', { maintenanceState, materialsState });
  } catch (err) {
    console.error('Erro ao carregar dados do Supabase:', err.message);
    alert('Erro ao carregar dados do Supabase: ' + err.message);
  }
}

// Salva estados no Supabase
async function saveStateToSupabase() {
  if (!supabase) {
    console.warn('Supabase não disponível. Dados não foram salvos.');
    alert('Supabase não disponível. Dados não foram salvos.');
    return;
  }

  console.log('Salvando dados no Supabase...');
  try {
    // Salvar maintenance_state
    const maintenanceUpdates = Object.entries(maintenanceState)
      .filter(([plate]) => desiredPlates.includes(plate))
      .map(([plate, is_in_maintenance]) => ({
        plate,
        is_in_maintenance
      }));
    const { error: maintenanceError } = await supabase
      .from('maintenance_state')
      .upsert(maintenanceUpdates, { onConflict: 'plate' });
    if (maintenanceError) {
      console.error('Erro ao salvar maintenance_state:', maintenanceError.message);
      alert('Erro ao salvar dados no Supabase: ' + maintenanceError.message);
      return;
    }
    console.log('maintenance_state salvo no Supabase:', maintenanceUpdates);

    // Salvar materials_state
    const materialsUpdates = Object.entries(materialsState)
      .filter(([material_id]) => ['Agua_Mineral', 'Gas_Cozinha', 'Oleo_Maquina'].includes(material_id))
      .map(([material_id, { current, stock }]) => ({
        material_id,
        current_quantity: current,
        stock_quantity: stock
      }));
    const { error: materialsError } = await supabase
      .from('materials_state')
      .upsert(materialsUpdates, { onConflict: 'material_id' });
    if (materialsError) {
      console.error('Erro ao salvar materials_state:', materialsError.message);
      alert('Erro ao salvar dados no Supabase: ' + materialsError.message);
      return;
    }
    console.log('materials_state salvo no Supabase:', materialsUpdates);
  } catch (err) {
    console.error('Erro ao salvar dados no Supabase:', err.message);
    alert('Erro ao salvar dados no Supabase: ' + err.message);
  }
}

// ==========================================================================
// Funções de Manipulação de Arquivos
// ==========================================================================

// Exporta os dados de manutenção e materiais para um arquivo .txt
function exportDataToFile() {
  const data = {
    maintenanceState,
    materialsState
  };
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'text/plain' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'BancoDado.txt';
  link.click();
  URL.revokeObjectURL(link.href);
  console.log('Dados exportados para BancoDado.txt:', data);
}

// Importa dados de um arquivo .txt e atualiza a interface
async function importDataFromFile(file) {
  if (!file) {
    console.log('Seleção de arquivo cancelada. Mantendo os dados atuais.');
    return;
  }

  if (!file.name.endsWith('.txt')) {
    alert('Por favor, selecione um arquivo .txt válido.');
    return;
  }

  const reader = new FileReader();
  reader.onload = async function (e) {
    try {
      const data = JSON.parse(e.target.result);
      // Atualizar maintenanceState
      maintenanceState = { ...maintenanceState, ...data.maintenanceState };
      Object.keys(maintenanceState).forEach(plate => {
        if (!desiredPlates.includes(plate)) {
          delete maintenanceState[plate];
        } else {
          maintenanceState[plate] = !!data.maintenanceState[plate];
        }
      });
      // Atualizar materialsState
      materialsState = { ...materialsState, ...data.materialsState };
      const validMaterials = ['Agua_Mineral', 'Gas_Cozinha', 'Oleo_Maquina'];
      Object.keys(materialsState).forEach(key => {
        if (!validMaterials.includes(key)) {
          delete materialsState[key];
        } else if (data.materialsState && data.materialsState[key]) {
          materialsState[key].current = Number.isInteger(data.materialsState[key].current) ? data.materialsState[key].current : materialsState[key].current;
          materialsState[key].stock = Number.isInteger(data.materialsState[key].stock) ? data.materialsState[key].stock : materialsState[key].stock;
        }
      });
      // Salvar no Supabase
      await saveStateToSupabase();
      // Atualizar UI
      const contentDiv = document.getElementById('content');
      const summaryContainer = document.getElementById('summaryContainer');
      contentDiv.innerHTML = '';
      summaryContainer.innerHTML = '';
      if (currentTable) {
        renderVehicleCards(currentTable);
        renderMaterialsCard();
        renderSummary(currentTable);
      } else {
        renderMaterialsCard();
        renderFuelPricesCard();
      }
      renderMaintenanceModal();
      renderMiscModal();
      alert('Dados importados com sucesso!');
      console.log('Dados importados do BancoDado.txt:', { maintenanceState, materialsState });
    } catch (err) {
      console.error('Erro ao importar BancoDado.txt:', err);
      alert('Erro ao importar o arquivo. Verifique se é um BancoDado.txt válido.');
    }
  };
  reader.onerror = function (err) {
    console.error('Erro ao ler BancoDado.txt:', err);
    alert('Erro ao ler o arquivo.');
  };
  reader.readAsText(file);
}

// Processa um arquivo HTML ou XLS para extrair dados de saldo
function processFile(file) {
  if (!file) {
    console.log('Seleção de arquivo cancelada. Mantendo o último extrato visível.');
    return;
  }

  if (!['text/html', 'application/vnd.ms-excel'].includes(file.type)) {
    console.error(`Arquivo inválido: ${file.name}. Tipo esperado: text/html ou application/vnd.ms-excel`);
    showError('Erro: Por favor, envie um arquivo .html ou .xls válido.');
    return;
  }

  console.log(`Processando arquivo: ${file.name} (Tipo: ${file.type})`);

  const contentDiv = document.getElementById('content');
  const summaryContainer = document.getElementById('summaryContainer');
  contentDiv.innerHTML = '';
  summaryContainer.innerHTML = '';

  const reader = new FileReader();
  reader.onload = function (e) {
    try {
      if (file.name.endsWith('.xls')) {
        const data = new Uint8Array(e.target.result);
        const workbook = XLSX.read(data, { type: 'array' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const jsonData = XLSX.utils.sheet_to_json(sheet, { header: 1 });
        // Converter para HTML para compatibilidade com renderVehicleCards
        const table = document.createElement('table');
        table.className = 'boxedBody';
        jsonData.forEach((row, index) => {
          const tr = document.createElement('tr');
          tr.className = index % 2 === 0 ? 'LinhaPar' : 'LinhaImpar';
          row.forEach(cell => {
            const td = document.createElement('td');
            td.textContent = cell || '';
            tr.appendChild(td);
          });
          table.appendChild(tr);
        });
        currentTable = table;
      } else {
        const content = e.target.result;
        const parser = new DOMParser();
        const doc = parser.parseFromString(content, 'text/html');
        const table = doc.querySelector('table.boxedBody');
        if (!table) {
          console.error('Tabela .boxedBody não encontrada no arquivo.');
          showError('Erro: O arquivo não contém uma tabela válida com a classe "boxedBody".');
          return;
        }
        currentTable = table;
      }

      console.log('Tabela .boxedBody encontrada com sucesso:', currentTable);
      renderVehicleCards(currentTable);
      renderMaterialsCard();
      renderSummary(currentTable);
      renderMaintenanceModal();
      renderMiscModal();
    } catch (err) {
      console.error('Erro ao processar o arquivo:', err);
      showError('Erro ao processar o arquivo: ' + err.message);
    }
  };
  reader.onerror = function (err) {
    console.error('Erro ao ler o arquivo:', err);
    showError('Erro ao ler o arquivo: ' + err.message);
  };
  if (file.name.endsWith('.xls')) {
    reader.readAsArrayBuffer(file);
  } else {
    reader.readAsText(file);
  }
}

// ==========================================================================
// Funções de Formatação e Validação
// ==========================================================================

// Exibe mensagem de erro na interface
function showError(message) {
  const contentDiv = document.getElementById('content');
  contentDiv.innerHTML = `<p class="text-red-500 text-center">${message}</p>`;
}

// Converte string de saldo para número
function parseSaldo(valor) {
  return parseFloat(valor.replace('.', '').replace(',', '.')) || 0;
}

// Formata número como moeda brasileira (R$)
function formatCurrency(value) {
  const formatted = value.toFixed(2).replace('.', ',');
  return formatted.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// ==========================================================================
// Funções de Renderização de Cartões
// ==========================================================================

// Renderiza cartões de veículos com base na tabela
function renderVehicleCards(table) {
  const contentDiv = document.getElementById('content');
  contentDiv.innerHTML = ''; // Limpar antes de renderizar

  const plateData = {};
  const dataRows = table.querySelectorAll('tr.LinhaImpar, tr.LinhaPar');
  if (dataRows.length === 0) {
    showError('Erro: Nenhuma linha de dados encontrada na tabela.');
    return;
  }

  dataRows.forEach(row => {
    const plateCell = row.cells[1];
    if (plateCell) {
      const plate = plateCell.textContent.trim();
      if (desiredPlates.includes(plate)) {
        const balanceRaw = row.cells[13]?.textContent.trim().replace('R$', '') || '0,00';
        plateData[plate] = balanceRaw;
        console.log(`Placa: ${plate}, Saldo Bruto: ${balanceRaw}`);
      }
    }
  });

  desiredPlates.forEach(plate => {
    const balanceRaw = plateData[plate] || '0,00';
    const balanceValue = parseSaldo(balanceRaw);
    const balanceDisplay = formatCurrency(balanceValue);
    const imgSrc = `img/car_img/${plate}.png`;
    const isInMaintenance = maintenanceState[plate] || false;

    console.log(`Renderizando placa: ${plate}, Saldo: R$ ${balanceDisplay}, Manutenção: ${isInMaintenance}`);

    const card = document.createElement('div');
    card.className = `modern-card ${isInMaintenance ? 'maintenance' : ''} loaded`;
    card.setAttribute('data-plate', plate);
    card.setAttribute('data-balance', balanceRaw);
    card.innerHTML = `
      <div class="mb-4">
        <img src="${imgSrc}" alt="Veículo ${plate}" class="loaded" onerror="this.parentElement.innerHTML='<div class=\\'no-image loaded\\'>Imagem não disponível</div>'; console.error('Erro ao carregar imagem do veículo: ${imgSrc}');"/>
      </div>
      <p class="text-xl font-semibold text-gray-800">${plate}</p>
      <p class="text-3xl font-bold ${balanceValue === 0 ? 'zero-balance' : 'text-green-600'} loaded" data-balance-display="R$ ${balanceDisplay}">R$ ${balanceDisplay}</p>
      ${isInMaintenance ? '<div class="maintenance-badge loaded">Em Manutenção</div>' : ''}
    `;
    contentDiv.appendChild(card);
  });
}

// Renderiza cartão de materiais diversos
function renderMaterialsCard() {
  const contentDiv = document.getElementById('content');
  const extraCard = document.createElement('div');
  extraCard.className = 'modern-card p-6 bg-white loaded';
  extraCard.setAttribute('data-materials-card', 'true');
  extraCard.innerHTML = `
    <h2 class="text-center text-xl font-semibold text-gray-700 mb-9">Materiais Diversos</h2>
    <ul class="space-y-4 text-gray-700 text-sm">
      <li class="flex justify-between items-center loaded">
        <div class="flex items-center gap-3">
          <img src="./img/diversos_img/Agua_Mineral.png" class="w-10 h-10 object-contain loaded" alt="Ícone de garrafa de água mineral" onerror="console.error('Erro ao carregar imagem: img/diversos_img/Agua_Mineral.png');"/>
          <span>Água Mineral</span>
        </div>
        <span class="font-semibold text-gray-800 text-lg">${materialsState['Agua_Mineral'].current} / ${materialsState['Agua_Mineral'].stock}</span>
      </li>
      <li class="flex justify-between items-center loaded">
        <div class="flex items-center gap-3">
          <img src="./img/diversos_img/Gas_Cozinha.png" class="w-10 h-10 object-contain loaded" alt="Ícone de botijão de gás" onerror="console.error('Erro ao carregar imagem: img/diversos_img/Gas_Cozinha.png');"/>
          <span>Gás de Cozinha</span>
        </div>
        <span class="font-semibold text-gray-800 text-lg">${materialsState['Gas_Cozinha'].current} / ${materialsState['Gas_Cozinha'].stock}</span>
      </li>
      <li class="flex justify-between items-center loaded">
        <div class="flex items-center gap-3">
          <img src="./img/diversos_img/Oleo_Maquina.png" class="w-10 h-10 object-contain loaded" alt="Ícone de óleo de máquina" onerror="console.error('Erro ao carregar imagem: img/diversos_img/Oleo_Maquina.png');"/>
          <span>Óleo de Máquina</span>
        </div>
        <span class="font-semibold text-gray-800 text-lg">${materialsState['Oleo_Maquina'].current} / ${materialsState['Oleo_Maquina'].stock}</span>
      </li>
    </ul>
  `;
  contentDiv.appendChild(extraCard);
}

// Renderiza cartão de preços de combustíveis
function renderFuelPricesCard() {
  const summaryContainer = document.getElementById('summaryContainer');
  const fuelCard = document.createElement('div');
  fuelCard.className = 'modern-card p-6 bg-white loaded';
  fuelCard.setAttribute('data-fuel-prices-card', 'true');
  fuelCard.innerHTML = `
    <h2 class="text-center text-xl font-semibold text-gray-700 mb-6">Preços Médios de Combustíveis</h2>
    <ul class="space-y-4 text-gray-700 text-sm">
      <li class="flex justify-between items-center loaded">
        <div class="flex items-center gap-3">
          <img src="./img/combust_img/Gasol_Comun.png" class="w-10 h-10 object-contain loaded" alt="Ícone de gasolina" onerror="console.error('Erro ao carregar imagem: img/combust_img/Gasol_Comun.png');"/>
          <span>Gasolina C.</span>
        </div>
        <span class="font-semibold text-gray-800 text-lg">R$ ${formatCurrency(fuelPrices.gasolina)}</span>
      </li>
      <li class="flex justify-between items-center loaded">
        <div class="flex items-center gap-3">
          <img src="./img/combust_img/Diesel_Comum.png" class="w-10 h-10 object-contain loaded" alt="Ícone de diesel" onerror="console.error('Erro ao carregar imagem: img/combust_img/Diesel_Comum.png');"/>
          <span>Diesel C.</span>
        </div>
        <span class="font-semibold text-gray-800 text-lg">R$ ${formatCurrency(fuelPrices.diesel)}</span>
      </li>
      <li class="flex justify-between items-center loaded">
        <div class="flex items-center gap-3">
          <img src="./img/combust_img/Gás_Natural.png" class="w-10 h-10 object-contain loaded" alt="Ícone de GNV" onerror="console.error('Erro ao carregar imagem: img/combust_img/Gás_Natural.png');"/>
          <span>Gás (GNV)</span>
        </div>
        <span class="font-semibold text-gray-800 text-lg">R$ ${formatCurrency(fuelPrices.gnv)}</span>
      </li>
      <li class="flex justify-between items-center loaded">
        <div class="flex items-center gap-3">
          <img src="./img/combust_img/Etanol_Comun.png" class="w-10 h-10 object-contain loaded" alt="Ícone de etanol" onerror="console.error('Erro ao carregar imagem: img/combust_img/Etanol_Comun.png');"/>
          <span>Etanol C.</span>
        </div>
        <span class="font-semibold text-gray-800 text-lg">R$ ${formatCurrency(fuelPrices.etanol)}</span>
      </li>
      <li class="flex justify-between items-center loaded">
        <div class="flex items-center gap-3">
          <img src="./img/combust_img/Arla_32.png" class="w-10 h-10 object-contain loaded" alt="Ícone de Arla 32" onerror="console.error('Erro ao carregar imagem: img/combust_img/Arla_32.png');"/>
          <span>Arla 32</span>
        </div>
        <span class="font-semibold text-gray-800 text-lg">R$ ${formatCurrency(fuelPrices.arla32)}</span>
      </li>
    </ul>
  `;
  summaryContainer.appendChild(fuelCard);
}

// Renderiza resumo de saldos e gráficos
function renderSummary(table) {
  const plateData = {};
  const dataRows = table.querySelectorAll('tr.LinhaImpar, tr.LinhaPar');
  if (dataRows.length === 0) {
    showError('Erro: Nenhuma linha de dados encontrada na tabela.');
    return;
  }

  dataRows.forEach(row => {
    const plateCell = row.cells[1];
    if (plateCell) {
      const plate = plateCell.textContent.trim();
      if (desiredPlates.includes(plate)) {
        const balanceRaw = row.cells[13]?.textContent.trim().replace('R$', '') || '0,00';
        plateData[plate] = balanceRaw;
      }
    }
  });

  let totalGeral = 0;
  let totalCPRSUL = 0;

  Object.entries(plateData).forEach(([placa, saldoStr]) => {
    const saldo = parseSaldo(saldoStr);
    totalGeral += saldo;
    if (placasCPRSUL.includes(placa)) {
      totalCPRSUL += saldo;
    }
  });

  const totalCMASUL = totalGeral - totalCPRSUL;
  const cmaSulCount = desiredPlates.length - placasCPRSUL.length;
  const cprSulCount = placasCPRSUL.length;
  const maintenanceCount = Object.values(maintenanceState).filter(status => status).length;

  const summaryContainer = document.getElementById('summaryContainer');
  summaryContainer.innerHTML = '';

  const resumo = document.createElement('div');
  resumo.className = 'modern-card p-6 text-base text-gray-800 bg-white loaded';
  resumo.innerHTML = `
    <h2 class="text-center text-xl font-semibold text-gray-700 mb-6">Resumo de Saldo</h2>
    <div id="pieChartContainer" class="mb-6 flex justify-center">
      <canvas id="balancePieChart" class="loaded"></canvas>
    </div>
    <div class="flex justify-between text-lg">
      <span class="font-medium">CMA SUL</span>
      <span class="font-bold text-green-700 text-xl">R$ ${formatCurrency(totalCMASUL)}</span>
    </div>
    <div class="flex justify-between text-lg mt-2">
      <span class="font-medium">CPR SUL</span>
      <span class="font-bold text-green-700 text-xl">R$ ${formatCurrency(totalCPRSUL)}</span>
    </div>
    <div class="flex justify-between border-t pt-2 mt-6 text-xl font-semibold">
      <span>Total</span>
      <span class="text-green-800 font-bold text-2xl">R$ ${formatCurrency(totalGeral)}</span>
    </div>
  `;
  summaryContainer.appendChild(resumo);

  const balanceCtx = document.getElementById('balancePieChart')?.getContext('2d');
  if (balanceCtx && totalCMASUL >= 0 && totalCPRSUL >= 0) {
    new Chart(balanceCtx, {
      type: 'pie',
      data: {
        labels: ['CMA SUL', 'CPR SUL'],
        datasets: [{
          data: [totalCMASUL, totalCPRSUL],
          backgroundColor: ['#10B981', '#34D399']
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: {
            position: 'bottom'
          },
          tooltip: {
            callbacks: {
              label: function(tooltipItem) {
                return `${tooltipItem.label}: R$ ${formatCurrency(tooltipItem.raw)}`;
              }
            }
          }
        }
      }
    });
  } else {
    console.warn('Gráfico de saldo não renderizado: Contexto ou dados inválidos.');
  }

  const quantityCard = document.createElement('div');
  quantityCard.className = 'modern-card p-6 text-base text-gray-800 bg-white loaded';
  quantityCard.innerHTML = `
    <h2 class="text-center text-xl font-semibold text-gray-700 mb-6">Veículos em Operação</h2>
    <div id="operationPieChartContainer" class="mb-6 flex justify-center">
      <canvas id="operationPieChart" class="loaded"></canvas>
    </div>
    <div class="flex justify-between text-lg">
      <span class="font-medium">CMA SUL</span>
      <span class="font-bold text-gray-700">${cmaSulCount} veículos</span>
    </div>
    <div class="flex justify-between text-lg mt-2">
      <span class="font-medium">CPR SUL</span>
      <span class="font-bold text-gray-700">${cprSulCount} veículos</span>
    </div>
    <div class="flex justify-between border-t pt-2 mt-6 text-lg font-semibold">
      <span>Manutenção</span>
      <span class="font-bold text-gray-800">${maintenanceCount} veículos</span>
    </div>
  `;
  summaryContainer.appendChild(quantityCard);

  updateOperationChart();
  renderFuelPricesCard();
}

// ==========================================================================
// Funções de Renderização de Modais
// ==========================================================================

function renderMaintenanceModal() {
  const maintenanceList = document.getElementById('maintenanceList');
  maintenanceList.innerHTML = '';

  desiredPlates.forEach(plate => {
    const isChecked = maintenanceState[plate] || false;
    const li = document.createElement('li');
    li.className = 'flex justify-between items-center';
    li.innerHTML = `
      <span class="text-gray-700">${plate}</span>
      <label class="switch">
        <input type="checkbox" ${isChecked ? 'checked' : ''} data-plate="${plate}">
        <span class="slider round"></span>
      </label>
    `;
    maintenanceList.appendChild(li);
  });

  document.querySelectorAll('#maintenanceList input[type="checkbox"]').forEach(switchInput => {
    switchInput.addEventListener('change', async (event) => {
      const plate = event.target.getAttribute('data-plate');
      maintenanceState[plate] = event.target.checked;
      await saveStateToSupabase();
      updateVehicleCard(plate);
      updateQuantityCard();
      updateOperationChart();
    });
  });
}

function renderMiscModal() {
  const miscList = document.getElementById('miscList');
  miscList.innerHTML = '';

  const materials = [
    { id: 'Agua_Mineral', name: 'Água Mineral' },
    { id: 'Gas_Cozinha', name: 'Gás de Cozinha' },
    { id: 'Oleo_Maquina', name: 'Óleo de Máquina' }
  ];

  materials.forEach(material => {
    const li = document.createElement('li');
    li.className = 'flex flex-col gap-2';
    li.innerHTML = `
      <div class="flex justify-between items-center">
        <span class="text-gray-700">${material.name}</span>
        <div class="flex gap-2">
          <input type="number" min="0" value="${materialsState[material.id].current}" data-material="${material.id}" data-type="current" class="w-16 p-1 border border-gray-300 rounded text-sm" placeholder="Atual">
          <span>/</span>
          <input type="number" min="0" value="${materialsState[material.id].stock}" data-material="${material.id}" data-type="stock" class="w-16 p-1 border border-gray-300 rounded text-sm" placeholder="Estoque">
        </div>
      </div>
    `;
    miscList.appendChild(li);
  });

  document.querySelectorAll('#miscList input[type="number"]').forEach(input => {
    input.addEventListener('change', async (event) => {
      const material = event.target.getAttribute('data-material');
      const type = event.target.getAttribute('data-type');
      const value = parseInt(event.target.value) || 0;
      materialsState[material][type] = value;
      await saveStateToSupabase();
      updateMaterialsCard();
    });
  });
}

// ==========================================================================
// Funções de Atualização de Interface
// ==========================================================================

// Atualiza o cartão de um veículo específico
function updateVehicleCard(plate) {
  const card = document.querySelector(`.modern-card[data-plate="${plate}"]`);
  if (card) {
    const isInMaintenance = maintenanceState[plate];
    card.className = `modern-card ${isInMaintenance ? 'maintenance' : ''} loaded`;
    const balanceRaw = card.getAttribute('data-balance') || '0,00';
    const balanceValue = parseSaldo(balanceRaw);
    const balanceDisplay = formatCurrency(balanceValue);
    const balanceElement = card.querySelector('p.text-3xl');
    if (balanceElement) {
      balanceElement.className = `text-3xl font-bold ${balanceValue === 0 ? 'zero-balance' : 'text-green-600'} loaded`;
      balanceElement.textContent = `R$ ${balanceDisplay}`;
      console.log(`Atualizando placa: ${plate}, Saldo: R$ ${balanceDisplay}`);
    }
    const badge = card.querySelector('.maintenance-badge');
    if (isInMaintenance && !badge) {
      const newBadge = document.createElement('div');
      newBadge.className = 'maintenance-badge loaded';
      newBadge.textContent = 'Em Manutenção';
      card.appendChild(newBadge);
    } else if (!isInMaintenance && badge) {
      badge.remove();
    }
  }
}

// Atualiza o cartão de materiais diversos
function updateMaterialsCard() {
  const materialsCard = document.querySelector('.modern-card[data-materials-card="true"]');
  if (materialsCard) {
    materialsCard.innerHTML = `
      <h2 class="text-center text-xl font-semibold text-gray-700 mb-9">Materiais Diversos</h2>
      <ul class="space-y-4 text-gray-700 text-sm">
        <li class="flex justify-between items-center loaded">
          <div class="flex items-center gap-3">
            <img src="img/diversos_img/Agua_Mineral.png" class="w-10 h-10 object-contain loaded" alt="Ícone de garrafa de água mineral" onerror="console.error('Erro ao carregar imagem: img/diversos_img/Agua_Mineral.png');"/>
            <span>Água Mineral</span>
          </div>
          <span class="font-semibold text-gray-800 text-lg">${materialsState['Agua_Mineral'].current} / ${materialsState['Agua_Mineral'].stock}</span>
        </li>
        <li class="flex justify-between items-center loaded">
          <div class="flex items-center gap-3">
            <img src="img/diversos_img/Gas_Cozinha.png" class="w-10 h-10 object-contain loaded" alt="Ícone de botijão de gás" onerror="console.error('Erro ao carregar imagem: img/diversos_img/Gas_Cozinha.png');"/>
            <span>Gás de Cozinha</span>
          </div>
          <span class="font-semibold text-gray-800 text-lg">${materialsState['Gas_Cozinha'].current} / ${materialsState['Gas_Cozinha'].stock}</span>
        </li>
        <li class="flex justify-between items-center loaded">
          <div class="flex items-center gap-3">
            <img src="img/diversos_img/Oleo_Maquina.png" class="w-10 h-10 object-contain loaded" alt="Ícone de óleo de máquina" onerror="console.error('Erro ao carregar imagem: img/diversos_img/Oleo_Maquina.png');"/>
            <span>Óleo de Máquina</span>
          </div>
          <span class="font-semibold text-gray-800 text-lg">${materialsState['Oleo_Maquina'].current} / ${materialsState['Oleo_Maquina'].stock}</span>
        </li>
      </ul>
    `;
  }
}

// Atualiza o cartão de quantidade de veículos em operação
function updateQuantityCard() {
  const maintenanceCount = Object.values(maintenanceState).filter(status => status).length;
  const cmaSulCount = desiredPlates.length - placasCPRSUL.length;
  const cprSulCount = placasCPRSUL.length;

  const quantityCard = document.querySelector('#summaryContainer .modern-card:nth-child(2)');
  if (quantityCard) {
    quantityCard.innerHTML = `
      <h2 class="text-center text-xl font-semibold text-gray-700 mb-6">Veículos em Operação</h2>
      <div id="operationPieChartContainer" class="mb-6 flex justify-center">
        <canvas id="operationPieChart" class="loaded"></canvas>
      </div>
      <div class="flex justify-between text-lg">
        <span class="font-medium">CMA SUL</span>
        <span class="font-bold text-gray-700">${cmaSulCount} veículos</span>
      </div>
      <div class="flex justify-between text-lg mt-2">
        <span class="font-medium">CPR SUL</span>
        <span class="font-bold text-gray-700">${cprSulCount} veículos</span>
      </div>
      <div class="flex justify-between border-t pt-2 mt-6 text-lg font-semibold">
        <span>Manutenção</span>
        <span class="font-bold text-gray-800">${maintenanceCount} veículos</span>
      </div>
    `;
    updateOperationChart();
  }
}

// Atualiza o gráfico de operação
function updateOperationChart() {
  const operationCtx = document.getElementById('operationPieChart')?.getContext('2d');
  if (operationCtx) {
    const operationData = calculateOperationData();

    if (Chart.getChart(operationCtx)) {
      Chart.getChart(operationCtx).destroy();
    }

    if (operationData.cmaSulCount >= 0 && operationData.cprSulCount >= 0 && operationData.maintenanceCount >= 0) {
      new Chart(operationCtx, {
        type: 'pie',
        data: {
          labels: ['CMA SUL', 'CPR SUL', 'Manutenção'],
          datasets: [{
            data: [operationData.cmaSulCount, operationData.cprSulCount, operationData.maintenanceCount],
            backgroundColor: ['#10B981', '#34D399', '#F59E0B']
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: {
              position: 'bottom'
            },
            tooltip: {
              callbacks: {
                label: function(tooltipItem) {
                  return `${tooltipItem.label}: ${tooltipItem.raw} veículos`;
                }
              }
            }
          }
        }
      });
    } else {
      console.warn('Gráfico de operação não renderizado: Dados inválidos.');
    }
  }
}

// Calcula dados para o gráfico de operação
function calculateOperationData() {
  const cmaSulCount = desiredPlates.length - placasCPRSUL.length;
  const cprSulCount = placasCPRSUL.length;
  const maintenanceCount = Object.values(maintenanceState).filter(status => status).length;
  return { cmaSulCount, cprSulCount, maintenanceCount };
}

// ==========================================================================
// Funções de Captura e Compartilhamento de Imagem
// ==========================================================================

function formatDateTime() {
  const now = new Date();
  const daysOfWeek = ['Dom', 'Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb'];
  const dayName = daysOfWeek[now.getDay()];
  const day = String(now.getDate()).padStart(2, '0');
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const year = now.getFullYear();
  const hours = String(now.getHours()).padStart(2, '0');
  const minutes = String(now.getMinutes()).padStart(2, '0');
  return `SALDO! ${dayName} - ${day}/${month}/${year} às ${hours}:${minutes}`;
}

// Função para copiar texto para a área de transferência
async function copyToClipboard(text) {
  try {
    if (navigator.clipboard && navigator.clipboard.writeText) {
      await navigator.clipboard.writeText(text);
    } else {
      console.warn('API navigator.clipboard não suportada. Cópia para área de transferência ignorada.');
    }
  } catch (err) {
    console.error('Erro ao copiar para a área de transferência:', err);
  }
}

// Função downloadImage
function downloadImage() {
  const content = document.getElementById('mainContent');
  const buttonContainer = document.querySelector('.button-container');
  const formatted = formatDateTime();
  copyToClipboard(formatted);
  if (buttonContainer) {
    buttonContainer.style.display = 'none';
  }
  window.scrollTo(0, 0);
  setTimeout(() => {
    html2canvas(content, {
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      scale: 2,
      scrollX: 0,
      scrollY: 0,
      windowWidth: document.documentElement.scrollWidth,
      windowHeight: document.documentElement.scrollHeight
    }).then(canvas => {
      const link = document.createElement('a');
      link.download = 'Saldo dos Veiculos.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      if (buttonContainer) {
        buttonContainer.style.display = '';
      }
    }).catch(err => {
      console.error('Erro ao baixar imagem:', err);
      alert('Erro ao baixar imagem: ' + err.message);
      if (buttonContainer) {
        buttonContainer.style.display = '';
      }
    });
  }, 100);
}

// Função shareImage
async function shareImage() {
  const content = document.getElementById('mainContent');
  const buttonContainer = document.querySelector('.button-container');
  const formatted = formatDateTime();
  await copyToClipboard(formatted);
  if (buttonContainer) {
    buttonContainer.style.display = 'none';
  }
  window.scrollTo(0, 0);
  try {
    const canvas = await new Promise(resolve => {
      setTimeout(() => {
        html2canvas(content, {
          useCORS: true,
          allowTaint: true,
          backgroundColor: '#ffffff',
          scale: 2,
          scrollX: 0,
          scrollY: 0,
          windowWidth: document.documentElement.scrollWidth,
          windowHeight: document.documentElement.scrollHeight
        }).then(canvas => resolve(canvas));
      }, 100);
    });
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const file = new File([blob], 'Saldo dos Veiculos.png', { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: 'Extrato de Veículos',
        text: 'Confira o saldo atualizado.',
      });
    } else {
      alert('Seu navegador não suporta compartilhamento de imagem.');
    }
  } catch (err) {
    console.error('Erro ao compartilhar imagem:', err);
    alert('Erro ao compartilhar: ' + err.message);
  } finally {
    if (buttonContainer) {
      buttonContainer.style.display = '';
    }
  }
}

// ==========================================================================
// Funções de Controle de Modais
// ==========================================================================

function toggleMaintenanceModal(show) {
  const modal = document.getElementById('maintenanceModal');
  let backdrop = document.querySelector('.modal-backdrop');
  if (modal) {
    const modalContent = modal.querySelector('div');
    if (modalContent) {
      modalContent.classList.add('modal-content');
    }
    if (show && !backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';
      document.body.appendChild(backdrop);
    }
    modal.classList.toggle('hidden', !show);
    modal.classList.toggle('show', show);
    if (backdrop) {
      backdrop.classList.toggle('show', show);
      if (!show) {
        backdrop.remove();
      }
    }
  }
}

function toggleMiscModal(show) {
  const modal = document.getElementById('miscModal');
  let backdrop = document.querySelector('.modal-backdrop');
  if (modal) {
    const modalContent = modal.querySelector('div');
    if (modalContent) {
      modalContent.classList.add('modal-content');
    }
    if (show && !backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';
      document.body.appendChild(backdrop);
    }
    modal.classList.toggle('hidden', !show);
    modal.classList.toggle('show', show);
    if (backdrop) {
      backdrop.classList.toggle('show', show);
      if (!show) {
        backdrop.remove();
      }
    }
  }
}

// ==========================================================================
// Configurações de Responsividade
// ==========================================================================

function setupResponsiveElements() {
  window.scrollTo(0, 0);
}

// ==========================================================================
// Inicialização e Eventos
// ==========================================================================

document.addEventListener('DOMContentLoaded', async () => {
  console.log('DOM carregado. Inicializando aplicação...');
  const loader = document.createElement('div');
  loader.className = 'loader';
  document.body.appendChild(loader);

  const isSupabaseInitialized = await initializeSupabase();
  if (isSupabaseInitialized) {
    await initializeDefaultStates();
  } else {
    initializeDefaultStates();
  }

  renderMaintenanceModal();
  renderMiscModal();

  setTimeout(() => {
    document.body.classList.add('loaded');
    loader.remove();
    document.querySelectorAll('#mainContent, h1, .button-container').forEach((el, index) => {
      setTimeout(() => {
        el.classList.add('loaded');
      }, index * 50);
    });
    document.querySelectorAll('.modern-card, .modern-card img, .modern-card ul li, .no-image, .maintenance-badge, .chart-card canvas').forEach(el => {
      el.classList.add('loaded');
    });
    setupResponsiveElements();
    console.log('Aplicação inicializada.');
  }, 500);
});

document.getElementById('fileInput').addEventListener('change', (event) => {
  processFile(event.target.files[0]);
});

document.getElementById('downloadBtn').addEventListener('click', downloadImage);
document.getElementById('shareBtn').addEventListener('click', shareImage);
document.getElementById('maintenanceBtn').addEventListener('click', () => toggleMaintenanceModal(true));
document.getElementById('closeModalBtn').addEventListener('click', () => toggleMaintenanceModal(false));
document.getElementById('miscBtn').addEventListener('click', () => toggleMiscModal(true));
document.getElementById('closeMiscModalBtn').addEventListener('click', () => toggleMiscModal(false));
document.getElementById('exportDataBtn').addEventListener('click', exportDataToFile);
document.getElementById('importDataInput').addEventListener('change', (event) => {
  importDataFromFile(event.target.files[0]);
});
