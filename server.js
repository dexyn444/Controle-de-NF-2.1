const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// Conexão com o Banco de Dados Local (Configuração Padrão XAMPP)
const db = mysql.createConnection({
    host: 'localhost',
    user: 'root',      
    password: '',      
    database: 'controle_fluxo'
});

db.connect(err => {
    if (err) {
        console.error('Erro ao conectar ao MySQL. Certifique-se de que ele está ativo no XAMPP:', err);
        return;
    }
    console.log('Conectado com sucesso ao MySQL!');
    
    // Criação automática da tabela caso ela não exista no banco
    const sqlTabela = `
        CREATE TABLE IF NOT EXISTS notas_fiscais (
            id VARCHAR(50) PRIMARY KEY,
            numero VARCHAR(20) NOT NULL,
            timestamp VARCHAR(10) NOT NULL,
            data_trabalho DATE NOT NULL,
            impresso TINYINT(1) DEFAULT 0
        );
    `;
    db.query(sqlTabela);
});

// Buscar notas de um dia específico
app.get('/api/nfs/:data', (req, res) => {
    const dataFormatada = req.params.data.split('-').reverse().join('-');
    db.query('SELECT * FROM notas_fiscais WHERE data_trabalho = ?', [dataFormatada], (err, results) => {
        if (err) return res.status(500).json(err);
        const formatadas = results.map(row => ({
            id: parseFloat(row.id),
            numero: row.numero,
            timestamp: row.timestamp,
            impresso: row.impresso === 1
        }));
        res.json(formatadas);
    });
});

// Inserir nota nova
app.post('/api/nfs', (req, res) => {
    const { id, numero, timestamp, dataTrabalho } = req.body;
    const dataFormatada = dataTrabalho.split('/').reverse().join('-');
    db.query('INSERT INTO notas_fiscais (id, numero, timestamp, data_trabalho) VALUES (?, ?, ?, ?)', 
    [id, numero, timestamp, dataFormatada], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true });
    });
});

// Alterar status de uma nota para impresso
app.put('/api/nfs/:id/imprimir', (req, res) => {
    db.query('UPDATE notas_fiscais SET impresso = 1 WHERE id = ?', [req.params.id], (err) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true });
    });
});

// ROTA CORRIGIDA: Excluir nota via comando de texto da IA
app.delete('/api/nfs/:numero/:data', (req, res) => {
    // Corrigido: Agora separa os dados usando o traço (-) enviado pelo script.js
    const dataFormatada = req.params.data.split('-').reverse().join('-'); 
    
    const query = 'DELETE FROM notas_fiscais WHERE numero = ? AND data_trabalho = ?';
    db.query(query, [req.params.numero, dataFormatada], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true, affectedRows: result.affectedRows });
    });
});

// Listar todas as datas únicas salvas (para alimentar o dropdown da tela)
app.get('/api/dias-registrados', (req, res) => {
    db.query('SELECT DISTINCT data_trabalho FROM notas_fiscais ORDER BY data_trabalho DESC', (err, results) => {
        if (err) return res.status(500).json(err);
        const dias = results.map(row => new Date(row.data_trabalho).toLocaleDateString('pt-BR', { timeZone: 'UTC' }));
        res.json(dias);
    });
});

app.listen(3000, () => console.log('Servidor Rodando com sucesso na Porta 3000!'));
