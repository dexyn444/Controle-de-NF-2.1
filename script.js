// =================================================================
// CONFIGURADO: Link definitivo do seu servidor hospedado no Render
// =================================================================
const API_URL = 'https://controle-de-nf-2-1.onrender.com/api';

const hoje = new Date().toLocaleDateString('pt-BR');
document.getElementById('current-work-date').textContent = hoje;

let dataTrabalhoAtiva = hoje;
let queue = [];

// Elementos do HTML
const entryForm = document.getElementById('nf-entry-form');
const nfInput = document.getElementById('nf-input');
const rowsContainer = document.getElementById('nf-rows');
const clearDoneBtn = document.getElementById('btn-clear-done');
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
const selectHistoryDays = document.getElementById('select-history-days');
const btnLoadHistory = document.getElementById('btn-load-history');
const btnBackToToday = document.getElementById('btn-back-to-today');

let isScannerMode = false;
let ocultarImpressasVisualmente = false;

// Buscar dados do banco de dados (MySQL na Nuvem) via Servidor Render
async function carregarDadosDoBanco() {
    const dataParam = dataTrabalhoAtiva.replace(/\//g, '-');
    try {
        const response = await fetch(`${API_URL}/nfs/${dataParam}`);
        queue = await response.json();
        render();
    } catch (error) {
        iaInsights.innerHTML = "❌ <strong>Erro:</strong> Não foi possível conectar ao servidor backend na Nuvem.";
    }
}

async function atualizarSelectHistorico() {
    try {
        const response = await fetch(`${API_URL}/dias-registrados`);
        let diasRegistrados = await response.json();
        
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
    } catch (e) {
        console.error("Erro ao carregar datas do histórico", e);
    }
}

// Enviar nova nota para o Banco de Dados (Railway)
async function salvarNotaNoBanco(nota) {
    try {
        await fetch(`${API_URL}/nfs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                id: nota.id,
                numero: nota.numero,
                timestamp: nota.timestamp,
                dataTrabalho: dataTrabalhoAtiva
            })
        });
        await atualizarSelectHistorico();
    } catch (error) {
        console.error("Erro ao salvar no banco", error);
    }
}

btnLoadHistory.addEventListener('click', () => {
    dataTrabalhoAtiva = selectHistoryDays.value;
    document.getElementById('current-work-date').textContent = dataTrabalhoAtiva;
    ocultarImpressasVisualmente = false;

    if (dataTrabalhoAtiva !== hoje) {
        nfInput.disabled = true;
        btnSubmit.disabled = true;
        nfInput.placeholder = "Bloqueado: Visualizando histórico...";
        btnBackToToday.classList.remove('hidden');
    } else {
        restaurarDiaAtual();
    }
    carregarDadosDoBanco();
});

btnBackToToday.addEventListener('click', restaurarDiaAtual);

function restaurarDiaAtual() {
    dataTrabalhoAtiva = hoje;
    document.getElementById('current-work-date').textContent = hoje;
    nfInput.disabled = false;
    btnSubmit.disabled = false;
    nfInput.placeholder = isScannerMode ? "Pode bipar..." : "Digite o número...";
    btnBackToToday.classList.add('hidden');
    atualizarSelectHistorico();
    carregarDadosDoBanco();
}

modeToggle.addEventListener('change', function() {
    if (dataTrabalhoAtiva !== hoje) return;
    isScannerMode = this.checked;
    if (isScannerMode) {
        modeLabel.textContent = "Modo Bipe";
        scannerIndicator.classList.remove('hidden');
        btnSubmit.classList.add('hidden');
        nfInput.focus();
    } else {
        modeLabel.textContent = "Modo Manual";
        scannerIndicator.classList.add('hidden');
        btnSubmit.classList.remove('hidden');
    }
});

document.addEventListener('click', (e) => {
    if (isScannerMode && dataTrabalhoAtiva === hoje) {
        if (!e.target.closest('button') && !e.target.closest('input') && !e.target.closest('select')) {
            nfInput.focus();
        }
    }
});

entryForm.addEventListener('submit', async function(e) {
    e.preventDefault();
    if (dataTrabalhoAtiva !== hoje) return;

    let rawValue = nfInput.value.trim();
    if (!rawValue) return;

    let cleanNumber = rawValue.replace(/\D/g, '');
    if (cleanNumber.length === 44) {
        cleanNumber = parseInt(cleanNumber.substring(25, 34), 10).toString();
    }

    if (queue.some(item => item.numero === cleanNumber)) {
        processarIA(cleanNumber, true);
        nfInput.value = '';
        return;
    }

    const novaNota = {
        id: Date.now() + Math.random(),
        numero: cleanNumber,
        timestamp: new Date().toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' }),
        impresso: false
    };

    queue.push(novaNota);
    render();
    nfInput.value = '';
    
    await salvarNotaNoBanco(novaNota);
    processarIA(cleanNumber, false);
});

rowsContainer.addEventListener('click', async (e) => {
    if (e.target.classList.contains('btn-action-ok')) {
        const id = parseFloat(e.target.getAttribute('data-id'));
        try {
            await fetch(`${API_URL}/nfs/${id}/imprimir`, { method: 'PUT' });
            const item = queue.find(x => x.id === id);
            if (item) item.impresso = true;
            render();
        } catch (err) {
            console.error(err);
        }
    }
});

clearDoneBtn.addEventListener('click', () => {
    ocultarImpressasVisualmente = true;
    render();
});

function render() {
    rowsContainer.innerHTML = '';
    let total = queue.length;
    let pendentes = 0;

    queue.forEach(item => {
        if (!item.impresso) pendentes++;
        if (ocultarImpressasVisualmente && item.impresso) return;

        const tr = document.createElement('tr');
        tr.innerHTML = `
            <td>${item.timestamp}</td>
            <td><strong>#${item.numero}</strong></td>
            <td><span class="badge ${item.impresso ? 'badge-success' : 'badge-pending'}">${item.impresso ? 'Impresso' : 'Pendente'}</span></td>
            <td class="text-right">
                ${!item.impresso ? `<button class="btn-action-ok" data-id="${item.id}">✔ Confirmar</button>` : '<span>✓ Processado</span>'}
            </td>
        `;
        rowsContainer.appendChild(tr);
    });

    mTotal.textContent = total;
    mPending.textContent = pendentes;
    mEfficiency.textContent = total > 0 ? `${Math.round(((total - pendentes) / total) * 100)}%` : '100%';
}

function processarIA(numeroNota, foiDuplicada) {
    if (foiDuplicada) {
        iaInsights.innerHTML = `🚨 <strong>Duplicidade:</strong> A nota #${numeroNota} já existe hoje.`;
    } else {
        iaInsights.innerHTML = `📥 <strong>Sucesso:</strong> Nota #${numeroNota} guardada com segurança no MySQL na Nuvem.`;
    }
}

// INTERPRETADOR DE COMANDOS DA IA (CONECTADO AO RENDER/RAILWAY)
async function executarComandoIA() {
    const comando = iaInput.value.toLowerCase().trim();
    if (!comando) return;

    const numerosEncontrados = comando.match(/\d+/);

    if (numerosEncontrados) {
        const numeroNota = numerosEncontrados[0];
        
        if (comando.includes('excluir') || comando.includes('apagar') || comando.includes('remover') || comando.includes('deletar')) {
            const dataParam = dataTrabalhoAtiva.replace(/\//g, '-');
            
            try {
                const response = await fetch(`${API_URL}/nfs/${numeroNota}/${dataParam}`, {
                    method: 'DELETE'
                });
                const resultado = await response.json();

                if (resultado.affectedRows > 0) {
                    iaInsights.innerHTML = `💥 <strong>Ação IA:</strong> Entendido! Localizei a nota <strong>#${numeroNota}</strong> no banco de dados de ${dataTrabalhoAtiva} e efetuei a exclusão permanente.`;
                    await carregarDadosDoBanco();
                } else {
                    iaInsights.innerHTML = `🔍 <strong>Ação IA:</strong> Você pediu para excluir a nota #${numeroNota}, mas ela não foi encontrada no histórico de (${dataTrabalhoAtiva}).`;
                }
            } catch (error) {
                iaInsights.innerHTML = `❌ <strong>Erro IA:</strong> Falha ao tentar excluir a nota do servidor MySQL na nuvem.`;
            }
        } else {
            iaInsights.innerHTML = `🤖 <strong>Dica da IA:</strong> Se deseja que eu apague a nota #${numeroNota}, digite algo como: <em>"excluir nota ${numeroNota}"</em>.`;
        }
    } else {
        iaInsights.innerHTML = `❓ <strong>Comando não reconhecido:</strong> Tente comandos diretos como: "excluir nota 123" ou "apagar 450".`;
    }
    iaInput.value = '';
}

btnIaCmd.addEventListener('click', executingComandoIA);
iaInput.addEventListener('keypress', (e) => { if (e.key === 'Enter') executarComandoIA(); });

// Inicialização
atualizarSelectHistorico();
carregarDadosDoBanco();
