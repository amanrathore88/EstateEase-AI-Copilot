import mongoose from 'mongoose';

const aiSettingSchema = new mongoose.Schema({
  key: { type: String, required: true, unique: true }, // 'is_ai_enabled', 'buyer_prompt', 'seller_prompt', 'admin_prompt'
  value: { type: mongoose.Schema.Types.Mixed, required: true }
}, { timestamps: true });

export default mongoose.model('AISetting', aiSettingSchema);
