// Data real de hoje (Usa o padrão do navegador)
const hoje = new Date().toLocaleDateString('pt-BR');
document.getElementById('current-work-date').textContent = hoje;

// Controla qual data está carregada na tela (pode ser hoje ou um dia do passado)
let dataTrabalhoAtiva = hoje;

// Banco de dados dinâmico baseado na data ativa
let queue = JSON.parse(localStorage.getItem(`nfs_${dataTrabalhoAtiva}`)) || [];

// Elementos da Interface
const entryForm = document.getElementById('nf-entry-form');
const nfInput = document.getElementById('nf-input');
const rowsContainer = document.getElementById('nf-rows');
const clearDoneBtn = document.getElementById('btn-clear-done');

// Elementos da IA e Modos
const modeToggle = document.getElementById('mode-toggle');
const modeLabel = document.getElementById('mode-label');
const scannerIndicator = document.getElementById('scanner-indicator');
const inputLabel = document.getElementById('input-label');
const inputHint = document.getElementById('input-hint');
const btnSubmit = document.getElementById('btn-submit');
const inputSection = document.querySelector('.input-section');
const iaInput = document.getElementById('ia-input');
const btnIaCmd = document.getElementById('btn-ia-cmd');

const mTotal = document.getElementById('metric-total');
const mPending = document.getElementById('metric-pending');
const mEfficiency = document.getElementById('metric-efficiency');
const iaInsights = document.getElementById('ia-insights');

// Elementos do Componente de Histórico
const selectHistoryDays = document.getElementById('select-history-days');
const btnLoadHistory = document.getElementById('btn-load-history');
const btnBackToToday = document.getElementById('btn-back-to-today');

let isScannerMode = false;
let ocultarImpressasVisualmente = false;

// Salva dados no LocalStorage isolados por data ativa
function salvarDados() {
    localStorage.setItem(`nfs_${dataTrabalhoAtiva}`, JSON.stringify(queue));
    // Só guarda no índice de dias se as notas forem criadas no dia de hoje
    if (dataTrabalhoAtiva === hoje) {
        registrarDiaNoIndice(hoje);
    }
}

// Cria uma lista separada de dias que já possuem alguma nota salva
function registrarDiaNoIndice(data) {
    let diasRegistrados = JSON.parse(localStorage.getItem('nfs_index_days')) || [];
    if (!diasRegistrados.includes(data)) {
        diasRegistrados.push(data);
        localStorage.setItem('nfs_index_days', JSON.stringify(diasRegistrados));
    }
    atualizarSelectHistorico();
}

// Recarrega o dropdown de datas com os dias armazenados
function atualizarSelectHistorico() {
    let diasRegistrados = JSON.parse(localStorage.getItem('nfs_index_days')) || [];
    
    if (!diasRegistrados.includes(hoje)) {
        diasRegistrados.unshift(hoje);
    }

    selectHistoryDays.innerHTML = '';
    diasRegistrados.forEach(dia => {
        const option = document.createElement('option');
        option.value = dia;
        option.textContent = dia === hoje ? `${dia} (Hoje)` : dia;
        if (dia === dataTrabalhoAtiva) option.selected = true;
        selectHistoryDays.appendChild(option);
    });
}

// Carrega as informações do dia escolhido no select
btnLoadHistory.addEventListener('click', () => {
    const diaSelecionado = selectHistoryDays.value;
    if (!diaSelecionado) return;

    dataTrabalhoAtiva = diaSelecionado;
    queue = JSON.parse(localStorage.getItem(`nfs_${dataTrabalhoAtiva}`)) || [];
    
    document.getElementById('current-work-date').textContent = dataTrabalhoAtiva;
    ocultarImpressasVisualmente = false;

    // Se estiver lendo o passado, bloqueia inserções por segurança
    if (dataTrabalhoAtiva !== hoje) {
        nfInput.disabled = true;
        btnSubmit.disabled = true;
        nfInput.placeholder = "Bloqueado: Visualizando dia histórico...";
        btnBackToToday.classList.remove('hidden');
        iaInsights.innerHTML = `📜 <strong>Modo Consulta:</strong> Você está revisando os registros do dia <strong>${dataTrabalhoAtiva}</strong>. Inserções desativadas para proteger o histórico.`;
    } else {
        restaurarDiaAtual();
    }

    render();
});

