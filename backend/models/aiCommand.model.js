import mongoose from 'mongoose';

const aiCommandSchema = new mongoose.Schema({
  phrase: { type: String, required: true, unique: true }, // e.g., "open profile"
  route: { type: String, required: true },  // e.g., "/profile"
  description: { type: String },
  isActive: { type: Boolean, default: true }
}, { timestamps: true });

export default mongoose.model('AICommand', aiCommandSchema);
