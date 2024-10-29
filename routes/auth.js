const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/user'); // Modelo de usuario
const Backup = require('../models/backup'); // Modelo de respaldo
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const Log = require('../models/log'); // Importar el modelo de Log


const router = express.Router();
const SECRET = 'mi_super_secreto'; // Llave para el JWT

// Función para generar hash de la contraseña
const hashData = (data) => crypto.createHash('sha256').update(data).digest('hex');

// **Ruta de Registro** - Registra usuario y genera respaldo automáticamente
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    const hashedPassword = hashData(password);
    const newUser = new User({ username, password: hashedPassword });
    await newUser.save();

    // Generar respaldo automático después del registro
    const allUsers = await User.find().lean();
    const usersWithHashes = allUsers.map(user => ({
      ...user,
      hash: hashData(user.password),
    }));

    const newBackup = new Backup({ data: usersWithHashes });
    await newBackup.save();

    res.status(201).json({ message: 'Usuario registrado y respaldo creado exitosamente' });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Error al registrar usuario' });
  }
});

// **Ruta de Login** - Autenticación de usuario con JWT
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const hashedPassword = hashData(password);

    const user = await User.findOne({ username, password: hashedPassword });

    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const token = jwt.sign({ id: user._id, username: user.username }, SECRET, {
      expiresIn: '1h',
    });

    res.status(200).json({ message: 'Login exitoso', token });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// **Ruta para Verificar Cambios en Contraseñas y Registrar Logs**
router.get('/verificar-cambios', async (req, res) => {
  try {
    const ultimoRespaldo = await Backup.findOne().sort({ fecha: -1 }).lean();
    if (!ultimoRespaldo) {
      return res.status(404).json({ alerta: 'No se encontró un respaldo' });
    }

    const usuariosActuales = await User.find().lean();
    const cambios = usuariosActuales.filter(userActual => {
      const respaldoUser = ultimoRespaldo.data.find(u => u._id.equals(userActual._id));
      if (!respaldoUser) return false;

      const hashActual = hashData(userActual.password);
      return hashActual !== respaldoUser.hash;
    });

    if (cambios.length > 0) {
      // Guardar los cambios en los logs
      const log = new Log({
        descripcion: 'Se detectaron cambios en las contraseñas',
        datos_afectados: cambios.map(c => ({ usuario: c.username, id: c._id })),
      });

      await log.save();

      return res.status(200).json({
        alerta: 'Se detectaron cambios en las contraseñas',
        cambios: cambios.map(c => ({ usuario: c.username, id: c._id })),
      });
    }

    res.status(200).json({ mensaje: 'No se detectaron cambios' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al verificar cambios' });
  }
});

router.get('/logs', async (req, res) => {
  try {
    const logs = await Log.find().sort({ fecha: -1 }).lean();
    res.status(200).json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener los logs' });
  }
});

module.exports = router;
