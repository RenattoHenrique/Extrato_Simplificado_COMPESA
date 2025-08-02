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

// Cliente Supabase
let supabase = null;

// Função para inicializar o cliente Supabase com retry
async function initializeSupabase() {
  console.log('Tentando inicializar Supabase...');
  console.log('Variáveis de ambiente:', {
    url: process.env.NEXT_PUBLIC_SUPABASE_URL,
    key: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ? '[presente]' : '[ausente]'
  });

  const maxAttempts = 10;
  let attempts = 0;

  return new Promise((resolve) => {
    const interval = setInterval(() => {
      attempts++;
      if (typeof supabaseClient !== 'undefined') {
        try {
          supabase = supabaseClient.createClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://wnuialureqofvgefdfol.supabase.co',
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndudWlhbHVyZXFvZnZnZWZkZm9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxNTQ2MzQsImV4cCI6MjA2OTczMDYzNH0.d_LEjNTIAuSagsaaJCsBWI9SaelBt4n8qzfxAPlRKgU'
          );
          console.log('Cliente Supabase inicializado com sucesso.');
          // Testar conexão com uma consulta simples
          supabase.from('maintenance_state').select('plate').limit(1)
            .then(({ error }) => {
              if (error) {
                console.error('Erro ao testar conexão com Supabase:', error.message);
                alert('Erro ao conectar ao Supabase: ' + error.message);
                supabase = null;
                resolve(false);
              } else {
                console.log('Conexão com Supabase testada com sucesso.');
                resolve(true);
              }
            });
          clearInterval(interval);
        } catch (err) {
          console.error('Erro ao criar cliente Supabase:', err.message);
          clearInterval(interval);
          resolve(false);
        }
      } else if (attempts >= maxAttempts) {
        console.error('Falha ao carregar biblioteca Supabase após', maxAttempts, 'tentativas.');
        alert('Erro: Biblioteca Supabase não encontrada. Algumas funcionalidades podem estar limitadas. Verifique o console para detalhes.');
        clearInterval(interval);
        resolve(false);
      } else {
        console.log(`Tentativa ${attempts}/${maxAttempts}: supabaseClient não encontrado.`);
      }
    }, 1000); // Aumentado para 1000ms para dar mais tempo ao CDN
  });
}

// ==========================================================================
// Funções de Inicialização
// ==========================================================================

// Inicializa os estados padrão e tenta carregar do Supabase
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

  const supabaseLoaded = await initializeSupabase();
  if (supabaseLoaded && supabase) {
    await loadStateFromSupabase();
  } else {
    console.warn('Supabase não disponível. Usando valores padrão.');
    renderMaintenanceModal();
    renderMiscModal();
    renderMaterialsCard();
    renderFuelPricesCard();
  }
}

// ==========================================================================
// Funções de Manipulação de Arquivos
// ==========================================================================

// Processa arquivo HTML ou XLS para extrair dados de saldo
function processFile(file) {
  if (!file) {
    console.log('Seleção de arquivo cancelada.');
    return;
  }

  if (!['text/html', 'application/vnd.ms-excel'].includes(file.type)) {
    console.error(`Arquivo inválido: ${file.name}`);
    showError('Por favor, envie um arquivo .html ou .xls válido.');
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
      const parser = new DOMParser();
      const doc = parser.parseFromString(e.target.result, 'text/html');
      const table = doc.querySelector('table.boxedBody');

      if (!table) {
        console.error('Tabela .boxedBody não encontrada.');
        showError('O arquivo não contém uma tabela válida com a classe "boxedBody".');
        return;
      }

      const firstRow = table.querySelector('tr.LinhaImpar, tr.LinhaPar');
      if (!firstRow || firstRow.cells.length < 14) {
        console.error('Tabela inválida: menos de 14 colunas.');
        showError('A tabela não contém a coluna de saldo (coluna 13).');
        return;
      }

      currentTable = table;
      renderVehicleCards(table);
      renderMaterialsCard();
      renderSummary(table);
      renderMaintenanceModal();
      renderMiscModal();
    } catch (err) {
      console.error('Erro ao processar arquivo:', err.message);
      showError('Erro ao processar o arquivo: ' + err.message);
    }
  };
  reader.onerror = function (err) {
    console.error('Erro ao ler arquivo:', err.message);
    showError('Erro ao ler o arquivo: ' + err.message);
  };
  reader.readAsText(file);
}

