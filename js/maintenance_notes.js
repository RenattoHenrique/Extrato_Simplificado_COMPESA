// Configuração do Supabase (deve corresponder ao script.js)
const supabase = window.supabase.createClient(
  'https://wnuialureqofvgefdfol.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6IndudWlhbHVyZXFvZnZnZWZkZm9sIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTQxNTQ2MzQsImV4cCI6MjA2OTczMDYzNH0.d_LEjNTIAuSagsaaJCsBWI9SaelBt4n8qzfxAPlRKgU'
);

// Dados iniciais para coordenação e placas (sincronizado com script.js)
const desiredPlates = [
  'RZO3G50', 'RZO2H73', 'SJE0D78', 'SJG1G06', 'QYY0G07',
  'SOD6G88', 'MAQ0003', 'MAQ0005', 'KII8770', 'PEW3772',
  'PCA5320'
];
const coordinations = ['CMA SUL', 'CPR SUL'];

// Estado para armazenar anotações de manutenção
let maintenanceNotes = [];

// Função para calcular o tempo ausente com base na data de entrada
function calculateDaysAbsent(entryDate) {
  if (!entryDate) return 0;
  const today = new Date();
  const entry = new Date(entryDate);
  if (isNaN(entry.getTime())) return 0;
  const diffTime = today - entry;
  const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
  return diffDays >= 0 ? diffDays : 0;
}

// Função para formatar data no formato DD/MM/YYYY
function formatDateToBrazilian(dateStr) {
  if (!dateStr) return '';
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return '';
  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  return `${day}/${month}/${year}`;
}

// Função para exibir notificação temporária (reutilizando ou simulando)
function showNotification(message) {
  const notification = document.createElement('div');
  notification.className = 'fixed top-4 right-4 bg-green-600 text-white px-4 py-2 rounded-lg shadow-lg z-50 opacity-0 transition-opacity duration-300';
  notification.textContent = message;
  document.body.appendChild(notification);

  setTimeout(() => {
    notification.classList.remove('opacity-0');
    notification.classList.add('opacity-100');
  }, 10);

  setTimeout(() => {
    notification.classList.remove('opacity-100');
    notification.classList.add('opacity-0');
    setTimeout(() => {
      notification.remove();
    }, 300);
  }, 2000);
}

// Função para mostrar erro (reutilizando ou simulando)
function showError(message) {
  const contentDiv = document.getElementById('content');
  if (contentDiv) {
    contentDiv.innerHTML = `<p class="text-red-500 text-center">${message}</p>`;
  } else {
    console.error('Erro: Elemento com id="content" não encontrado para exibir mensagem de erro');
  }
}

// Função para gerenciar o backdrop do modal usando a classe existente
function manageBackdrop(show) {
  console.log(`Gerenciando backdrop: show=${show}`);
  let backdrop = document.querySelector('.modal-backdrop');
  if (!backdrop) {
    console.log('Criando novo backdrop...');
    backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop';
    document.body.appendChild(backdrop);
  }
  if (show) {
    backdrop.classList.add('show');
    console.log('Backdrop ativado com classe "show"');
  } else {
    backdrop.classList.remove('show');
    console.log('Backdrop desativado, removendo "show"');
  }
  // Garantir que o backdrop esteja abaixo do modal
  backdrop.style.zIndex = '999';
}

// Função para carregar anotações do Supabase
async function loadMaintenanceNotesFromSupabase() {
  try {
    console.log('Carregando anotações de manutenção do Supabase...');
    const { data, error } = await supabase
      .from('maintenance_notes')
      .select('*')
      .order('entry_date', { ascending: false });
    if (error) {
      console.error('Erro ao carregar anotações do Supabase:', error);
      showError('Erro ao carregar anotações de manutenção: ' + error.message);
      return;
    }
    maintenanceNotes = data || [];
    console.log('Anotações carregadas:', maintenanceNotes);
    renderMaintenanceNotesModal();
  } catch (err) {
    console.error('Erro geral ao carregar anotações do Supabase:', err);
    showError('Erro geral ao carregar anotações de manutenção.');
  }
}

