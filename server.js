require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(express.json({ limit: '10mb' }));
app.use(cors());
app.use(express.static(path.join(__dirname, 'public')));

app.use('/api/auth',       require('./routes/auth'));
app.use('/api/machines',   require('./routes/machines'));
app.use('/api/workspaces', require('./routes/workspaces'));
app.use('/api/history',    require('./routes/history'));

// Toutes les autres routes -> index.html (SPA)
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`✅ NECTA Monitor server running on port ${PORT}`));
