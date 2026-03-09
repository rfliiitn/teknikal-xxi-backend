const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../supabase');

const ALLOWED_DOMAIN = '@cinema21.net';

// Register
router.post('/register', async (req, res) => {
  const { email, password, nama_outlet, nama_lengkap } = req.body;

  if (!email || !password || !nama_outlet || !nama_lengkap) {
    return res.status(400).json({ error: 'Semua field wajib diisi' });
  }

  if (!email.endsWith(ALLOWED_DOMAIN)) {
    return res.status(400).json({ error: `Hanya email ${ALLOWED_DOMAIN} yang diizinkan` });
  }

  // Check if outlet already registered
  const { data: existing } = await supabase
    .from('users')
    .select('id, nama_outlet')
    .eq('nama_outlet', nama_outlet)
    .single();

  if (existing) {
    return res.status(400).json({
      error: `Outlet "${nama_outlet}" sudah terdaftar`,
      already_registered: true
    });
  }

  // Check if email already used
  const { data: emailExists } = await supabase
    .from('users')
    .select('id')
    .eq('email', email)
    .single();

  if (emailExists) {
    return res.status(400).json({ error: 'Email sudah digunakan' });
  }

  const hashed = await bcrypt.hash(password, 10);

  const { data, error } = await supabase
    .from('users')
    .insert([{ email, password: hashed, nama_outlet, nama_lengkap, role: 'user' }])
    .select()
    .single();

  if (error) return res.status(500).json({ error: error.message });

  // Auto-create outlet settings
  await supabase.from('outlet_settings').insert([{
    user_id: data.id,
    nama_outlet: nama_outlet,
    yang_membuat_nama: '',
    yang_membuat_divisi: '',
    yang_mengetahui_nama: '',
    yang_mengetahui_divisi: ''
  }]);

  res.json({ message: 'Registrasi berhasil, silakan login' });
});

// Login
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email dan password wajib diisi' });
  }

  if (!email.endsWith(ALLOWED_DOMAIN)) {
    return res.status(400).json({ error: `Hanya email ${ALLOWED_DOMAIN} yang diizinkan` });
  }

  const { data: user, error } = await supabase
    .from('users')
    .select('*')
    .eq('email', email)
    .single();

  if (error || !user) {
    return res.status(401).json({ error: 'Email atau password salah' });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Email atau password salah' });
  }

  const token = jwt.sign(
    { id: user.id, email: user.email, role: user.role, nama_outlet: user.nama_outlet },
    process.env.JWT_SECRET,
    { expiresIn: '7d' }
  );

  res.json({
    token,
    user: { id: user.id, email: user.email, role: user.role, nama_outlet: user.nama_outlet, nama_lengkap: user.nama_lengkap }
  });
});

// Get current user
router.get('/me', async (req, res) => {
  const authHeader = req.headers.authorization;
  if (!authHeader) return res.status(401).json({ error: 'Unauthorized' });
  const token = authHeader.split(' ')[1];
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const { data: user } = await supabase.from('users').select('id,email,role,nama_outlet,nama_lengkap').eq('id', decoded.id).single();
    res.json(user);
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;