// Reseta o painel de volta para o dia de hoje
btnBackToToday.addEventListener('click', restaurarDiaAtual);

function restaurarDiaAtual() {
    dataTrabalhoAtiva = hoje;
    queue = JSON.parse(localStorage.getItem(`nfs_${hoje}`)) || [];
    document.getElementById('current-work-date').textContent = hoje;
    
    nfInput.disabled = false;
    btnSubmit.disabled = false;
    nfInput.placeholder = isScannerMode ? "Pode bipar agora..." : "Digite o número e clique em Registrar...";
    btnBackToToday.classList.add('hidden');
    
    atualizarSelectHistorico();
    render();
    iaInsights.innerHTML = `🎯 <strong>Painel Pronto:</strong> Retornado ao dia de trabalho atual (<strong>${hoje}</strong>).`;
}

// Chaveador de Modos (Manual/Bipe)
modeToggle.addEventListener('change', function() {
    if (dataTrabalhoAtiva !== hoje) return; // Não permite alterar modo vendo o passado
    
    isScannerMode = this.checked;
    if (isScannerMode) {
        modeLabel.textContent = "Modo Bipe (Leitor)";
        scannerIndicator.classList.remove('hidden');
        inputSection.classList.add('scanner-mode-active');
        inputLabel.textContent = "Aponte o leitor e Bipe o código";
        inputHint.textContent = "Modo Bipe Ativo: Salvamento automático instantâneo.";
        btnSubmit.classList.add('hidden');
        nfInput.placeholder = "Pode bipar agora...";
        nfInput.focus();
    } else {
        modeLabel.textContent = "Modo Manual";
        scannerIndicator.classList.add('hidden');
        inputSection.classList.remove('scanner-mode-active');
        inputLabel.textContent = "Inserir Número da NF";
        inputHint.textContent = "Modo Manual: Digite a nota e clique em Registrar.";
        btnSubmit.classList.remove('hidden');
        nfInput.placeholder = "Digite o número e clique em Registrar...";
    }
    processarIA('', false, 'mudanca_modo');
});

// Trava o foco no input apenas se estiver no modo Bipe e no dia de Hoje
document.addEventListener('click', (e) => {
    if (isScannerMode && dataTrabalhoAtiva === hoje) {
        const resetarFoco = !e.target.closest('button') && 
                            !e.target.closest('input') && 
                            !e.target.closest('label') &&
                            !e.target.closest('select');
        if (resetarFoco) {
            nfInput.focus();
        }
    }
});

// Entrada de notas fiscais
entryForm.addEventListener('submit', function(e) {
    e.preventDefault();
    if (dataTrabalhoAtiva !== hoje) return; // Trava contra gravação retroativa

    let rawValue = nfInput.value.trim();
    if (!rawValue) return;

    let cleanNumber = rawValue.replace(/\D/g, '');

    // Extração do sequencial da chave de acesso (44 dígitos)
    if (cleanNumber.length === 44) {
        const numeroExtraido = cleanNumber.substring(25, 34);
        cleanNumber = parseInt(numeroExtraido, 10).toString();
    }

    let duplicada = false;

    if (cleanNumber.length > 0) {
        if (queue.some(item => item.numero === cleanNumber)) {
            duplicada = true;
        } else {
            queue.push({
                id: Date.now() + Math.random(),
                numero: cleanNumber,
                timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
                impresso: false
            });
            salvarDados();
        }
    }

    nfInput.value = '';
    render();
    processarIA(cleanNumber, duplicada);
});

// Delegação de evento do botão confirmar impressão
rowsContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('btn-action-ok')) {
        const idParaMarcar = parseFloat(e.target.getAttribute('data-id'));
        marcarImpresso(idParaMarcar);
    }
});

function marcarImpresso(id) {
    const item = queue.find(x => x.id === id);
    if (item) {
        item.impresso = true;
        salvarDados();
        render();
        processarIA('', false, 'impressao');
    }
}

// Limpa de forma visual a visualização atual das notas impressas
clearDoneBtn.addEventListener('click', () => {
    ocultarImpressasVisualmente = true;
    render();
    processarIA('', false, 'limpeza');
});

