const mongoose = require('mongoose');

const logSchema = new mongoose.Schema({
  fecha: { type: Date, default: Date.now },
  descripcion: { type: String, required: true },
  datos_afectados: { type: Array, default: [] },
});

module.exports = mongoose.model('Log', logSchema);
