const express = require('express');
const router = express.Router();
const supabase = require('../supabase');
const { authMiddleware } = require('../middleware/auth');

router.use(authMiddleware);

router.get('/', async (req, res) => {
  const { data, error } = await supabase.from('outlet_settings').select('*').eq('user_id', req.user.id).single();
  if (error) return res.status(500).json({ error: error.message });
  res.json(data);
});

router.put('/', async (req, res) => {
  const { data: existing } = await supabase.from('outlet_settings').select('id').eq('user_id', req.user.id).single();

  let result;
  if (existing) {
    result = await supabase.from('outlet_settings').update(req.body).eq('user_id', req.user.id).select().single();
  } else {
    result = await supabase.from('outlet_settings').insert([{ ...req.body, user_id: req.user.id }]).select().single();
  }

  if (result.error) return res.status(500).json({ error: result.error.message });
  res.json(result.data);
});

module.exports = router;
