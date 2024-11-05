const express = require('express');
const mongoose = require('mongoose');
const User = require('../models/user'); // Modelo de usuario
const Backup = require('../models/backup'); // Modelo de respaldo
const Log = require('../models/log'); // Importar el modelo de Log
const bcrypt = require('bcryptjs'); // Agregar la importación


const router = express.Router();
const SECRET = 'mi_super_secreto'; // Llave para el JWT

// **Función para crear respaldo**
const createBackup = async () => {
  const allUsers = await User.find().lean();
  const newBackup = new Backup({ data: allUsers });
  await newBackup.save();
};

// **Función para registrar en logs**
const logAction = async (descripcion, datos_afectados) => {
  const log = new Log({
    descripcion,
    datos_afectados
  });
  await log.save();
};

// **Ruta de Registro** - Registra usuario y genera respaldo automáticamente
router.post('/register', async (req, res) => {
  try {
    const { username, password } = req.body;

    // Crear el nuevo usuario
    const newUser = new User({ username, password });
    await newUser.save();

    // Generar respaldo automático después del registro
    await createBackup();

    // Registrar en logs
    await logAction('Usuario registrado', [{ usuario: username }]);

    res.status(201).json({ message: 'Usuario registrado y respaldo creado exitosamente' });
  } catch (err) {
    console.error(err);
    res.status(400).json({ error: 'Error al registrar usuario' });
  }
});

// **Ruta de Login** - Autenticación de usuario sin JWT
router.post('/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    console.log('Intentando iniciar sesión con:', { username, password });

    // Buscar usuario por nombre de usuario
    const user = await User.findOne({ username });
    if (!user) {
      console.log('Usuario no encontrado');
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }
    console.log('Usuario encontrado:', user);

    // Comparar la contraseña ingresada con la almacenada
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      console.log('Contraseña incorrecta');
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    console.log('Login exitoso');
    res.status(200).json({ message: 'Login exitoso' });

    // Registrar en logs de login
    await logAction('Usuario inició sesión', [{ usuario: username }]);

  } catch (err) {
    console.error('Error en el servidor:', err);
    res.status(500).json({ error: 'Error en el servidor' });
  }
});

// **Ruta para crear un usuario**
router.post('/users', async (req, res) => {
  try {
    const { username, password } = req.body;
    const newUser = new User({ username, password });
    await newUser.save();

    // Generar respaldo automático después de crear un usuario
    await createBackup();

    // Registrar en logs
    await logAction('Usuario creado', [{ usuario: username }]);

    res.status(201).json({ message: 'Usuario creado exitosamente' });
  } catch (error) {
    console.error(error);
    res.status(400).json({ error: 'Error al crear usuario' });
  }
});

// **Ruta para actualizar un usuario**

router.put('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { username, password } = req.body;

    // Encontrar el usuario por ID
    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ error: 'Usuario no encontrado' });
    }

    // Actualizar el nombre de usuario
    user.username = username;

    // Si se proporciona una nueva contraseña, se actualizará automáticamente debido al middleware pre('save') en el modelo
    if (password) {
      user.password = password; // El middleware se encargará de hashear la contraseña al guardarla
    }

    // Guardar el usuario actualizado
    await user.save(); // El middleware de hasheo de contraseña se ejecutará automáticamente

    // Generar respaldo automático después de actualizar un usuario
    await createBackup();

    // Registrar en logs
    await logAction('Usuario actualizado', [{ usuario: username, id }]);

    res.status(200).json({ message: 'Usuario actualizado exitosamente' });
  } catch (error) {
    console.error('Error al actualizar el usuario:', error);
    res.status(400).json({
      error: 'Error al actualizar usuario',
      details: error.message, // Puedes agregar detalles del error aquí para más información
    });
  }
});

// **Ruta para verificar cambios en contraseñas y registrar logs**
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

      // Verificar si las contraseñas hasheadas han cambiado directamente
      return userActual.password !== respaldoUser.password;
    });

    if (cambios.length > 0) {
      // Guardar los cambios en los logs
      await logAction('Se detectaron cambios en las contraseñas', cambios.map(c => ({ usuario: c.username, id: c._id })));

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

// **Ruta para eliminar un usuario**
router.delete('/users/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndDelete(id);
    if (!user) return res.status(404).json({ error: 'Usuario no encontrado' });

    // Generar respaldo automático después de eliminar un usuario
    await createBackup();

    // Registrar en logs
    await logAction('Usuario eliminado', [{ usuario: user.username, id }]);

    res.status(200).json({ message: 'Usuario eliminado exitosamente' });
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al eliminar usuario' });
  }
});

// **Ruta para obtener logs**
router.get('/logs', async (req, res) => {
  try {
    // Obtener logs ordenados por fecha
    const logs = await Log.find().sort({ fecha: -1 }).lean();

    // Actualizar respaldo con los usuarios actuales
    await createBackup();

    res.status(200).json(logs);
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: 'Error al obtener los logs' });
  }
});

// **Ruta para leer todos los usuarios**
router.get('/users', async (req, res) => {
  try {
    const users = await User.find().lean();
    res.status(200).json(users);
  } catch (error) {
    console.error(error);
    res.status(500).json({ error: 'Error al obtener usuarios' });
  }
});

module.exports = router;
