const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', async (req, res) => {
  const { data, error } = await supabase.from('maintenances').select('*').eq('user_id', req.user.id).eq('deleted', false).order('tanggal', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/trash', async (req, res) => {
  const { data, error } = await supabase.from('maintenances').select('*').eq('user_id', req.user.id).eq('deleted', true);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/', async (req, res) => {
  const { data, error } = await supabase.from('maintenances').insert([{ ...req.body, user_id: req.user.id, deleted: false }]).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.put('/:id', async (req, res) => {
  const { data, error } = await supabase.from('maintenances').update(req.body).eq('id', req.params.id).eq('user_id', req.user.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/:id', async (req, res) => {
  const { data, error } = await supabase.from('maintenances').update({ deleted: true, deleted_at: new Date().toISOString() }).eq('id', req.params.id).eq('user_id', req.user.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/bulk-delete', async (req, res) => {
  const { ids } = req.body;
  const { error } = await supabase.from('maintenances').update({ deleted: true, deleted_at: new Date().toISOString() }).in('id', ids).eq('user_id', req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Deleted' });
});

router.post('/:id/restore', async (req, res) => {
  const { data, error } = await supabase.from('maintenances').update({ deleted: false, deleted_at: null }).eq('id', req.params.id).eq('user_id', req.user.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/:id/permanent', async (req, res) => {
  const { error } = await supabase.from('maintenances').delete().eq('id', req.params.id).eq('user_id', req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Permanently deleted' });
});

module.exports = router;
