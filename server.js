const express = require('express');
const multer = require('multer');

const app = express();
app.use(express.json());
app.use(express.static('public'));

// Diz ao multer para guardar os arquivos na pasta "uploads"
const upload = multer({ dest: 'uploads/' });

// "Banco de mentira": uma lista na memória.
// Quando o banco real estiver pronto, trocamos só esta parte.
const documentos = [];

app.get('/', (req, res) => {
  res.json({ mensagem: 'API no ar' });
});

// Recebe um documento
app.post('/documentos', upload.single('arquivo'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ erro: 'Envie um arquivo no campo "arquivo"' });
  }

  const documento = {
    id: documentos.length + 1,
    nomeOriginal: req.file.originalname,
    caminho: req.file.path,
    status: 'recebido',
    dados: null
  };

  documentos.push(documento);
  res.status(201).json(documento);
});

// Lista todos os documentos recebidos
app.get('/documentos', (req, res) => {
  res.json(documentos);
});

app.listen(3000, () => {
  console.log('Rodando em http://localhost:3000');
});