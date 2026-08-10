# EstateEase AI Co-pilot & NLU System

![EstateEase AI Banner](https://img.shields.io/badge/EstateEase-AI%20Copilot-059669?style=for-the-badge&logo=google)
![Gemini 2.5 NLU](https://img.shields.io/badge/NLU-Gemini%202.5%20Flash-0284c7?style=for-the-badge)
![React & Node.js](https://img.shields.io/badge/Stack-React%20%7C%20Node.js%20%7C%20MongoDB-047857?style=for-the-badge)

A multi-turn stateful AI chat assistant, Gemini 2.5 NLU entity extraction engine, dynamic qualification flow builder, voice assistant (STT/TTS), and navigation command dictionary built for the **EstateEase Real Estate Platform**.

---

## 🌟 Core Features

1. **Stateful Chat Engine & Lead Qualification**:
   - Manages stateful conversation sessions across API turns.
   - Evaluates multi-step qualification workflows (`initial` &rarr; `property_qualification` &rarr; `contact_collection` &rarr; `completed`).
   - Dynamically matches active MongoDB real estate listings based on extracted criteria (City, Locality, BHK, Price Range).
   - Automatically saves captured leads to the database once qualified.

2. **Gemini 2.5 NLU Structured Extraction**:
   - Uses strict JSON Schema extraction (`@google/genai`) to convert natural language user input into structured variables.
   - Intelligent fallback intent matchers for custom welcome options and custom flow keys.

3. **3-Step Dynamic Flow Builder & Admin Panel**:
   - **Step 1**: Pre-built & custom welcome option chip builder with unique intent bindings (e.g., `cust_guest_2299`).
   - **Step 2**: Qualification sequence editor featuring &blackcaftri;/&blackvtri; step reordering, removal, and custom field creation.
   - **Step 3**: Localized question text customizer (English, Hindi, Hinglish) and response suggestion chip manager.

4. **Voice Assistant & Autonomous Navigation**:
   - Web Speech API integration for speech-to-text (`STT`) voice input and text-to-speech (`TTS`) audio playback.
   - Command dictionary engine mapping natural trigger phrases to React Router paths.

---

## 📂 Repository File Index

```
EstateEase-AI-Copilot/
├── backend/
│   ├── controllers/
│   │   ├── ai.controller.js         # Core stateful chat controller & progression engine
│   │   └── aiSetting.controller.js  # AI settings & prompt management API
│   ├── models/
│   │   ├── aiCommand.model.js       # Navigation trigger commands schema
│   │   ├── aiSetting.model.js       # Global prompts & flow config schema
│   │   └── lead.model.js            # Captured lead CRM schema
│   ├── routes/
│   │   ├── ai.routes.js             # /api/ai/chat public & protected endpoints
│   │   └── aiSetting.routes.js      # /api/ai-settings admin endpoints
│   └── utils/
│       └── gemini.js                # @google/genai SDK wrapper (generateJSON & generateText)
├── frontend/
│   ├── src/
│   │   ├── components/common/
│   │   │   └── AIChatWidget.jsx     # Floating chat widget UI, voice STT/TTS, & router navigation
│   │   └── pages/admin/
│   │       └── AIManagement.jsx     # Admin 3-Step Flow Builder & Prompt Trainer (Fully Responsive)
└── docs/
    ├── estate_ease_ai_documentation.pdf            # Full AI Architecture PDF Report
    └── estate_ease_full_platform_documentation.pdf  # Full EstateEase Platform Architecture PDF
```

---

## 📄 Documentation PDFs
Detailed technical documentation PDFs are included in the `docs/` directory:
- [AI Architecture & Specification PDF](./docs/estate_ease_ai_documentation.pdf)
- [Full Website Platform PDF](./docs/estate_ease_full_platform_documentation.pdf)

---

## 🚀 Quick Setup & Integration

### 1. Backend Environment Variables
Set the following in your `backend/.env` file:
```env
GEMINI_API_KEY=your_gemini_api_key_here
MONGODB_URI=your_mongodb_connection_string
```

### 2. API Endpoints
- **Chat Endpoint**: `POST /api/ai/chat`
- **Settings Endpoint**: `GET /api/ai-settings`
- **Commands Endpoint**: `GET /api/ai-settings/commands`

---

&copy; 2026 EstateEase AI Engineering Team.
