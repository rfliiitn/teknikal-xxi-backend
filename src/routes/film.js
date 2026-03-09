const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

const getBase = (req) => supabase.from('films').select('*').eq('user_id', req.user.id);

// Get all active films
router.get('/', async (req, res) => {
  const { data, error } = await getBase(req).eq('deleted', false).order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Get trash
router.get('/trash', async (req, res) => {
  const { data, error } = await getBase(req).eq('deleted', true).order('deleted_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Create film
router.post('/', async (req, res) => {
  const film = { ...req.body, user_id: req.user.id, deleted: false };
  const { data, error } = await supabase.from('films').insert([film]).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Update film
router.put('/:id', async (req, res) => {
  const { data, error } = await supabase.from('films').update(req.body).eq('id', req.params.id).eq('user_id', req.user.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Soft delete (move to trash)
router.delete('/:id', async (req, res) => {
  const { data, error } = await supabase.from('films')
    .update({ deleted: true, deleted_at: new Date().toISOString() })
    .eq('id', req.params.id).eq('user_id', req.user.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Bulk soft delete
router.post('/bulk-delete', async (req, res) => {
  const { ids } = req.body;
  const { error } = await supabase.from('films')
    .update({ deleted: true, deleted_at: new Date().toISOString() })
    .in('id', ids).eq('user_id', req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Deleted' });
});

// Restore from trash
router.post('/:id/restore', async (req, res) => {
  const { data, error } = await supabase.from('films')
    .update({ deleted: false, deleted_at: null })
    .eq('id', req.params.id).eq('user_id', req.user.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// Permanent delete
router.delete('/:id/permanent', async (req, res) => {
  const { error } = await supabase.from('films').delete().eq('id', req.params.id).eq('user_id', req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Permanently deleted' });
});

module.exports = router;
