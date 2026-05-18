const express = require('express');
const mysql = require('mysql2');
const cors = require('cors');

const app = express();
app.use(express.json());
app.use(cors());

// =================================================================
// CONFIGURADO COM POOL: Evita quedas e resolve o erro {"fatal": true}
// =================================================================
const db = mysql.createPool({
    host: 'autorack.proxy.rlwy.net',
    user: 'root',
    password: 'yxicJCODoLJakBvcfwgPsKBuDxnMxPse', // <-- Cole a sua senha do Railway aqui
    database: 'railway',
    port: 58285,
    waitForConnections: true,
    connectionLimit: 10,
    queueLimit: 0
});

// Testar a conexão do Pool e criar a tabela se não existir
db.getConnection((err, connection) => {
    if (err) {
        console.error('Erro ao conectar ao MySQL na Nuvem:', err);
        return;
    }
    console.log('Conectado com sucesso ao MySQL na Nuvem via Pool!');
    
    const sqlTabela = `
        CREATE TABLE IF NOT EXISTS notas_fiscais (
            id VARCHAR(50) PRIMARY KEY,
            numero VARCHAR(20) NOT NULL,
            timestamp VARCHAR(10) NOT NULL,
            data_trabalho DATE NOT NULL,
            impresso TINYINT(1) DEFAULT 0
        );
    `;
    connection.query(sqlTabela, (queryErr) => {
        if (queryErr) console.error('Erro ao criar tabela:', queryErr);
        connection.release(); // Libera a conexão de volta para a piscina
    });
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

// Excluir nota via comando de texto da IA
app.delete('/api/nfs/:numero/:data', (req, res) => {
    const dataFormatada = req.params.data.split('-').reverse().join('-'); 
    const query = 'DELETE FROM notas_fiscais WHERE numero = ? AND data_trabalho = ?';
    db.query(query, [req.params.numero, dataFormatada], (err, result) => {
        if (err) return res.status(500).json(err);
        res.json({ success: true, affectedRows: result.affectedRows });
    });
});

// Listar todas as datas únicas salvas
app.get('/api/dias-registrados', (req, res) => {
    db.query('SELECT DISTINCT data_trabalho FROM notas_fiscais ORDER BY data_trabalho DESC', (err, results) => {
        if (err) return res.status(500).json(err);
        const dias = results.map(row => new Date(row.data_trabalho).toLocaleDateString('pt-BR', { timeZone: 'UTC' }));
        res.json(dias);
    });
});

// Porta automática do Render ou 3000 local
const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => console.log(`Servidor rodando com sucesso na porta ${PORT}!`));
