const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const { authMiddleware } = require('../middleware/auth');
router.use(authMiddleware);

const TABLE_NAME = 'servers';
const AAM_NAME = 'AAM LIBRARY';

const ensureAAM = async (user_id) => {
  const { data } = await supabase.from(TABLE_NAME)
    .select('id').eq('user_id', user_id).ilike('type_server', AAM_NAME);
  if (!data || data.length === 0) {
    await supabase.from(TABLE_NAME).insert([{
      user_id, type_server: AAM_NAME, deleted: false, is_aam: true
    }]);
  }
};

router.get('/', async (req, res) => {
  await ensureAAM(req.user.id);
  const { data, error } = await supabase.from(TABLE_NAME)
    .select('*').eq('user_id', req.user.id).eq('deleted', false)
    .order('created_at', { ascending: true });
  if (error) return res.status(500).json({ error: error.message });
  // AAM selalu paling atas
  const sorted = [...(data || [])].sort((a, b) => (b.is_aam ? 1 : 0) - (a.is_aam ? 1 : 0));
  res.json(sorted);
});

// Server yang terdaftar di studios + AAM Library
router.get('/in-studio', async (req, res) => {
  await ensureAAM(req.user.id);

  // 1. Ambil semua servers user
  const { data: allServers, error: sErr } = await supabase.from(TABLE_NAME)
    .select('*').eq('user_id', req.user.id).eq('deleted', false);
  if (sErr) return res.status(500).json({ error: sErr.message });

  // 2. Ambil semua studios user
  const { data: studios, error: stErr } = await supabase.from('studios')
    .select('server_id, studio_number').eq('user_id', req.user.id).eq('deleted', false);
  if (stErr) return res.status(500).json({ error: stErr.message });

  // 3. Buat map server_id -> [studio_number, ...] (bisa lebih dari 1)
  const studioMap = {};
  (studios || []).forEach(s => {
    if (s.server_id) {
      if (!studioMap[s.server_id]) studioMap[s.server_id] = [];
      studioMap[s.server_id].push(s.studio_number);
    }
  });

  // 4. Expand: server yang dipakai di N studio jadi N baris
  const studioServerIds = new Set(Object.keys(studioMap));
  const result = [];
  (allServers || []).forEach(sv => {
    if (sv.is_aam) {
      result.push({ ...sv, studio_number: null });
    } else if (studioServerIds.has(sv.id)) {
      const studioNums = studioMap[sv.id];
      studioNums.sort((a, b) => String(a).localeCompare(String(b), undefined, { numeric: true }));
      studioNums.forEach(num => result.push({ ...sv, studio_number: num }));
    }
  });

  result.sort((a, b) => {
    if (a.is_aam) return -1;
    if (b.is_aam) return 1;
    return String(a.studio_number).localeCompare(String(b.studio_number), undefined, { numeric: true });
  });

  res.json(result);
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