import express from 'express';
import { protect } from '../middlewares/auth.middleware.js';
import { generateDescription, estimatePrice, chatWithAssistant, retryLeadSubmission } from '../controllers/ai.controller.js';

const router = express.Router();

// All AI routes require authentication
router.use(protect);

router.post('/generate-description', generateDescription);
router.post('/estimate-price', estimatePrice);
router.post('/chat', chatWithAssistant);
router.post('/retry-lead', retryLeadSubmission);

export default router;
