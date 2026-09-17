import { getEmbedding, getGeminiClient, generateText, generateJSON } from '../utils/gemini.js';
import { generateTextWithGroq, generateJSONWithGroq } from '../utils/groq.js';
import Property from '../models/property.models.js';
import User from '../models/user.model.js';
import Lead from '../models/lead.model.js';
import Inquiry from '../models/inquiry.model.js';
import Wishlist from '../models/wishlist.model.js';
import Conversation from '../models/conversation.model.js';
import AISetting from '../models/aiSetting.model.js';
import AICommand from '../models/aiCommand.model.js';
import Message from '../models/message.model.js';

// Cosine similarity helper for vector search
const cosineSimilarity = (vecA, vecB) => {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) return 0;
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
};

// 1. Generate Property Description
export const generateDescription = async (req, res) => {
  try {
    const { title, propertyType, city, area, bhk, furnishing, amenities } = req.body;

    if (!title || !propertyType || !city || !area) {
      return res.status(400).json({
        success: false,
        message: 'Title, property type, city, and area are required.'
      });
    }

    const prompt = `Write a compelling, professional, and SEO-friendly real estate listing description for a property with the following details:
    - Title: ${title}
    - Type: ${propertyType}
    - Location: ${area}, ${city}
    - Configuration: ${bhk ? `${bhk} BHK` : ''} ${furnishing || ''}
    - Amenities: ${Array.isArray(amenities) ? amenities.join(', ') : amenities || 'None'}
    
    Highlight the lifestyle benefits, neighborhood convenience, and value of the property. Keep it under 200 words. Do not include placeholders.`;

    const description = await generateTextWithGroq(prompt, 'You are an expert real estate copywriter.');
    res.json({ success: true, description: description.trim() });
  } catch (error) {
    console.error('GENERATE_DESCRIPTION_ERROR:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 2. Estimate Property Price
export const estimatePrice = async (req, res) => {
  try {
    const { city, area, propertyType, bhk, areaSize, furnishing } = req.body;

    if (!city || !propertyType) {
      return res.status(400).json({
        success: false,
        message: 'City and property type are required.'
      });
    }

    // Query comparable listings in the database
    const query = {
      city: new RegExp(`^${city.trim()}$`, 'i'),
      propertyType,
      status: 'sale'
    };
    if (bhk) query.bhk = bhk;

    const comparables = await Property.find(query)
      .limit(8)
      .select('price areaSize furnishing title');

    const prompt = `You are a real estate valuation expert. Estimate a fair market price range (in Indian Rupees - INR) for the following property:
    - Type: ${propertyType}
    - Location: ${area || 'Unknown area'}, ${city}
    - Size: ${areaSize ? `${areaSize} sq. ft.` : 'Unknown size'}
    - Configuration: ${bhk ? `${bhk} BHK` : 'Unknown BHK'}, ${furnishing || 'Unknown furnishing'}
    
    Comparable properties in the database:
    ${JSON.stringify(comparables)}
    
    If there are no comparable properties, estimate based on general market trends in ${city} for a ${propertyType}. Make sure the price is realistic.
    Return the response in clean JSON format matching this structure:
    {
      "minPrice": number,
      "maxPrice": number,
      "recommendedPrice": number,
      "explanation": "string"
    }`;

    const estimation = await generateJSONWithGroq(prompt);
    res.json({ success: true, estimation });
  } catch (error) {
    console.error('ESTIMATE_PRICE_ERROR:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// City Normalization Helper
const normalizeCity = (city) => {
  if (!city) return "";
  const c = city.trim().toLowerCase();
  if (c.includes('gurgaon') || c.includes('gurugram')) return 'Gurugram';
  if (c.includes('delhi') || c.includes('new delhi')) return 'Delhi';
  if (c.includes('noida')) return 'Noida';
  if (c.includes('mumbai') || c.includes('bombay')) return 'Mumbai';
  if (c.includes('bengaluru') || c.includes('bangalore')) return 'Bengaluru';
  if (c.includes('hyderabad')) return 'Hyderabad';
  if (c.includes('pune')) return 'Pune';
  return city.trim().replace(/\b\w/g, l => l.toUpperCase());
};

// Local location name extractor for natural queries (Hinglish/English fallback)
const detectCityFromMessage = (msg) => {
  if (!msg) return null;
  const text = msg.trim();
  
  // 1. Matches "X ki property" or "X me property" or "X main property"
  const hingesRegex = /([a-zA-Z\u0900-\u097F]+)\s+(ki|me|main|mein|pe|per)\b/i;
  const hingesMatch = text.match(hingesRegex);
  if (hingesMatch && hingesMatch[1]) {
    const word = hingesMatch[1].trim();
    const ignores = ['koi', 'hai', 'is', 'kya', 'bhi', 'kuch', 'at', 'in', 'the', 'any', 'some', 'time'];
    if (!ignores.includes(word.toLowerCase())) {
      return word;
    }
  }
  
  // 2. Matches "properties in X" or "listings in X" or "available in X"
  const englishRegex = /\b(in|at|near|around)\s+([a-zA-Z]+)/i;
  const englishMatch = text.match(englishRegex);
  if (englishMatch && englishMatch[2]) {
    const word = englishMatch[2].trim();
    const ignores = ['koi', 'hai', 'is', 'kya', 'bhi', 'kuch', 'at', 'in', 'the', 'any', 'some', 'time'];
    if (!ignores.includes(word.toLowerCase())) {
      return word;
    }
  }
  
  return null;
};

// Localized Default Question Texts Helper (Contextual seller vs buyer phrasings)
const getLocalizedQuestionText = (field, intent, lang, customConfig) => {
  const isHindi = lang === 'hindi';
  const isHinglish = lang === 'hinglish';
  const isSeller = intent === 'seller';
  const isRenter = intent === 'renter';

  // 1. If customConfig has an override for this specific intent, use it
  if (customConfig && customConfig.questions && customConfig.questions[field]) {
    const qRoot = customConfig.questions[field];
    if (intent && qRoot[intent]) {
      const q = qRoot[intent];
      if (isHindi && q.text_hi) return q.text_hi;
      if (isHinglish && q.text_hg) return q.text_hg;
      if (q.text_en) return q.text_en;
    }
  }

  // 2. If intent is seller, always use contextual seller phrasing (asking about their existing property)
  if (isSeller) {
    const sellerTexts = {
      intent: {
        en: "Hello, Seller! How can I help with your property today?",
        hi: "नमस्ते सेलर! आज मैं आपकी प्रॉपर्टी के संबंध में क्या मदद कर सकता हूँ?",
        hg: "Hello Seller! Aaj main aapki property ke regarding kya help kar sakta hoon?"
      },
      city: {
        en: "Where is your property located (which city)?",
        hi: "आपकी प्रॉपर्टी किस शहर में स्थित है?",
        hg: "Aapki property kis city me located hai?"
      },
      locality: {
        en: "Which locality or area is your property located in?",
        hi: "आपकी प्रॉपर्टी किस इलाके या क्षेत्र में स्थित है?",
        hg: "Aapki property kis area ya locality me located hai?"
      },
      propertyType: {
        en: "What type of property do you want to sell/list?",
        hi: "आप किस प्रकार की प्रॉपर्टी बेचना या लिस्ट करना चाहते हैं?",
        hg: "Aap kis type ki property sell ya list karna chahte hain?"
      },
      bedrooms: {
        en: "How many bedrooms does your property have?",
        hi: "आपकी प्रॉपर्टी में कितने बेडरूम हैं?",
        hg: "Aapki property me kitne bedrooms hain?"
      },
      propertySize: {
        en: "What is the approximate size of your property?",
        hi: "आपकी प्रॉपर्टी का अनुमानित आकार क्या है?",
        hg: "Aapki property ka approximate size kya hai?"
      },
      budget: {
        en: "What is your expected selling price for the property?",
        hi: "आपकी प्रॉपर्टी का अपेक्षित विक्रय मूल्य क्या है?",
        hg: "Aapka expected selling price kya hai?"
      },
      timeline: {
        en: "How soon are you planning to sell the property?",
        hi: "आप अपनी प्रॉपर्टी कब तक बेचने की योजना बना रहे हैं?",
        hg: "Aap apni property kab tak sell karne ka plan kar rahe hain?"
      },
      email: {
        en: "What email address can we use to contact you?",
        hi: "हम आपसे संपर्क करने के लिए किस ईमेल पते का उपयोग कर सकते हैं?",
        hg: "Hum aapko contact karne ke liye kis email address ka use kar sakte hain?"
      },
      phone: {
        en: "Thanks! And what phone number is best for you?",
        hi: "धन्यवाद! और आपके लिए कौन सा फ़ोन नंबर सबसे अच्छा रहेगा?",
        hg: "Thanks! Aur contact karne ke liye aapka phone number kya hai?"
      }
    };
    if (sellerTexts[field]) {
      if (isHindi) return sellerTexts[field].hi;
      if (isHinglish) return sellerTexts[field].hg;
      return sellerTexts[field].en;
    }
  }

  // 3. If intent is renter, use renter phrasing
  if (isRenter) {
    const renterTexts = {
      budget: {
        en: "What monthly rent budget are you hoping to stay within?",
        hi: "आप मासिक किराए का कितना बजट रखना चाहते हैं?",
        hg: "Aapka monthly rent budget kitna hai?"
      }
    };
    if (renterTexts[field]) {
      if (isHindi) return renterTexts[field].hi;
      if (isHinglish) return renterTexts[field].hg;
      return renterTexts[field].en;
    }
  }

  // 4. Fallback to customConfig root question text (for buyer/general)
  if (customConfig && customConfig.questions && customConfig.questions[field]) {
    const qRoot = customConfig.questions[field];
    if (isHindi && qRoot.text_hi) return qRoot.text_hi;
    if (isHinglish && qRoot.text_hg) return qRoot.text_hg;
    if (qRoot.text_en) return qRoot.text_en;
  }
  
  const texts = {
    intent: {
      en: "How can I help you today? Please choose one of the options below:",
      hi: "मैं आज आपकी क्या मदद कर सकता हूँ? कृपया नीचे दिए गए विकल्पों में से एक चुनें:",
      hg: "Main aaj aapki kya help kar sakta hoon? Please neeche diye options me se ek select karein:"
    },
    propertyType: {
      en: "What type of property are you looking for?",
      hi: "आप किस प्रकार की प्रॉपर्टी तलाश रहे हैं?",
      hg: "Aap kis type ki property search kar rahe hain?"
    },
    city: {
      en: "Which city are you looking in?",
      hi: "आप किस शहर में तलाश कर रहे हैं?",
      hg: "Aap kis city me property dekh rahe hain?"
    },
    locality: {
      en: "Which area/locality are you considering?",
      hi: "आप किस इलाके या क्षेत्र पर विचार कर रहे हैं?",
      hg: "Aap kis area/locality me property dekh rahe hain?"
    },
    bedrooms: {
      en: "How many bedrooms do you need?",
      hi: "आपको कितने बेडरूम की आवश्यकता है?",
      hg: "Aapko kitne bedrooms chahiye?"
    },
    propertySize: {
      en: "What is the approximate size of your property?",
      hi: "आपकी प्रॉपर्टी का अनुमानित आकार क्या है?",
      hg: "Aapki property ka approximate size kya hai?"
    },
    budget: {
      en: "What price range are you hoping to stay within?",
      hi: "आप किस मूल्य सीमा में प्रॉपर्टी देखना चाहते हैं?",
      hg: "Aap kis budget range me property dekh rahe hain?"
    },
    timeline: {
      en: "What is your desired timeframe for booking the property?",
      hi: "प्रॉपर्टी बुक करने की आपकी संभावित समय-सीमा क्या है?",
      hg: "Property book karne ka aapka expected timeframe kya hai?"
    },
    email: {
      en: "What email address can we use to contact you?",
      hi: "हम आपसे संपर्क करने के लिए किस ईमेल पते का उपयोग कर सकते हैं?",
      hg: "Hum aapko contact karne ke liye kis email address ka use kar sakte hain?"
    },
    phone: {
      en: "Thanks! And what phone number is best for you?",
      hi: "धन्यवाद! और आपके लिए कौन सा फ़ोन नंबर सबसे अच्छा रहेगा?",
      hg: "Thanks! Aur contact karne ke liye aapka phone number kya hai?"
    }
  };

  const fieldTexts = texts[field];
  if (!fieldTexts) return "";
  if (isHindi) return fieldTexts.hi;
  if (isHinglish) return fieldTexts.hg;
  return fieldTexts.en;
};

const getSuggestionsForField = (field, intent, customConfig, defaultSuggestions) => {
  if (customConfig && customConfig.questions && customConfig.questions[field]) {
    const qRoot = customConfig.questions[field];
    if (intent && qRoot[intent] && Array.isArray(qRoot[intent].suggestions) && qRoot[intent].suggestions.length > 0) {
      return qRoot[intent].suggestions;
    }
  }
  if (intent === 'seller') {
    if (field === 'propertyType') {
      return [
        { label: "Flat/Apartment", value: "apartment" },
        { label: "Villa/House", value: "house" },
        { label: "Penthouse", value: "penthouse" },
        { label: "Commercial property", value: "commercial" },
        { label: "Plot / Land", value: "plot" }
      ];
    }
  }
  if (customConfig && customConfig.questions && customConfig.questions[field]) {
    const qRoot = customConfig.questions[field];
    if (Array.isArray(qRoot.suggestions) && qRoot.suggestions.length > 0) {
      return qRoot.suggestions;
    }
  }
  return defaultSuggestions;
};

// Helper to parse budget text to number
const parseBudgetValue = (budgetString) => {
  if (!budgetString) return undefined;
  const clean = budgetString.toLowerCase().replace(/\s+/g, '');
  
  if (clean.includes("under50l")) return 5000000;
  if (clean.includes("50l-1cr")) return 10000000;
  if (clean.includes("1cr-2cr")) return 20000000;
  if (clean.includes("2cr+")) return 30000000;
  
  if (clean.includes("under15k")) return 15000;
  if (clean.includes("15k-30k")) return 30000;
  if (clean.includes("30k-60k")) return 60000;
  if (clean.includes("60k+")) return 80000;

  const parts = clean.split('-');
  const partToParse = parts[parts.length - 1];
  
  const cleanNum = parseFloat(partToParse.replace(/[^0-9.]/g, ''));
  if (isNaN(cleanNum)) return undefined;
  
  if (partToParse.includes('cr') || partToParse.includes('crore')) {
    return cleanNum * 10000000;
  } else if (partToParse.includes('lakh') || partToParse.includes('l')) {
    return cleanNum * 100000;
  } else if (partToParse.includes('k') || partToParse.includes('thousand')) {
    return cleanNum * 1000;
  }
  return cleanNum;
};

// Lead Scoring Helper
const scoreLead = (state) => {
  let score = 0;
  
  // 1. Timeline (Max 3 points)
  if (state.timeline) {
    const t = state.timeline.toLowerCase();
    if (t.includes('immediately') || t.includes('immediate')) score += 3;
    else if (t.includes('1-3') || t.includes('1_3')) score += 2;
    else if (t.includes('3-6') || t.includes('3_6')) score += 1;
    else score += 1;
  }

  // 2. Budget (Max 2 points)
  if (state.budget) {
    const b = state.budget.toLowerCase();
    if (b.includes('cr') || b.includes('crore') || b.includes('750') || b.includes('60k') || b.includes('1cr') || b.includes('2cr')) score += 2;
    else score += 1;
  }

  // 3. Location specificity (Max 2 points)
  if (state.city) {
    score += 1;
    if (state.locality) score += 1;
  }

  // 4. Intent (Max 2 points)
  if (state.intent) {
    const intent = state.intent.toLowerCase();
    if (intent === 'buyer' || intent === 'seller' || intent === 'renter') score += 2;
    else score += 1;
  }

  // 5. Contact Completion (Max 3 points)
  if (state.email && state.phone) {
    score += 3;
  } else if (state.email || state.phone) {
    score += 1;
  }

  let priority = 'cold';
  if (score >= 9) priority = 'hot';
  else if (score >= 5) priority = 'warm';

  return { score, priority };
};

// Idempotent Lead Upsert
const saveLeadFromState = async (state, user) => {
  if (user && user.role === 'admin') return null;
  const email = user?.email || state.email;
  const phone = user?.phone || state.phone || "";
  
  if (!email || !phone) return null;

  let aiSummary = "";
  if (state.intent === 'buyer') {
    aiSummary = `Buyer looking for ${state.bedrooms || ''} ${state.propertyType || 'property'} in ${state.locality || ''}, ${state.city || ''} within ${state.timeline || ''} | Budget: ${state.budget || ''}`;
  } else if (state.intent === 'seller') {
    aiSummary = `Seller looking to list ${state.bedrooms || ''} ${state.propertyType || 'property'} in ${state.city || ''} (size: ${state.propertySize || ''}) within ${state.timeline || ''}`;
  } else if (state.intent === 'renter') {
    aiSummary = `Tenant looking to rent ${state.bedrooms || ''} ${state.propertyType || 'property'} in ${state.city || ''} within ${state.timeline || ''} | Rent Budget: ${state.budget || ''}`;
  } else {
    aiSummary = `Lead requested to speak with agent directly.`;
  }

  const transcriptLine = `[Stateful Chat] Intent: ${state.intent} | City: ${state.city} | Locality: ${state.locality} | Budget: ${state.budget} | Phone: ${phone}`;

  let lead = await Lead.findOne({ email: email });
  if (!lead) {
    lead = await Lead.findOne({ phone: phone });
  }

  const scoring = scoreLead(state);

  if (lead) {
    lead.name = state.name || lead.name || user?.name || "Stateful Chat Lead";
    lead.phone = phone || lead.phone;
    if (state.budget) {
      const parsedBudget = parseBudgetValue(state.budget);
      if (parsedBudget !== undefined) {
        lead.budget = parsedBudget;
      }
    }
    lead.locality = state.locality || lead.locality;
    lead.city = state.city || lead.city;
    lead.propertyType = state.propertyType || lead.propertyType;
    lead.intent = state.intent || lead.intent || 'buyer';
    if (state.email) lead.chatEmail = state.email;
    if (state.phone) lead.chatPhone = state.phone;
    lead.aiScore = scoring.score;
    lead.aiPriority = scoring.priority;
    lead.aiSummary = aiSummary;
    lead.chatTranscript = lead.chatTranscript ? `${lead.chatTranscript}\n${transcriptLine}` : transcriptLine;
    await lead.save();
    console.log(`[LeadGen] Stateful Lead updated: ${lead._id}`);
    return lead;
  } else {
    const budgetVal = parseBudgetValue(state.budget);

    lead = await Lead.create({
      name: state.name || user?.name || "Stateful Chat Lead",
      email: email,
      phone: phone,
      chatEmail: state.email || undefined,
      chatPhone: state.phone || undefined,
      budget: budgetVal,
      locality: state.locality,
      city: state.city,
      propertyType: state.propertyType,
      intent: state.intent || 'buyer',
      aiScore: scoring.score,
      aiPriority: scoring.priority,
      buyerType: 'end-user',
      aiSummary: aiSummary,
      chatTranscript: transcriptLine,
      source: 'chat'
    });
    console.log(`[LeadGen] New Stateful Lead created: ${lead._id}`);
    return lead;
  }
};

// 3. Stateful AI Chat Assistant
export const chatWithAssistant = async (req, res) => {
  try {
    const { message, chatHistory = [], propertyContextId, language = 'english', userRole = 'buyer', currentState } = req.body;

    const flowConfigSetting = await AISetting.findOne({ key: 'ai_chat_flow_config' });
    const customConfig = flowConfigSetting ? flowConfigSetting.value : null;

    // Check if AI is enabled for the specific role
    let aiSettingKey = 'is_ai_enabled_buyer';
    if (userRole === 'admin') aiSettingKey = 'is_ai_enabled_admin';
    else if (userRole === 'seller') aiSettingKey = 'is_ai_enabled_seller';

    const aiSetting = await AISetting.findOne({ key: aiSettingKey });
    if (aiSetting && aiSetting.value === false) {
      return res.json({
        success: true,
        reply: "The AI assistant for your role is currently offline for maintenance. Please check back later!",
        speechReply: "The AI assistant is currently offline for maintenance. Please check back later!"
      });
    }

    const defaultState = {
      intent: "", // buyer | seller | renter | agent
      city: "",
      locality: "",
      propertyType: "",
      bedrooms: "",
      propertySize: "",
      budget: "",
      timeline: "",
      email: "",
      phone: "",
      name: "",
      leadCaptureStage: "initial",
      qualificationComplete: false,
      leadCreated: false
    };

    const state = { ...defaultState, ...currentState };

    // Check if message matches any welcome option or qualification flow starter across all roles
    let isFlowOptionMatch = false;
    if (customConfig && customConfig.options) {
      const allOpts = [
        ...(customConfig.options.buyer || []),
        ...(customConfig.options.seller || []),
        ...(customConfig.options.admin || []),
        ...(Array.isArray(customConfig.options) ? customConfig.options : [])
      ];
      const cleanMsg = message.trim().toLowerCase();
      isFlowOptionMatch = allOpts.some(o => 
        (o.value && o.value.trim().toLowerCase() === cleanMsg) ||
        (o.label && o.label.trim().toLowerCase() === cleanMsg)
      );
    }
    const lowerMessage = message.toLowerCase();
    const isStarterText = lowerMessage === "sell a home" || lowerMessage === "buy a home" || lowerMessage === "what is my home worth?" || lowerMessage === "what is my home worth" || lowerMessage === "rent a property" || lowerMessage === "i'm looking for a rental" || lowerMessage === "speak with an agent";
    const isFlowQualificationStarter = isFlowOptionMatch || isStarterText;

    // Automatic page navigation router (only runs if message is NOT a qualification flow starter)
    let redirectPath = null;
    let redirectText = null;

    if (!isFlowQualificationStarter) {
      if (lowerMessage.includes("admin panel") || lowerMessage.includes("admin dashboard") || (lowerMessage.includes("admin") && (lowerMessage.includes("open") || lowerMessage.includes("page")))) {
        redirectPath = "/admin-dashboard";
        redirectText = "Sure, opening the Admin Dashboard for you now.";
      } else if (lowerMessage.includes("seller dashboard") || lowerMessage.includes("seller panel") || (userRole === "seller" && lowerMessage.includes("dashboard") && lowerMessage.includes("open"))) {
        redirectPath = "/dashboard";
        redirectText = "Sure, opening the Seller Dashboard for you now.";
      } else if (lowerMessage.includes("add property") || lowerMessage.includes("add listing") || lowerMessage.includes("list a property") || lowerMessage.includes("property add") || lowerMessage.includes("list property")) {
        redirectPath = "/add-property";
        redirectText = "Opening the Add Property page for you.";
    } else if (lowerMessage.includes("my properties") || lowerMessage.includes("my listing") || lowerMessage.includes("meri property") || lowerMessage.includes("my listed") || (lowerMessage.includes("listings") && (lowerMessage.includes("open") || lowerMessage.includes("page")))) {
      redirectPath = "/my-properties";
      redirectText = "Opening your listed properties list.";
    } else if (lowerMessage.includes("seller requests") || lowerMessage.includes("seller request") || lowerMessage.includes("pending seller") || lowerMessage.includes("seller approvals") || lowerMessage.includes("seller approval")) {
      redirectPath = "/admin/seller-requests";
      redirectText = "Opening the Seller Requests management page.";
    } else if (lowerMessage.includes("ai management") || lowerMessage.includes("ai setting") || lowerMessage.includes("ai config") || lowerMessage.includes("ai dashboard")) {
      redirectPath = "/admin/ai-management";
      redirectText = "Opening the AI Management dashboard.";
    } else if (lowerMessage.includes("users list") || lowerMessage.includes("manage users") || lowerMessage.includes("users page") || (userRole === "admin" && lowerMessage.includes("users") && lowerMessage.includes("open"))) {
      redirectPath = "/admin/users";
      redirectText = "Opening the user management page.";
    } else if (lowerMessage.includes("leads list") || lowerMessage.includes("leads page") || lowerMessage.includes("manage leads") || lowerMessage.includes("my leads") || lowerMessage.includes("mere leads") || (lowerMessage.includes("leads") && (lowerMessage.includes("open") || lowerMessage.includes("view") || lowerMessage.includes("show") || lowerMessage.includes("aaye") || lowerMessage.includes("received")))) {
      redirectPath = userRole === 'admin' ? "/admin/leads" : "/inquiries";
      redirectText = "Opening the leads page.";
    } else if (lowerMessage.includes("inquiries") || lowerMessage.includes("inquiry") || lowerMessage.includes("buyer inquiries")) {
      redirectPath = userRole === 'admin' ? "/admin/inquiries" : "/inquiries";
      redirectText = "Opening the inquiries list.";
    } else if (lowerMessage.includes("profile open") || lowerMessage.includes("profile page") || lowerMessage.includes("my profile") || lowerMessage.includes("profile info")) {
      redirectPath = "/profile";
      redirectText = "Opening your profile page.";
    } else if (lowerMessage.includes("messages") || lowerMessage.includes("chat list") || lowerMessage.includes("chat messages") || lowerMessage.includes("inbox") || lowerMessage.includes("chats") || lowerMessage.includes("message")) {
      redirectPath = userRole === 'admin' ? "/admin/chat" : "/chat-messages";
      redirectText = "Opening your messages.";
    } else if (lowerMessage.includes("browse properties") || lowerMessage.includes("properties page") || lowerMessage.includes("property page") || (lowerMessage.includes("properties") && (lowerMessage.includes("open") || lowerMessage.includes("view")))) {
      redirectPath = "/properties";
      redirectText = "Opening the properties browse page.";
    } else if (lowerMessage.includes("about us") || lowerMessage.includes("about page") || (lowerMessage.includes("about") && lowerMessage.includes("open"))) {
      redirectPath = "/about";
      redirectText = "Opening the About Us page.";
    } else if (lowerMessage.includes("contact us") || lowerMessage.includes("contact page") || (lowerMessage.includes("contact") && lowerMessage.includes("open"))) {
      redirectPath = "/contact";
      redirectText = "Opening the Contact page.";
    } else if (lowerMessage.includes("wishlist")) {
      redirectPath = "/wishlist";
      redirectText = "Opening your wishlist.";
    } else if (lowerMessage.includes("home page") || lowerMessage.includes("landing page") || lowerMessage.includes("main website") || (lowerMessage.includes("home") && lowerMessage.includes("open")) || lowerMessage.includes("go to home")) {
      redirectPath = "/";
      redirectText = "Opening the homepage.";
    }
  }

    if (redirectPath) {
      // Localized speech/display replies
      let finalSpeech = redirectText;
      let finalDisplay = redirectText;

      const hasKitne = lowerMessage.includes("kitn") || lowerMessage.includes("how many") || lowerMessage.includes("total") || lowerMessage.includes("aaye") || lowerMessage.includes("receive") || lowerMessage.includes("koi") || lowerMessage.includes("unread") || lowerMessage.includes("unseen");

      // Resolve database stats on the fly for navigation questions
      if (hasKitne) {
        try {
          const sellerProperties = await Property.countDocuments({ seller: req.user._id });
          const sellerInquiries = await Inquiry.countDocuments({ seller: req.user._id });
          
          let userConvsQuery = {};
          if (req.user.role === 'buyer') {
            userConvsQuery.buyer = req.user._id;
          } else if (req.user.role === 'seller') {
            userConvsQuery.seller = req.user._id;
            userConvsQuery["participants.user"] = req.user._id;
            userConvsQuery["participants.role"] = "seller";
            userConvsQuery["participants.status"] = "active";
          } else {
            userConvsQuery.buyer = req.user._id;
          }

          const userConvs = await Conversation.find(userConvsQuery).select('_id');
          const convIds = userConvs.map(c => c._id);
          
          let unseenMessages = 0;
          for (const convId of convIds) {
            const latestMsg = await Message.findOne({ conversation: convId })
              .sort({ createdAt: -1 })
              .populate('sender');
            if (latestMsg && latestMsg.sender && latestMsg.sender._id.toString() !== req.user._id.toString()) {
              if (latestMsg.messageType !== 'system' && (req.user.role === 'seller' ? latestMsg.sender.role === 'buyer' : true)) {
                unseenMessages++;
              }
            }
          }

          if (redirectPath === "/chat-messages" || redirectPath === "/admin/chat" || lowerMessage.includes("message") || lowerMessage.includes("chat")) {
            if (unseenMessages > 0) {
              if (language === 'hinglish') {
                finalDisplay = `Haan, aapke paas ${unseenMessages} new unread messages aaye hain. Main aapke liye messages page open kar raha hoon.`;
                finalSpeech = `[SPEECH] हाँ, आपके पास ${unseenMessages} नए संदेश आए हैं। मैं आपके लिए मैसेज पेज खोल रहा हूँ।`;
              } else if (language === 'hindi') {
                finalDisplay = `हाँ, आपके पास ${unseenMessages} नए अनरीड संदेश आए हैं। मैसेज पेज खोल रहा हूँ।`;
                finalSpeech = `हाँ, आपके पास ${unseenMessages} नए अनरीड संदेश आए हैं। मैसेज पेज खोल रहा हूँ।`;
              } else {
                finalDisplay = `Yes, you have ${unseenMessages} new unread messages. Opening the messages page for you.`;
                finalSpeech = `Yes, you have ${unseenMessages} new unread messages. Opening the messages page for you.`;
              }
            } else {
              if (language === 'hinglish') {
                finalDisplay = "Aapke paas is samay koi naya message nahi hai. Main aapke liye messages page open kar raha hoon.";
                finalSpeech = "[SPEECH] आपके पास इस समय कोई नया संदेश नहीं है। मैं आपके लिए मैसेज पेज खोल रहा हूँ।";
              } else if (language === 'hindi') {
                finalDisplay = "आपके पास इस समय कोई नया संदेश नहीं है। मैसेज पेज खोल रहा हूँ।";
                finalSpeech = "आपके पास इस समय कोई नया संदेश नहीं है। मैसेज पेज खोल रहा हूँ।";
              } else {
                finalDisplay = "You don't have any new messages at the moment. Opening the messages page for you.";
                finalSpeech = "You don't have any new messages at the moment. Opening the messages page for you.";
              }
            }
          } else if (redirectPath === "/inquiries" || redirectPath === "/admin/inquiries" || redirectPath === "/admin/leads" || lowerMessage.includes("lead") || lowerMessage.includes("inquiry")) {
            if (language === 'hinglish') {
              finalDisplay = `Aapko abhi tak total ${sellerInquiries} leads received hui hain. Main aapke liye Leads page open kar raha hoon.`;
              finalSpeech = `[SPEECH] आपको अभी तक कुल ${sellerInquiries} लीड्स मिली हैं। मैं आपके लिए लीड्स पेज खोल रहा हूँ।`;
            } else if (language === 'hindi') {
              finalDisplay = `आपको अभी तक कुल ${sellerInquiries} लीड्स प्राप्त हुई हैं। मैं आपके लिए लीड्स पेज खोल रहा हूँ।`;
              finalSpeech = `आपको अभी तक कुल ${sellerInquiries} लीड्स प्राप्त हुई हैं। मैं आपके लिए लीड्स पेज खोल रहा हूँ।`;
            } else {
              finalDisplay = `You have received a total of ${sellerInquiries} leads. Opening the leads page.`;
              finalSpeech = `You have received a total of ${sellerInquiries} leads. Opening the leads page.`;
            }
          } else if (redirectPath === "/my-properties" || lowerMessage.includes("property") || lowerMessage.includes("listing")) {
            if (language === 'hinglish') {
              finalDisplay = `Aapki total ${sellerProperties} properties listed hain. Main aapke liye My Listings page open kar raha hoon.`;
              finalSpeech = `[SPEECH] आपकी कुल ${sellerProperties} प्रॉपर्टीज लिस्टेड हैं। मैं आपके लिए माय लिस्टिंग्स पेज खोल रहा हूँ।`;
            } else if (language === 'hindi') {
              finalDisplay = `आपकी कुल ${sellerProperties} प्रॉपर्टीज लिस्टेड हैं। मैं आपके लिए माय लिस्टिंग्स पेज खोल रहा हूँ।`;
              finalSpeech = `आपकी कुल ${sellerProperties} प्रॉपर्टीज लिस्टेड हैं। मैं आपके लिए माय लिस्टिंग्स पेज खोल रहा हूँ।`;
            } else {
              finalDisplay = `You have a total of ${sellerProperties} properties listed. Opening the My Listings page.`;
              finalSpeech = `You have a total of ${sellerProperties} properties listed. Opening the My Listings page.`;
            }
          }
        } catch (err) {
          console.warn("Failed to fetch live stats for redirect query:", err.message);
        }
      } else {
        if (language === 'hinglish') {
          if (redirectPath.includes("admin")) {
            finalDisplay = "Sure, aapke liye Admin Dashboard open kar raha hoon.";
            finalSpeech = "[SPEECH] बिल्कुल, आपके लिए एडमिन डैशबोर्ड खोल रहा हूँ।";
          } else if (redirectPath.includes("seller") || redirectPath === "/dashboard") {
            finalDisplay = "Sure, aapke liye Seller Dashboard open kar raha hoon.";
            finalSpeech = "[SPEECH] बिल्कुल, आपके लिए सेलर डैशबोर्ड खोल रहा हूँ।";
          } else {
            finalDisplay = "Sure, aapke liye ye page open kar raha hoon.";
            finalSpeech = "[SPEECH] बिल्कुल, आपके लिए यह पेज खोल रहा हूँ।";
          }
        } else if (language === 'hindi') {
          finalDisplay = "बिल्कुल, आपके लिए यह पेज खोल रहा हूँ।";
          finalSpeech = "बिल्कुल, आपके लिए यह पेज खोल रहा हूँ।";
        }
      }

      return res.json({
        success: true,
        reply: finalDisplay,
        speechReply: finalSpeech,
        redirect: redirectPath,
        state,
        activeQuestion: currentState?.activeQuestion || { field: "complete", text: "", type: "complete", required: false, suggestions: [] }
      });
    }

    // Fetch stats for the system instruction to make the AI aware of real-time listing/user counts
    let databaseStats = null;
    try {
      const totalProperties = await Property.countDocuments({});
      const activeListings = await Property.countDocuments({ status: "sale" });
      const soldProperties = await Property.countDocuments({ status: "sold" });
      const totalUsers = await User.countDocuments({});
      const totalBuyers = await User.countDocuments({ role: 'buyer' });
      const totalSellers = await User.countDocuments({ role: 'seller' });
      const pendingSellers = await User.countDocuments({ role: "seller", isApproved: false });
      
      let sellerProperties = 0;
      let sellerSold = 0;
      let sellerInquiries = 0;
      let totalConversations = 0;
      let unseenMessages = 0;
      
      if (req.user && req.user._id) {
        sellerProperties = await Property.countDocuments({ seller: req.user._id });
        sellerSold = await Property.countDocuments({ seller: req.user._id, status: 'sold' });
        sellerInquiries = await Inquiry.countDocuments({ seller: req.user._id });
        
        let userConvsQuery = {};
        if (req.user.role === 'buyer') {
          userConvsQuery.buyer = req.user._id;
        } else if (req.user.role === 'seller') {
          userConvsQuery.seller = req.user._id;
          userConvsQuery["participants.user"] = req.user._id;
          userConvsQuery["participants.role"] = "seller";
          userConvsQuery["participants.status"] = "active";
        } else {
          userConvsQuery.buyer = req.user._id;
        }

        const userConvs = await Conversation.find(userConvsQuery).select('_id');
        totalConversations = userConvs.length;
        const convIds = userConvs.map(c => c._id);
        
        unseenMessages = 0;
        for (const convId of convIds) {
          const latestMsg = await Message.findOne({ conversation: convId })
            .sort({ createdAt: -1 })
            .populate('sender');
          if (latestMsg && latestMsg.sender && latestMsg.sender._id.toString() !== req.user._id.toString()) {
            if (latestMsg.messageType !== 'system' && (req.user.role === 'seller' ? latestMsg.sender.role === 'buyer' : true)) {
              unseenMessages++;
            }
          }
        }
      }

      databaseStats = {
        totalProperties,
        activeListings,
        soldProperties,
        totalUsers,
        totalBuyers,
        totalSellers,
        pendingSellers,
        sellerProperties,
        sellerSold,
        sellerInquiries,
        totalConversations,
        unseenMessages
      };
    } catch (err) {
      console.warn("Failed to fetch database stats for AI context:", err.message);
    }

    let extracted = {
      intent: null,
      city: null,
      locality: null,
      propertyType: null,
      bedrooms: null,
      propertySize: null,
      budget: null,
      timeline: null,
      email: null,
      phone: null,
      name: null,
      userQueryOverride: null
    };

    // If message is not empty, run Gemini to extract parameters
    if (message && message.trim() !== "") {
      const extractPrompt = `
      You are the natural language understanding (NLU) component of a real estate assistant co-pilot.
      Analyze the following user's latest message and recent chat history to extract real estate preferences and contact details.

      User Message: "${message}"
      Chat History:
      ${chatHistory.slice(-6).map(h => `${h.sender === 'user' ? 'User' : 'Assistant'}: ${h.text}`).join('\n')}

      INSTRUCTIONS:
      1. Extract any mentioned attributes and return them in JSON.
      2. The extracted 'intent' field must be one of:
         - "buyer" (if they want to buy, purchase, find a property to buy)
         - "seller" (if they want to sell, list property, or value their home / ask what their home is worth)
         - "renter" (if they want to rent a property or look for rental)
         - "agent" (if they request to speak with an agent directly)
         - null if not specified.
      3. Keep values normalized to English tags where possible:
         - propertyType: "apartment" | "flat" | "villa" | "house" | "penthouse" | "commercial" | "plot"
           CRITICAL: Generic terms like "home", "ghar", "property", "place", or flow starters like "Buy a home", "Sell a home", "Rent a property" DO NOT indicate a propertyType! Return null for propertyType unless the user explicitly names a specific property type (e.g. apartment, flat, villa, penthouse, commercial, plot, or independent house). If the user says "Buy a home" or "ghar khareedna", propertyType MUST be null.
         - bedrooms: e.g. "1 BHK", "2 BHK", "3 BHK", "4+ BHK"
         - timeline: extract timeline in standard ranges like "Immediately", "1-3 Months", "3-6 Months", "6+ Months" or "Just Exploring"
         - budget: extract the budget text as a clean string (e.g. "Under ₹50L", "₹50L - ₹1Cr", "₹1Cr - ₹2Cr", "₹2Cr+", or rent price).
         - propertySize: e.g. "Under 1,000 sq ft", "1,000–1,500 sq ft", "1,500–2,500 sq ft", "2,500+ sq ft"
      4. userQueryOverride: If the user is asking a specific question, query, or deviating from providing qualification info (e.g., asking about parking, listing details, legal fees, or general real estate help) rather than answering the qualification fields, capture their natural question query here, otherwise return null.
      5. If no information is found for a field, return null. Do not guess or make up details.
      `;

      const extractSchema = {
        type: "OBJECT",
        properties: {
          intent: { type: "STRING", enum: ["buyer", "seller", "renter", "agent"], nullable: true },
          city: { type: "STRING", nullable: true },
          locality: { type: "STRING", nullable: true },
          propertyType: { type: "STRING", nullable: true },
          bedrooms: { type: "STRING", nullable: true },
          propertySize: { type: "STRING", nullable: true },
          budget: { type: "STRING", nullable: true },
          timeline: { type: "STRING", nullable: true },
          email: { type: "STRING", nullable: true },
          phone: { type: "STRING", nullable: true },
          name: { type: "STRING", nullable: true },
          userQueryOverride: { type: "STRING", nullable: true }
        }
      };

      if (state.intent && customConfig && customConfig.flows && customConfig.flows[state.intent]) {
        customConfig.flows[state.intent].forEach(f => {
          if (!extractSchema.properties[f]) {
            extractSchema.properties[f] = { type: "STRING", nullable: true };
          }
        });
      }

      try {
        const result = await generateJSON(extractPrompt, extractSchema);
        if (result) extracted = result;
      } catch (err) {
        console.warn("Failed to generate JSON for entity extraction, continuing with defaults:", err.message);
      }
    }

    // Sanitize propertyType: generic terms like "home", "ghar", "property", "place" are NOT property types
    if (extracted.propertyType) {
      const genericTypeWords = ["home", "property", "ghar", "place", "real estate", "rental", "house/home"];
      const val = extracted.propertyType.trim().toLowerCase();
      if (genericTypeWords.includes(val)) {
        extracted.propertyType = null;
      }
    }

    // Direct mapping bypass only applies if the user is NOT asking a specific question
    const isFlowStarter = lowerMessage.includes("worth") || lowerMessage.includes("sell a home") || lowerMessage.includes("buy a home") || lowerMessage.includes("looking for a rental") || lowerMessage.includes("rent a property") || lowerMessage.includes("speak with an agent");
    
    // Check if message matches any welcome option
    let isWelcomeOptionMatch = false;
    if (customConfig && customConfig.options) {
      const allOpts = [
        ...(customConfig.options.buyer || []),
        ...(customConfig.options.seller || []),
        ...(customConfig.options.admin || []),
        ...(Array.isArray(customConfig.options) ? customConfig.options : [])
      ];
      isWelcomeOptionMatch = allOpts.some(o => 
        (o.value && o.value.trim().toLowerCase() === lowerMessage) ||
        (o.label && o.label.trim().toLowerCase() === lowerMessage)
      );
    }

    // When starting a flow or clicking a welcome option, do not let generic words be interpreted as propertyType
    if (isFlowStarter || isWelcomeOptionMatch || (!currentState?.activeQuestion || currentState?.activeQuestion?.field === "intent")) {
      const explicitTypeRegex = /\b(apartment|flat|villa|penthouse|commercial|plot|duplex|studio|kothi|farmhouse|independent house)\b/i;
      if (!explicitTypeRegex.test(message)) {
        extracted.propertyType = null;
        if (state.propertyType === "home" || state.propertyType === "property") {
          state.propertyType = "";
        }
      }
    }

    const isQuestionText = !isFlowStarter && /\b(how|what|why|who|where|when|which|how many|kitni|kitne|total|pending|approve|show|list|active|block|received|aaye|aaya|receive|unseen|unread)\b/i.test(message);
    const userIsAskingQuestion = (extracted.userQueryOverride !== null && extracted.userQueryOverride !== "") || isQuestionText;

    // Merge extracted details into state
    for (const key in extracted) {
      if (extracted[key] !== null && extracted[key] !== undefined && extracted[key] !== "") {
        state[key] = extracted[key];
      }
    }

    // Global fallback for intent detection if state.intent is not set (e.g. first turn selection button click or search input)
    if (!state.intent && message) {
      const msg = message.trim().toLowerCase();

      // 1. Check if message matches any option in customConfig.options across all roles
      let matchedOpt = null;
      if (customConfig && customConfig.options) {
        const allOpts = [
          ...(customConfig.options.buyer || []),
          ...(customConfig.options.seller || []),
          ...(customConfig.options.admin || []),
          ...(Array.isArray(customConfig.options) ? customConfig.options : [])
        ];
        matchedOpt = allOpts.find(o => 
          (o.value && o.value.trim().toLowerCase() === msg) ||
          (o.label && o.label.trim().toLowerCase() === msg) ||
          (o.intent && o.intent.trim().toLowerCase() === msg)
        );
      }

      if (matchedOpt && matchedOpt.intent) {
        state.intent = matchedOpt.intent;
      } else if (customConfig && customConfig.flows && customConfig.flows[msg]) {
        state.intent = msg;
      } else if (msg.includes("worth") || msg.includes("sell") || msg.includes("💰") || msg.includes("🤔")) {
        state.intent = "seller";
      } else if (msg.includes("buy") || msg.includes("🏠") || msg.includes("purchase")) {
        state.intent = "buyer";
      } else if (msg.includes("rental") || msg.includes("rent") || msg.includes("🏡")) {
        state.intent = "renter";
      } else if (msg.includes("speak") || msg.includes("agent") || msg.includes("👤")) {
        state.intent = "agent";
      }
    }

    // Global fallback for city detection (overwrites previous city if user specifies a new location in the latest query)
    const currentMsgCity = extracted.city || detectCityFromMessage(message);
    if (currentMsgCity) {
      state.city = currentMsgCity;
    } else if (!state.city && message) {
      const msg = message.toLowerCase();
      if (msg.includes("delhi")) state.city = "Delhi";
      else if (msg.includes("noida")) state.city = "Noida";
      else if (msg.includes("gurgaon") || msg.includes("gurugram")) state.city = "Gurugram";
      else if (msg.includes("mumbai") || msg.includes("bombay")) state.city = "Mumbai";
    }

    // Search bypass detection
    const isSearchText = /available|dekhn|dikha|any property|koi property|listings|show me/i.test(message);
    const isSearch = extracted.isPropertySearch || isSearchText;

    if (isSearch) {
      if (!state.intent) {
        state.intent = "buyer";
      }

      // Default the remaining property fields to bypass them and go straight to contact capture
      const fieldsToBypass = ["propertyType", "locality", "bedrooms", "propertySize", "budget", "timeline"];
      fieldsToBypass.forEach(field => {
        if (!state[field]) {
          state[field] = "Any";
        }
      });
    } else if (!userIsAskingQuestion) {
      // Deterministic direct mapping: if a specific question was active, and the user provided a reply,
      // ensure that field is updated directly in the state, bypassing NLU extraction failure or rate limits.
      const prevField = currentState?.activeQuestion?.field;
      if (prevField && prevField !== "complete") {
        if (prevField === "intent" && !state.intent) {
          const msg = message.toLowerCase();
          if (msg.includes("worth") || msg.includes("sell")) state.intent = "seller";
          else if (msg.includes("buy")) state.intent = "buyer";
          else if (msg.includes("rental") || msg.includes("rent")) state.intent = "renter";
          else if (msg.includes("speak") || msg.includes("agent")) state.intent = "agent";
        } else if (!state[prevField]) {
          state[prevField] = message;
        }
      }
    }

    // Normalize city
    if (state.city) {
      state.city = normalizeCity(state.city);
    }

    // Skip locality if all other flow-specific property details are present (compound natural language input)
    if (state.intent === 'buyer' || state.intent === 'renter') {
      if (state.city && state.propertyType && state.bedrooms && state.budget && state.timeline && !state.locality) {
        state.locality = "Not Specified";
      }
    } else if (state.intent === 'seller') {
      if (state.city && state.propertyType && state.bedrooms && state.propertySize && state.budget && state.timeline && !state.locality) {
        state.locality = "Not Specified";
      }
    }

    // Validation checks
    let validationError = "";
    if (extracted.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(extracted.email)) {
      state.email = "";
      validationError = getLocalizedQuestionText("email", state.intent, language, customConfig);
    } else if (extracted.phone && extracted.phone.replace(/[^0-9]/g, '').length < 10) {
      state.phone = "";
      validationError = getLocalizedQuestionText("phone", state.intent, language, customConfig);
    }

    // Determine progression
    const buyerFields = (customConfig && customConfig.flows && customConfig.flows.buyer) || ["propertyType", "city", "locality", "bedrooms", "budget", "timeline"];
    const sellerFields = (customConfig && customConfig.flows && customConfig.flows.seller) || ["city", "locality", "propertyType", "bedrooms", "propertySize", "budget", "timeline"];
    const renterFields = (customConfig && customConfig.flows && customConfig.flows.renter) || ["city", "locality", "propertyType", "bedrooms", "budget", "timeline"];
    const agentFields = [];

    let flowFields = [];
    if (state.intent && customConfig && customConfig.flows && customConfig.flows[state.intent]) {
      flowFields = customConfig.flows[state.intent];
      state.leadCaptureStage = "property_qualification";
    } else if (state.intent === 'buyer') {
      flowFields = buyerFields;
      state.leadCaptureStage = "property_qualification";
    } else if (state.intent === 'seller') {
      flowFields = sellerFields;
      state.leadCaptureStage = "property_qualification";
    } else if (state.intent === 'renter') {
      flowFields = renterFields;
      state.leadCaptureStage = "property_qualification";
    } else if (state.intent === 'agent') {
      flowFields = agentFields;
      state.leadCaptureStage = "email";
    }

    // Find first missing field
    let activeField = null;
    if (state.intent && state.intent !== "") {
      for (const f of flowFields) {
        if (!state[f]) {
          activeField = f;
          break;
        }
      }
      
      // If property fields are all completed, collect email and phone next
      if (!activeField) {
        if (!state.email) {
          activeField = "email";
          state.leadCaptureStage = "email";
        } else if (!state.phone) {
          activeField = "phone";
          state.leadCaptureStage = "phone";
        }
      }
    } else {
      activeField = "intent";
      state.leadCaptureStage = "initial";
    }

    // Set default intent suggestions based on userRole
    let intentSuggestions = [];
    if (customConfig && customConfig.options) {
      if (customConfig.options[userRole]) {
        intentSuggestions = customConfig.options[userRole];
      } else if (Array.isArray(customConfig.options) && userRole === 'buyer') {
        intentSuggestions = customConfig.options;
      }
    }

    if (!intentSuggestions || intentSuggestions.length === 0) {
      if (userRole === 'admin') {
        intentSuggestions = [
          { label: "📊 Show platform stats", value: "Show platform stats" },
          { label: "👥 Review pending sellers", value: "Review pending sellers" },
          { label: "🏠 Check active listings", value: "Check active listings" }
        ];
      } else if (userRole === 'seller') {
        intentSuggestions = [
          { label: "💰 What is my home worth?", value: "What is my home worth?" },
          { label: "🏠 Sell a home", value: "Sell a home" },
          { label: "👤 Speak with an agent", value: "Speak with an agent" }
        ];
      } else {
        intentSuggestions = [
          { label: "🏠 Buy a home", value: "Buy a home" },
          { label: "🏡 I'm looking for a rental", value: "I'm looking for a rental" },
          { label: "👤 Speak with an agent", value: "Speak with an agent" },
          { label: "🔑 Rent a Property", value: "Rent a Property" }
        ];
      }
    }

    const questionMap = {
      intent: {
        field: "intent",
        text: getLocalizedQuestionText("intent", state.intent, language, customConfig),
        type: "single_select",
        required: true,
        suggestions: intentSuggestions
      },
      propertyType: {
        field: "propertyType",
        text: getLocalizedQuestionText("propertyType", state.intent, language, customConfig),
        type: "single_select",
        required: true,
        suggestions: getSuggestionsForField("propertyType", state.intent, customConfig, [
          { label: "Flat/Apartment", value: "apartment" },
          { label: "Villa/House", value: "house" },
          { label: "Penthouse", value: "penthouse" },
          { label: "Commercial property", value: "commercial" }
        ])
      },
      city: {
        field: "city",
        text: getLocalizedQuestionText("city", state.intent, language, customConfig),
        type: "single_select",
        required: true,
        suggestions: getSuggestionsForField("city", state.intent, customConfig, [
          { label: "📍 Delhi", value: "Delhi" },
          { label: "📍 Noida", value: "Noida" },
          { label: "📍 Gurugram", value: "Gurugram" },
          { label: "📍 Mumbai", value: "Mumbai" }
        ])
      },
      locality: {
        field: "locality",
        text: getLocalizedQuestionText("locality", state.intent, language, customConfig),
        type: "single_select",
        required: true,
        suggestions: getSuggestionsForField("locality", state.intent, customConfig, [])
      },
      bedrooms: {
        field: "bedrooms",
        text: getLocalizedQuestionText("bedrooms", state.intent, language, customConfig),
        type: "single_select",
        required: true,
        suggestions: getSuggestionsForField("bedrooms", state.intent, customConfig, [
          { label: "1 BHK", value: "1 BHK" },
          { label: "2 BHK", value: "2 BHK" },
          { label: "3 BHK", value: "3 BHK" },
          { label: "4+ BHK", value: "4+ BHK" }
        ])
      },
      propertySize: {
        field: "propertySize",
        text: getLocalizedQuestionText("propertySize", state.intent, language, customConfig),
        type: "single_select",
        required: true,
        suggestions: getSuggestionsForField("propertySize", state.intent, customConfig, [
          { label: "Under 1,000 sq ft", value: "Under 1,000 sq ft" },
          { label: "1,000–1,500 sq ft", value: "1,000–1,500 sq ft" },
          { label: "1,500–2,500 sq ft", value: "1,500–2,500 sq ft" },
          { label: "2,500+ sq ft", value: "2,500+ sq ft" }
        ])
      },
      budget: {
        field: "budget",
        text: getLocalizedQuestionText("budget", state.intent, language, customConfig),
        type: "single_select",
        required: true,
        suggestions: getSuggestionsForField("budget", state.intent, customConfig, state.intent === 'renter' ? [
          { label: "Under ₹15K", value: "Under ₹15K" },
          { label: "₹15K - ₹30K", value: "₹15K - ₹30K" },
          { label: "₹30K - ₹60K", value: "₹30K - ₹60K" },
          { label: "₹60K+", value: "₹60K+" }
        ] : [
          { label: "Under ₹50L", value: "Under ₹50L" },
          { label: "₹50L - ₹1Cr", value: "₹50L - ₹1Cr" },
          { label: "₹1Cr - ₹2Cr", value: "₹1Cr - ₹2Cr" },
          { label: "₹2Cr+", value: "₹2Cr+" }
        ])
      },
      timeline: {
        field: "timeline",
        text: getLocalizedQuestionText("timeline", state.intent, language, customConfig),
        type: "single_select",
        required: true,
        suggestions: getSuggestionsForField("timeline", state.intent, customConfig, state.intent === 'seller' ? [
          { label: "Immediately", value: "Immediately" },
          { label: "1-3 Months", value: "1-3 Months" },
          { label: "3-6 Months", value: "3-6 Months" },
          { label: "Just Exploring", value: "Just Exploring" }
        ] : [
          { label: "Immediately", value: "Immediately" },
          { label: "1-3 Months", value: "1-3 Months" },
          { label: "3-6 Months", value: "3-6 Months" },
          { label: "6+ Months", value: "6+ Months" }
        ])
      },
      email: {
        field: "email",
        text: getLocalizedQuestionText("email", state.intent, language, customConfig),
        type: "text",
        required: true,
        suggestions: getSuggestionsForField("email", state.intent, customConfig, [])
      },
      phone: {
        field: "phone",
        text: getLocalizedQuestionText("phone", state.intent, language, customConfig),
        type: "text",
        required: true,
        suggestions: getSuggestionsForField("phone", state.intent, customConfig, [])
      }
    };

    // If activeField is not one of the default keys, dynamically populate it in questionMap from customConfig
    if (activeField && !questionMap[activeField]) {
      questionMap[activeField] = {
        field: activeField,
        text: getLocalizedQuestionText(activeField, state.intent, language, customConfig) || `Please provide the details for ${activeField.replace(/([A-Z])/g, ' $1')}`,
        type: "single_select",
        required: true,
        suggestions: getSuggestionsForField(activeField, state.intent, customConfig, [])
      };
    }

    // Assign contextual suggestions based on normalized city
    if (state.city) {
      const cityLocalityMap = (customConfig && customConfig.questions && customConfig.questions.locality && customConfig.questions.locality.cityLocalities) || {
        "Delhi": [
          { label: "Dwarka", value: "Dwarka" },
          { label: "Saket", value: "Saket" },
          { label: "Connaught Place", value: "Connaught Place" }
        ],
        "Noida": [
          { label: "Sector 62", value: "Sector 62" },
          { label: "Sector 15", value: "Sector 15" },
          { label: "Sector 18", value: "Sector 18" }
        ],
        "Gurugram": [
          { label: "Sector 54", value: "Sector 54" },
          { label: "Golf Course Road", value: "Golf Course Road" },
          { label: "Sohna Road", value: "Sohna Road" }
        ],
        "Mumbai": [
          { label: "Bandra", value: "Bandra" },
          { label: "Andheri", value: "Andheri" },
          { label: "Colaba", value: "Colaba" }
        ]
      };
      if (cityLocalityMap[state.city]) {
        questionMap.locality.suggestions = cityLocalityMap[state.city];
      }
    }

    let displayReply = "";
    let speechReply = "";
    let activeQuestion = null;

    if (validationError) {
      displayReply = validationError;
      speechReply = validationError;
      activeQuestion = questionMap[activeField];
    } else if (activeField === null) {
      // Flow is complete! Calculate scoring and save to database
      const scoring = scoreLead(state);
      state.aiScore = scoring.score;
      state.aiPriority = scoring.priority;
      state.qualificationComplete = true;
      state.leadCaptureStage = "complete";

      let completionProperties = [];
      let extraMessage = "";

      if (state.city) {
        try {
          let cityRegex = new RegExp(state.city, "i");
          if (state.city.toLowerCase() === "delhi") {
            cityRegex = /^(delhi|new delhi)$/i;
          } else if (state.city.toLowerCase() === "gurugram" || state.city.toLowerCase() === "gurgaon") {
            cityRegex = /^(gurugram|gurgaon)$/i;
          } else if (state.city.toLowerCase() === "mumbai" || state.city.toLowerCase() === "bombay") {
            cityRegex = /^(mumbai|bombay)$/i;
          }
          
          completionProperties = await Property.find({
            city: cityRegex,
            status: state.intent === "renter" ? "rent" : "sale"
          }).limit(5).select('title description price city area bhk propertyType images status');
        } catch (err) {
          console.warn("Failed to query completion properties:", err.message);
        }
      }

      const hasProps = completionProperties && completionProperties.length > 0;

      if (language === 'hindi') {
        displayReply = "बहुत बढ़िया! हमें आपका विवरण मिल गया है। आपकी सहायता के लिए हमारी टीम का एक सदस्य जल्द ही आपसे संपर्क करेगा।";
        speechReply = "बहुत बढ़िया! हमें आपका विवरण मिल गया है। हमारी टीम का सदस्य जल्द ही संपर्क करेगा।";
        if (hasProps) {
          extraMessage = `\n\nइस बीच, आप नीचे ${state.city} में उपलब्ध प्रॉपर्टीज को देख सकते हैं। यदि आपको कोई प्रॉपर्टी पसंद आए या अधिक जानकारी चाहिए, तो आप उस प्रॉपर्टी पेज पर दिए गए चैट विकल्प का उपयोग कर सकते हैं।`;
          displayReply += extraMessage;
          speechReply += ` इस बीच, आप नीचे ${state.city} में उपलब्ध प्रॉपर्टीज देख सकते हैं।`;
        }
      } else if (language === 'hinglish') {
        displayReply = "Perfect! Humein aapka details mil gaya hai. Hamari team ka ek member aapse jaldi hi contact karega.";
        speechReply = "परफेक्ट! हमें आपका विवरण मिल गया है। हमारी टीम का सदस्य जल्द ही आपसे संपर्क करेगा।";
        if (hasProps) {
          extraMessage = `\n\nIsi beech, aap neeche ${state.city} me available properties ko check kar sakte hain. Agar aapko koi property pasand aaye ya aur information chahiye, toh aap us property page par diye gaye chat option ka use kar sakte hain.`;
          displayReply += extraMessage;
          speechReply += ` इसी बीच, आप नीचे ${state.city} में उपलब्ध प्रॉपर्टीज देख सकते हैं।`;
        }
      } else {
        displayReply = "Perfect. We've got your details. A member of our team will be in touch with you shortly to help you find the best property.";
        speechReply = "Perfect. We have received your details. A member of our team will be in touch with you shortly.";
        if (hasProps) {
          extraMessage = `\n\nIn the meantime, you can check out properties available in ${state.city} listed on our website below. If you find a property you like or want more information, please use the chat option available directly on that property's details page.`;
          displayReply += extraMessage;
          speechReply += ` In the meantime, you can check out properties available in ${state.city} below.`;
        }
      }

      state.completionProperties = completionProperties;

      activeQuestion = {
        field: "complete",
        text: "Lead qualification complete.",
        type: "text",
        required: false,
        suggestions: []
      };

      if (!state.leadCreated) {
        await saveLeadFromState(state, req.user);
        state.leadCreated = true;
      }
    } else {
      activeQuestion = questionMap[activeField];
      const nextQuestionText = activeQuestion.text;

      let languageInstruction = "";
      if (language === 'hinglish') {
        languageInstruction = `
        The user's preferred language is Hinglish (a natural combination of Hindi and English written in the Latin alphabet).
        You MUST write your response strictly using the [DISPLAY] and [SPEECH] tags.
        - Under [DISPLAY]: Write the response in natural Hinglish (e.g. "Gurugram to perfect location hai. Aap kis area me villa dekh rahe hain?").
        - Under [SPEECH]: Write the response in pure Hindi Devanagari script (e.g. "गुरुग्राम तो बहुत अच्छी जगह है। आप किस इलाके में विला देख रहे हैं?") with numbers spelled out.
        Example format:
        [DISPLAY]
        Aapka budget kya hai?
        [SPEECH]
        आपका बजट क्या है?
        `;
      } else if (language === 'hindi') {
        languageInstruction = `
        The user's preferred language is Hindi. You MUST respond in pure, helpful Hindi using the Devanagari script.
        `;
      } else {
        languageInstruction = `
        The user's preferred language is English. You MUST respond in clear, professional English.
        `;
      }

      // Fetch property listings if isSearch is active
      let properties = [];
      if (isSearch) {
        try {
          const searchQuery = {};
          
          // Filter by city with robust regex mappings (e.g. matching "New Delhi" when searching for "Delhi")
          const searchCity = extracted.city || state.city;
          if (searchCity) {
            const norm = normalizeCity(searchCity);
            if (norm === 'Delhi') {
              searchQuery.city = /delhi|new delhi/i;
            } else if (norm === 'Gurugram') {
              searchQuery.city = /gurugram|gurgaon/i;
            } else if (norm === 'Mumbai') {
              searchQuery.city = /mumbai|bombay/i;
            } else {
              searchQuery.city = new RegExp(`^${norm}$`, 'i');
            }
          }
          
          // Filter by propertyType
          const searchType = extracted.propertyType || state.propertyType;
          if (searchType && searchType !== "Any") {
            searchQuery.propertyType = searchType.toLowerCase();
          }
          
          // Filter by bedrooms / bhk
          const searchBhk = extracted.bedrooms || state.bedrooms;
          if (searchBhk && searchBhk !== "Any") {
            const match = searchBhk.match(/\d+/);
            if (match) {
              searchQuery.bhk = match[0];
            }
          }

          // Filter status based on intent
          if (state.intent === 'renter') {
            searchQuery.status = 'rent';
          } else {
            searchQuery.status = 'sale';
          }

          properties = await Property.find(searchQuery)
            .limit(5)
            .select('title description price city area bhk propertyType images status');
        } catch (err) {
          console.warn("Failed to query properties for chatbot:", err.message);
        }
      }

      let responseSystemInstruction = "";
      let prompt = "";

      let statsInstruction = "";
      if (databaseStats) {
        statsInstruction = `
        REAL-TIME DATABASE STATISTICS (Use these exact numbers to answer questions about platform metrics, listings, or user counts):
        - Total Properties listed on platform: ${databaseStats.totalProperties}
        - Active Listings for sale/rent: ${databaseStats.activeListings}
        - Properties Sold: ${databaseStats.soldProperties}
        - Total Registered Users: ${databaseStats.totalUsers} (Buyers: ${databaseStats.totalBuyers}, Sellers: ${databaseStats.totalSellers})
        - Pending Seller Requests/Approvals: ${databaseStats.pendingSellers}
        - Current Seller's Own Listed Properties: ${databaseStats.sellerProperties}
        - Current Seller's Sold Properties: ${databaseStats.sellerSold}
        - Inquiries/Leads received by current seller: ${databaseStats.sellerInquiries}
        `;
      }

      if (isSearch) {
        const hasProperties = properties && properties.length > 0;
        if (hasProperties) {
          responseSystemInstruction = `
          You are "EstateEase AI", a friendly, professional, and knowledgeable real estate co-pilot.
          The user has asked about property availability. We queried our database and found the following matching properties:
          ${JSON.stringify(properties)}
          
          ${statsInstruction}
          
          Your instructions:
          1. Confirm that we have matching properties available and invite them to view them in the carousel (e.g., "We do have properties available right now—you can view them here.").
          2. Keep your response concise (1-2 sentences). Do not list out all the pricing or detailed descriptions in text, since they are already displayed in the visual carousel below.
          3. Do NOT ask for their email address, phone number, name, or any other contact details in this response. Simply confirm availability and invite them to browse the listings.
          
          LANGUAGE INSTRUCTIONS:
          ${languageInstruction}
          `;
        } else {
          responseSystemInstruction = `
          You are "EstateEase AI", a friendly, professional, and knowledgeable real estate co-pilot.
          The user has asked about property availability. We queried our database and found 0 matching properties.
          
          ${statsInstruction}
          
          Your instructions:
          1. Politely and clearly state that we do NOT have any properties available in the requested location (e.g., "${state.city || 'this location'}") at the moment.
          2. Suggest that they can explore properties in other cities we support (such as Delhi, Noida, Gurugram, or Mumbai), or ask if they'd like to list a property instead.
          3. Keep your response concise (1-2 sentences).
          4. Do NOT ask for their email address, phone number, name, or any other contact details in this response. Simply state that properties are unavailable in that location.
          
          LANGUAGE INSTRUCTIONS:
          ${languageInstruction}
          `;
        }
        prompt = `
        Chat History:
        ${chatHistory.slice(-5).map(h => `${h.sender === 'user' ? 'User' : 'Assistant'}: ${h.text}`).join('\n')}
        
        User's Search Query: "${message}"
        
        Assistant:`;
      } else if (userIsAskingQuestion) {
        if (userRole === 'admin' || (userRole === 'seller' && state.intent !== 'seller')) {
          responseSystemInstruction = `
          You are "EstateEase AI", a friendly, professional, and knowledgeable real estate co-pilot.
          The user is a logged-in ${userRole}. They are asking a question: "${message}".
          
          ${statsInstruction}
          
          Your instructions are:
          1. Answer their question directly, accurately, and politely in the requested language ("${language}").
          2. Keep your response helpful, friendly, and concise. Do NOT ask them any qualification questions (like city, budget, bedrooms, etc.) since they are an active ${userRole} managing/viewing the site, not a lead.
          
          LANGUAGE INSTRUCTIONS:
          ${languageInstruction}
          `;
        } else {
          responseSystemInstruction = `
          You are "EstateEase AI", a friendly, professional, and knowledgeable real estate co-pilot.
          The user has deviated from the qualification sequence to ask a specific question: "${message}".
          
          ${statsInstruction}
          
          Your instructions are:
          1. Answer their question directly, accurately, and politely in the requested language ("${language}").
          2. Immediately following your answer, gently guide the user back to the qualification flow by asking the missing question: "${nextQuestionText}".
          
          LANGUAGE INSTRUCTIONS:
          ${languageInstruction}
          `;
        }
        prompt = `
        Chat History:
        ${chatHistory.slice(-5).map(h => `${h.sender === 'user' ? 'User' : 'Assistant'}: ${h.text}`).join('\n')}
        
        User's Deviation Query: "${message}"
        
        Assistant:`;
      } else {
        // Standard flow response
        responseSystemInstruction = `
        You are "EstateEase AI", a friendly, professional, and knowledgeable real estate co-pilot.
        Your job is to talk to the user naturally based on the conversational state and active flow.
        
        ${statsInstruction}
        
        Here is the current state of preferences collected so far:
        - Intent: ${state.intent}
        - City: ${state.city}
        - Locality: ${state.locality}
        - Property Type: ${state.propertyType}
        - Bedrooms: ${state.bedrooms}
        - Budget: ${state.budget}
        - Timeline: ${state.timeline}
        - Size: ${state.propertySize || 'N/A'}
        
        We are now asking the user for: "${activeField}".
        The specific question we need to ask next is: "${nextQuestionText}".
        
        LANGUAGE INSTRUCTIONS:
        ${languageInstruction}

        ROLE & PERSPECTIVE GUIDELINES:
        ${state.intent === 'seller' || userRole === 'seller'
          ? `CRITICAL PERSPECTIVE: The user is a PROPERTY SELLER / OWNER who wants to sell or get a valuation for their existing property. NEVER treat them as a buyer. NEVER ask them what property they are "looking for", "searching for", or "exploring to buy". Instead, acknowledge their property listing/valuation goal and ask about where their property is situated, its details, or its expected selling price.` 
          : state.intent === 'renter'
          ? `CRITICAL PERSPECTIVE: The user wants to rent a home/property (tenant).`
          : `CRITICAL PERSPECTIVE: The user is a home BUYER looking to purchase property.`
        }

        GENERAL INSTRUCTIONS:
        1. Write a natural-sounding, helpful reply that acknowledges the user's previous answer (if appropriate) and transitions smoothly into asking the next question.
        2. Keep your response concise (1-2 sentences). Do not repeat what they just said unless it fits a quick confirmation.
        3. Do NOT include any suggestible values, tags, or JSON arrays inside your text response. The options will be displayed as native UI chips.
        `;
        prompt = `
        Chat History:
        ${chatHistory.slice(-5).map(h => `${h.sender === 'user' ? 'User' : 'Assistant'}: ${h.text}`).join('\n')}
        
        User's Latest Message: "${message}"
        
        Assistant:`;
      }

      let reply;
      try {
        reply = await generateText(prompt, responseSystemInstruction);
      } catch (err) {
        console.warn("Failed to generate natural text with Gemini, falling back to static prompt:", err.message);
        if (isSearch) {
          const searchCity = state.city || "this location";
          const hasProps = properties && properties.length > 0;
          if (hasProps) {
            if (language === 'hindi') {
              reply = "हमारे पास इस समय प्रॉपर्टीज़ उपलब्ध हैं—आप इन्हें यहाँ देख सकते हैं।";
            } else if (language === 'hinglish') {
              reply = "Humare paas is samay properties available hain—aap inhe yahan dekh sakte hain.";
            } else {
              reply = "We do have properties available right now—you can view them here.";
            }
          } else {
            if (language === 'hindi') {
              reply = `हमारे पास इस समय ${searchCity} में कोई प्रॉपर्टी उपलब्ध नहीं है।`;
            } else if (language === 'hinglish') {
              reply = `Humare paas is samay ${searchCity} me koi property available nahi hai.`;
            } else {
              reply = `We don't have any properties available in ${searchCity} at the moment.`;
            }
          }
        } else if (userIsAskingQuestion) {
          // Deterministic QA fallback if Gemini text generation is rate-limited or fails
          const hasTotal = lowerMessage.includes("total") || lowerMessage.includes("kitni") || lowerMessage.includes("kitne") || lowerMessage.includes("how many") || lowerMessage.includes("koi");
          const hasProperty = lowerMessage.includes("property") || lowerMessage.includes("properties") || lowerMessage.includes("listing") || lowerMessage.includes("listings");
          const hasUser = lowerMessage.includes("user") || lowerMessage.includes("users");
          const hasPending = lowerMessage.includes("pending") || lowerMessage.includes("request") || lowerMessage.includes("approv");
          const hasLead = lowerMessage.includes("lead") || lowerMessage.includes("leads") || lowerMessage.includes("inquiry") || lowerMessage.includes("inquiries");
          const hasMessage = lowerMessage.includes("message") || lowerMessage.includes("messages") || lowerMessage.includes("chat") || lowerMessage.includes("chats") || lowerMessage.includes("aaye") || lowerMessage.includes("receive");
          const hasWorth = lowerMessage.includes("worth") || lowerMessage.includes("value") || lowerMessage.includes("estimate") || lowerMessage.includes("price");
          const hasStats = lowerMessage.includes("stats") || lowerMessage.includes("statistic") || lowerMessage.includes("statistics") || lowerMessage.includes("data");
          const hasActiveListings = lowerMessage.includes("active") && (lowerMessage.includes("listing") || lowerMessage.includes("listings") || lowerMessage.includes("property") || lowerMessage.includes("properties"));
          
          if (hasTotal && hasProperty) {
            const count = userRole === 'seller' ? (databaseStats?.sellerProperties ?? 15) : (databaseStats?.totalProperties ?? 15);
            if (language === 'hindi') {
              reply = `आपकी कुल ${count} प्रॉपर्टीज लिस्टेड हैं।`;
            } else if (language === 'hinglish') {
              reply = `Aapki total ${count} properties listed hain.`;
            } else {
              reply = `You have a total of ${count} properties listed.`;
            }
          } else if (hasTotal && hasUser) {
            const count = databaseStats?.totalUsers ?? 15;
            if (language === 'hindi') {
              reply = `प्लेटफ़ॉर्म पर कुल ${count} यूज़र्स रजिस्टडी हैं।`;
            } else if (language === 'hinglish') {
              reply = `Platform par total ${count} users registered hain.`;
            } else {
              reply = `There are a total of ${count} users registered on the platform.`;
            }
          } else if (hasPending && lowerMessage.includes("seller")) {
            const count = databaseStats?.pendingSellers ?? 0;
            if (language === 'hindi') {
              reply = `इस समय ${count} सेलर रिक्वेस्ट पेंडिंग हैं।`;
            } else if (language === 'hinglish') {
              reply = `Is samay ${count} seller requests pending hain.`;
            } else {
              reply = `There are currently ${count} pending seller requests.`;
            }
          } else if (hasLead) {
            const count = databaseStats?.sellerInquiries ?? 1;
            if (language === 'hindi') {
              reply = `आपको कुल ${count} लीड्स प्राप्त हुई हैं।`;
            } else if (language === 'hinglish') {
              reply = `Aapko total ${count} leads received hui hain.`;
            } else {
              reply = `You have received a total of ${count} leads.`;
            }
          } else if (hasMessage) {
            const count = databaseStats?.unseenMessages ?? 0;
            if (count > 0) {
              if (language === 'hindi') {
                reply = `जी हाँ, आपके पास ${count} नए अनरीड मैसेज आए हैं।`;
              } else if (language === 'hinglish') {
                reply = `Haan, aapke paas ${count} new unread messages aaye hain.`;
              } else {
                reply = `Yes, you have ${count} new unread messages.`;
              }
            } else {
              if (language === 'hindi') {
                reply = "आपके पास इस समय कोई नया मैसेज नहीं है।";
              } else if (language === 'hinglish') {
                reply = "Aapke paas is samay koi naya message nahi hai.";
              } else {
                reply = "You don't have any new messages at the moment.";
              }
            }
          } else if (hasWorth) {
            if (language === 'hindi') {
              reply = "कृपया अपनी प्रॉपर्टी का विवरण (शहर, साइज, कमरे) दर्ज करें ताकि मैं उसकी सही कीमत का अनुमान लगा सकूँ।";
            } else if (language === 'hinglish') {
              reply = "Please apni property ke details (city, size, rooms) fill karein taaki main uski estimate value calculate kar sakoon.";
            } else {
              reply = "Please provide your property details (city, size, bedrooms) so I can estimate its market value.";
            }
          } else if (hasActiveListings) {
            const count = databaseStats?.activeListings ?? 15;
            if (language === 'hindi') {
              reply = `प्लेटफ़ॉर्म पर इस समय ${count} सक्रिय प्रॉपर्टी लिस्टिंग्स हैं।`;
            } else if (language === 'hinglish') {
              reply = `Platform par is samay total ${count} active property listings hain.`;
            } else {
              reply = `There are currently ${count} active property listings on the platform.`;
            }
          } else if (hasStats) {
            const props = databaseStats?.totalProperties ?? 15;
            const active = databaseStats?.activeListings ?? 15;
            const sold = databaseStats?.soldProperties ?? 0;
            const users = databaseStats?.totalUsers ?? 15;
            const buyers = databaseStats?.totalBuyers ?? 10;
            const sellers = databaseStats?.totalSellers ?? 5;
            const pending = databaseStats?.pendingSellers ?? 0;

            if (language === 'hindi') {
              reply = `प्लेटफ़ॉर्म सांख्यिकी:\n- कुल प्रॉपर्टीज: ${props} (${active} सक्रिय, ${sold} बिकी हुई)\n- कुल यूज़र्स: ${users} (${buyers} खरीदार, ${sellers} विक्रेता)\n- पेंडिंग सेलर अनुरोध: ${pending}`;
            } else if (language === 'hinglish') {
              reply = `Platform Statistics summary:\n- Total Properties: ${props} (${active} active, ${sold} sold)\n- Total Users: ${users} (${buyers} buyers, ${sellers} sellers)\n- Pending Seller Requests: ${pending}`;
            } else {
              reply = `Platform Statistics Summary:\n- Total Properties: ${props} (${active} active, ${sold} sold)\n- Total Users: ${users} (${buyers} buyers, ${sellers} sellers)\n- Pending Seller Requests: ${pending}`;
            }
          } else {
            if (language === 'hindi') {
              reply = "क्षमा करें, मैं इस समय इस जानकारी को लोड नहीं कर सका। कृपया थोड़ी देर बाद पुनः प्रयास करें।";
            } else if (language === 'hinglish') {
              reply = "Sorry, main abhi ye information load nahi kar saka. Please thodi der baad try karein.";
            } else {
              reply = "Sorry, I couldn't load this information right now. Please try again in a moment.";
            }
          }
        } else {
          reply = nextQuestionText;
        }
      }

      let replyText = reply.trim();

      displayReply = replyText;
      speechReply = replyText;

      // Handle Hinglish display/speech splitting
      if (language === 'hinglish') {
        const displayIdx = replyText.toUpperCase().indexOf('DISPLAY');
        const speechIdx = replyText.toUpperCase().indexOf('SPEECH');
        
        if (displayIdx !== -1 && speechIdx !== -1) {
          let displayPart = replyText.substring(displayIdx + 7, speechIdx).trim();
          displayPart = displayPart.replace(/^[:*\]\s]+/, '').replace(/[\[*:\s]+$/, '').trim();
          
          let speechPart = replyText.substring(speechIdx + 6).trim();
          speechPart = speechPart.replace(/^[:*\]\s]+/, '').replace(/[\[*:\s]+$/, '').trim();
          
          if (displayPart && speechPart) {
            displayReply = displayPart;
            speechReply = speechPart;
          }
        }
      }
      
      // Expose properties lists inside final state
      state.properties = properties || [];
    }

    state.activeQuestion = activeQuestion;
    res.json({
      success: true,
      reply: displayReply,
      speechReply: speechReply,
      activeQuestion,
      state,
      properties: state.completionProperties || state.properties || []
    });

  } catch (error) {
    console.error('CHAT_WITH_ASSISTANT_ERROR:', error);
    res.status(500).json({ success: false, message: error.message });
  }
};

// 4. Retry Lead Submission Controller
export const retryLeadSubmission = async (req, res) => {
  try {
    const { state } = req.body;
    if (!state || !state.email || !state.phone) {
      return res.status(400).json({ success: false, message: 'Invalid lead state' });
    }
    
    const lead = await saveLeadFromState(state, req.user);
    
    res.json({
      success: true,
      message: 'Lead saved successfully',
      state: { ...state, leadCreated: true }
    });
  } catch (error) {
    console.error('Failed to retry lead submission:', error);
    res.status(500).json({
      success: false,
      message: 'Database save failed. Please try again.',
      state: { ...state, leadCreated: false }
    });
  }
};
