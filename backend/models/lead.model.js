import mongoose from 'mongoose';

const leadSchema = new mongoose.Schema({
  name: { type: String },
  email: { type: String },
  phone: { type: String },
  chatEmail: { type: String },
  chatPhone: { type: String },
  budget: { type: Number },
  locality: { type: String },
  city: { type: String },
  propertyType: { type: String },
  aiScore: { type: Number, default: 0 },
  aiPriority: {
    type: String,
    enum: ['hot', 'warm', 'cold'],
    default: 'cold'
  },
  intent: {
    type: String,
    enum: ['buyer', 'seller', 'renter', 'agent'],
    default: 'buyer'
  },
  buyerType: {
    type: String,
    enum: ['end-user', 'investor'],
    default: 'end-user'
  },
  aiSummary: { type: String },
  matchedProperties: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Property'
  }],
  status: {
    type: String,
    enum: ['new', 'contacted', 'converted', 'lost'],
    default: 'new'
  },
  chatTranscript: { type: String },
  source: {
    type: String,
    enum: ['chat', 'inquiry_form', 'contact_form'],
    default: 'chat'
  },
  viewedBy: [{ type: String }]
}, { timestamps: true });

const Lead = mongoose.model('Lead', leadSchema);
export default Lead;
