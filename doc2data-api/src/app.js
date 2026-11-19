const express = require('express');
const cors = require('cors');
const config = require('./config');
const { authenticate } = require('./middlewares/auth');
const { notFound, errorHandler } = require('./utils/errors');

const authRoutes = require('./routes/auth');
const usuariosRoutes = require('./routes/usuarios');
const { canaisRouter, tiposDocumentoRouter } = require('./routes/catalogos');
const documentosRoutes = require('./routes/documentos');
const processamentosRoutes = require('./routes/processamentos');
const validacoesRoutes = require('./routes/validacoes');
const exportacoesRoutes = require('./routes/exportacoes');

const app = express();

app.disable('x-powered-by');
app.use(cors({ origin: config.corsOrigins.includes('*') ? true : config.corsOrigins }));
app.use(express.json({ limit: '1mb' }));

// ---- Rotas públicas ----
app.get('/', (req, res) => res.json({ servico: 'doc2data-api', status: 'ok' }));
app.get('/health', (req, res) => res.json({ status: 'ok' }));
app.use('/auth', authRoutes);

// ---- Tudo abaixo exige login ----
app.use(authenticate);
app.get('/me', (req, res) => res.json(req.user));
app.use('/usuarios', usuariosRoutes);
app.use('/canais', canaisRouter);
app.use('/tipos-documento', tiposDocumentoRouter);
app.use('/documentos', documentosRoutes);
app.use('/processamentos', processamentosRoutes);
app.use('/validacoes', validacoesRoutes);
app.use('/exportacoes', exportacoesRoutes);

app.use(notFound);
app.use(errorHandler);

module.exports = app;
