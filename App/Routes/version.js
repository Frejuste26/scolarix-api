import { Router } from 'express';
const router = Router();

router.get('/version', (req, res) => {
  res.json({
    name: 'SCOLARIX API',
    version: '1.0.0',
    status: 'stable',
    timestamp: new Date().toISOString()
  });
});

export default router;
