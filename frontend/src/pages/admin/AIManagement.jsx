import React, { useEffect, useState } from "react";
import axios from "axios";
import API_URL from "../../config";
import { useAuth } from "../../context/AuthContext";
import { 
  HiOutlineAdjustments, 
  HiOutlineTerminal, 
  HiOutlineChatAlt2, 
  HiOutlinePlus, 
  HiOutlineTrash, 
  HiOutlineCheckCircle, 
  HiOutlineXCircle,
  HiOutlineSparkles
} from "react-icons/hi";

const defaultFlowConfig = {
  options: {
    buyer: [
      { label: "🏠 Buy a home", value: "Buy a home", intent: "buyer" },
      { label: "🏡 I'm looking for a rental", value: "I'm looking for a rental", intent: "renter" },
      { label: "👤 Speak with an agent", value: "Speak with an agent", intent: "agent" },
      { label: "🔑 Rent a Property", value: "Rent a Property", intent: "renter" }
    ],
    seller: [
      { label: "💰 What is my home worth?", value: "What is my home worth?", intent: "seller" },
      { label: "🏠 Sell a home", value: "Sell a home", intent: "seller" },
      { label: "👤 Speak with an agent", value: "Speak with an agent", intent: "agent" }
    ],
    admin: [
      { label: "📊 Show platform stats", value: "Show platform stats", intent: "admin" },
      { label: "👥 Review pending sellers", value: "Review pending sellers", intent: "admin" },
      { label: "🏠 Check active listings", value: "Check active listings", intent: "admin" }
    ]
  },
  flows: {
    buyer: ["propertyType", "city", "locality", "bedrooms", "budget", "timeline"],
    renter: ["city", "locality", "propertyType", "bedrooms", "budget", "timeline"],
    seller: ["city", "locality", "propertyType", "bedrooms", "propertySize", "budget", "timeline"]
  },
  questions: {
    propertyType: {
      text_en: "What type of property are you looking for?",
      text_hi: "आप किस प्रकार की प्रॉपर्टी तलाश रहे हैं?",
      text_hg: "Aap kis type ki property search kar rahe hain?",
      suggestions: [
        { label: "Flat/Apartment", value: "apartment" },
        { label: "Villa/House", value: "house" },
        { label: "Penthouse", value: "penthouse" },
        { label: "Commercial property", value: "commercial" }
      ]
    },
    city: {
      text_en: "Which city are you looking in?",
      text_hi: "आप किस शहर में तलाश कर रहे हैं?",
      text_hg: "Aap kis city me property dekh rahe hain?",
      suggestions: [
        { label: "📍 Delhi", value: "Delhi" },
        { label: "📍 Noida", value: "Noida" },
        { label: "📍 Gurugram", value: "Gurugram" },
        { label: "📍 Mumbai", value: "Mumbai" }
      ]
    },
    locality: {
      text_en: "Which area/locality are you considering?",
      text_hi: "आप किस इलाके या क्षेत्र पर विचार कर रहे हैं?",
      text_hg: "Aap kis area/locality me property dekh rahe hain?",
      cityLocalities: {
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
      }
    },
    bedrooms: {
      text_en: "How many bedrooms do you need?",
      text_hi: "आपको कितने बेडरूम की आवश्यकता है?",
      text_hg: "Aapko kitne bedrooms chahiye?",
      suggestions: [
        { label: "1 BHK", value: "1 BHK" },
        { label: "2 BHK", value: "2 BHK" },
        { label: "3 BHK", value: "3 BHK" },
        { label: "4+ BHK", value: "4+ BHK" }
      ]
    },
    propertySize: {
      text_en: "What is the approximate size of your property?",
      text_hi: "आपकी प्रॉपर्टी का अनुमानित आकार क्या है?",
      text_hg: "Aapki property ka approximate size kya hai?",
      suggestions: [
        { label: "Under 1,000 sq ft", value: "Under 1,000 sq ft" },
        { label: "1,000–1,500 sq ft", value: "1,000–1,500 sq ft" },
        { label: "1,500–2,500 sq ft", value: "1,500–2,500 sq ft" },
        { label: "2,500+ sq ft", value: "2,500+ sq ft" }
      ]
    },
    budget: {
      text_en: "What price range are you hoping to stay within?",
      text_hi: "आप किस मूल्य सीमा में प्रॉपर्टी देखना चाहते हैं?",
      text_hg: "Aap kis budget range me property dekh rahe hain?",
      suggestions: [
        { label: "Under ₹50L", value: "Under ₹50L" },
        { label: "₹50L - ₹1Cr", value: "₹50L - ₹1Cr" },
        { label: "₹1Cr - ₹2Cr", value: "₹1Cr - ₹2Cr" },
        { label: "₹2Cr+", value: "₹2Cr+" }
      ]
    },
    timeline: {
      text_en: "What is your timeframe for booking the property?",
      text_hi: "प्रॉपर्टी बुक करने की आपकी संभावित समय-सीमा क्या है?",
      text_hg: "Property book karne ka aapka expected timeframe kya hai?",
      suggestions: [
        { label: "Immediately", value: "Immediately" },
        { label: "1-3 Months", value: "1-3 Months" },
        { label: "3-6 Months", value: "3-6 Months" },
        { label: "6+ Months", value: "6+ Months" }
      ]
    },
    offTopic: {
      text_en: "I'm sorry, but I don't have information on that topic. I am EstateEase AI, specialized exclusively in real estate, property search, sales, rentals, and platform navigation. How can I assist you with your property needs today?",
      text_hi: "क्षमा करें, मेरे पास इस बारे में कोई जानकारी नहीं है। मैं EstateEase AI हूँ और केवल रियल एस्टेट, प्रॉपर्टी (खरीदने, बेचने, किराए पर लेने) और प्लेटफ़ॉर्म नेविगेशन से जुड़े सवालों में ही आपकी मदद कर सकता हूँ। आज प्रॉपर्टी में मैं आपकी क्या सहायता करूँ?",
      text_hg: "Sorry, mere paas is bare me information nahi hai. Main EstateEase AI hoon aur sirf real estate ya property (buy, sell, rent ya listings) se related queries me hi aapki help kar sakta hoon. Aaj property search ya sale me main aapki kya help karoon?",
      suggestions: []
    }
  }
};

