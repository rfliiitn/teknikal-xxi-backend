const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const { authMiddleware } = require('../middleware/auth');
router.use(authMiddleware);

const TABLE_NAME = 'servers';
const AAM_NAME = 'AAM LIBRARY';

// Auto-create AAM LIBRARY jika belum ada
const ensureAAM = async (user_id) => {
  const { data } = await supabase.from(TABLE_NAME)
    .select('id').eq('user_id', user_id).ilike('type_server', AAM_NAME).single();
  if (!data) {
    await supabase.from(TABLE_NAME).insert([{
      user_id, type_server: AAM_NAME, deleted: false, is_aam: true
    }]);
  }
};

router.get('/', async (req, res) => {
  await ensureAAM(req.user.id);
  const { data, error } = await supabase.from(TABLE_NAME)
    .select('*').eq('user_id', req.user.id).eq('deleted', false)
    .order('is_aam', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

// GET servers yang terdaftar di studios (untuk dropdown FilmTab)
router.get('/in-studio', async (req, res) => {
  await ensureAAM(req.user.id);
  // Ambil semua server_id dari studios user ini
  const { data: studios, error: stErr } = await supabase.from('studios')
    .select('server_id').eq('user_id', req.user.id).eq('deleted', false).not('server_id', 'is', null);
  if (stErr) return res.status(500).json({ error: stErr.message });

  const serverIds = [...new Set(studios.map(s => s.server_id))];

  // Ambil AAM Library juga (selalu masuk)
  const { data: aamData } = await supabase.from(TABLE_NAME)
    .select('id').eq('user_id', req.user.id).ilike('type_server', AAM_NAME).single();

  const allIds = aamData ? [...new Set([...serverIds, aamData.id])] : serverIds;

  if (allIds.length === 0) return res.json([]);

  const { data, error } = await supabase.from(TABLE_NAME)
    .select('*, studios(studio_number)')
    .in('id', allIds).eq('deleted', false)
    .order('is_aam', { ascending: false })
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.get('/trash', async (req, res) => {
  const { data, error } = await supabase.from(TABLE_NAME).select('*').eq('user_id', req.user.id).eq('deleted', true);
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/', async (req, res) => {
  const { data, error } = await supabase.from(TABLE_NAME)
    .insert([{ ...req.body, user_id: req.user.id, deleted: false, is_aam: false }]).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.put('/:id', async (req, res) => {
  // Cek apakah AAM — kalau iya, hanya boleh edit kapasitas dan size_terpakai
  const { data: existing } = await supabase.from(TABLE_NAME).select('is_aam').eq('id', req.params.id).single();
  let payload = req.body;
  if (existing?.is_aam) {
    const { type_server, is_aam, deleted, ...allowed } = req.body;
    payload = allowed;
  }
  const { data, error } = await supabase.from(TABLE_NAME).update(payload)
    .eq('id', req.params.id).eq('user_id', req.user.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/:id', async (req, res) => {
  // Cek AAM — tidak boleh dihapus
  const { data: existing } = await supabase.from(TABLE_NAME).select('is_aam').eq('id', req.params.id).single();
  if (existing?.is_aam) return res.status(403).json({ error: 'AAM Library tidak dapat dihapus' });
  const { data, error } = await supabase.from(TABLE_NAME)
    .update({ deleted: true, deleted_at: new Date().toISOString() })
    .eq('id', req.params.id).eq('user_id', req.user.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.post('/:id/restore', async (req, res) => {
  const { data, error } = await supabase.from(TABLE_NAME)
    .update({ deleted: false, deleted_at: null }).eq('id', req.params.id).eq('user_id', req.user.id).select().single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.delete('/:id/permanent', async (req, res) => {
  const { data: existing } = await supabase.from(TABLE_NAME).select('is_aam').eq('id', req.params.id).single();
  if (existing?.is_aam) return res.status(403).json({ error: 'AAM Library tidak dapat dihapus' });
  const { error } = await supabase.from(TABLE_NAME).delete().eq('id', req.params.id).eq('user_id', req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ message: 'Permanently deleted' });
});

module.exports = router;