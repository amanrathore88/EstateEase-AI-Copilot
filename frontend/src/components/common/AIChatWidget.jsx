import React, { useState, useRef, useEffect } from 'react';
import axios from 'axios';
import { HiSparkles, HiChevronDown, HiPaperAirplane, HiMicrophone, HiVolumeUp, HiVolumeOff, HiRefresh, HiX, HiChevronLeft } from 'react-icons/hi';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import API_URL from '../../config';

// Helper to convert numbers (like 58700000 or 58,700,000) to natural Indian spoken words (Lakhs/Crores)
const convertNumbersToSpokenIndian = (text, isHindiMode) => {
  return text.replace(/\b\d{1,3}(?:,\d{3})+\b|\b\d{5,10}\b/g, (match) => {
    const num = parseInt(match.replace(/,/g, ''));
    if (isNaN(num)) return match;
    
    const croreUnit = isHindiMode ? 'करोड़' : 'Crore';
    const lakhUnit = isHindiMode ? 'लाख' : 'Lakh';
    const thousandUnit = isHindiMode ? 'हज़ार' : 'Thousand';
    
    if (num >= 10000000) {
      const cr = Math.floor(num / 10000000);
      const lakh = Math.round((num % 10000000) / 100000);
      return `${cr} ${croreUnit} ${lakh > 0 ? `${lakh} ${lakhUnit}` : ''}`;
    } else if (num >= 100000) {
      const lakh = Math.floor(num / 100000);
      const thousand = Math.round((num % 100000) / 1000);
      return `${lakh} ${lakhUnit} ${thousand > 0 ? `${thousand} ${thousandUnit}` : ''}`;
    }
    return num.toString();
  });
};

// Localized welcome greeting helper for English, Hindi, and Hinglish across roles
const getWelcomeMessage = (role, language) => {
  const isHindi = language === 'hindi';
  const isHinglish = language === 'hinglish';

  if (role === 'admin') {
    if (isHindi) {
      return 'नमस्ते व्यवस्थापक! मैं आपका प्लेटफ़ॉर्म को-पायलट हूँ। मैं आंकड़े देखने, उपयोगकर्ता गतिविधि का विश्लेषण करने या एडमिन पैनल नेविगेट करने में आपकी मदद कर सकता हूँ। आज मैं आपकी क्या सहायता करूँ?';
    }
    if (isHinglish) {
      return 'Welcome, Administrator! Main aapka platform co-pilot hoon. Main platform stats dekhne, user activity analyze karne ya admin panel navigate karne me help kar sakta hoon. Aaj main aapki kya assist kar sakta hoon?';
    }
    return 'Welcome, Administrator. I am your platform co-pilot. I can help you query statistics, analyze user activity, or navigate the admin panel. How can I assist you today?';
  }

  if (role === 'seller') {
    if (isHindi) {
      return 'नमस्ते! मैं आपका लिस्टिंग और प्राइसिंग को-पायलट हूँ। मैं प्रॉपर्टी डिस्क्रिप्शन लिखने, उचित मूल्य का अनुमान लगाने या आपकी लिस्टिंग्स मैनेज करने में मदद कर सकता हूँ। आज मैं आपकी क्या मदद करूँ?';
    }
    if (isHinglish) {
      return 'Hello, Seller! Main aapka listing aur pricing co-pilot hoon. Main property descriptions likhne, fair market value estimate karne ya aapki listings manage karne me help kar sakta hoon. Aaj main aapki kya help kar sakta hoon?';
    }
    return 'Hello, Seller. I am your listing and pricing co-pilot. I can help you write property descriptions, estimate fair market values, or manage your listings. How can I help you today?';
  }

  // Buyer / General default
  if (isHindi) {
    return 'नमस्ते! मैं EstateEase AI हूँ, आपका प्रॉपर्टी को-पायलट। बताइए आज मैं आपकी क्या मदद कर सकता हूँ?';
  }
  if (isHinglish) {
    return 'Hi! Main EstateEase AI hoon, aapka property co-pilot. Batayein aaj main aapki kya help kar sakta hoon?';
  }
  return 'Hi! I am EstateEase AI, your property co-pilot. Let me know how I can help you today!';
};

