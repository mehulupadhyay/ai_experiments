const router = require('express').Router();
const prisma = require('../config/database');
const { authenticate } = require('../middleware/auth');
const { requireEmailVerified } = require('../middleware/rbac');

router.use(authenticate, requireEmailVerified);

router.get('/', async (req, res) => {
  const { box = 'inbox' } = req.query;
  const where = box === 'sent'
    ? { senderId: req.user.id }
    : { recipientId: req.user.id };

  const messages = await prisma.message.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 50,
    include: {
      sender: { select: { id: true, firstName: true, lastName: true, role: true } },
      recipient: { select: { id: true, firstName: true, lastName: true, role: true } },
    },
  });
  res.json(messages);
});

router.post('/', async (req, res) => {
  const { recipientId, subject, body } = req.body;
  if (!recipientId || !body) return res.status(400).json({ error: 'recipientId and body required' });

  // Verify recipient is in same school
  const recipient = await prisma.user.findFirst({ where: { id: recipientId, schoolId: req.user.schoolId } });
  if (!recipient) return res.status(404).json({ error: 'Recipient not found' });

  const msg = await prisma.message.create({
    data: { senderId: req.user.id, recipientId, subject, body },
  });

  // Create in-app notification
  await prisma.notification.create({
    data: {
      userId: recipientId,
      type: 'IN_APP',
      title: `New message from ${req.user.firstName} ${req.user.lastName}`,
      body: subject || body.slice(0, 100),
      link: `/messages/${msg.id}`,
    },
  });

  res.status(201).json(msg);
});

router.patch('/:id/read', async (req, res) => {
  await prisma.message.updateMany({
    where: { id: req.params.id, recipientId: req.user.id },
    data: { isRead: true, readAt: new Date() },
  });
  res.json({ message: 'Marked as read' });
});

module.exports = router;