// Comandos de exclusão por texto da IA
function executarComandoIA() {
    const comando = iaInput.value.toLowerCase().trim();
    if (!comando) return;

    const numerosEncontrados = comando.match(/\d+/);

    if (numerosEncontrados) {
        const numeroNota = numerosEncontrados[0];
        
        if (comando.includes('excluir') || comando.includes('apagar') || comando.includes('remover') || comando.includes('deletar')) {
            const indice = queue.findIndex(item => item.numero === numeroNota);
            
            if (indice !== -1) {
                queue.splice(indice, 1);
                salvarDados();
                render();
                iaInsights.innerHTML = `💥 <strong>Ação IA:</strong> Removi a nota <strong>#${numeroNota}</strong> do lote de <strong>${dataTrabalhoAtiva}</strong> com sucesso.`;
            } else {
                iaInsights.innerHTML = `🔍 <strong>Ação IA:</strong> Não localizei a nota #${numeroNota} no histórico de <strong>${dataTrabalhoAtiva}</strong>.`;
            }
        } else {
            iaInsights.innerHTML = `🤖 <strong>Dica da IA:</strong> Quer remover? Digite: <em>"excluir nota ${numeroNota}"</em>.`;
        }
    } else {
        iaInsights.innerHTML = `❓ <strong>Comando não compreendido.</strong>`;
    }
    iaInput.value = '';
}

btnIaCmd.addEventListener('click', executarComandoIA);
iaInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') executarComandoIA(); });

// Constrói as linhas na tabela
function render() {
    rowsContainer.innerHTML = '';
    let total = queue.length;
    let pendentes = 0;

    queue.forEach(item => {
        if (!item.impresso) pendentes++;

        if (ocultarImpressasVisualmente && item.impresso) return;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td style="font-family: monospace; color: var(--text-muted);">${item.timestamp}</td>
            <td style="font-family: monospace; font-weight: 700; font-size: 1.1rem; color: var(--accent);">#${item.numero}</td>
            <td>
                <span class="badge ${item.impresso ? 'badge-success' : 'badge-pending'}">
                    ${item.impresso ? 'Impresso' : 'Pendente'}
                </span>
            </td>
            <td class="text-right">
                ${!item.impresso ? `<button class="btn-action-ok" data-id="${item.id}">✔ Confirmar Impressão</button>` : '<span style="color: var(--success); font-size: 0.85rem; font-weight:600;">✓ Processado</span>'}
            </td>
        `;
        rowsContainer.appendChild(tr);
    });

    mTotal.textContent = total;
    mPending.textContent = pendentes;
    const ef = total > 0 ? Math.round(((total - pendentes) / total) * 100) : 100;
    mEfficiency.textContent = `${ef}%`;
}

// Gera logs e avisos do painel lateral da IA
function processarIA(numeroNota, foiDuplicada, gatilho = '') {
    const totalPendentes = queue.filter(x => !x.impresso).length;
    let log = "";

    if (gatilho === 'mudanca_modo') {
        log = isScannerMode 
            ? `🤖 <strong>Modo Bipe Ativado:</strong> Entrada pronta via leitor de código.`
            : `🤖 <strong>Modo Manual Ativado:</strong> Digite e clique para registrar a NF do dia de hoje.`;
        iaInsights.innerHTML = log;
        return;
    }

    if (foiDuplicada) {
        log += `🚨 <strong>Duplicidade:</strong> A nota <strong>#${numeroNota}</strong> já foi incluída hoje.`;
    } else if (numeroNota) {
        log += `📥 <strong>Arquivado:</strong> Nota <strong>#${numeroNota}</strong> registrada com sucesso.`;
        ocultarImpressasVisualmente = false;
    } else if (gatilho === 'impressao') {
        log += `✓ <strong>Despacho:</strong> Nota fiscal updated para status impresso.`;
    } else if (gatilho === 'limpeza') {
        log += `🧹 <strong>Filtro aplicado:</strong> Ocultando itens impressos da tela para organizar sua visão.`;
    }

    if (totalPendentes > 8 && dataTrabalhoAtiva === hoje) {
        log += `<br><br>⚠️ <strong>Alerta de Fluxo:</strong> Há muitas notas pendentes na fila de hoje. Realize a impressão para evitar gargalos.`;
    }
    iaInsights.innerHTML = log;
}

// Inicializa a montagem dos componentes no primeiro carregamento
atualizarSelectHistorico();
render();