// ==========================================================================
// Funções de Supabase
// ==========================================================================

// Carrega estados do Supabase
async function loadStateFromSupabase() {
  if (!supabase) {
    console.warn('Supabase não disponível. Pulando carregamento.');
    return;
  }
  try {
    console.log('Carregando dados do Supabase...');
    // Carregar maintenance_state
    const { data: maintenanceData, error: maintenanceError } = await supabase
      .from('maintenance_state')
      .select('plate, is_in_maintenance');
    if (maintenanceError) throw new Error(`Erro em maintenance_state: ${maintenanceError.message}`);

    maintenanceData.forEach(({ plate, is_in_maintenance }) => {
      if (desiredPlates.includes(plate)) {
        maintenanceState[plate] = is_in_maintenance;
      }
    });

    // Carregar materials_state
    const { data: materialsData, error: materialsError } = await supabase
      .from('materials_state')
      .select('material_id, current_quantity, stock_quantity');
    if (materialsError) throw new Error(`Erro em materials_state: ${materialsError.message}`);

    materialsData.forEach(({ material_id, current_quantity, stock_quantity }) => {
      if (materialsState.hasOwnProperty(material_id)) {
        materialsState[material_id] = {
          current: current_quantity,
          stock: stock_quantity
        };
      }
    });

    // Atualizar interface
    renderMaintenanceModal();
    renderMiscModal();
    if (currentTable) {
      renderVehicleCards(currentTable);
      renderSummary(currentTable);
    }
    renderMaterialsCard();
    renderFuelPricesCard();
    console.log('Dados carregados do Supabase com sucesso.');
  } catch (err) {
    console.error('Erro ao carregar dados do Supabase:', err.message);
    alert('Erro ao carregar dados do banco: ' + err.message + '. Usando valores padrão.');
  }
}

// Salva maintenance_state no Supabase
async function saveMaintenanceStateToSupabase() {
  if (!supabase) {
    console.warn('Supabase não disponível. Dados não salvos.');
    alert('Erro: Supabase não disponível. Dados não foram salvos. Verifique o console para detalhes.');
    return;
  }
  try {
    console.log('Salvando maintenance_state no Supabase...');
    const updates = Object.entries(maintenanceState).map(([plate, isInMaintenance]) => ({
      plate,
      is_in_maintenance: isInMaintenance
    }));

    const { error } = await supabase
      .from('maintenance_state')
      .upsert(updates, { onConflict: 'plate' });
    if (error) throw new Error(`Erro ao salvar maintenance_state: ${error.message}`);

    alert('Manutenção salva com sucesso!');
    console.log('maintenance_state salvo no Supabase:', updates);
  } catch (err) {
    console.error('Erro ao salvar maintenance_state:', err.message);
    alert('Erro ao salvar dados de manutenção: ' + err.message);
  }
}

// Salva materials_state no Supabase
async function saveMaterialsStateToSupabase() {
  if (!supabase) {
    console.warn('Supabase não disponível. Dados não salvos.');
    alert('Erro: Supabase não disponível. Dados não foram salvos. Verifique o console para detalhes.');
    return;
  }
  try {
    console.log('Salvando materials_state no Supabase...');
    const updates = Object.entries(materialsState).map(([material_id, { current, stock }]) => ({
      material_id,
      current_quantity: current,
      stock_quantity: stock
    }));

    const { error } = await supabase
      .from('materials_state')
      .upsert(updates, { onConflict: 'material_id' });
    if (error) throw new Error(`Erro ao salvar materials_state: ${error.message}`);

    alert('Materiais salvos com sucesso!');
    console.log('materials_state salvo no Supabase:', updates);
  } catch (err) {
    console.error('Erro ao salvar materials_state:', err.message);
    alert('Erro ao salvar dados de materiais: ' + err.message);
  }
}

