// ==========================================================================
// Configuração do Supabase
// ==========================================================================

// O objeto `supabase` já está disponível globalmente via CDN
const supabase = window.supabase.createClient(
  'https://mqyhqkyrttqkldslifed.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im1xeWhxa3lydHRxa2xkc2xpZmVkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxODA0NDYsImV4cCI6MjA2OTc1NjQ0Nn0.PbbfeZAknDu7DvggU_tgCkgoJ9oEJzIH-Sq40PeYOzQ'
);

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

// ==========================================================================
// Funções de Inicialização
// ==========================================================================

// Inicializa os estados padrão de manutenção e materiais
async function initializeDefaultStates() {
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

// ==========================================================================
// Funções de Manipulação de Arquivos
// ==========================================================================

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
    const content = e.target.result;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(content, 'text/html');
      const table = doc.querySelector('table.boxedBody');

      if (!table) {
        console.error('Tabela .boxedBody não encontrada no arquivo.');
        showError('Erro: O arquivo não contém uma tabela válida com a classe "boxedBody".');
        return;
      }

      console.log('Tabela .boxedBody encontrada com sucesso:', table);
      currentTable = table;
      renderVehicleCards(table);
      renderMaterialsCard();
      renderSummary(table);
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
  reader.readAsText(file);
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
// Funções de Busca de Dados
// ==========================================================================

// Busca preços médios de combustíveis via Base dos Dados
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

    return updatedPrices;
  } catch (err) {
    console.error('Erro ao buscar preços da Base dos Dados:', err);
    return fuelPrices;
  }
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
        console.log(`Placa: ${plate}, Saldo Bruto: ${balanceRaw}`); // Log para depuração
      }
    }
  });

  desiredPlates.forEach(plate => {
    const balanceRaw = plateData[plate] || '0,00';
    const balanceValue = parseSaldo(balanceRaw);
    const balanceDisplay = formatCurrency(balanceValue);
    const imgSrc = `img/car_img/${plate}.png`;
    const isInMaintenance = maintenanceState[plate] || false;

    console.log(`Renderizando placa: ${plate}, Saldo: R$ ${balanceDisplay}, Manutenção: ${isInMaintenance}`); // Log para depuração

    const card = document.createElement('div');
    card.className = `modern-card ${isInMaintenance ? 'maintenance' : ''} loaded`; // Adicionar 'loaded' imediatamente
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
          <img src="./img/diversos_img/Agua_Mineral.png" class="w-10 h-10 object-contain loaded" alt="Ícone de garrafa de água mineral" onerror="this.parentElement.innerHTML='<div class=\\'no-image loaded\\'>Imagem não disponível</div>'; console.error('Erro ao carregar imagem: ./img/diversos_img/Agua_Mineral.png');"/>
          <span>Água Mineral</span>
        </div>
        <span class="font-semibold text-gray-800 text-lg">${materialsState['Agua_Mineral'].current} / ${materialsState['Agua_Mineral'].stock}</span>
      </li>
      <li class="flex justify-between items-center loaded">
        <div class="flex items-center gap-3">
          <img src="./img/diversos_img/Gas_Cozinha.png" class="w-10 h-10 object-contain loaded" alt="Ícone de botijão de gás" onerror="this.parentElement.innerHTML='<div class=\\'no-image loaded\\'>Imagem não disponível</div>'; console.error('Erro ao carregar imagem: ./img/diversos_img/Gas_Cozinha.png');"/>
          <span>Gás de Cozinha</span>
        </div>
        <span class="font-semibold text-gray-800 text-lg">${materialsState['Gas_Cozinha'].current} / ${materialsState['Gas_Cozinha'].stock}</span>
      </li>
      <li class="flex justify-between items-center loaded">
        <div class="flex items-center gap-3">
          <img src="./img/diversos_img/Oleo_Maquina.png" class="w-10 h-10 object-contain loaded" alt="Ícone de óleo de máquina" onerror="this.parentElement.innerHTML='<div class=\\'no-image loaded\\'>Imagem não disponível</div>'; console.error('Erro ao carregar imagem: ./img/diversos_img/Oleo_Maquina.png');"/>
          <span>Óleo de Máquina</span>
        </div>
        <span class="font-semibold text-gray-800 text-lg">${materialsState['Oleo_Maquina'].current} / ${materialsState['Oleo_Maquina'].stock}</span>
      </li>
    </ul>
  `;
  contentDiv.appendChild(extraCard);
}

// Renderiza cartão de preços de combustíveis
async function renderFuelPricesCard() {
  const summaryContainer = document.getElementById('summaryContainer');
  const prices = await fetchFuelPrices();
  const fuelCard = document.createElement('div');
  fuelCard.className = 'modern-card p-6 bg-white loaded';
  fuelCard.setAttribute('data-fuel-prices-card', 'true');
  fuelCard.innerHTML = `
    <h2 class="text-center text-xl font-semibold text-gray-700 mb-6">Preços Médios de Combustíveis</h2>
    <ul class="space-y-4 text-gray-700 text-sm">
      <li class="flex justify-between items-center loaded">
        <div class="flex items-center gap-3">
          <img src="./img/combust_img/Gasol_Comun.png" class="w-10 h-10 object-contain loaded" alt="Ícone de gasolina" onerror="this.parentElement.innerHTML='<div class=\\'no-image loaded\\'>Imagem não disponível</div>'; console.error('Erro ao carregar imagem: ./img/combust_img/Gasol_Comun.png');"/>
          <span>Gasolina C.</span>
        </div>
        <span class="font-semibold text-gray-800 text-lg">R$ ${formatCurrency(prices.gasolina)}</span>
      </li>
      <li class="flex justify-between items-center loaded">
        <div class="flex items-center gap-3">
          <img src="./img/combust_img/Diesel_Comum.png" class="w-10 h-10 object-contain loaded" alt="Ícone de diesel" onerror="this.parentElement.innerHTML='<div class=\\'no-image loaded\\'>Imagem não disponível</div>'; console.error('Erro ao carregar imagem: ./img/combust_img/Diesel_Comum.png');"/>
          <span>Diesel C.</span>
        </div>
        <span class="font-semibold text-gray-800 text-lg">R$ ${formatCurrency(prices.diesel)}</span>
      </li>
      <li class="flex justify-between items-center loaded">
        <div class="flex items-center gap-3">
          <img src="./img/combust_img/Gás_Natural.png" class="w-10 h-10 object-contain loaded" alt="Ícone de GNV" onerror="this.parentElement.innerHTML='<div class=\\'no-image loaded\\'>Imagem não disponível</div>'; console.error('Erro ao carregar imagem: ./img/combust_img/Gás_Natural.png');"/>
          <span>Gás (GNV)</span>
        </div>
        <span class="font-semibold text-gray-800 text-lg">R$ ${formatCurrency(prices.gnv)}</span>
      </li>
      <li class="flex justify-between items-center loaded">
        <div class="flex items-center gap-3">
          <img src="./img/combust_img/Etanol_Comun.png" class="w-10 h-10 object-contain loaded" alt="Ícone de etanol" onerror="this.parentElement.innerHTML='<div class=\\'no-image loaded\\'>Imagem não disponível</div>'; console.error('Erro ao carregar imagem: ./img/combust_img/Etanol_Comun.png');"/>
          <span>Etanol C.</span>
        </div>
        <span class="font-semibold text-gray-800 text-lg">R$ ${formatCurrency(prices.etanol)}</span>
      </li>
      <li class="flex justify-between items-center loaded">
        <div class="flex items-center gap-3">
          <img src="./img/combust_img/Arla_32.png" class="w-10 h-10 object-contain loaded" alt="Ícone de Arla 32" onerror="this.parentElement.innerHTML='<div class=\\'no-image loaded\\'>Imagem não disponível</div>'; console.error('Erro ao carregar imagem: ./img/combust_img/Arla_32.png');"/>
          <span>Arla 32</span>
        </div>
        <span class="font-semibold text-gray-800 text-lg">R$ ${formatCurrency(prices.arla32)}</span>
      </li>
    </ul>
  `;
  summaryContainer.appendChild(fuelCard);
}

// Renderiza resumo de saldos e gráficos
async function renderSummary(table) {
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

  try {
    await renderFuelPricesCard();
  } catch (err) {
    console.error('Erro ao renderizar cartão de preços:', err);
    const errorCard = document.createElement('div');
    errorCard.className = 'modern-card p-6 text-base text-red-500 bg-white loaded';
    errorCard.innerHTML = '<p>Erro ao carregar preços de combustíveis. Usando dados estáticos.</p>';
    summaryContainer.appendChild(errorCard);
  }
}

// ==========================================================================
// Funções de Renderização de Modais
// ==========================================================================

async function renderMaintenanceModal() {
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
      await saveMaintenanceToSupabase(plate, maintenanceState[plate]);
      updateVehicleCard(plate);
      updateQuantityCard();
      updateOperationChart();
    });
  });
}

async function renderMiscModal() {
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
      await saveMaterialsToSupabase(material, materialsState[material]);
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
      console.log(`Atualizando placa: ${plate}, Saldo: R$ ${balanceDisplay}`); // Log para depuração
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
            <img src="./img/diversos_img/Agua_Mineral.png" class="w-10 h-10 object-contain loaded" alt="Ícone de garrafa de água mineral" onerror="this.parentElement.innerHTML='<div class=\\'no-image loaded\\'>Imagem não disponível</div>'; console.error('Erro ao carregar imagem: ./img/diversos_img/Agua_Mineral.png');"/>
            <span>Água Mineral</span>
          </div>
          <span class="font-semibold text-gray-800 text-lg">${materialsState['Agua_Mineral'].current} / ${materialsState['Agua_Mineral'].stock}</span>
        </li>
        <li class="flex justify-between items-center loaded">
          <div class="flex items-center gap-3">
            <img src="./img/diversos_img/Gas_Cozinha.png" class="w-10 h-10 object-contain loaded" alt="Ícone de botijão de gás" onerror="this.parentElement.innerHTML='<div class=\\'no-image loaded\\'>Imagem não disponível</div>'; console.error('Erro ao carregar imagem: ./img/diversos_img/Gas_Cozinha.png');"/>
            <span>Gás de Cozinha</span>
          </div>
          <span class="font-semibold text-gray-800 text-lg">${materialsState['Gas_Cozinha'].current} / ${materialsState['Gas_Cozinha'].stock}</span>
        </li>
        <li class="flex justify-between items-center loaded">
          <div class="flex items-center gap-3">
            <img src="./img/diversos_img/Oleo_Maquina.png" class="w-10 h-10 object-contain loaded" alt="Ícone de óleo de máquina" onerror="this.parentElement.innerHTML='<div class=\\'no-image loaded\\'>Imagem não disponível</div>'; console.error('Erro ao carregar imagem: ./img/diversos_img/Oleo_Maquina.png');"/>
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
        <span class="text-gray-800 font-bold">${maintenanceCount} veículos</span>
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

  const formatted = `SALDO! ${dayName} - ${day}/${month}/${year} às ${hours}:${minutes}`;

  return formatted;
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

  // Obter data e hora formatada para a área de transferência
  const formatted = formatDateTime();

  // Copiar data e hora para a área de transferência
  copyToClipboard(formatted);

  // Oculta o contêiner de botões
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
      // Restaura o contêiner de botões
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

  // Obter data e hora formatada para a área de transferência
  const formatted = formatDateTime();

  // Copiar data e hora para a área de transferência
  await copyToClipboard(formatted);

  // Oculta o contêiner de botões
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
    alert('Erro ao compartilhar: ' + err.message);
  } finally {
    // Restaura o contêiner de botões
    if (buttonContainer) {
      buttonContainer.style.display = '';
    }
  }
}

// ==========================================================================
// Funções de Controle de Modais
// ==========================================================================

// Alterna a visibilidade do modal de manutenção
function toggleMaintenanceModal(show) {
  const modal = document.getElementById('maintenanceModal');
  let backdrop = document.querySelector('.modal-backdrop');

  if (modal) {
    // Adicionar classe modal-content ao contêiner interno
    const modalContent = modal.querySelector('div');
    if (modalContent) {
      modalContent.classList.add('modal-content');
    }

    // Criar ou remover backdrop
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

// Alterna a visibilidade do modal de materiais
function toggleMiscModal(show) {
  const modal = document.getElementById('miscModal');
  let backdrop = document.querySelector('.modal-backdrop');

  if (modal) {
    // Adicionar classe modal-content ao contêiner interno
    const modalContent = modal.querySelector('div');
    if (modalContent) {
      modalContent.classList.add('modal-content');
    }

    // Criar ou remover backdrop
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

// Configurações que impactam a responsividade da interface
function setupResponsiveElements() {
  // Gráficos com opção 'responsive: true' para adaptação a diferentes tamanhos de tela
  // Definido nas funções updateOperationChart e renderSummary

  // Modais com classes CSS que se adaptam via media queries
  // Definido nas funções toggleMaintenanceModal e toggleMiscModal

  // Layout de cartões gerenciado pelo CSS (grid com auto-fit)
  // Manipulação dinâmica do conteúdo em renderVehicleCards, renderMaterialsCard, renderFuelPricesCard e renderSummary

  // Ajuste de rolagem para captura de imagem em downloadImage e shareImage
  window.scrollTo(0, 0); // Garante que a captura comece do topo
}

// ==========================================================================
// Funções de Integração com Supabase
// ==========================================================================

async function saveMaintenanceToSupabase(plate, isInMaintenance) {
  try {
    const { error } = await supabase
      .from('maintenance')
      .upsert(
        { plate, is_in_maintenance: isInMaintenance },
        { onConflict: 'plate' }
      );
    if (error) {
      console.error('Erro ao salvar estado de manutenção no Supabase:', error);
      showError('Erro ao salvar estado de manutenção: ' + error.message);
    } else {
      console.log(`Estado de manutenção salvo para placa ${plate}: ${isInMaintenance}`);
    }
  } catch (err) {
    console.error('Erro inesperado ao salvar manutenção:', err);
    showError('Erro inesperado ao salvar manutenção: ' + err.message);
  }
}

async function saveMaterialsToSupabase(materialId, { current, stock }) {
  try {
    const { error } = await supabase
      .from('materials')
      .upsert(
        { material_id: materialId, current, stock },
        { onConflict: 'material_id' }
      );
    if (error) {
      console.error('Erro ao salvar materiais no Supabase:', error);
      showError('Erro ao salvar materiais: ' + error.message);
    } else {
      console.log(`Material salvo: ${materialId}, Atual: ${current}, Estoque: ${stock}`);
    }
  } catch (err) {
    console.error('Erro inesperado ao salvar materiais:', err);
    showError('Erro inesperado ao salvar materiais: ' + err.message);
  }
}

async function loadStateFromSupabase() {
  try {
    // Carregar estado de manutenção
    const { data: maintenanceData, error: maintenanceError } = await supabase
      .from('maintenance')
      .select('*');
    if (maintenanceError) {
      console.error('Erro ao carregar manutenção do Supabase:', maintenanceError);
      showError('Erro ao carregar manutenção: ' + maintenanceError.message);
      return;
    }
    if (maintenanceData) {
      maintenanceData.forEach(row => {
        if (desiredPlates.includes(row.plate)) {
          maintenanceState[row.plate] = row.is_in_maintenance;
        }
      });
    }

    // Carregar estado de materiais
    const { data: materialsData, error: materialsError } = await supabase
      .from('materials')
      .select('*');
    if (materialsError) {
      console.error('Erro ao carregar materiais do Supabase:', materialsError);
      showError('Erro ao carregar materiais: ' + materialsError.message);
      return;
    }
    if (materialsData) {
      const validMaterials = ['Agua_Mineral', 'Gas_Cozinha', 'Oleo_Maquina'];
      materialsData.forEach(row => {
        if (validMaterials.includes(row.material_id)) {
          materialsState[row.material_id] = {
            current: row.current,
            stock: row.stock
          };
        }
      });
    }

    // Atualizar interface após carregar os dados
    desiredPlates.forEach(plate => updateVehicleCard(plate));
    updateMaterialsCard();
    updateQuantityCard();
  } catch (err) {
    console.error('Erro inesperado ao carregar estados:', err);
    showError('Erro inesperado ao carregar estados: ' + err.message);
  }
}

// ==========================================================================
// Inicialização e Eventos
// ==========================================================================

// Inicializa a aplicação ao carregar o DOM
document.addEventListener('DOMContentLoaded', async () => {
  await initializeDefaultStates();
  renderMaintenanceModal();
  renderMiscModal();

  // Criar loader
  const loader = document.createElement('div');
  loader.className = 'loader';
  document.body.appendChild(loader);

  // Simular carregamento e adicionar classe 'loaded'
  setTimeout(() => {
    document.body.classList.add('loaded');
    loader.remove();

    // Adicionar classe 'loaded' aos elementos após o carregamento
    document.querySelectorAll('#mainContent, h1, .button-container').forEach((el, index) => {
      setTimeout(() => {
        el.classList.add('loaded');
      }, index * 50);
    });

    // Forçar exibição imediata dos cartões e seus elementos
    document.querySelectorAll('.modern-card, .modern-card img, .modern-card ul li, .no-image, .maintenance-badge, .chart-card canvas').forEach(el => {
      el.classList.add('loaded');
    });

    setupResponsiveElements();
  }, 100);
});

// Configura eventos de interação
document.getElementById('fileInput').addEventListener('change', (event) => {
  processFile(event.target.files[0]);
});

document.getElementById('downloadBtn').addEventListener('click', downloadImage);
document.getElementById('shareBtn').addEventListener('click', shareImage);
document.getElementById('maintenanceBtn').addEventListener('click', () => toggleMaintenanceModal(true));
document.getElementById('closeModalBtn').addEventListener('click', () => toggleMaintenanceModal(false));
document.getElementById('miscBtn').addEventListener('click', () => toggleMiscModal(true));
document.getElementById('closeMiscModalBtn').addEventListener('click', () => toggleMiscModal(false));