const defaultSellerQuestions = {
  city: {
    text_en: "Where is your property located (which city)?",
    text_hi: "आपकी प्रॉपर्टी किस शहर में स्थित है?",
    text_hg: "Aapki property kis city me located hai?",
    suggestions: [
      { label: "📍 Delhi", value: "Delhi" },
      { label: "📍 Noida", value: "Noida" },
      { label: "📍 Gurugram", value: "Gurugram" },
      { label: "📍 Mumbai", value: "Mumbai" }
    ]
  },
  locality: {
    text_en: "Which locality or area is your property located in?",
    text_hi: "आपकी प्रॉपर्टी किस इलाके या क्षेत्र में स्थित है?",
    text_hg: "Aapki property kis area ya locality me located hai?",
    suggestions: []
  },
  propertyType: {
    text_en: "What type of property do you want to sell/list?",
    text_hi: "आप किस प्रकार की प्रॉपर्टी बेचना या लिस्ट करना चाहते हैं?",
    text_hg: "Aap kis type ki property sell ya list karna chahte hain?",
    suggestions: [
      { label: "Flat/Apartment", value: "apartment" },
      { label: "Villa/House", value: "house" },
      { label: "Penthouse", value: "penthouse" },
      { label: "Commercial property", value: "commercial" },
      { label: "Plot / Land", value: "plot" }
    ]
  },
  bedrooms: {
    text_en: "How many bedrooms does your property have?",
    text_hi: "आपकी प्रॉपर्टी में कितने बेडरूम हैं?",
    text_hg: "Aapki property me kitne bedrooms hain?",
    suggestions: [
      { label: "1 BHK", value: "1 BHK" },
      { label: "2 BHK", value: "2 BHK" },
      { label: "3 BHK", value: "3 BHK" },
      { label: "4+ BHK", value: "4+ BHK" }
    ]
  },
  propertySize: {
    text_en: "What is the approximate size of your property?",
    text_hi: "आपकी प्रॉपर्टी का अनुमानित आकार क्या है?",
    text_hg: "Aapki property ka approximate size kya hai?",
    suggestions: [
      { label: "Under 1,000 sq ft", value: "Under 1,000 sq ft" },
      { label: "1,000–1,500 sq ft", value: "1,000–1,500 sq ft" },
      { label: "1,500–2,500 sq ft", value: "1,500–2,500 sq ft" },
      { label: "2,500+ sq ft", value: "2,500+ sq ft" }
    ]
  },
  budget: {
    text_en: "What is your expected selling price for the property?",
    text_hi: "आपकी प्रॉपर्टी का अपेक्षित विक्रय मूल्य क्या है?",
    text_hg: "Aapka expected selling price kya hai?",
    suggestions: [
      { label: "Under ₹50L", value: "Under ₹50L" },
      { label: "₹50L - ₹1Cr", value: "₹50L - ₹1Cr" },
      { label: "₹1Cr - ₹2Cr", value: "₹1Cr - ₹2Cr" },
      { label: "₹2Cr+", value: "₹2Cr+" }
    ]
  },
  timeline: {
    text_en: "How soon are you planning to sell the property?",
    text_hi: "आप अपनी प्रॉपर्टी कब तक बेचने की योजना बना रहे हैं?",
    text_hg: "Aap apni property kab tak sell karne ka plan kar rahe hain?",
    suggestions: [
      { label: "Immediately", value: "Immediately" },
      { label: "1-3 Months", value: "1-3 Months" },
      { label: "3-6 Months", value: "3-6 Months" },
      { label: "6+ Months", value: "6+ Months" }
    ]
  }
};