// ==========================================================================
// Funções de Formatação e Validação
// ==========================================================================

// Exibe mensagem de erro
function showError(message) {
  const contentDiv = document.getElementById('content');
  contentDiv.innerHTML = `<p class="text-red-500 text-center">${message}</p>`;
}

// Converte string de saldo para número
function parseSaldo(valor) {
  return parseFloat(valor.replace('.', '').replace(',', '.')) || 0;
}

// Formata número como moeda brasileira
function formatCurrency(value) {
  return value.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

// Formata data e hora
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

// ==========================================================================
// Funções de Busca de Dados
// ==========================================================================

// Busca preços de combustíveis (fallback estático)
async function fetchFuelPrices() {
  try {
    const query = `
      SELECT
        produto,
        AVG(preco_venda) as preco_medio
      FROM
        basedosdados.br_anp_precos_combustiveis.microdados
      WHERE
        ano = 2025
        AND produto IN ('Gasolina C', 'Diesel', 'GNV', 'Etanol Hidratado')
        AND regiao = 'BRASIL'
      GROUP BY
        produto
    `;
    const data = await basedosdados.query(query, { billingProjectId: 'your-google-project-id' });
    const updatedPrices = { ...fuelPrices };
    data.forEach(row => {
      const produto = row.produto.toLowerCase();
      const preco = parseFloat(row.preco_medio) || 0;
      if (produto.includes('gasolina c')) updatedPrices.gasolina = preco;
      if (produto.includes('diesel')) updatedPrices.diesel = preco;
      if (produto.includes('gnv')) updatedPrices.gnv = preco;
      if (produto.includes('etanol hidratado')) updatedPrices.etanol = preco;
    });
    console.log('Preços de combustíveis atualizados:', updatedPrices);
    return updatedPrices;
  } catch (err) {
    console.error('Erro ao buscar preços:', err.message);
    return fuelPrices;
  }
}

// ==========================================================================
// Funções de Renderização
// ==========================================================================

// Renderiza cartões de veículos
function renderVehicleCards(table) {
  const contentDiv = document.getElementById('content');
  contentDiv.innerHTML = '';

  const plateData = {};
  table.querySelectorAll('tr.LinhaImpar, tr.LinhaPar').forEach(row => {
    const plate = row.cells[1]?.textContent.trim();
    if (plate && desiredPlates.includes(plate)) {
      const balanceRaw = row.cells[13]?.textContent.trim().replace('R$', '') || '0,00';
      plateData[plate] = balanceRaw;
    }
  });

  desiredPlates.forEach(plate => {
    const balanceRaw = plateData[plate] || '0,00';
    const balanceValue = parseSaldo(balanceRaw);
    const balanceDisplay = formatCurrency(balanceValue);
    const imgSrc = `img/car_img/${plate}.png`;
    const isInMaintenance = maintenanceState[plate] || false;

    const card = document.createElement('div');
    card.className = `modern-card ${isInMaintenance ? 'maintenance' : ''} loaded`;
    card.setAttribute('data-plate', plate);
    card.setAttribute('data-balance', balanceRaw);
    card.innerHTML = `
      <div class="mb-4">
        <img src="${imgSrc}" alt="Veículo ${plate}" class="loaded" onerror="this.parentElement.innerHTML='<div class=\\'no-image loaded\\'>Imagem não disponível</div>';"/>
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
  const card = document.createElement('div');
  card.className = 'modern-card p-6 bg-white loaded';
  card.setAttribute('data-materials-card', 'true');
  card.innerHTML = `
    <h2 class="text-center text-xl font-semibold text-gray-700 mb-9">Materiais Diversos</h2>
    <ul class="space-y-4 text-gray-700 text-sm">
      <li class="flex justify-between items-center loaded">
        <div class="flex items-center gap-3">
          <img src="./img/diversos_img/Agua_Mineral.png" class="w-10 h-10 object-contain loaded" alt="Água Mineral"/>
          <span>Água Mineral</span>
        </div>
        <span class="font-semibold text-gray-800 text-lg">${materialsState['Agua_Mineral'].current} / ${materialsState['Agua_Mineral'].stock}</span>
      </li>
      <li class="flex justify-between items-center loaded">
        <div class="flex items-center gap-3">
          <img src="./img/diversos_img/Gas_Cozinha.png" class="w-10 h-10 object-contain loaded" alt="Gás de Cozinha"/>
          <span>Gás de Cozinha</span>
        </div>
        <span class="font-semibold text-gray-800 text-lg">${materialsState['Gas_Cozinha'].current} / ${materialsState['Gas_Cozinha'].stock}</span>
      </li>
      <li class="flex justify-between items-center loaded">
        <div class="flex items-center gap-3">
          <img src="./img/diversos_img/Oleo_Maquina.png" class="w-10 h-10 object-contain loaded" alt="Óleo de Máquina"/>
          <span>Óleo de Máquina</span>
        </div>
        <span class="font-semibold text-gray-800 text-lg">${materialsState['Oleo_Maquina'].current} / ${materialsState['Oleo_Maquina'].stock}</span>
      </li>
    </ul>
  `;
  contentDiv.appendChild(card);
}

// Renderiza cartão de preços de combustíveis
async function renderFuelPricesCard() {
  const summaryContainer = document.getElementById('summaryContainer');
  const prices = await fetchFuelPrices();
  const card = document.createElement('div');
  card.className = 'modern-card p-6 bg-white loaded';
  card.setAttribute('data-fuel-prices-card', 'true');
  card.innerHTML = `
    <h2 class="text-center text-xl font-semibold text-gray-700 mb-6">Preços Médios de Combustíveis</h2>
    <ul class="space-y-4 text-gray-700 text-sm">
      <li class="flex justify-between items-center loaded">
        <div class="flex items-center gap-3">
          <img src="./img/combust_img/Gasol_Comun.png" class="w-10 h-10 object-contain loaded" alt="Gasolina"/>
          <span>Gasolina C.</span>
        </div>
        <span class="font-semibold text-gray-800 text-lg">R$ ${formatCurrency(prices.gasolina)}</span>
      </li>
      <li class="flex justify-between items-center loaded">
        <div class="flex items-center gap-3">
          <img src="./img/combust_img/Diesel_Comum.png" class="w-10 h-10 object-contain loaded" alt="Diesel"/>
          <span>Diesel C.</span>
        </div>
        <span class="font-semibold text-gray-800 text-lg">R$ ${formatCurrency(prices.diesel)}</span>
      </li>
      <li class="flex justify-between items-center loaded">
        <div class="flex items-center gap-3">
          <img src="./img/combust_img/Gás_Natural.png" class="w-10 h-10 object-contain loaded" alt="GNV"/>
          <span>Gás (GNV)</span>
        </div>
        <span class="font-semibold text-gray-800 text-lg">R$ ${formatCurrency(prices.gnv)}</span>
      </li>
      <li class="flex justify-between items-center loaded">
        <div class="flex items-center gap-3">
          <img src="./img/combust_img/Etanol_Comun.png" class="w-10 h-10 object-contain loaded" alt="Etanol"/>
          <span>Etanol C.</span>
        </div>
        <span class="font-semibold text-gray-800 text-lg">R$ ${formatCurrency(prices.etanol)}</span>
      </li>
      <li class="flex justify-between items-center loaded">
        <div class="flex items-center gap-3">
          <img src="./img/combust_img/Arla_32.png" class="w-10 h-10 object-contain loaded" alt="Arla 32"/>
          <span>Arla 32</span>
        </div>
        <span class="font-semibold text-gray-800 text-lg">R$ ${formatCurrency(prices.arla32)}</span>
      </li>
    </ul>
  `;
  summaryContainer.appendChild(card);
}

// Renderiza resumo de saldos e gráficos
function renderSummary(table) {
  const plateData = {};
  table.querySelectorAll('tr.LinhaImpar, tr.LinhaPar').forEach(row => {
    const plate = row.cells[1]?.textContent.trim();
    if (plate && desiredPlates.includes(plate)) {
      const balanceRaw = row.cells[13]?.textContent.trim().replace('R$', '') || '0,00';
      plateData[plate] = balanceRaw;
    }
  });

  let totalGeral = 0;
  let totalCPRSUL = 0;
  Object.entries(plateData).forEach(([plate, balanceRaw]) => {
    const balance = parseSaldo(balanceRaw);
    totalGeral += balance;
    if (placasCPRSUL.includes(plate)) totalCPRSUL += balance;
  });
  const totalCMASUL = totalGeral - totalCPRSUL;
  const cmaSulCount = desiredPlates.length - placasCPRSUL.length;
  const cprSulCount = placasCPRSUL.length;
  const maintenanceCount = Object.values(maintenanceState).filter(status => status).length;

  const summaryContainer = document.getElementById('summaryContainer');
  summaryContainer.innerHTML = '';

  const resumoCard = document.createElement('div');
  resumoCard.className = 'modern-card p-6 text-base text-gray-800 bg-white loaded';
  resumoCard.innerHTML = `
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
  summaryContainer.appendChild(resumoCard);

  const balanceCtx = document.getElementById('balancePieChart')?.getContext('2d');
  if (balanceCtx && totalCMASUL >= 0 && totalCPRSUL >= 0) {
    new Chart(balanceCtx, {
      type: 'pie',
      data: {
        labels: ['CMA SUL', 'CPR SUL'],
        datasets: [{ data: [totalCMASUL, totalCPRSUL], backgroundColor: ['#10B981', '#34D399'] }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: {
            callbacks: {
              label: (tooltipItem) => `${tooltipItem.label}: R$ ${formatCurrency(tooltipItem.raw)}`
            }
          }
        }
      }
    });
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
  renderFuelPricesCard().catch(err => {
    console.error('Erro ao renderizar preços:', err.message);
    const errorCard = document.createElement('div');
    errorCard.className = 'modern-card p-6 text-red-500 bg-white loaded';
    errorCard.innerHTML = '<p>Erro ao carregar preços de combustíveis.</p>';
    summaryContainer.appendChild(errorCard);
  });
}

// Renderiza modal de manutenção
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

  document.querySelectorAll('#maintenanceList input[type="checkbox"]').forEach(input => {
    input.addEventListener('change', (event) => {
      const plate = event.target.getAttribute('data-plate');
      maintenanceState[plate] = event.target.checked;
      updateVehicleCard(plate);
      updateQuantityCard();
      updateOperationChart();
    });
  });
}

// Renderiza modal de materiais diversos
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
    input.addEventListener('change', (event) => {
      const material = event.target.getAttribute('data-material');
      const type = event.target.getAttribute('data-type');
      materialsState[material][type] = parseInt(event.target.value) || 0;
      updateMaterialsCard();
    });
  });
}

