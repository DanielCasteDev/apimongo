const mongoose = require('mongoose');

const backupSchema = new mongoose.Schema({
  fecha: { type: Date, default: Date.now },
  data: { type: Array, required: true },
});

module.exports = mongoose.model('Backup', backupSchema);
