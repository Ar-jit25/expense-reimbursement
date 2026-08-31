const lineService = require('../services/line.service');

class LineController {
  async add(req, res) {
    try {
      const { date, amount, category, description } = req.body;
      if (!date || !amount || !category || !description) {
        return res.status(400).json({ error: 'Missing required fields' });
      }
      
      const line = await lineService.addLine(req.params.id, { date, amount, category, description });
      res.status(201).json(line);
    } catch (err) {
      console.error(err);
      // Prisma throws on invalid Enum
      if (err.code === 'P2009' || err.message.includes('Invalid enum value')) {
        return res.status(400).json({ error: 'Invalid expense category' });
      }
      res.status(500).json({ error: 'Failed to add expense line' });
    }
  }

  async update(req, res) {
    try {
      const line = await lineService.updateLine(req.params.lineId, req.body);
      res.json(line);
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to update expense line' });
    }
  }

  async remove(req, res) {
    try {
      await lineService.removeLine(req.params.lineId);
      res.status(204).send();
    } catch (err) {
      console.error(err);
      res.status(500).json({ error: 'Failed to delete expense line' });
    }
  }
}

module.exports = new LineController();