// Atualiza cartão de veículo
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

// Atualiza cartão de materiais
function updateMaterialsCard() {
  const card = document.querySelector('.modern-card[data-materials-card="true"]');
  if (card) {
    card.innerHTML = `
      <h2 class="text-center text-xl font-semibold text-gray-700 mb-9">Materiais Diversos</h2>
      <ul class="space-y-4 text-gray-700 text-sm">
        <li class="flex justify-between items-center loaded">
          <div class="flex items-center gap-3">
            <img src="./img/diversos_img/Agua_Mineral.png" class="w-10 h-10 object-contain loaded" alt="Água Mineral"/>
            <span>Água Mineral</span>
          </div>
          <span class="font-semibold text-gray-800 text-lg">${materialsState['Agua_Mineral'].current} / ${materialsState['Agua_Mineral'].stock}</span>
        </li>
        <li class="flex justify-between items-center loaded">
          <div class="flex items-center gap-3">
            <img src="./img/diversos_img/Gas_Cozinha.png" class="w-10 h-10 object-contain loaded" alt="Gás de Cozinha"/>
            <span>Gás de Cozinha</span>
          </div>
          <span class="font-semibold text-gray-800 text-lg">${materialsState['Gas_Cozinha'].current} / ${materialsState['Gas_Cozinha'].stock}</span>
        </li>
        <li class="flex justify-between items-center loaded">
          <div class="flex items-center gap-3">
            <img src="./img/diversos_img/Oleo_Maquina.png" class="w-10 h-10 object-contain loaded" alt="Óleo de Máquina"/>
            <span>Óleo de Máquina</span>
          </div>
          <span class="font-semibold text-gray-800 text-lg">${materialsState['Oleo_Maquina'].current} / ${materialsState['Oleo_Maquina'].stock}</span>
        </li>
      </ul>
    `;
  }
}

