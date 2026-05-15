const express = require('express');
const { requireAuth } = require('../middleware/auth');
const { chatWithPlantExpert } = require('../utils/gemini');
const { query } = require('../db');

const router = express.Router();

router.post('/public', async (req, res, next) => {
  try {
    const { question } = req.body;
    if (!question || !question.trim()) return res.status(400).json({ error: 'Question is required' });
    const answer = await chatWithPlantExpert(question.trim());
    res.json({ answer });
  } catch (err) {
    next(err);
  }
});

router.post('/', requireAuth, async (req, res, next) => {
  try {
    const { question } = req.body;
    if (!question) return res.status(400).json({ error: 'Question is required' });
    const answer = await chatWithPlantExpert(question);
    await query('INSERT INTO chat_messages (user_id, question, response) VALUES ($1, $2, $3)', [req.user.id, question, { answer }]);
    res.json({ answer });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
