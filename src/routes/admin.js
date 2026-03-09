const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const { authMiddleware, adminMiddleware } = require('../middleware/auth');

router.use(authMiddleware);
router.use(adminMiddleware);

// Get semua users
router.get('/users', async (req, res) => {
  const { data, error } = await supabase
    .from('users')
    .select('id, email, nama_lengkap, nama_outlet, role, is_active, created_at')
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Toggle aktif/nonaktif user
router.put('/users/:id/toggle', async (req, res) => {
  const { data: user } = await supabase.from('users').select('is_active').eq('id', req.params.id).single();
  if (!user) return res.status(404).json({ error: 'User tidak ditemukan' });

  const { data, error } = await supabase
    .from('users')
    .update({ is_active: !user.is_active })
    .eq('id', req.params.id)
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Hapus user permanen
router.delete('/users/:id', async (req, res) => {
  const { error } = await supabase.from('users').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'User dihapus' });
});

// Statistik
router.get('/stats', async (req, res) => {
  const [users, films, orders, maintenances, outletList] = await Promise.all([
    supabase.from('users').select('id, is_active, created_at').neq('role', 'admin'),
    supabase.from('films').select('id, status_tayang, deleted'),
    supabase.from('orders').select('id, status_barang, deleted'),
    supabase.from('maintenances').select('id, deleted'),
    supabase.from('outlet_list').select('id, aktif'),
  ]);

  res.json({
    total_outlet: users.data?.length || 0,
    outlet_aktif: users.data?.filter(u => u.is_active).length || 0,
    outlet_nonaktif: users.data?.filter(u => !u.is_active).length || 0,
    total_film: films.data?.filter(f => !f.deleted).length || 0,
    film_sedang_tayang: films.data?.filter(f => !f.deleted && f.status_tayang === 'Sedang Tayang').length || 0,
    total_order: orders.data?.filter(o => !o.deleted).length || 0,
    order_belum_diterima: orders.data?.filter(o => !o.deleted && o.status_barang === 'Belum Diterima').length || 0,
    total_maintenance: maintenances.data?.filter(m => !m.deleted).length || 0,
    total_outlet_list: outletList.data?.length || 0,
  });
});

// --- OUTLET LIST ---

// Get semua outlet list
router.get('/outlet-list', async (req, res) => {
  const { data, error } = await supabase
    .from('outlet_list')
    .select('*')
    .order('nama_outlet', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Tambah outlet ke list
router.post('/outlet-list', async (req, res) => {
  const { nama_outlet } = req.body;
  if (!nama_outlet) return res.status(400).json({ error: 'Nama outlet wajib diisi' });

  const { data, error } = await supabase
    .from('outlet_list')
    .insert([{ nama_outlet }])
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Hapus outlet dari list
router.delete('/outlet-list/:id', async (req, res) => {
  const { error } = await supabase.from('outlet_list').delete().eq('id', req.params.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Outlet dihapus dari list' });
});

module.exports = router;