// Atualiza cartão de quantidade
function updateQuantityCard() {
  const maintenanceCount = Object.values(maintenanceState).filter(status => status).length;
  const cmaSulCount = desiredPlates.length - placasCPRSUL.length;
  const cprSulCount = placasCPRSUL.length;

  const card = document.querySelector('#summaryContainer .modern-card:nth-child(2)');
  if (card) {
    card.innerHTML = `
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

// Atualiza gráfico de operação
function updateOperationChart() {
  const operationCtx = document.getElementById('operationPieChart')?.getContext('2d');
  if (operationCtx) {
    const { cmaSulCount, cprSulCount, maintenanceCount } = calculateOperationData();
    if (Chart.getChart(operationCtx)) Chart.getChart(operationCtx).destroy();
    new Chart(operationCtx, {
      type: 'pie',
      data: {
        labels: ['CMA SUL', 'CPR SUL', 'Manutenção'],
        datasets: [{ data: [cmaSulCount, cprSulCount, maintenanceCount], backgroundColor: ['#10B981', '#34D399', '#F59E0B'] }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'bottom' },
          tooltip: { callbacks: { label: (tooltipItem) => `${tooltipItem.label}: ${tooltipItem.raw} veículos` } }
        }
      }
    });
  }
}

// Calcula dados para gráfico de operação
function calculateOperationData() {
  const cmaSulCount = desiredPlates.length - placasCPRSUL.length;
  const cprSulCount = placasCPRSUL.length;
  const maintenanceCount = Object.values(maintenanceState).filter(status => status).length;
  return { cmaSulCount, cprSulCount, maintenanceCount };
}

// ==========================================================================
// Funções de Captura e Compartilhamento
// ==========================================================================

// Copia texto para a área de transferência
async function copyToClipboard(text) {
  try {
    await navigator.clipboard.writeText(text);
    console.log('Texto copiado para a área de transferência:', text);
  } catch (err) {
    console.error('Erro ao copiar:', err.message);
  }
}

// Baixa imagem do conteúdo
function downloadImage() {
  const content = document.getElementById('mainContent');
  const buttonContainer = document.querySelector('.button-container');
  if (buttonContainer) buttonContainer.style.display = 'none';

  copyToClipboard(formatDateTime());
  window.scrollTo(0, 0);

  setTimeout(() => {
    html2canvas(content, {
      useCORS: true,
      backgroundColor: '#ffffff',
      scale: 2
    }).then(canvas => {
      const link = document.createElement('a');
      link.download = 'Saldo dos Veiculos.png';
      link.href = canvas.toDataURL('image/png');
      link.click();
      if (buttonContainer) buttonContainer.style.display = '';
      console.log('Imagem baixada com sucesso.');
    }).catch(err => {
      console.error('Erro ao baixar imagem:', err.message);
      alert('Erro ao baixar imagem.');
    });
  }, 100);
}

// Compartilha imagem do conteúdo
async function shareImage() {
  const content = document.getElementById('mainContent');
  const buttonContainer = document.querySelector('.button-container');
  if (buttonContainer) buttonContainer.style.display = 'none';

  await copyToClipboard(formatDateTime());
  window.scrollTo(0, 0);

  try {
    const canvas = await html2canvas(content, {
      useCORS: true,
      backgroundColor: '#ffffff',
      scale: 2
    });
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const file = new File([blob], 'Saldo dos Veiculos.png', { type: 'image/png' });

    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      await navigator.share({
        files: [file],
        title: 'Extrato de Veículos',
        text: 'Confira o saldo atualizado.'
      });
      console.log('Imagem compartilhada com sucesso.');
    } else {
      alert('Compartilhamento não suportado pelo navegador.');
    }
  } catch (err) {
    console.error('Erro ao compartilhar:', err.message);
    alert('Erro ao compartilhar imagem.');
  } finally {
    if (buttonContainer) buttonContainer.style.display = '';
  }
}

// ==========================================================================
// Funções de Modais
// ==========================================================================

// Alterna modal de manutenção
function toggleMaintenanceModal(show) {
  const modal = document.getElementById('maintenanceModal');
  let backdrop = document.querySelector('.modal-backdrop');
  if (modal) {
    if (show && !backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';
      document.body.appendChild(backdrop);
    }
    modal.classList.toggle('hidden', !show);
    modal.classList.toggle('show', show);
    if (backdrop) {
      backdrop.classList.toggle('show', show);
      if (!show) backdrop.remove();
    }
  }
}

// Alterna modal de materiais
function toggleMiscModal(show) {
  const modal = document.getElementById('miscModal');
  let backdrop = document.querySelector('.modal-backdrop');
  if (modal) {
    if (show && !backdrop) {
      backdrop = document.createElement('div');
      backdrop.className = 'modal-backdrop';
      document.body.appendChild(backdrop);
    }
    modal.classList.toggle('hidden', !show);
    modal.classList.toggle('show', show);
    if (backdrop) {
      backdrop.classList.toggle('show', show);
      if (!show) backdrop.remove();
    }
  }
}

// ==========================================================================
// Inicialização e Eventos
// ==========================================================================

document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM carregado. Inicializando aplicação...');
  const loader = document.createElement('div');
  loader.className = 'loader';
  document.body.appendChild(loader);

  setTimeout(() => {
    document.body.classList.add('loaded');
    loader.remove();
    document.querySelectorAll('#mainContent, h1, .button-container, .modern-card, .modern-card img, .modern-card ul li, .no-image, .maintenance-badge, .chart-card canvas')
      .forEach((el, i) => setTimeout(() => el.classList.add('loaded'), i * 50));
    initializeDefaultStates();
  }, 500);

  document.getElementById('fileInput').addEventListener('change', (e) => {
    console.log('Arquivo selecionado:', e.target.files[0]?.name);
    processFile(e.target.files[0]);
  });
  document.getElementById('downloadBtn').addEventListener('click', () => {
    console.log('Iniciando download de imagem...');
    downloadImage();
  });
  document.getElementById('shareBtn').addEventListener('click', () => {
    console.log('Iniciando compartilhamento de imagem...');
    shareImage();
  });
  document.getElementById('maintenanceBtn').addEventListener('click', () => {
    console.log('Abrindo modal de manutenção...');
    toggleMaintenanceModal(true);
  });
  document.getElementById('closeModalBtn').addEventListener('click', () => {
    console.log('Fechando modal de manutenção...');
    toggleMaintenanceModal(false);
  });
  document.getElementById('confirmMaintenanceBtn').addEventListener('click', () => {
    console.log('Confirmando dados de manutenção...');
    saveMaintenanceStateToSupabase();
    toggleMaintenanceModal(false);
  });
  document.getElementById('miscBtn').addEventListener('click', () => {
    console.log('Abrindo modal de materiais...');
    toggleMiscModal(true);
  });
  document.getElementById('closeMiscModalBtn').addEventListener('click', () => {
    console.log('Fechando modal de materiais...');
    toggleMiscModal(false);
  });
  document.getElementById('confirmMiscBtn').addEventListener('click', () => {
    console.log('Confirmando dados de materiais...');
    saveMaterialsStateToSupabase();
    toggleMiscModal(false);
  });
});
