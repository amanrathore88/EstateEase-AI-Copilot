import AISetting from '../models/aiSetting.model.js';
import AICommand from '../models/aiCommand.model.js';

// Get public AI status (for chat widget visibility)
export const getAIStatus = async (req, res) => {
  try {
    const adminSetting = await AISetting.findOne({ key: 'is_ai_enabled_admin' });
    const sellerSetting = await AISetting.findOne({ key: 'is_ai_enabled_seller' });
    const buyerSetting = await AISetting.findOne({ key: 'is_ai_enabled_buyer' });
    const configSetting = await AISetting.findOne({ key: 'ai_chat_flow_config' });

    res.json({
      success: true,
      is_ai_enabled_admin: adminSetting ? adminSetting.value : true,
      is_ai_enabled_seller: sellerSetting ? sellerSetting.value : true,
      is_ai_enabled_buyer: buyerSetting ? buyerSetting.value : true,
      chat_flow_config: configSetting ? configSetting.value : null
    });
  } catch (error) {
    res.json({
      success: true,
      is_ai_enabled_admin: true,
      is_ai_enabled_seller: true,
      is_ai_enabled_buyer: true,
      chat_flow_config: null
    });
  }
};

// Get all AI settings and custom commands (Admin only)
export const getAISettings = async (req, res) => {
  try {
    const dbSettings = await AISetting.find();
    const commands = await AICommand.find().sort({ createdAt: -1 });

    // Format settings into a key-value object
    const settings = {
      is_ai_enabled_admin: true,
      is_ai_enabled_seller: true,
      is_ai_enabled_buyer: true,
      buyer_prompt: '',
      seller_prompt: '',
      admin_prompt: '',
    };

    dbSettings.forEach(s => {
      settings[s.key] = s.value;
    });

    res.json({
      success: true,
      settings,
      commands
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to retrieve AI settings',
      error: error.message
    });
  }
};

// Update or create an AI setting (Admin only)
export const updateAISetting = async (req, res) => {
  try {
    const { key, value } = req.body;

    if (!key) {
      return res.status(400).json({
        success: false,
        message: 'Setting key is required'
      });
    }

    const setting = await AISetting.findOneAndUpdate(
      { key },
      { value },
      { upsert: true, new: true }
    );

    res.json({
      success: true,
      message: `AI setting '${key}' updated successfully`,
      setting
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to update AI setting',
      error: error.message
    });
  }
};

// Add a new custom navigation command (Admin only)
export const createAICommand = async (req, res) => {
  try {
    const { phrase, route, description } = req.body;

    if (!phrase || !route) {
      return res.status(400).json({
        success: false,
        message: 'Phrase and route are required'
      });
    }

    const sanitizedPhrase = phrase.trim().toLowerCase();

    // Check if phrase already exists
    const existing = await AICommand.findOne({ phrase: sanitizedPhrase });
    if (existing) {
      return res.status(400).json({
        success: false,
        message: 'This trigger phrase has already been taught to the AI'
      });
    }

    const command = await AICommand.create({
      phrase: sanitizedPhrase,
      route: route.trim(),
      description: description ? description.trim() : ''
    });

    res.status(201).json({
      success: true,
      message: 'AI successfully trained on new command',
      command
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to create AI command',
      error: error.message
    });
  }
};

// Delete an AI command (Admin only)
export const deleteAICommand = async (req, res) => {
  try {
    const command = await AICommand.findByIdAndDelete(req.params.id);
    if (!command) {
      return res.status(404).json({
        success: false,
        message: 'Command not found'
      });
    }

    res.json({
      success: true,
      message: 'Command deleted successfully'
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to delete AI command',
      error: error.message
    });
  }
};

// Toggle AI command active status (Admin only)
export const toggleAICommand = async (req, res) => {
  try {
    const command = await AICommand.findById(req.params.id);
    if (!command) {
      return res.status(404).json({
        success: false,
        message: 'Command not found'
      });
    }

    command.isActive = !command.isActive;
    await command.save();

    res.json({
      success: true,
      message: `Command ${command.isActive ? 'activated' : 'deactivated'} successfully`,
      command
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Failed to toggle AI command',
      error: error.message
    });
  }
};