const AIChatWidget = () => {
  const { token, user } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const [isOpen, setIsOpen] = useState(false);
  
  // Dock/Collapse to edge state
  const [isCollapsedToEdge, setIsCollapsedToEdge] = useState(() => {
    try {
      return localStorage.getItem('ai_chat_collapsed') === 'true';
    } catch (e) {
      return false;
    }
  });

  // Stateful Qualification Engine State (initialized empty, loaded reactively per user ID)
  const [conversationState, setConversationState] = useState({
    intent: "",
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
  });

  const [suggestions, setSuggestions] = useState([]);
  const [messages, setMessages] = useState([]);

  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [isAiEnabled, setIsAiEnabled] = useState(true);
  const [hasLeadError, setHasLeadError] = useState(false);
  const [chatFlowConfig, setChatFlowConfig] = useState(null);

  const chatEndRef = useRef(null);
  const recognitionRef = useRef(null);

  // Auto-detect property context from URL
  const pathMatch = location.pathname.match(/\/property\/([a-f\d]{24})/i);
  const propertyContextId = pathMatch ? pathMatch[1] : null;

  const [selectedLanguage, setSelectedLanguage] = useState(null);

  // Load chat state, messages, and language preference reactively based on logged-in user
  useEffect(() => {
    const userId = user?._id || 'guest';
    const msgKey = `estate_ease_chat_messages_${userId}`;
    const stateKey = `estate_ease_chat_state_${userId}`;
    const langKey = `ai_chat_language_${userId}`;

    // Load language preference
    let savedLang = null;
    try {
      savedLang = localStorage.getItem(langKey) || null;
    } catch (e) {}
    setSelectedLanguage(savedLang);

    // Load messages list
    let savedMsgs = [];
    try {
      const persisted = localStorage.getItem(msgKey);
      if (persisted) savedMsgs = JSON.parse(persisted);
    } catch (e) {}

    const role = user?.role || 'buyer';
    if (savedLang && (savedMsgs.length === 0 || (savedMsgs.length === 1 && savedMsgs[0].sender === 'ai'))) {
      savedMsgs = [{ sender: 'ai', text: getWelcomeMessage(role, savedLang) }];
    }
    setMessages(savedMsgs);

    // Load conversation state
    let savedState = null;
    try {
      const persisted = localStorage.getItem(stateKey);
      if (persisted) {
        const parsed = JSON.parse(persisted);
        savedState = {
          ...parsed,
          email: "",
          phone: ""
        };
      }
    } catch (e) {}

    if (savedState) {
      setConversationState(savedState);
    } else {
      setConversationState({
        intent: "",
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
      });
    }
  }, [user?._id]);

  // Persist conversationState dynamically per user ID
  useEffect(() => {
    if (!conversationState) return;
    try {
      const userId = user?._id || 'guest';
      const stateKey = `estate_ease_chat_state_${userId}`;
      const stateToPersist = { ...conversationState, email: "", phone: "" };
      localStorage.setItem(stateKey, JSON.stringify(stateToPersist));
    } catch (e) {}
  }, [conversationState, user?._id]);

  // Persist messages list dynamically per user ID
  useEffect(() => {
    if (!messages) return;
    try {
      const userId = user?._id || 'guest';
      const msgKey = `estate_ease_chat_messages_${userId}`;
      localStorage.setItem(msgKey, JSON.stringify(messages));
    } catch (e) {}
  }, [messages, user?._id]);

  const checkAIStatus = async () => {
    try {
      const res = await axios.get(`${API_URL}/api/ai-settings/status`);
      if (res.data.success) {
        const role = user?.role || 'buyer';
        if (role === 'admin') {
          setIsAiEnabled(res.data.is_ai_enabled_admin !== false);
        } else if (role === 'seller') {
          setIsAiEnabled(res.data.is_ai_enabled_seller !== false);
        } else {
          setIsAiEnabled(res.data.is_ai_enabled_buyer !== false);
        }
        if (res.data.chat_flow_config) {
          setChatFlowConfig(res.data.chat_flow_config);
        }
      }
    } catch (err) {
      console.error("Failed to check AI status:", err);
    }
  };

  useEffect(() => {
    checkAIStatus();
  }, [user, isOpen]);

  // Cleanup speech synthesis and recognition on unmount
  useEffect(() => {
    if (typeof window !== 'undefined' && window.speechSynthesis) {
      window.speechSynthesis.getVoices();
    }

    return () => {
      if (window.speechSynthesis) {
        window.speechSynthesis.cancel();
      }
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch (e) {
          console.error(e);
        }
      }
    };
  }, []);

  // Set welcome message if history is empty or contains only initial greeting
  useEffect(() => {
    if (!selectedLanguage) return;
    const role = user?.role || 'buyer';

    setMessages(prev => {
      if (prev.length === 0 || (prev.length === 1 && prev[0].sender === 'ai')) {
        return [
          {
            sender: 'ai',
            text: getWelcomeMessage(role, selectedLanguage)
          }
        ];
      }
      return prev;
    });
  }, [selectedLanguage, user]);

  // Sync suggestions on reload and state updates
  useEffect(() => {
    if (!selectedLanguage) {
      setSuggestions([]);
      return;
    }
    if (loading) return;

    if (conversationState?.activeQuestion?.suggestions && conversationState.activeQuestion.suggestions.length > 0) {
      setSuggestions(conversationState.activeQuestion.suggestions);
    } else if (!conversationState.intent) {
      // Re-populate default startup choices if intent is not set yet
      const role = user?.role || 'buyer';
      let initialSugs = [];
      if (chatFlowConfig && chatFlowConfig.options) {
        if (role === 'admin' && chatFlowConfig.options.admin) {
          initialSugs = chatFlowConfig.options.admin;
        } else if (role === 'seller' && chatFlowConfig.options.seller) {
          initialSugs = chatFlowConfig.options.seller;
        } else if (role === 'buyer') {
          initialSugs = chatFlowConfig.options.buyer || (Array.isArray(chatFlowConfig.options) ? chatFlowConfig.options : []);
        }
      }

      if (initialSugs.length === 0) {
        if (role === 'admin') {
          initialSugs = [
            { label: "📊 Show platform stats", value: "Show platform stats" },
            { label: "👥 Review pending sellers", value: "Review pending sellers" },
            { label: "🏠 Check active listings", value: "Check active listings" }
          ];
        } else if (role === 'seller') {
          initialSugs = [
            { label: "💰 What is my home worth?", value: "What is my home worth?" },
            { label: "🏠 Sell a home", value: "Sell a home" },
            { label: "👤 Speak with an agent", value: "Speak with an agent" }
          ];
        } else {
          initialSugs = [
            { label: "🏠 Buy a home", value: "Buy a home" },
            { label: "🏡 I'm looking for a rental", value: "I'm looking for a rental" },
            { label: "👤 Speak with an agent", value: "Speak with an agent" },
            { label: "🔑 Rent a Property", value: "Rent a Property" }
          ];
        }
      }
      setSuggestions(initialSugs);
    } else {
      setSuggestions([]);
    }
  }, [conversationState, user, loading, selectedLanguage, chatFlowConfig]);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isOpen]);

  // Handle suggestion chip click - direct sending
  const handleSuggestionClick = (sug) => {
    if (loading) return;
    if (typeof sug === 'object' && sug !== null) {
      sendMessageText(sug.value || sug.label, sug.intent);
    } else {
      sendMessageText(sug);
    }
  };

  // Dedicated retry handler
  const handleRetrySubmission = async () => {
    setLoading(true);
    setHasLeadError(false);
    try {
      const res = await axios.post(
        `${API_URL}/api/ai/retry-lead`,
        { state: conversationState },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data.success) {
        setConversationState(res.data.state);
        setMessages(prev => [
          ...prev,
          { sender: 'ai', text: "Perfect. We've got your details. A member of our team will be in touch with you shortly." }
        ]);
        setSuggestions([]);
      } else {
        setHasLeadError(true);
      }
    } catch (err) {
      console.error("Retry lead submission failed:", err);
      setHasLeadError(true);
    } finally {
      setLoading(false);
    }
  };

  // Reset chat helper
  const handleResetChat = () => {
    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
    }

    const defaultState = {
      intent: "",
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

    setConversationState(defaultState);
    setHasLeadError(false);
    
    let initialSugs = [];
    const role = user?.role || 'buyer';

    if (chatFlowConfig && chatFlowConfig.options) {
      if (role === 'admin' && chatFlowConfig.options.admin) {
        initialSugs = chatFlowConfig.options.admin;
      } else if (role === 'seller' && chatFlowConfig.options.seller) {
        initialSugs = chatFlowConfig.options.seller;
      } else if (role === 'buyer') {
        initialSugs = chatFlowConfig.options.buyer || (Array.isArray(chatFlowConfig.options) ? chatFlowConfig.options : []);
      }
    }

    const welcomeText = getWelcomeMessage(role, selectedLanguage || 'english');

    if (role === 'admin') {
      if (initialSugs.length === 0) {
        initialSugs = [
          { label: "📊 Show platform stats", value: "Show platform stats" },
          { label: "👥 Review pending sellers", value: "Review pending sellers" },
          { label: "🏠 Check active listings", value: "Check active listings" }
        ];
      }
    } else if (role === 'seller') {
      if (initialSugs.length === 0) {
        initialSugs = [
          { label: "💰 What is my home worth?", value: "What is my home worth?" },
          { label: "🏠 Sell a home", value: "Sell a home" },
          { label: "👤 Speak with an agent", value: "Speak with an agent" }
        ];
      }
    } else {
      if (initialSugs.length === 0) {
        initialSugs = [
          { label: "🏠 Buy a home", value: "Buy a home" },
          { label: "🏡 I'm looking for a rental", value: "I'm looking for a rental" },
          { label: "👤 Speak with an agent", value: "Speak with an agent" },
          { label: "🔑 Rent a Property", value: "Rent a Property" }
        ];
      }
    }

    setMessages([
      {
        sender: 'ai',
        text: welcomeText
      }
    ]);
    setSuggestions(initialSugs);

    const userId = user?._id || 'guest';
    localStorage.removeItem(`estate_ease_chat_state_${userId}`);
    localStorage.removeItem(`estate_ease_chat_messages_${userId}`);
  };

  const handleButtonClick = () => {
    setIsOpen(true);
  };

  const handleLanguageSelect = (lang) => {
    const userId = user?._id || 'guest';
    localStorage.setItem(`ai_chat_language_${userId}`, lang);
    setSelectedLanguage(lang);

    const role = user?.role || 'buyer';
    const newWelcomeText = getWelcomeMessage(role, lang);

    setMessages(prev => {
      // If messages list is empty, or only contains the initial AI greeting, update it to the selected language
      if (prev.length === 0 || (prev.length === 1 && prev[0].sender === 'ai')) {
        return [{ sender: 'ai', text: newWelcomeText }];
      }
      return prev;
    });
  };

  // Text-to-Speech (TTS) Helper
  const speakText = (text) => {
    if (!window.speechSynthesis || isMuted) return;

    window.speechSynthesis.cancel();
    window.speechSynthesis.resume();

    const isHindiMode = selectedLanguage === 'hindi';
    let spokenText = convertNumbersToSpokenIndian(text, isHindiMode);

    const cleanText = spokenText
      .replace(/\*\*([^*]+)\*\*/g, '$1')
      .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
      .replace(/[-*#]/g, '');

    const utterance = new SpeechSynthesisUtterance(cleanText);

    if (selectedLanguage === 'hindi' || selectedLanguage === 'hinglish') {
      utterance.lang = 'hi-IN';
    } else {
      utterance.lang = 'en-IN';
    }

    const voices = window.speechSynthesis.getVoices();
    let voice = voices.find(v => v.lang.toLowerCase().startsWith('hi')) || 
                voices.find(v => v.lang.toLowerCase().startsWith('en-in')) ||
                voices.find(v => v.lang.toLowerCase().startsWith('en'));

    if (voice) utterance.voice = voice;

    utterance.onstart = () => setIsSpeaking(true);
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = () => setIsSpeaking(false);

    window.speechSynthesis.speak(utterance);
  };

  // Speech-to-Text (STT) Helper
  const startListening = () => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      alert("Speech recognition is not supported in this browser. Please use Google Chrome.");
      return;
    }

    if (window.speechSynthesis) {
      window.speechSynthesis.cancel();
      window.speechSynthesis.resume();
      setIsSpeaking(false);
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch (e) {}
    }

    const recognition = new SpeechRecognition();
    recognitionRef.current = recognition;
    
    recognition.lang = selectedLanguage === 'hindi' ? 'hi-IN' : 'en-IN';
    recognition.interimResults = false;
    recognition.maxAlternatives = 1;
    recognition.continuous = false;

    recognition.onstart = () => setIsListening(true);
    recognition.onend = () => setIsListening(false);
    
    recognition.onerror = (event) => {
      console.error("Speech recognition error:", event.error);
      setIsListening(false);
    };

    recognition.onresult = (event) => {
      const transcript = event.results[0][0].transcript;
      sendMessageText(transcript);
    };

    recognition.start();
  };

  const sendMessageText = async (textToSend, intentOverride = null) => {
    if (!textToSend.trim() || loading) return;

    setSuggestions([]);
    setHasLeadError(false);

    const userMessage = { sender: 'user', text: textToSend };
    setMessages(prev => [...prev, userMessage]);

    if (!token || token === 'null' || token === 'undefined') {
      let text = 'You need to be logged in to chat with me. Please [Log In](/login) or [Register](/register) to get started!';
      setMessages(prev => [...prev, { sender: 'ai', text: text }]);
      return;
    }

    setLoading(true);

    const stateToSend = { ...conversationState };
    if (intentOverride) {
      stateToSend.intent = intentOverride;
    }

    try {
      const chatHistory = messages
        .slice(-6)
        .map(msg => ({
          sender: msg.sender,
          text: msg.text
        }));

      const res = await axios.post(
        `${API_URL}/api/ai/chat`,
        {
          message: textToSend,
          chatHistory,
          propertyContextId,
          language: selectedLanguage,
          userRole: user?.role || 'buyer',
          currentState: stateToSend
        },
        {
          headers: { Authorization: `Bearer ${token}` }
        }
      );

      if (res.data.success) {
        const replyText = res.data.reply;
        const speechText = res.data.speechReply || replyText;
        const activeQuestionObj = res.data.activeQuestion;
        const nextState = res.data.state;
        const matchingProperties = res.data.properties || [];

        setMessages(prev => [...prev, { sender: 'ai', text: replyText, properties: matchingProperties }]);
        setConversationState({
          ...nextState,
          activeQuestion: activeQuestionObj
        });

        if (activeQuestionObj && activeQuestionObj.suggestions) {
          setSuggestions(activeQuestionObj.suggestions);
        } else {
          setSuggestions([]);
        }

        speakText(speechText);

        if (res.data.redirect) {
          setTimeout(() => {
            setIsOpen(false);
            navigate(res.data.redirect);
          }, 800);
        }
      } else {
        throw new Error('Chat failed');
      }
    } catch (err) {
      console.error("Chat engine request error:", err);
      const isCapturingLead = conversationState.leadCaptureStage === 'email' || conversationState.leadCaptureStage === 'phone';
      
      let errorMsg = 'Sorry, I encountered an connection issue. Please check your network and try again.';
      if (isCapturingLead) {
        errorMsg = '⚠️ We encountered an error saving your contact details. Click the retry button below to submit again.';
        setHasLeadError(true);
      }

      setMessages(prev => [...prev, { sender: 'ai', text: errorMsg }]);
    } finally {
      setLoading(false);
    }
  };

  const handleSend = (e) => {
    if (e) e.preventDefault();
    const text = input;
    setInput('');
    sendMessageText(text);
  };

  const renderMessageText = (text) => {
    if (!text) return '';
    const lines = text.split('\n');

    return lines.map((line, lineIdx) => {
      let elements = [];
      let lastIndex = 0;
      const tokenRegex = /(\*\*([^*]+)\*\*|\[([^\]]+)\]\(([^)]+)\))/g;
      let match;

      while ((match = tokenRegex.exec(line)) !== null) {
        const matchIndex = match.index;
        if (matchIndex > lastIndex) {
          elements.push(line.substring(lastIndex, matchIndex));
        }

        if (match[2]) {
          elements.push(<strong key={matchIndex} className="font-semibold">{match[2]}</strong>);
        } else if (match[3] && match[4]) {
          const linkText = match[3];
          const linkUrl = match[4];

          if (linkUrl.startsWith('/')) {
            elements.push(
              <span
                key={matchIndex}
                onClick={() => {
                  setIsOpen(false);
                  navigate(linkUrl);
                }}
                className="cursor-pointer text-emerald-400 hover:text-emerald-200 underline font-semibold transition-colors"
              >
                {linkText}
              </span>
            );
          } else {
            elements.push(
              <a
                key={matchIndex}
                href={linkUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-emerald-400 hover:text-emerald-200 underline font-semibold transition-colors"
              >
                {linkText}
              </a>
            );
          }
        }
        lastIndex = tokenRegex.lastIndex;
      }

      if (lastIndex < line.length) {
        elements.push(line.substring(lastIndex));
      }

      return (
        <div key={lineIdx} className={line.trim().startsWith('-') || line.trim().startsWith('*') ? 'pl-4 list-item list-disc' : 'min-h-[1.25rem]'}>
          {elements.length > 0 ? elements : line}
        </div>
      );
    });
  };

  if (isOpen && !selectedLanguage) {
    return (
      <div className="fixed bottom-6 right-24 z-50 font-sans flex h-[480px] w-[360px] flex-col rounded-2xl border border-emerald-100 bg-white shadow-2xl transition-all duration-300 animate-in slide-in-from-bottom-5">
        <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-emerald-600 to-teal-600 p-4 text-white shadow-md">
          <div className="flex items-center gap-2">
            <HiSparkles className="animate-pulse text-xl text-yellow-300" />
            <div>
              <span className="block font-semibold text-sm leading-none">EstateEase AI</span>
              <span className="text-[10px] text-emerald-100">AI Assistant Co-pilot</span>
            </div>
          </div>
          <button onClick={() => setIsOpen(false)} className="rounded-full p-1 hover:bg-white/20 transition-colors">
            <HiChevronDown size={20} />
          </button>
        </div>
        
        <div className="flex-1 bg-slate-50 p-6 flex flex-col justify-center items-center text-center space-y-6">
          <div>
            <h3 className="font-bold text-slate-800 text-sm">Select Your Preferred Language</h3>
            <p className="text-[10px] text-slate-500 mt-1">अपनी पसंदीदा बातचीत की भाषा चुनें</p>
          </div>
          
          <div className="w-full space-y-3">
            <button
              onClick={() => handleLanguageSelect('english')}
              className="w-full py-3 px-4 rounded-xl bg-white border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/30 text-slate-700 font-semibold text-xs transition-all shadow-sm flex items-center justify-between group"
            >
              <span>🇬🇧 English</span>
              <span className="text-[10px] text-slate-400 group-hover:text-emerald-600">Select →</span>
            </button>
            
            <button
              onClick={() => handleLanguageSelect('hindi')}
              className="w-full py-3 px-4 rounded-xl bg-white border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/30 text-slate-700 font-semibold text-xs transition-all shadow-sm flex items-center justify-between group"
            >
              <span>🇮🇳 Hindi (हिंदी)</span>
              <span className="text-[10px] text-slate-400 group-hover:text-emerald-600">चुनें →</span>
            </button>
            
            <button
              onClick={() => handleLanguageSelect('hinglish')}
              className="w-full py-3 px-4 rounded-xl bg-white border border-slate-200 hover:border-emerald-500 hover:bg-emerald-50/30 text-slate-700 font-semibold text-xs transition-all shadow-sm flex items-center justify-between group"
            >
              <span>🗣️ Hinglish (Hindi + English)</span>
              <span className="text-[10px] text-slate-400 group-hover:text-emerald-600">Select →</span>
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!isAiEnabled) {
    return null;
  }

  if (isCollapsedToEdge) {
    return (
      <div className="fixed right-0 bottom-28 md:bottom-32 z-50 font-sans transition-all duration-300 animate-in slide-in-from-right-5">
        <button
          onClick={() => {
            setIsCollapsedToEdge(false);
            localStorage.setItem("ai_chat_collapsed", "false");
          }}
          className="flex h-12 w-6 items-center justify-center rounded-l-xl bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-lg hover:w-8 hover:from-emerald-500 hover:to-teal-500 transition-all duration-300 group"
          title="Show AI Assistant"
        >
          <HiChevronLeft className="text-white text-base group-hover:scale-110 transition-transform" />
        </button>
      </div>
    );
  }

  return (
    <div className="fixed bottom-20 right-4 md:bottom-24 md:right-6 z-50 font-sans">
      {isOpen ? (
        <div className="flex h-[80vh] w-[90vw] max-w-[360px] md:h-[480px] md:w-[360px] flex-col rounded-2xl border border-emerald-100 bg-white shadow-2xl transition-all duration-300 animate-in slide-in-from-bottom-5">
          {/* Header */}
          <div className="flex items-center justify-between rounded-t-2xl bg-gradient-to-r from-emerald-600 to-teal-600 p-4 text-white shadow-md select-none shrink-0">
            <div className="flex items-center gap-2">
              <div className="relative">
                <HiSparkles className="animate-pulse text-xl text-yellow-300" />
                <span className="absolute top-0 right-0 h-2 w-2 rounded-full bg-green-400 ring-2 ring-white"></span>
              </div>
              <div>
                <span className="block font-semibold text-sm leading-none">EstateEase AI</span>
                <span className="text-[10px] text-emerald-100">Stateful Chat Co-pilot</span>
              </div>
            </div>

            {/* Controls */}
            <div className="flex items-center gap-1.5">
              <button
                onClick={handleResetChat}
                className="rounded p-1.5 hover:bg-white/20 transition-colors flex items-center justify-center"
                title="Start New Conversation"
              >
                <HiRefresh size={15} />
              </button>

              <button
                onClick={() => setSelectedLanguage(null)}
                className="rounded px-1.5 py-0.5 text-[9px] font-bold bg-white/20 hover:bg-white/30 transition-colors uppercase"
              >
                {selectedLanguage === 'english' ? 'EN' : selectedLanguage === 'hindi' ? 'HI' : 'HG'}
              </button>

              <button
                onClick={() => {
                  if (!isMuted) {
                    window.speechSynthesis.cancel();
                    setIsSpeaking(false);
                  }
                  setIsMuted(prev => !prev);
                }}
                className="rounded-full p-1 hover:bg-white/20 transition-colors"
              >
                {isMuted ? <HiVolumeOff size={15} /> : <HiVolumeUp size={15} />}
              </button>

              <button
                onClick={() => {
                  window.speechSynthesis.cancel();
                  setIsSpeaking(false);
                  setIsOpen(false);
                }}
                className="rounded-full p-1 hover:bg-white/20 transition-colors flex items-center justify-center"
                title="Minimize to Button"
              >
                <HiChevronDown size={18} />
              </button>

              <button
                onClick={() => {
                  window.speechSynthesis.cancel();
                  setIsSpeaking(false);
                  setIsOpen(false);
                  setIsCollapsedToEdge(true);
                  localStorage.setItem("ai_chat_collapsed", "true");
                }}
                className="rounded-full p-1 hover:bg-white/20 transition-colors flex items-center justify-center"
                title="Hide Assistant to Edge"
              >
                <HiX size={15} />
              </button>
            </div>
          </div>
 
          {/* Messages Viewport */}
          <div className="flex-1 overflow-y-auto bg-slate-50 p-4 space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'} space-y-1.5`}>
                <div className={`flex ${msg.sender === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div
                    className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs shadow-sm leading-relaxed ${
                      msg.sender === 'user'
                        ? 'bg-gradient-to-br from-emerald-600 to-teal-600 text-white rounded-br-none'
                        : 'bg-white text-slate-800 border border-slate-100 rounded-bl-none'
                    }`}
                  >
                    {renderMessageText(msg.text)}
                  </div>
                </div>

                {msg.properties && msg.properties.length > 0 && (
                  <div className="w-full pl-2 pr-2 py-1 flex gap-2.5 overflow-x-auto no-scrollbar scroll-smooth">
                    {msg.properties.map((prop, pIdx) => {
                      const imgUrl = prop.images && prop.images[0]
                        ? (prop.images[0].startsWith('http') ? prop.images[0] : `${API_URL}${prop.images[0]}`)
                        : 'https://images.unsplash.com/photo-1564013799919-ab600027ffc6?auto=format&fit=crop&w=400&q=80';
                      
                      return (
                        <div key={pIdx} className="min-w-[170px] max-w-[170px] bg-white rounded-xl border border-slate-150 shadow-sm flex flex-col overflow-hidden shrink-0">
                          <div className="h-20 w-full bg-slate-150 relative overflow-hidden">
                            <img src={imgUrl} alt={prop.title} className="h-full w-full object-cover" />
                            <div className="absolute top-1.5 right-1.5 bg-emerald-600 text-white text-[8px] font-bold px-1 py-0.5 rounded uppercase leading-none">
                              {prop.status === 'rent' ? 'Rent' : 'Sale'}
                            </div>
                          </div>
                          <div className="p-2 flex-1 flex flex-col justify-between space-y-1 bg-white">
                            <div>
                              <span className="block font-semibold text-[10px] text-slate-800 truncate" title={prop.title}>
                                {prop.title}
                              </span>
                              <span className="block text-[8px] text-slate-400 truncate">
                                📍 {prop.area}, {prop.city}
                              </span>
                            </div>
                            <div className="flex items-center justify-between border-t border-slate-50 pt-1.5 mt-1">
                              <span className="text-[10px] font-bold text-emerald-600">
                                ₹{prop.price >= 10000000 
                                  ? `${(prop.price / 10000000).toFixed(2)} Cr` 
                                  : (prop.price >= 100000 
                                    ? `${(prop.price / 100000).toFixed(1)} Lakh` 
                                    : prop.price.toLocaleString())}
                              </span>
                              <button
                                type="button"
                                onClick={() => {
                                  setIsOpen(false);
                                  navigate(`/property/${prop._id}`);
                                }}
                                className="px-2 py-1 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-[8px] font-bold rounded transition-colors"
                              >
                                View
                              </button>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="max-w-[85%] rounded-2xl bg-white border border-slate-100 px-4 py-3 text-xs text-slate-400 rounded-bl-none shadow-sm flex items-center gap-1.5">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400"></span>
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0.2s]"></span>
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:0.4s]"></span>
                </div>
              </div>
            )}
            <div ref={chatEndRef} />
          </div>

          {/* Integrated Composer Area */}
          <div className="border-t border-slate-100 bg-white p-3 rounded-b-2xl flex flex-col gap-2 shrink-0">
            {hasLeadError && (
              <button
                type="button"
                onClick={handleRetrySubmission}
                className="w-full py-2 bg-rose-600 hover:bg-rose-500 text-white font-bold text-xs rounded-xl shadow-md transition-all active:scale-95 flex items-center justify-center gap-1"
              >
                <HiRefresh className="animate-spin text-sm" />
                <span>Save Lead Details Failed. Tap to Retry</span>
              </button>
            )}

            {/* suggestions Chips - positioned directly above input */}
            {suggestions.length > 0 && (
              <div className="flex flex-wrap gap-1.5 py-1 max-h-24 overflow-y-auto no-scrollbar">
                {suggestions.map((sug, idx) => (
                  <button
                    key={idx}
                    type="button"
                    onClick={() => handleSuggestionClick(sug)}
                    className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-[10px] text-slate-600 hover:border-emerald-500 hover:bg-emerald-50 hover:text-emerald-700 transition-all font-medium leading-none"
                  >
                    {typeof sug === 'object' && sug !== null ? (sug.label || sug.value) : sug}
                  </button>
                ))}
              </div>
            )}

            <form onSubmit={handleSend} className="flex items-center gap-2">
              <button
                type="button"
                onClick={startListening}
                className={`flex h-8 w-8 items-center justify-center rounded-full transition-all ${
                  isListening
                    ? 'bg-red-500 text-white animate-pulse'
                    : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                }`}
                title="Speak to Assistant"
              >
                <HiMicrophone className="text-sm" />
              </button>

              <input
                type="text"
                value={input}
                onChange={e => setInput(e.target.value)}
                placeholder="Type or speak..."
                className="flex-1 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-xs focus:border-emerald-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-emerald-500 transition-all"
              />
              
              <button
                type="submit"
                disabled={!input.trim() || loading}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-emerald-600 text-white hover:bg-emerald-500 disabled:bg-slate-200 disabled:text-slate-400 transition-colors"
              >
                <HiPaperAirplane className="rotate-90 text-sm" />
              </button>
            </form>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={handleButtonClick}
          className="flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-xl hover:scale-105 hover:shadow-emerald-200/50 transition-all duration-300 group select-none relative"
        >
          <HiSparkles size={24} className="group-hover:rotate-12 transition-transform" />
          <span className="absolute -top-1 -right-1 flex h-4 w-4">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75"></span>
            <span className="relative inline-flex h-4 w-4 rounded-full bg-emerald-500 text-[9px] font-bold text-white items-center justify-center">AI</span>
          </span>
        </button>
      )}
    </div>
  );
};

export default AIChatWidget;
