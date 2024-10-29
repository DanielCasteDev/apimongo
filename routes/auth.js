const express = require('express');
const User = require('../models/user');
const Backup = require('../models/backup'); // Importar el modelo de respaldo
const crypto = require('crypto');

const router = express.Router();

// Registro de usuario
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Crear y guardar el nuevo usuario
    const newUser = new User({ username, password });
    await newUser.save();

    // Obtener el estado actual de todos los usuarios
    const allUsers = await User.find().lean();

    // Crear un nuevo backup con los datos actuales
    const newBackup = new Backup({ data: allUsers });
    await newBackup.save();

    res.status(201).json({ message: 'Usuario registrado y respaldo creado exitosamente' });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Error al registrar usuario' });
  }
});

// Login de usuario
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const user = await User.findOne({ username });

    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    res.status(200).json({ message: 'Login exitoso' });
  } catch (err) {
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// Crear un respaldo del estado actual de la base de datos
router.get('/respaldo', async (req, res) => {
  try {
    const users = await User.find().lean();
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: 'Error al generar respaldo' });
  }
});

// Detección de cambios (posible ataque)
router.post('/detectar-ataque', async (req, res) => {
  try {
    const { respaldo } = req.body; // JSON con los datos respaldados
    const usuariosActuales = await User.find().lean();

    const hashRespaldo = crypto.createHash('sha256').update(JSON.stringify(respaldo)).digest('hex');
    const hashActual = crypto.createHash('sha256').update(JSON.stringify(usuariosActuales)).digest('hex');

    if (hashRespaldo !== hashActual) {
      return res.status(200).json({ alerta: 'Posible manipulación detectada en la base de datos' });
    }

    res.status(200).json({ mensaje: 'No se detectaron cambios' });
  } catch (err) {
    res.status(500).json({ error: 'Error al verificar cambios' });
  }
});

module.exports = router;