// Função para salvar anotações no Supabase
async function saveMaintenanceNoteToSupabase(note) {
  try {
    console.log('Salvando anotação no Supabase:', note);
    const { error } = await supabase
      .from('maintenance_notes')
      .insert([note]);
    if (error) {
      console.error('Erro ao salvar anotação no Supabase:', error);
      showError('Erro ao salvar anotação de manutenção: ' + error.message);
      return false;
    }
    console.log('Anotação salva com sucesso:', note);
    return true;
  } catch (err) {
    console.error('Erro geral ao salvar anotação no Supabase:', err);
    showError('Erro geral ao salvar anotação de manutenção.');
    return false;
  }
}

// Função para renderizar o modal de anotações de manutenção
function renderMaintenanceNotesModal() {
  console.log('Renderizando modal de anotações de manutenção...');
  const notesList = document.getElementById('maintenanceNotesList');
  if (!notesList) {
    console.error('Erro: Elemento com id="maintenanceNotesList" não encontrado');
    return;
  }
  notesList.innerHTML = '';

  maintenanceNotes.forEach(note => {
    const li = document.createElement('li');
    li.className = 'border-b border-gray-200 py-2';
    li.innerHTML = `
      <div class="text-gray-700">
        <strong>Placa:</strong> ${note.plate}<br>
        <strong>Coordenação:</strong> ${note.coordination}<br>
        <strong>Data de Entrada:</strong> ${formatDateToBrazilian(note.entry_date)}<br>
        <strong>Tempo Ausente:</strong> ${calculateDaysAbsent(note.entry_date)} dias<br>
        <strong>Nº Chamado:</strong> ${note.ticket_number}<br>
        <strong>Serviço:</strong> ${note.service}
      </div>
    `;
    notesList.appendChild(li);
  });

  const plateSelect = document.getElementById('maintenanceNotePlate');
  if (plateSelect) {
    plateSelect.innerHTML = '<option value="">Selecione uma placa</option>';
    desiredPlates.forEach(plate => {
      const option = document.createElement('option');
      option.value = plate;
      option.textContent = plate;
      plateSelect.appendChild(option);
    });
  } else {
    console.error('Erro: Elemento com id="maintenanceNotePlate" não encontrado');
  }

  const coordinationSelect = document.getElementById('maintenanceNoteCoordination');
  if (coordinationSelect) {
    coordinationSelect.innerHTML = '<option value="">Selecione uma coordenação</option>';
    coordinations.forEach(coord => {
      const option = document.createElement('option');
      option.value = coord;
      option.textContent = coord;
      coordinationSelect.appendChild(option);
    });
  } else {
    console.error('Erro: Elemento com id="maintenanceNoteCoordination" não encontrado');
  }

  const entryDateInput = document.getElementById('maintenanceNoteEntryDate');
  if (entryDateInput) {
    entryDateInput.addEventListener('change', () => {
      const daysAbsent = calculateDaysAbsent(entryDateInput.value);
      const daysAbsentInput = document.getElementById('maintenanceNoteDaysAbsent');
      if (daysAbsentInput) {
        daysAbsentInput.value = daysAbsent;
      } else {
        console.error('Erro: Elemento com id="maintenanceNoteDaysAbsent" não encontrado');
      }
    });
  } else {
    console.error('Erro: Elemento com id="maintenanceNoteEntryDate" não encontrado');
  }
}

