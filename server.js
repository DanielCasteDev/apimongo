const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const authRoutes = require('./routes/auth');

const app = express();
const PORT = process.env.PORT || 4001;

// Middlewares
app.use(cors());
app.use(express.json());

// Conectar a MongoDB

mongoose.connect(process.env.MONGO_URI)
  .then(() => console.log('MongoDB conectado'))
  .catch((err) => console.error('Error conectando a MongoDB:', err));

// Rutas
app.use('/api/auth', authRoutes);

// Iniciar servidor
app.listen(PORT, () => console.log(`Servidor escuchando en puerto ${PORT}`));
