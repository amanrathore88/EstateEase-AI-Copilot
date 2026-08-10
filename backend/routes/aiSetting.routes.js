import express from 'express';
import { protect, authorize } from '../middlewares/auth.middleware.js';
import {
  getAIStatus,
  getAISettings,
  updateAISetting,
  createAICommand,
  deleteAICommand,
  toggleAICommand
} from '../controllers/aiSetting.controller.js';

const aiSettingRouter = express.Router();

// Public route to check if AI is enabled (used by the chat widget)
aiSettingRouter.get('/status', getAIStatus);

// Protected Admin-only routes
aiSettingRouter.use(protect, authorize('admin'));

aiSettingRouter.get('/', getAISettings);
aiSettingRouter.post('/', updateAISetting);
aiSettingRouter.post('/commands', createAICommand);
aiSettingRouter.delete('/commands/:id', deleteAICommand);
aiSettingRouter.patch('/commands/:id/toggle', toggleAICommand);

export default aiSettingRouter;
