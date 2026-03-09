require('dotenv').config();
const express = require('express');
const cors = require('cors');

const authRoutes = require('./routes/auth');
const filmRoutes = require('./routes/film');
const orderRoutes = require('./routes/order');
const maintenanceRoutes = require('./routes/maintenance');
const equipmentRoutes = require('./routes/equipment');
const settingRoutes = require('./routes/setting');

const app = express();

app.use(cors({
  origin: process.env.FRONTEND_URL || '*',
  credentials: true
}));
app.use(express.json());

app.get('/', (req, res) => res.json({ message: 'Teknikal-XXI API Running' }));

app.use('/api/auth', authRoutes);
app.use('/api/film', filmRoutes);
app.use('/api/order', orderRoutes);
app.use('/api/maintenance', maintenanceRoutes);
app.use('/api/equipment', equipmentRoutes);
app.use('/api/setting', settingRoutes);

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

module.exports = app;
