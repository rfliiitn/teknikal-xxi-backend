const express = require('express');
const router = express.Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const supabase = require('../supabase');

const ALLOWED_DOMAIN = '@cinema21.net';

// Get daftar outlet list (public - untuk halaman register)
router.get('/outlet-list', async (req, res) => {
  const { search } = req.query;

  let query = supabase
    .from('outlet_list')
    .select('nama_outlet, kota')
    .eq('aktif', true)
    .order('nama_outlet', { ascending: true });

  if (search) query = query.ilike('nama_outlet', `%${search}%`);

  const { data: outletList } = await query;
  const { data: registered } = await supabase.from('users').select('nama_outlet');
  const registeredNames = (registered || []).map(u => u.nama_outlet);

  const result = (outletList || []).map(o => ({
    nama_outlet: o.nama_outlet,
    kota: o.kota,
    sudah_terdaftar: registeredNames.includes(o.nama_outlet)
  }));

  res.json(result);
});

// Register
router.post('/register', async (req, res) => {
  const { email, password, nama_outlet, nama_lengkap } = req.body;

  if (!email || !password || !nama_outlet || !nama_lengkap) {
    return res.status(400).json({ error: 'Semua field wajib diisi' });
  }

  if (!email.endsWith(ALLOWED_DOMAIN)) {
    return res.status(400).json({ error: `Hanya email ${ALLOWED_DOMAIN} yang diizinkan` });
  }

  const { data: outletValid } = await supabase
    .from('outlet_list').select('nama_outlet').eq('nama_outlet', nama_outlet).single();

  if (!outletValid) {
    return res.status(400).json({ error: 'Outlet tidak terdaftar dalam daftar resmi' });
  }

  const { data: existing } = await supabase
    .from('users').select('id').eq('nama_outlet', nama_outlet).single();

  if (existing) {
    return res.status(400).json({ error: `Outlet "${nama_outlet}" sudah terdaftar`, already_registered: true });
  }

  const { data: emailExists } = await supabase
    .from('users').select('id').eq('email', email).single();

  if (emailExists) {
    return res.status(400).json({ error: 'Email sudah digunakan' });
  }

  const { data: usernameExists } = await supabase
    .from('users').select('id').eq('nama_lengkap', nama_lengkap).single();

  if (usernameExists) {
    return res.status(400).json({ error: 'Username sudah digunakan, pilih username lain' });
  }

  const hashed = await bcrypt.hash(password, 10);

  const { data, error } = await supabase
    .from('users')
    .insert([{ email, password: hashed, nama_outlet, nama_lengkap, role: 'user', is_active: true }])
    .select().single();

  if (error) return res.status(500).json({ error: error.message });

  await supabase.from('outlet_settings').insert([{
    user_id: data.id, nama_outlet,
    yang_membuat_nama: '', yang_membuat_divisi: '',
    yang_mengetahui_nama: '', yang_mengetahui_divisi: ''
  }]);

  res.json({ message: 'Registrasi berhasil, silakan login' });
});

// Login - bisa pakai email atau username
router.post('/login', async (req, res) => {
  const { email, password } = req.body;

  if (!email || !password) {
    return res.status(400).json({ error: 'Email/username dan password wajib diisi' });
  }

  let user, error;

  if (email.includes('@')) {
    if (!email.endsWith(ALLOWED_DOMAIN)) {
      return res.status(400).json({ error: `Hanya email ${ALLOWED_DOMAIN} yang diizinkan` });
    }
    ({ data: user, error } = await supabase.from('users').select('*').eq('email', email).single());
  } else {
    ({ data: user, error } = await supabase.from('users').select('*').eq('nama_lengkap', email).single());
  }

  if (error || !user) {
    return res.status(401).json({ error: 'Email/username atau password salah' });
  }

  if (!user.is_active) {
    return res.status(403).json({ error: 'Akun Anda telah dinonaktifkan. Hubungi admin.' });
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    return res.status(401).json({ error: 'Email/username atau password salah' });
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
    const { data: user } = await supabase.from('users').select('id,email,role,nama_outlet,nama_lengkap,is_active').eq('id', decoded.id).single();
    res.json(user);
  } catch {
    res.status(401).json({ error: 'Invalid token' });
  }
});

module.exports = router;