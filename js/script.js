// Importar o cliente Supabase
import { createClient } from '@supabase/supabase-js';

// Configuração do Supabase
const supabaseUrl = process.env.SUPABASE_URL || 'https://wnuialureqofvgefdfol.supabase.co'; // Substitua por sua URL do Supabase
const supabaseKey = process.env.SUPABASE_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndudWlhbHVyZXFvZnZnZWZkZm9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxNTQ2MzQsImV4cCI6MjA2OTczMDYzNH0.d_LEjNTIAuSagsaaJCsBWI9SaelBt4n8qzfxAPlRKgU'; // Substitua por sua chave anônima
const supabase = createClient(supabaseUrl, supabaseKey);

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

// Preços médios iniciais de combustíveis
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
// Funções de Manipulação de Dados com Supabase
// ==========================================================================

// Carregar estados do Supabase
async function loadStateFromSupabase() {
  try {
    // Carregar maintenance_state
    const { data: maintenanceData, error: maintenanceError } = await supabase
      .from('maintenance_state')
      .select('*');
    if (maintenanceError) {
      console.error('Erro ao carregar maintenance_state:', maintenanceError);
      alert('Erro ao carregar dados de manutenção. Usando valores padrão.');
      return;
    }
    maintenanceData.forEach(item => {
      if (desiredPlates.includes(item.plate)) {
        maintenanceState[item.plate] = item.is_in_maintenance;
      }
    });

    // Carregar materials_state
    const { data: materialsData, error: materialsError } = await supabase
      .from('materials_state')
      .select('*');
    if (materialsError) {
      console.error('Erro ao carregar materials_state:', materialsError);
      alert('Erro ao carregar dados de materiais. Usando valores padrão.');
      return;
    }
    materialsData.forEach(item => {
      materialsState[item.material_id] = {
        current: item.current_quantity,
        stock: item.stock_quantity
      };
    });

    // Renderizar interface após carregar os dados
    renderMaintenanceModal();
    renderMiscModal();
    if (currentTable) {
      renderVehicleCards(currentTable);
      renderMaterialsCard();
      renderSummary(currentTable);
    } else {
      renderMaterialsCard();
      renderFuelPricesCard();
    }
  } catch (err) {
    console.error('Erro geral ao carregar dados do Supabase:', err);
    alert('Erro ao conectar com o banco de dados. Verifique sua conexão.');
  }
}

// Salvar estados no Supabase
async function saveStateToSupabase() {
  try {
    // Salvar maintenance_state
    for (const [plate, isInMaintenance] of Object.entries(maintenanceState)) {
      const { error } = await supabase
        .from('maintenance_state')
        .upsert({ plate, is_in_maintenance: isInMaintenance });
      if (error) {
        console.error(`Erro ao salvar ${plate}:`, error);
        alert(`Erro ao salvar estado de manutenção para ${plate}.`);
      }
    }

    // Salvar materials_state
    for (const [material, { current, stock }] of Object.entries(materialsState)) {
      const { error } = await supabase
        .from('materials_state')
        .upsert({ material_id: material, current_quantity: current, stock_quantity: stock });
      if (error) {
        console.error(`Erro ao salvar ${material}:`, error);
        alert(`Erro ao salvar estado do material ${material}.`);
      }
    }
  } catch (err) {
    console.error('Erro geral ao salvar dados no Supabase:', err);
    alert('Erro ao salvar dados no banco. Tente novamente.');
  }
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

// As demais funções (processFile, renderVehicleCards, renderMaterialsCard, renderFuelPricesCard, renderSummary, updateVehicleCard, updateMaterialsCard, updateQuantityCard, updateOperationChart, calculateOperationData, formatDateTime, copyToClipboard, downloadImage, shareImage, toggleMaintenanceModal, toggleMiscModal, setupResponsiveElements) permanecem inalteradas do código original.

// ==========================================================================
// Inicialização e Eventos
// ==========================================================================

document.addEventListener('DOMContentLoaded', async () => {
  await initializeDefaultStates();

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
  }, 500);
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