const AIManagement = () => {
  const { token } = useAuth();
  const [activeTab, setActiveTab] = useState("settings");
  const [loading, setLoading] = useState(true);
  
  // Settings state
  const [isAiEnabledAdmin, setIsAiEnabledAdmin] = useState(true);
  const [isAiEnabledSeller, setIsAiEnabledSeller] = useState(true);
  const [isAiEnabledBuyer, setIsAiEnabledBuyer] = useState(true);
  const [buyerPrompt, setBuyerPrompt] = useState("");
  const [sellerPrompt, setSellerPrompt] = useState("");
  const [adminPrompt, setAdminPrompt] = useState("");

  // Chat flow training configurations state
  const [chatFlowConfig, setChatFlowConfig] = useState(defaultFlowConfig);
  const [editingField, setEditingField] = useState("propertyType");
  const [selectedRoleForOptions, setSelectedRoleForOptions] = useState("buyer");
  const [selectedOptionIndex, setSelectedOptionIndex] = useState(0);
  const [selectedCityForLocalities, setSelectedCityForLocalities] = useState("Delhi");
  const [newOptLabel, setNewOptLabel] = useState("");
  const [newOptValue, setNewOptValue] = useState("");
  const [newOptIntent, setNewOptIntent] = useState("unique_empty");
  const [newSuggLabel, setNewSuggLabel] = useState("");
  const [newSuggValue, setNewSuggValue] = useState("");

  // Commands state
  const [commands, setCommands] = useState([]);
  const [newPhrase, setNewPhrase] = useState("");
  const [newRoute, setNewRoute] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [submittingCommand, setSubmittingCommand] = useState(false);

  // Fetch AI settings and commands
  const fetchAISettings = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/api/ai-settings`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setIsAiEnabledAdmin(res.data.settings.is_ai_enabled_admin !== false);
        setIsAiEnabledSeller(res.data.settings.is_ai_enabled_seller !== false);
        setIsAiEnabledBuyer(res.data.settings.is_ai_enabled_buyer !== false);
        setBuyerPrompt(res.data.settings.buyer_prompt || "");
        setSellerPrompt(res.data.settings.seller_prompt || "");
        setAdminPrompt(res.data.settings.admin_prompt || "");
        setCommands(res.data.commands || []);
        if (res.data.settings.ai_chat_flow_config) {
          const loaded = res.data.settings.ai_chat_flow_config;
          // Migrate old options array format to partitioned object
          if (loaded.options && Array.isArray(loaded.options)) {
            loaded.options = {
              buyer: loaded.options,
              seller: defaultFlowConfig.options.seller,
              admin: defaultFlowConfig.options.admin
            };
          }
          // Make sure questions have cityLocalities mapped
          if (loaded.questions && loaded.questions.locality && !loaded.questions.locality.cityLocalities) {
            loaded.questions.locality.cityLocalities = defaultFlowConfig.questions.locality.cityLocalities;
          }
          setChatFlowConfig(loaded);
        } else {
          setChatFlowConfig(defaultFlowConfig);
        }
      }
    } catch (err) {
      console.error("Failed to load AI settings:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAISettings();
  }, [token]);

  // Handle role-specific toggle
  const handleToggleAI = async (key, currentValue, setter) => {
    const nextValue = !currentValue;
    try {
      const res = await axios.post(
        `${API_URL}/api/ai-settings`,
        { key, value: nextValue },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        setter(nextValue);
      }
    } catch (err) {
      alert(`Failed to toggle AI status for ${key}`);
    }
  };

  // Handle prompt update
  const handleSavePrompt = async (key, value) => {
    try {
      const res = await axios.post(
        `${API_URL}/api/ai-settings`,
        { key, value },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        alert("Prompt updated successfully");
      }
    } catch (err) {
      alert("Failed to save prompt");
    }
  };

  // Save Flow Configs
  const handleSaveFlowConfig = async (newConfig) => {
    try {
      const res = await axios.post(
        `${API_URL}/api/ai-settings`,
        { key: "ai_chat_flow_config", value: newConfig },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        setChatFlowConfig(newConfig);
        alert("AI chat flow configurations saved successfully!");
      }
    } catch (err) {
      alert("Failed to save AI chat flow configurations.");
    }
  };

  // Handle adding custom command
  const handleAddCommand = async (e) => {
    e.preventDefault();
    if (!newPhrase.trim() || !newRoute.trim()) return;

    try {
      setSubmittingCommand(true);
      const res = await axios.post(
        `${API_URL}/api/ai-settings/commands`,
        {
          phrase: newPhrase,
          route: newRoute,
          description: newDescription
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        setCommands([res.data.command, ...commands]);
        setNewPhrase("");
        setNewRoute("");
        setNewDescription("");
        alert("AI successfully trained on new command!");
      }
    } catch (err) {
      alert(err.response?.data?.message || "Failed to add command");
    } finally {
      setSubmittingCommand(false);
    }
  };

  // Handle deleting command
  const handleDeleteCommand = async (id) => {
    if (!window.confirm("Are you sure you want to delete this command?")) return;
    try {
      const res = await axios.delete(`${API_URL}/api/ai-settings/commands/${id}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (res.data.success) {
        setCommands(commands.filter(c => c._id !== id));
      }
    } catch (err) {
      alert("Failed to delete command");
    }
  };

  // Handle toggling command active status
  const handleToggleCommand = async (id) => {
    try {
      const res = await axios.patch(
        `${API_URL}/api/ai-settings/commands/${id}/toggle`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        setCommands(commands.map(c => c._id === id ? { ...c, isActive: res.data.command.isActive } : c));
      }
    } catch (err) {
      alert("Failed to toggle command status");
    }
  };

  if (loading) {
    return (
      <div className="flex h-96 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-emerald-500 border-t-transparent"></div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl p-3 sm:p-6 font-sans w-full overflow-x-hidden">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h1 className="text-lg sm:text-xl font-black text-slate-800 tracking-tight flex items-center gap-2">
            <HiOutlineSparkles className="text-emerald-500 animate-pulse" />
            AI Management & Training
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Configure global AI parameters, customize system instructions, and teach the co-pilot new navigation commands.
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="mb-6 flex border-b border-slate-200 overflow-x-auto no-scrollbar gap-1 sm:gap-0">
        <button
          onClick={() => setActiveTab("settings")}
          className={`flex items-center gap-2 border-b-2 px-3 sm:px-4 py-2.5 text-xs font-extrabold transition-all whitespace-nowrap ${
            activeTab === "settings"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          <HiOutlineAdjustments size={16} />
          Global Settings
        </button>
        <button
          onClick={() => setActiveTab("prompts")}
          className={`flex items-center gap-2 border-b-2 px-3 sm:px-4 py-2.5 text-xs font-extrabold transition-all whitespace-nowrap ${
            activeTab === "prompts"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          <HiOutlineChatAlt2 size={16} />
          System Prompts (Training)
        </button>
        <button
          onClick={() => setActiveTab("commands")}
          className={`flex items-center gap-2 border-b-2 px-3 sm:px-4 py-2.5 text-xs font-extrabold transition-all whitespace-nowrap ${
            activeTab === "commands"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-slate-400 hover:text-slate-600"
          }`}
        >
          <HiOutlineTerminal size={16} />
          Command Dictionary
        </button>
      </div>

      {/* Tab Content */}
      <div className="bg-white rounded-2xl border border-slate-100 p-3 sm:p-6 shadow-sm overflow-x-hidden">
        {activeTab === "settings" && (
          <div className="space-y-6">
            <h3 className="text-sm font-bold text-slate-700">Role-Based AI Enable/Disable</h3>
            <p className="text-xs text-slate-400 -mt-4">
              Enable or disable the AI chatbot widget for each user role independently.
            </p>

            {/* Buyer Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50/50 border border-slate-100">
              <div>
                <span className="block text-xs font-bold text-slate-700">Buyer Panel Co-pilot</span>
                <span className="block text-[11px] text-slate-400 mt-0.5">
                  Controls the AI widget on public pages, search pages, and the buyer dashboard.
                </span>
              </div>
              <button
                onClick={() => handleToggleAI("is_ai_enabled_buyer", isAiEnabledBuyer, setIsAiEnabledBuyer)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isAiEnabledBuyer ? "bg-emerald-600" : "bg-slate-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isAiEnabledBuyer ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Seller Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50/50 border border-slate-100">
              <div>
                <span className="block text-xs font-bold text-slate-700">Seller Panel Co-pilot</span>
                <span className="block text-[11px] text-slate-400 mt-0.5">
                  Controls the AI widget inside the Seller Dashboard and tools.
                </span>
              </div>
              <button
                onClick={() => handleToggleAI("is_ai_enabled_seller", isAiEnabledSeller, setIsAiEnabledSeller)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isAiEnabledSeller ? "bg-emerald-600" : "bg-slate-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isAiEnabledSeller ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {/* Admin Toggle */}
            <div className="flex items-center justify-between p-4 rounded-xl bg-slate-50/50 border border-slate-100">
              <div>
                <span className="block text-xs font-bold text-slate-700">Admin Panel Co-pilot</span>
                <span className="block text-[11px] text-slate-400 mt-0.5">
                  Controls the AI widget inside the Admin Control Center.
                </span>
              </div>
              <button
                onClick={() => handleToggleAI("is_ai_enabled_admin", isAiEnabledAdmin, setIsAiEnabledAdmin)}
                className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none ${
                  isAiEnabledAdmin ? "bg-emerald-600" : "bg-slate-300"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 transform rounded-full bg-white shadow ring-0 transition duration-200 ease-in-out ${
                    isAiEnabledAdmin ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>
          </div>
        )}

        {activeTab === "prompts" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-700">Customize Role Instructions</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Edit the system instructions that guide the AI's behavior, tone, and knowledge for each user role. Leave blank to use defaults.
              </p>
            </div>

            {/* Buyer Prompt */}
            <div className="space-y-2">
              <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">Buyer Co-pilot Prompt</label>
              <textarea
                value={buyerPrompt}
                onChange={e => setBuyerPrompt(e.target.value)}
                placeholder="Enter custom instructions for the buyer's co-pilot..."
                rows={5}
                className="w-full rounded-xl border border-slate-200 p-3.5 text-xs font-medium focus:border-emerald-500 focus:outline-none transition-all"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setBuyerPrompt(""); handleSavePrompt("buyer_prompt", ""); }}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-500 hover:bg-slate-50 border border-slate-200 transition-all"
                >
                  Reset Default
                </button>
                <button
                  onClick={() => handleSavePrompt("buyer_prompt", buyerPrompt)}
                  className="px-3.5 py-1.5 rounded-lg text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all shadow-sm"
                >
                  Save Buyer Prompt
                </button>
              </div>
            </div>

            {/* Seller Prompt */}
            <div className="space-y-2 pt-4 border-t border-slate-100">
              <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">Seller Co-pilot Prompt</label>
              <textarea
                value={sellerPrompt}
                onChange={e => setSellerPrompt(e.target.value)}
                placeholder="Enter custom instructions for the seller's co-pilot..."
                rows={5}
                className="w-full rounded-xl border border-slate-200 p-3.5 text-xs font-medium focus:border-emerald-500 focus:outline-none transition-all"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setSellerPrompt(""); handleSavePrompt("seller_prompt", ""); }}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-500 hover:bg-slate-50 border border-slate-200 transition-all"
                >
                  Reset Default
                </button>
                <button
                  onClick={() => handleSavePrompt("seller_prompt", sellerPrompt)}
                  className="px-3.5 py-1.5 rounded-lg text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all shadow-sm"
                >
                  Save Seller Prompt
                </button>
              </div>
            </div>

            {/* Admin Prompt */}
            <div className="space-y-2 pt-4 border-t border-slate-100">
              <label className="text-[11px] font-extrabold text-slate-600 uppercase tracking-wider">Admin Co-pilot Prompt</label>
              <textarea
                value={adminPrompt}
                onChange={e => setAdminPrompt(e.target.value)}
                placeholder="Enter custom instructions for the admin's co-pilot..."
                rows={5}
                className="w-full rounded-xl border border-slate-200 p-3.5 text-xs font-medium focus:border-emerald-500 focus:outline-none transition-all"
              />
              <div className="flex justify-end gap-2">
                <button
                  onClick={() => { setAdminPrompt(""); handleSavePrompt("admin_prompt", ""); }}
                  className="px-3 py-1.5 rounded-lg text-[11px] font-bold text-slate-500 hover:bg-slate-50 border border-slate-200 transition-all"
                >
                  Reset Default
                </button>
                <button
                  onClick={() => handleSavePrompt("admin_prompt", adminPrompt)}
                  className="px-3.5 py-1.5 rounded-lg text-[11px] font-bold text-white bg-emerald-600 hover:bg-emerald-500 transition-all shadow-sm"
                >
                  Save Admin Prompt
                </button>
              </div>
            </div>

            {/* AI Assistant Chat Flow Configurations */}
            <div className="pt-6 border-t border-slate-100 space-y-6 text-left">
              {(() => {
                const currentRoleOptions = chatFlowConfig.options?.[selectedRoleForOptions] || [];
                const activeChip = currentRoleOptions[selectedOptionIndex] || currentRoleOptions[0];
                const activeIntent = activeChip?.intent || (selectedRoleForOptions === "seller" ? "seller" : selectedRoleForOptions === "admin" ? "admin" : "buyer");

                const isSellerContext = activeIntent === "seller" || selectedRoleForOptions === "seller";

                const getQuestionText = (field, langKey) => {
                  const q = chatFlowConfig.questions?.[field];
                  // 1. Check if there is an intent-specific override in config
                  if (activeIntent !== "general" && q?.[activeIntent]?.[langKey]) {
                    return q[activeIntent][langKey];
                  }
                  // 2. If in seller context, provide default seller question text
                  if (isSellerContext && defaultSellerQuestions[field]?.[langKey]) {
                    return defaultSellerQuestions[field][langKey];
                  }
                  // 3. Fallback to general/buyer text
                  return q?.[langKey] || "";
                };

                const setQuestionText = (field, langKey, val) => {
                  const questions = { ...chatFlowConfig.questions };
                  const q = { ...(questions[field] || {}) };
                  if (activeIntent === "general") {
                    q[langKey] = val;
                  } else {
                    const baseObj = q[activeIntent] || (isSellerContext && defaultSellerQuestions[field] ? { ...defaultSellerQuestions[field] } : { text_en: "", text_hi: "", text_hg: "", suggestions: [] });
                    q[activeIntent] = {
                      ...baseObj,
                      [langKey]: val
                    };
                  }
                  questions[field] = q;
                  setChatFlowConfig({ ...chatFlowConfig, questions });
                };

                const getSuggestionsList = (field) => {
                  const q = chatFlowConfig.questions?.[field];
                  if (activeIntent !== "general" && q?.[activeIntent]?.suggestions && q[activeIntent].suggestions.length > 0) {
                    return q[activeIntent].suggestions;
                  }
                  if (isSellerContext && defaultSellerQuestions[field]?.suggestions && defaultSellerQuestions[field].suggestions.length > 0) {
                    return defaultSellerQuestions[field].suggestions;
                  }
                  return q?.suggestions || [];
                };

                const setSuggestionsList = (field, list) => {
                  const questions = { ...chatFlowConfig.questions };
                  const q = { ...(questions[field] || {}) };
                  if (activeIntent === "general") {
                    q.suggestions = list;
                  } else {
                    const baseObj = q[activeIntent] || (isSellerContext && defaultSellerQuestions[field] ? { ...defaultSellerQuestions[field] } : { text_en: "", text_hi: "", text_hg: "", suggestions: [] });
                    q[activeIntent] = {
                      ...baseObj,
                      suggestions: list
                    };
                  }
                  questions[field] = q;
                  setChatFlowConfig({ ...chatFlowConfig, questions });
                };

                const activeFields = chatFlowConfig.flows?.[activeIntent] || [];
                const defaultFields = ["propertyType", "city", "locality", "bedrooms", "propertySize", "budget", "timeline"];
                const customFields = chatFlowConfig.customFieldsByIntent?.[activeIntent] || [];
                const allFields = [...defaultFields, ...customFields];

                return (
                  <>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 pb-4">
                      <div>
                        <h3 className="text-sm font-bold text-slate-700">Pre-built Chat Options & Qualification Flows (Training)</h3>
                        <p className="text-[11px] text-slate-400 mt-0.5">
                          Train the AI agents by defining welcome options, custom field collection sequences, and custom step questions/suggestions.
                        </p>
                      </div>
                      <div className="flex items-center gap-2">
                        <label className="text-[10px] font-bold text-slate-500 uppercase">Select Role:</label>
                        <select
                          value={selectedRoleForOptions}
                          onChange={e => {
                            setSelectedRoleForOptions(e.target.value);
                            setSelectedOptionIndex(0);
                          }}
                          className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-semibold focus:outline-none focus:border-emerald-500 bg-white"
                        >
                          <option value="buyer">Buyer Assistant Options</option>
                          <option value="seller">Seller Assistant Options</option>
                        </select>
                      </div>
                    </div>

                    {/* Startup Options Editor */}
                    <div className="space-y-4 bg-slate-50/55 p-4 rounded-xl border border-slate-100">
                      <div>
                        <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">1. Welcome Option Chips</h4>
                        <p className="text-[10px] text-slate-400">
                          Click a chip to select it and train its sequence / overrides. Use the form below to add new ones.
                        </p>
                      </div>

                      {/* Option chips list */}
                      <div className="flex flex-wrap gap-2.5 mb-1 p-3 bg-white border border-slate-150 rounded-xl">
                        {currentRoleOptions.length === 0 ? (
                          <span className="text-xs text-slate-400 italic">No startup options defined for this role.</span>
                        ) : (
                          currentRoleOptions.map((opt, idx) => {
                            const isSelected = idx === selectedOptionIndex;
                            return (
                              <div
                                key={idx}
                                onClick={() => setSelectedOptionIndex(idx)}
                                className={`cursor-pointer flex items-center justify-between gap-2 px-3 py-2 border rounded-xl text-xs font-bold transition-all select-none ${
                                  isSelected
                                    ? "bg-emerald-50 border-emerald-500 text-emerald-800 shadow-sm ring-1 ring-emerald-500"
                                    : "bg-white border-slate-200 text-slate-700 hover:border-slate-300 hover:bg-slate-50"
                                }`}
                              >
                                <div className="flex items-center gap-1.5">
                                  {isSelected && <span className="w-1.5 h-1.5 rounded-full bg-emerald-600 animate-pulse" />}
                                  <span>{opt.label}</span>
                                  {opt.intent && (
                                    <span className="text-[9px] bg-slate-100 text-slate-500 px-1 py-0.5 rounded font-extrabold lowercase">
                                      ({opt.intent})
                                    </span>
                                  )}
                                </div>
                                <button
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    const updatedRoleOpts = currentRoleOptions.filter((_, oIdx) => oIdx !== idx);
                                    const updated = {
                                      ...chatFlowConfig,
                                      options: {
                                        ...chatFlowConfig.options,
                                        [selectedRoleForOptions]: updatedRoleOpts
                                      }
                                    };
                                    handleSaveFlowConfig(updated);
                                    setSelectedOptionIndex(0);
                                  }}
                                  className="text-slate-400 hover:text-rose-600 transition-all"
                                  title="Delete Option"
                                >
                                  <HiOutlineXCircle size={14} />
                                </button>
                              </div>
                            );
                          })
                        )}
                      </div>

                      {/* Add option Form */}
                      <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 bg-white p-3 rounded-lg border border-slate-200">
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Chip Display Label</label>
                          <input
                            type="text"
                            placeholder="e.g. 🔑 Rent a Property"
                            value={newOptLabel}
                            onChange={e => setNewOptLabel(e.target.value)}
                            className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Message Value Sent</label>
                          <input
                            type="text"
                            placeholder="e.g. Rent a Property"
                            value={newOptValue}
                            onChange={e => setNewOptValue(e.target.value)}
                            className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:border-emerald-500"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[10px] font-bold text-slate-500 uppercase">Intent Flow</label>
                          <select
                            value={newOptIntent}
                            onChange={e => setNewOptIntent(e.target.value)}
                            className="w-full rounded-md border border-slate-200 px-2 py-1.5 text-xs font-medium focus:outline-none focus:border-emerald-500 bg-white"
                          >
                            <option value="unique_empty">New Custom Sequence (Starts empty)</option>
                            <option value="unique_buyer">New Custom Sequence (Copy Buyer steps)</option>
                            <option value="unique_renter">New Custom Sequence (Copy Tenant steps)</option>
                            <option value="unique_seller">New Custom Sequence (Copy Seller steps)</option>
                            <option value="buyer">Share Existing Buyer Sequence</option>
                            <option value="renter">Share Existing Tenant Sequence</option>
                            <option value="seller">Share Existing Seller Sequence</option>
                            <option value="agent">Share Existing Direct Agent Sequence</option>
                            <option value="custom">Advanced: Specify Custom Intent Key...</option>
                          </select>
                        </div>
                        <div className="flex items-end">
                          {newOptIntent === "custom" || (!["unique_empty", "unique_buyer", "unique_renter", "unique_seller", "buyer", "renter", "seller", "agent"].includes(newOptIntent) && newOptIntent !== "custom") ? (
                            <div className="w-full flex gap-2">
                              <input
                                type="text"
                                placeholder="Custom intent name (e.g. my_flow)"
                                onChange={e => setNewOptIntent(e.target.value)}
                                className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:border-emerald-500"
                              />
                              <button
                                onClick={() => {
                                  if (!newOptLabel.trim() || !newOptValue.trim() || !newOptIntent.trim()) return;
                                  const newOption = {
                                    label: newOptLabel.trim(),
                                    value: newOptValue.trim(),
                                    intent: newOptIntent.trim()
                                  };
                                  const updated = {
                                    ...chatFlowConfig,
                                    options: {
                                      ...chatFlowConfig.options,
                                      [selectedRoleForOptions]: [...currentRoleOptions, newOption]
                                    },
                                    flows: {
                                      ...chatFlowConfig.flows,
                                      [newOptIntent.trim()]: []
                                    }
                                  };
                                  handleSaveFlowConfig(updated);
                                  setNewOptLabel("");
                                  setNewOptValue("");
                                  setNewOptIntent("unique_empty");
                                }}
                                className="py-1.5 px-3 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-md shadow-xs transition-all flex items-center justify-center gap-1 font-sans shrink-0"
                              >
                                Add
                              </button>
                            </div>
                          ) : (
                            <button
                              onClick={() => {
                                if (!newOptLabel.trim() || !newOptValue.trim()) return;

                                let finalIntent = newOptIntent;
                                let initialFlow = [];

                                if (newOptIntent.startsWith("unique_")) {
                                  const suffix = newOptLabel.toLowerCase().replace(/[^a-z0-9]/g, "");
                                  finalIntent = `cust_${suffix}_${Date.now().toString().slice(-4)}`;

                                  if (newOptIntent === "unique_buyer") {
                                    initialFlow = ["propertyType", "city", "locality", "bedrooms", "budget", "timeline"];
                                  } else if (newOptIntent === "unique_renter") {
                                    initialFlow = ["city", "locality", "propertyType", "bedrooms", "budget", "timeline"];
                                  } else if (newOptIntent === "unique_seller") {
                                    initialFlow = ["city", "locality", "propertyType", "bedrooms", "propertySize", "budget", "timeline"];
                                  }
                                }

                                const newOption = {
                                  label: newOptLabel.trim(),
                                  value: newOptValue.trim(),
                                  intent: finalIntent
                                };

                                const updated = {
                                  ...chatFlowConfig,
                                  options: {
                                    ...chatFlowConfig.options,
                                    [selectedRoleForOptions]: [...currentRoleOptions, newOption]
                                  },
                                  flows: {
                                    ...chatFlowConfig.flows,
                                    [finalIntent]: initialFlow
                                  }
                                };

                                handleSaveFlowConfig(updated);
                                setNewOptLabel("");
                                setNewOptValue("");
                                setNewOptIntent("unique_empty");
                              }}
                              className="w-full py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-md shadow-xs transition-all flex items-center justify-center gap-1"
                            >
                              <HiOutlinePlus /> Add Option Chip
                            </button>
                          )}
                        </div>
                      </div>
                    </div>

                    {/* Qualification Field Flow Sequences */}
                    <div className="space-y-4 bg-slate-50/55 p-3 sm:p-4 rounded-xl border border-slate-100 text-left">
                      <div>
                        <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">2. Qualification Flow Sequence</h4>
                        <p className="text-[10px] text-slate-400">
                          Configure which questions the AI asks and the order in which they are asked during the selected welcome chip's flow.
                        </p>
                      </div>

                      {currentRoleOptions.length === 0 ? (
                        <div className="bg-white p-6 rounded-xl border border-slate-200 text-center text-xs text-slate-500 italic">
                          Please add a welcome option chip first in Step 1 to configure its sequence.
                        </div>
                      ) : (
                        <div className="bg-white p-3 sm:p-4 rounded-xl border border-emerald-400 shadow-xs space-y-2 max-w-full overflow-x-hidden">
                          <span className="block text-xs font-bold text-slate-800 border-b border-slate-100 pb-1.5 mb-2 flex flex-wrap items-center gap-1.5 leading-snug">
                            <span className="w-2.5 h-2.5 rounded-full bg-emerald-500 animate-pulse shrink-0" />
                            <span>Active Flow Sequence for:</span>
                            <strong className="text-emerald-700 font-extrabold">"{activeChip?.label || activeIntent}"</strong>
                            <span className="text-slate-400 font-normal">(Intent: <code className="text-slate-600 bg-slate-100 px-1 py-0.5 rounded text-[10px]">{activeIntent}</code>)</span>
                          </span>
                          
                          {(() => {
                            return (
                              <div className="space-y-2 w-full max-w-2xl">
                                {activeFields.length === 0 ? (
                                  <div className="p-4 bg-slate-50 border border-dashed border-slate-200 rounded-lg text-center text-xs text-slate-500 italic">
                                    No steps added to this sequence yet. Use the form below to build your custom flow sequence.
                                  </div>
                                ) : (
                                  activeFields.map((field, seqIdx) => {
                                    const displayName = field === "propertyType" ? "Property Type" :
                                                        field === "propertySize" ? "Property Size" :
                                                        field.replace(/([A-Z])/g, ' $1');

                                    return (
                                      <div
                                        key={`${field}-${seqIdx}`}
                                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 p-2.5 rounded-xl border border-slate-200 bg-white shadow-2xs text-xs transition-all"
                                      >
                                        <div className="flex items-center gap-2.5 min-w-0">
                                          <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-600 text-white shrink-0">
                                            Step {seqIdx + 1}
                                          </span>
                                          <span className="font-semibold text-slate-700 capitalize truncate">
                                            {displayName}
                                          </span>
                                        </div>

                                        <div className="flex items-center justify-between sm:justify-end gap-2 pt-1.5 sm:pt-0 border-t sm:border-t-0 border-slate-100 w-full sm:w-auto">
                                          <div className="flex items-center gap-1">
                                            <button
                                              disabled={seqIdx === 0}
                                              onClick={() => {
                                                const nextFields = [...activeFields];
                                                const temp = nextFields[seqIdx - 1];
                                                nextFields[seqIdx - 1] = nextFields[seqIdx];
                                                nextFields[seqIdx] = temp;
                                                const updated = {
                                                  ...chatFlowConfig,
                                                  flows: {
                                                    ...chatFlowConfig.flows,
                                                    [activeIntent]: nextFields
                                                  }
                                                };
                                                handleSaveFlowConfig(updated);
                                              }}
                                              className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 text-slate-500 hover:text-slate-800 transition-all font-bold text-xs"
                                              title="Move Up"
                                            >
                                              ▲
                                            </button>
                                            <button
                                              disabled={seqIdx === activeFields.length - 1}
                                              onClick={() => {
                                                const nextFields = [...activeFields];
                                                const temp = nextFields[seqIdx + 1];
                                                nextFields[seqIdx + 1] = nextFields[seqIdx];
                                                nextFields[seqIdx] = temp;
                                                const updated = {
                                                  ...chatFlowConfig,
                                                  flows: {
                                                    ...chatFlowConfig.flows,
                                                    [activeIntent]: nextFields
                                                  }
                                                };
                                                handleSaveFlowConfig(updated);
                                              }}
                                              className="p-1 rounded hover:bg-slate-100 disabled:opacity-30 text-slate-500 hover:text-slate-800 transition-all font-bold text-xs"
                                              title="Move Down"
                                            >
                                              ▼
                                            </button>
                                            
                                            <button
                                              onClick={() => {
                                                const nextFields = activeFields.filter((_, fIdx) => fIdx !== seqIdx);
                                                
                                                let updatedCustomFields = [...customFields];
                                                if (!defaultFields.includes(field)) {
                                                  updatedCustomFields = customFields.filter(f => f !== field || nextFields.includes(f));
                                                }

                                                const nextFlows = {
                                                  ...chatFlowConfig.flows,
                                                  [activeIntent]: nextFields
                                                };

                                                const updated = {
                                                  ...chatFlowConfig,
                                                  customFieldsByIntent: {
                                                    ...(chatFlowConfig.customFieldsByIntent || {}),
                                                    [activeIntent]: updatedCustomFields
                                                  },
                                                  flows: nextFlows
                                                };
                                                handleSaveFlowConfig(updated);
                                                if (editingField === field) {
                                                  setEditingField("propertyType");
                                                }
                                              }}
                                              className="p-1 text-slate-400 hover:text-rose-600 transition-all ml-1.5 border-l border-slate-200 pl-2 font-semibold text-xs"
                                              title="Remove Step from Sequence"
                                            >
                                              🗑️ Remove
                                            </button>
                                          </div>
                                        </div>
                                      </div>
                                    );
                                  })
                                )}

                                {/* Add Step Form */}
                                <div className="mt-4 pt-3 border-t border-slate-100 space-y-3 w-full max-w-2xl text-left">
                                  <h5 className="text-[11px] font-bold text-slate-700 uppercase tracking-wider">➕ Add Step to Sequence</h5>
                                  
                                  <div className="flex flex-col md:flex-row gap-3 items-stretch md:items-end bg-slate-50 p-3 rounded-lg border border-slate-200">
                                    {/* Option A: Quick-add pre-built step */}
                                    <div className="flex-1 space-y-1 w-full min-w-0">
                                      <label className="text-[9px] font-extrabold text-slate-500 uppercase">A. Select Pre-built Step</label>
                                      <select
                                        id="prebuilt-step-select"
                                        className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:border-emerald-500 bg-white"
                                      >
                                        <option value="">-- Choose pre-built step --</option>
                                        <option value="propertyType">Property Type</option>
                                        <option value="city">City</option>
                                        <option value="locality">Locality</option>
                                        <option value="bedrooms">Bedrooms (BHK)</option>
                                        <option value="propertySize">Property Size</option>
                                        <option value="budget">Budget / Price Range</option>
                                        <option value="timeline">Timeline</option>
                                      </select>
                                    </div>

                                    <div className="text-slate-400 text-xs font-bold text-center self-center py-0.5 md:py-2">OR</div>

                                    {/* Option B: Type a new custom step */}
                                    <div className="flex-1 space-y-1 w-full min-w-0">
                                      <label className="text-[9px] font-extrabold text-slate-500 uppercase">B. Type Custom Step Name</label>
                                      <input
                                        type="text"
                                        placeholder="e.g. possessionStatus"
                                        id="new-custom-field-input"
                                        className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-semibold focus:outline-none focus:border-emerald-500 bg-white"
                                      />
                                    </div>

                                    <button
                                      onClick={() => {
                                        const selectEl = document.getElementById("prebuilt-step-select");
                                        const inputEl = document.getElementById("new-custom-field-input");
                                        
                                        let selectedField = selectEl?.value;
                                        let typedField = inputEl?.value?.trim();
                                        
                                        let fieldVal = selectedField || typedField;
                                        if (!fieldVal) return;
                                        
                                        let cleanFieldVal = fieldVal;
                                        if (!selectedField) {
                                          cleanFieldVal = typedField.replace(/[^a-zA-Z0-9]/g, "");
                                        }
                                        
                                        if (!cleanFieldVal) return;
                                        
                                        if (activeFields.includes(cleanFieldVal)) {
                                          alert("This step is already active in the sequence!");
                                          return;
                                        }
                                        
                                        const nextFlows = {
                                          ...chatFlowConfig.flows,
                                          [activeIntent]: [...activeFields, cleanFieldVal]
                                        };
                                        
                                        let updatedCustomFields = [...customFields];
                                        if (!defaultFields.includes(cleanFieldVal) && !customFields.includes(cleanFieldVal)) {
                                          updatedCustomFields.push(cleanFieldVal);
                                        }
                                        
                                        const updated = {
                                          ...chatFlowConfig,
                                          customFieldsByIntent: {
                                            ...(chatFlowConfig.customFieldsByIntent || {}),
                                            [activeIntent]: updatedCustomFields
                                          },
                                          flows: nextFlows
                                        };
                                        
                                        handleSaveFlowConfig(updated);
                                        
                                        if (selectEl) selectEl.value = "";
                                        if (inputEl) inputEl.value = "";
                                      }}
                                      className="py-2 px-4 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-xs transition-all shrink-0 w-full md:w-auto text-center"
                                    >
                                      Add Step
                                    </button>
                                  </div>
                                </div>
                              </div>
                            );
                          })()}
                        </div>
                      )}
                    </div>

                    {/* Question & Suggestions Editor */}
                    <div className="space-y-4 bg-slate-50/55 p-3 sm:p-4 rounded-xl border border-slate-100 text-left">
                      <div>
                        <h4 className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">3. Edit Step Questions & Suggestions</h4>
                        <p className="text-[10px] text-slate-400">
                          Customize the question texts asked by the AI and the default suggestion chips displayed specifically for the selected welcome chip.
                        </p>
                      </div>

                      {currentRoleOptions.length === 0 ? (
                        <div className="bg-white p-6 rounded-xl border border-slate-200 text-center text-xs text-slate-500 italic">
                          Please add a welcome option chip first in Step 1 to configure questions & suggestion chips.
                        </div>
                      ) : (() => {
                        const currentEditingField = activeFields.includes(editingField) ? editingField : (activeFields[0] || "propertyType");

                        if (activeFields.length === 0) {
                          return (
                            <div className="bg-white p-6 rounded-xl border border-slate-200 text-center text-xs text-slate-500 italic">
                              No steps are active in this sequence. Please add/activate steps in Step 2 above to configure their questions and suggestions.
                            </div>
                          );
                        }

                        return (
                          <div className="bg-white p-3 sm:p-4 rounded-lg border border-slate-200 space-y-4 max-w-full overflow-x-hidden">
                            <div className="flex flex-col lg:flex-row gap-3 lg:items-center justify-between pb-3 border-b border-slate-100">
                              {/* Field Selector dropdown */}
                              <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full lg:w-auto">
                                <label className="text-xs font-bold text-slate-700 shrink-0">Select Step/Field to Edit:</label>
                                <select
                                  value={currentEditingField}
                                  onChange={e => setEditingField(e.target.value)}
                                  className="w-full sm:w-auto max-w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-emerald-500 bg-slate-50 cursor-pointer"
                                >
                                  {activeFields.map((field, index) => {
                                    const displayName = field === "propertyType" ? "Property Type" :
                                                        field === "propertySize" ? "Property Size" :
                                                        field.replace(/([A-Z])/g, ' $1');
                                    return (
                                      <option key={field} value={field}>
                                        Step {index + 1}: {displayName}
                                      </option>
                                    );
                                  })}
                                </select>
                              </div>

                              {currentEditingField === "locality" && (
                                <div className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-3 w-full lg:w-auto">
                                  <label className="text-xs font-bold text-slate-700 shrink-0">Select City for Localities:</label>
                                  <select
                                    value={selectedCityForLocalities}
                                    onChange={e => setSelectedCityForLocalities(e.target.value)}
                                    className="w-full sm:w-auto max-w-full rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-semibold focus:outline-none focus:border-emerald-500 bg-slate-50"
                                  >
                                    {(chatFlowConfig.questions?.city?.suggestions || []).map(citySg => (
                                      <option key={citySg.value} value={citySg.value}>{citySg.label}</option>
                                    ))}
                                  </select>
                                </div>
                              )}
                            </div>

                            {/* Contextual indicator card */}
                            <div className="bg-emerald-50 border border-emerald-100 text-slate-700 p-3 rounded-lg text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                              <div className="break-words">
                                <strong>✨ Editing Target:</strong> Customizing questions and suggestion chips for: <strong className="text-emerald-800">"{activeChip?.label}"</strong> (Intent: <code className="bg-slate-100 px-1 py-0.5 rounded text-[10px] text-slate-700 font-extrabold">{activeIntent}</code>).
                              </div>
                              <span className="text-[10px] bg-emerald-600 text-white px-2 py-0.5 rounded font-extrabold uppercase tracking-wider shrink-0 self-start sm:self-auto">Active</span>
                            </div>

                            {/* Question Texts Inputs */}
                            {currentEditingField && (
                              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 border-t border-slate-100 pt-3">
                                <div className="space-y-1 min-w-0">
                                  <span className="block text-[10px] font-bold text-slate-500 uppercase">English Question Text</span>
                                  <textarea
                                    rows={2}
                                    value={getQuestionText(currentEditingField, "text_en")}
                                    onChange={e => setQuestionText(currentEditingField, "text_en", e.target.value)}
                                    className="w-full rounded-md border border-slate-200 p-2 text-xs font-medium focus:outline-none focus:border-emerald-500"
                                    placeholder="Type English question here..."
                                  />
                                </div>
                                <div className="space-y-1 min-w-0">
                                  <span className="block text-[10px] font-bold text-slate-500 uppercase">Hindi Question Text</span>
                                  <textarea
                                    rows={2}
                                    value={getQuestionText(currentEditingField, "text_hi")}
                                    onChange={e => setQuestionText(currentEditingField, "text_hi", e.target.value)}
                                    className="w-full rounded-md border border-slate-200 p-2 text-xs font-medium focus:outline-none focus:border-emerald-500"
                                    placeholder="Type Hindi question here..."
                                  />
                                </div>
                                <div className="space-y-1 min-w-0">
                                  <span className="block text-[10px] font-bold text-slate-500 uppercase">Hinglish Question Text</span>
                                  <textarea
                                    rows={2}
                                    value={getQuestionText(currentEditingField, "text_hg")}
                                    onChange={e => setQuestionText(currentEditingField, "text_hg", e.target.value)}
                                    className="w-full rounded-md border border-slate-200 p-2 text-xs font-medium focus:outline-none focus:border-emerald-500"
                                    placeholder="Type Hinglish question here..."
                                  />
                                </div>
                              </div>
                            )}

                            {/* Suggestion Chips list */}
                            <div className="space-y-2 pt-3 border-t border-slate-100">
                              <div className="flex flex-col gap-1">
                                <span className="block text-[10px] font-bold text-slate-500 uppercase">Response Suggestion Chips</span>
                                <p className="text-[10px] text-slate-400">
                                  These are buttons that appear under the AI's question, allowing the user to select an option with one tap.
                                </p>
                              </div>

                              <div className="flex flex-wrap gap-2 p-2 bg-slate-50 border border-slate-200 rounded-lg max-w-full overflow-x-hidden">
                                {currentEditingField === "locality" ? (
                                  /* Locality Suggestions (Partitioned by City) */
                                  !(chatFlowConfig.questions?.locality?.cityLocalities?.[selectedCityForLocalities]) || 
                                  chatFlowConfig.questions.locality.cityLocalities[selectedCityForLocalities].length === 0 ? (
                                    <span className="text-xs text-slate-400 italic">No localities defined for {selectedCityForLocalities} yet.</span>
                                  ) : (
                                    chatFlowConfig.questions.locality.cityLocalities[selectedCityForLocalities].map((sug, idx) => (
                                      <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium max-w-full truncate">
                                        <span className="truncate">{sug.label}</span>
                                        <span className="text-[10px] text-slate-400 font-mono truncate">({sug.value})</span>
                                        <button
                                          onClick={() => {
                                            const list = chatFlowConfig.questions.locality.cityLocalities[selectedCityForLocalities];
                                            const updatedList = list.filter((_, sIdx) => sIdx !== idx);
                                            const updatedLocality = {
                                              ...chatFlowConfig.questions.locality,
                                              cityLocalities: {
                                                ...chatFlowConfig.questions.locality.cityLocalities,
                                                [selectedCityForLocalities]: updatedList
                                              }
                                            };
                                            const updatedQuestions = {
                                              ...chatFlowConfig.questions,
                                              locality: updatedLocality
                                            };
                                            setChatFlowConfig({ ...chatFlowConfig, questions: updatedQuestions });
                                          }}
                                          className="text-slate-400 hover:text-rose-600 transition-all ml-1 shrink-0"
                                        >
                                          <HiOutlineXCircle size={13} />
                                        </button>
                                      </div>
                                    ))
                                  )
                                ) : (
                                  /* Suggestions List (Intent Override or General fallback) */
                                  getSuggestionsList(currentEditingField).length === 0 ? (
                                    <span className="text-xs text-slate-400 italic">No suggestions configured. (Falls back to general settings)</span>
                                  ) : (
                                    getSuggestionsList(currentEditingField).map((sug, idx) => (
                                      <div key={idx} className="flex items-center gap-1.5 px-2.5 py-1 bg-white border border-slate-200 rounded-lg text-xs font-medium max-w-full truncate">
                                        <span className="truncate">{sug.label}</span>
                                        <span className="text-[10px] text-slate-400 font-mono truncate">({sug.value})</span>
                                        <button
                                          onClick={() => {
                                            const list = getSuggestionsList(currentEditingField);
                                            const updatedSugs = list.filter((_, sIdx) => sIdx !== idx);
                                            setSuggestionsList(currentEditingField, updatedSugs);
                                          }}
                                          className="text-slate-400 hover:text-rose-600 transition-all ml-1 shrink-0"
                                        >
                                          <HiOutlineXCircle size={13} />
                                        </button>
                                      </div>
                                    ))
                                  )
                                )}
                              </div>

                              {/* Explanatory notes about Label vs Value */}
                              <div className="bg-slate-55 border border-slate-100 p-2.5 rounded-lg text-[10px] text-slate-500 space-y-1 leading-relaxed">
                                <p><strong>🏷️ Chip Label:</strong> The text that is shown on the button (e.g. <code>📍 Saket</code> or <code>1 BHK</code>).</p>
                                <p><strong>⚙️ Message Value:</strong> The raw text sent to the system when clicked (e.g. <code>Saket</code> or <code>1 BHK</code>). This must match the actual database values (e.g. city name or type) to filter listings correctly. If they should be identical, just type the same text in both fields!</p>
                              </div>

                              {/* Add Suggestion form */}
                              <div className="flex flex-col sm:flex-row gap-2.5 sm:items-end w-full max-w-lg pt-2">
                                <div className="flex-1 space-y-1 min-w-0">
                                  <label className="text-[9px] font-bold text-slate-400 uppercase">Chip Label (Display)</label>
                                  <input
                                    type="text"
                                    placeholder="e.g. Dwarka"
                                    value={newSuggLabel}
                                    onChange={e => {
                                      setNewSuggLabel(e.target.value);
                                      if (!newSuggValue || newSuggValue === newSuggLabel) {
                                        setNewSuggValue(e.target.value);
                                      }
                                    }}
                                    className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:border-emerald-500"
                                  />
                                </div>
                                <div className="flex-1 space-y-1 min-w-0">
                                  <label className="text-[9px] font-bold text-slate-400 uppercase">Message Value</label>
                                  <input
                                    type="text"
                                    placeholder="e.g. Dwarka"
                                    value={newSuggValue}
                                    onChange={e => setNewSuggValue(e.target.value)}
                                    className="w-full rounded-md border border-slate-200 px-2.5 py-1.5 text-xs font-medium focus:outline-none focus:border-emerald-500"
                                  />
                                </div>
                                <button
                                  onClick={() => {
                                    if (!newSuggLabel.trim() || !newSuggValue.trim()) return;
                                    const newSug = { label: newSuggLabel.trim(), value: newSuggValue.trim() };

                                    if (currentEditingField === "locality") {
                                      const currentLocality = chatFlowConfig.questions.locality || { text_en: "", text_hi: "", text_hg: "", cityLocalities: {} };
                                      const cityLocalities = currentLocality.cityLocalities || {};
                                      const currentCityList = cityLocalities[selectedCityForLocalities] || [];

                                      const updatedQuestions = {
                                        ...chatFlowConfig.questions,
                                        locality: {
                                          ...currentLocality,
                                          cityLocalities: {
                                            ...cityLocalities,
                                            [selectedCityForLocalities]: [...currentCityList, newSug]
                                          }
                                        }
                                      };
                                      setChatFlowConfig({ ...chatFlowConfig, questions: updatedQuestions });
                                    } else {
                                      const list = getSuggestionsList(currentEditingField);
                                      setSuggestionsList(currentEditingField, [...list, newSug]);

                                      // Special logic: if we just added a new City, initialize empty localities list for it
                                      if (currentEditingField === "city") {
                                        const updatedQuestions = { ...chatFlowConfig.questions };
                                        const currentLocality = chatFlowConfig.questions.locality || { text_en: "", text_hi: "", text_hg: "", cityLocalities: {} };
                                        const cityLocalities = currentLocality.cityLocalities || {};
                                        if (!cityLocalities[newSug.value]) {
                                          updatedQuestions.locality = {
                                            ...currentLocality,
                                            cityLocalities: {
                                              ...cityLocalities,
                                              [newSug.value]: []
                                            }
                                          };
                                          setChatFlowConfig({ ...chatFlowConfig, questions: updatedQuestions });
                                        }
                                      }
                                    }

                                    setNewSuggLabel("");
                                    setNewSuggValue("");
                                  }}
                                  className="py-2 px-3.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-md shadow-xs transition-all flex items-center justify-center gap-1 shrink-0 w-full sm:w-auto"
                                >
                                  <HiOutlinePlus /> Add Chip
                                </button>
                              </div>
                            </div>

                            {/* Save button */}
                            <div className="flex justify-end pt-3 border-t border-slate-100">
                              <button
                                onClick={() => handleSaveFlowConfig(chatFlowConfig)}
                                className="w-full sm:w-auto px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5"
                              >
                                Save Flow Configuration
                              </button>
                            </div>
                          </div>
                        );
                      })()}
                    </div>
                  </>
                );
              })()}
            </div>
          </div>
        )}

        {activeTab === "commands" && (
          <div className="space-y-6">
            <div>
              <h3 className="text-sm font-bold text-slate-700">Teach AI New Navigation Commands</h3>
              <p className="text-[11px] text-slate-400 mt-0.5">
                Map specific user trigger phrases to React routes on your website. The AI will learn these mappings and navigate users in real-time.
              </p>
            </div>

            {/* Add Command Form */}
            <form onSubmit={handleAddCommand} className="p-3 sm:p-4 bg-slate-50/50 border border-slate-100 rounded-xl grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
              <div className="space-y-1.5 min-w-0">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Trigger Phrase</label>
                <input
                  type="text"
                  value={newPhrase}
                  onChange={e => setNewPhrase(e.target.value)}
                  placeholder="e.g., open profile settings"
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium focus:border-emerald-500 focus:outline-none bg-white"
                />
              </div>
              <div className="space-y-1.5 min-w-0">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Target Route</label>
                <input
                  type="text"
                  value={newRoute}
                  onChange={e => setNewRoute(e.target.value)}
                  placeholder="e.g., /profile"
                  required
                  className="w-full rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium focus:border-emerald-500 focus:outline-none bg-white"
                />
              </div>
              <div className="space-y-1.5 min-w-0 sm:col-span-2 md:col-span-1">
                <label className="text-[10px] font-extrabold text-slate-500 uppercase tracking-wider">Description</label>
                <div className="flex gap-2">
                  <input
                    type="text"
                    value={newDescription}
                    onChange={e => setNewDescription(e.target.value)}
                    placeholder="e.g., Opens user profile"
                    className="w-full flex-1 min-w-0 rounded-lg border border-slate-200 px-3 py-2 text-xs font-medium focus:border-emerald-500 focus:outline-none bg-white"
                  />
                  <button
                    type="submit"
                    disabled={submittingCommand}
                    className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-200 text-white text-xs font-bold rounded-lg shadow-sm transition-all flex items-center justify-center gap-1.5 shrink-0"
                  >
                    <HiOutlinePlus />
                    Teach
                  </button>
                </div>
              </div>
            </form>

            {/* Commands Table */}
            <div className="overflow-x-auto rounded-xl border border-slate-100 w-full max-w-full">
              <table className="w-full border-collapse text-left text-xs">
                <thead>
                  <tr className="bg-slate-50/70 text-[10px] font-extrabold text-slate-500 uppercase tracking-wider border-b border-slate-100">
                    <th className="p-3.5">Trigger Phrase</th>
                    <th className="p-3.5">Target Route</th>
                    <th className="p-3.5">Description</th>
                    <th className="p-3.5 text-center">Status</th>
                    <th className="p-3.5 text-center">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {commands.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-6 text-center text-slate-400 font-medium">
                        No custom commands taught yet. Add a command above to start training!
                      </td>
                    </tr>
                  ) : (
                    commands.map(cmd => (
                      <tr key={cmd._id} className="hover:bg-slate-50/20 transition-colors">
                        <td className="p-3.5 font-bold text-slate-700">"{cmd.phrase}"</td>
                        <td className="p-3.5 font-mono text-emerald-600 font-semibold">{cmd.route}</td>
                        <td className="p-3.5 text-slate-400 font-medium">{cmd.description || "-"}</td>
                        <td className="p-3.5 text-center">
                          <button
                            onClick={() => handleToggleCommand(cmd._id)}
                            className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold border transition-all ${
                              cmd.isActive
                                ? "bg-green-50 text-green-600 border-green-100 hover:bg-green-100"
                                : "bg-slate-50 text-slate-400 border-slate-200 hover:bg-slate-100"
                            }`}
                          >
                            {cmd.isActive ? (
                              <>
                                <HiOutlineCheckCircle />
                                Active
                              </>
                            ) : (
                              <>
                                <HiOutlineXCircle />
                                Inactive
                              </>
                            )}
                          </button>
                        </td>
                        <td className="p-3.5 text-center">
                          <button
                            onClick={() => handleDeleteCommand(cmd._id)}
                            className="p-1.5 rounded-lg hover:bg-rose-50 text-slate-400 hover:text-rose-600 transition-all"
                            title="Delete Command"
                          >
                            <HiOutlineTrash size={15} />
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default AIManagement;