// Função para exportar anotações como TXT
function exportMaintenanceNotesToTxt() {
  console.log('Exportando anotações como TXT...');
  const txtContent = maintenanceNotes.map(note => `
*PLACA:* ${note.plate}
*COORDENAÇÃO:* ${note.coordination}
*DATA DE ENTRADA NA OFICINA:* ${formatDateToBrazilian(note.entry_date)}
*TEMPO AUSENTE:* ${calculateDaysAbsent(note.entry_date)} dias
*Nº CHAMADO:* ${note.ticket_number}
*SERVIÇO:* ${note.service}
───────────────────`).join('\n').trim();

  const blob = new Blob([txtContent], { type: 'text/plain' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'Anotacoes_Manutencao.txt';
  link.click();
  URL.revokeObjectURL(link.href);
  showNotification('Anotações exportadas como TXT!');
}

// Função para exportar anotações como Excel
function exportMaintenanceNotesToExcel() {
  console.log('Exportando anotações como Excel...');
  const worksheetData = maintenanceNotes.map(note => ({
    Placa: note.plate,
    Coordenação: note.coordination,
    'Data de Entrada': formatDateToBrazilian(note.entry_date),
    'Tempo Ausente (dias)': calculateDaysAbsent(note.entry_date),
    'Nº Chamado': note.ticket_number,
    Serviço: note.service
  }));

  const worksheet = XLSX.utils.json_to_sheet(worksheetData);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, 'Anotações de Manutenção');
  XLSX.writeFile(workbook, 'Anotacoes_Manutencao.xlsx');
  showNotification('Anotações exportadas como Excel!');
}

// Função para abrir/fechar o modal de anotações
function toggleMaintenanceNotesModal(show) {
  console.log(`Toggling modal maintenanceNotesModal: show=${show}`);
  const modal = document.getElementById('maintenanceNotesModal');
  if (modal) {
    // Ajustar z-index do modal para garantir que fique acima do backdrop
    modal.style.zIndex = '1001'; // Acima de 1000 (modal) e 999 (backdrop)
    manageBackdrop(show);
    modal.classList.toggle('hidden', !show);
    modal.classList.toggle('show', show);
    if (show) {
      renderMaintenanceNotesModal();
    } else {
      const form = document.getElementById('maintenanceNotesForm');
      if (form) form.reset();
      const daysAbsentInput = document.getElementById('maintenanceNoteDaysAbsent');
      if (daysAbsentInput) daysAbsentInput.value = '';
      // Restaurar z-index padrão após fechar
      modal.style.zIndex = '1000';
    }
  } else {
    console.error('Erro: Modal com id="maintenanceNotesModal" não encontrado no DOM');
  }
}

// Adicionar eventos ao carregar o DOM
document.addEventListener('DOMContentLoaded', () => {
  console.log('DOM carregado, configurando eventos para maintenanceNotesModal');
  const notesBtn = document.getElementById('maintenanceNotesBtn');
  if (notesBtn) {
    console.log('Botão maintenanceNotesBtn encontrado, adicionando evento de clique');
    notesBtn.addEventListener('click', () => {
      console.log('Botão maintenanceNotesBtn clicado, abrindo modal');
      toggleMaintenanceNotesModal(true);
    });
  } else {
    console.error('Erro: Botão com id="maintenanceNotesBtn" não encontrado no DOM');
  }

  const closeNotesModalBtn = document.getElementById('closeNotesModalBtn');
  if (closeNotesModalBtn) {
    closeNotesModalBtn.addEventListener('click', () => {
      console.log('Botão closeNotesModalBtn clicado, fechando modal');
      toggleMaintenanceNotesModal(false);
    });
  } else {
    console.error('Erro: Botão com id="closeNotesModalBtn" não encontrado no DOM');
  }

  const saveNoteBtn = document.getElementById('saveNoteBtn');
  if (saveNoteBtn) {
    saveNoteBtn.addEventListener('click', async () => {
      console.log('Botão saveNoteBtn clicado, salvando anotação');
      const plate = document.getElementById('maintenanceNotePlate').value;
      const coordination = document.getElementById('maintenanceNoteCoordination').value;
      const entryDate = document.getElementById('maintenanceNoteEntryDate').value;
      const ticketNumber = document.getElementById('maintenanceNoteTicketNumber').value;
      const service = document.getElementById('maintenanceNoteService').value;

      if (!plate || !coordination || !entryDate || !ticketNumber || !service) {
        showError('Por favor, preencha todos os campos obrigatórios.');
        return;
      }

      const note = {
        plate,
        coordination,
        entry_date: entryDate,
        ticket_number: ticketNumber,
        service
      };

      const success = await saveMaintenanceNoteToSupabase(note);
      if (success) {
        maintenanceNotes.push(note);
        renderMaintenanceNotesModal();
        showNotification('Anotação salva com sucesso!');
      }
    });
  } else {
    console.error('Erro: Botão com id="saveNoteBtn" não encontrado no DOM');
  }

  const exportTxtBtn = document.getElementById('exportTxtBtn');
  if (exportTxtBtn) {
    exportTxtBtn.addEventListener('click', () => {
      exportMaintenanceNotesToTxt();
    });
  } else {
    console.error('Erro: Botão com id="exportTxtBtn" não encontrado no DOM');
  }

  const exportExcelBtn = document.getElementById('exportExcelBtn');
  if (exportExcelBtn) {
    exportExcelBtn.addEventListener('click', () => {
      exportMaintenanceNotesToExcel();
    });
  } else {
    console.error('Erro: Botão com id="exportExcelBtn" não encontrado no DOM');
  }

  // Carregar anotações do Supabase
  loadMaintenanceNotesFromSupabase();
});