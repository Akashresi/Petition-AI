# PetitionAI - AI-Powered Grievance & Petition Management System

## Aim / Objective

The aim of this project is to develop an AI-powered grievance and petition management system that intelligently analyzes petitions using Artificial Intelligence (AI) and Natural Language Processing (NLP), automatically categorizes them into the appropriate government departments, identifies urgent and repetitive grievances, sends automated reminders to responsible officials, tracks the progress of each petition until resolution, and provides real-time status updates to petitioners. The system is designed to improve the efficiency, transparency, accountability, and responsiveness of grievance redressal processes while reducing manual effort and ensuring timely resolution of public complaints.

## Methodology

### 1. Petition Submission
Citizens submit complaints through a user-friendly web interface with support for text descriptions, images, and document uploads (JPG, PNG, PDF up to 5MB). The system captures location, category, and district information for proper routing.

### 2. AI-Based Text Analysis
- **NLP Classification**: Analyzes complaint title and description using hybrid NLP classification
- **Sentiment Analysis**: Detects emotional tone (positive, neutral, negative, angry) to gauge urgency
- **Keyword Extraction**: Identifies key terms for categorization and search
- **Confidence & Explanation**: Every AI prediction returns a confidence score and plain-language explanation

### 3. Automatic Department Classification
Maps complaint categories to appropriate government departments:
- Road & Infrastructure → Roads & Infrastructure (PWD)
- Water Supply → Water Works
- Electricity → Electricity Board
- Waste Management/Sanitation → Waste Management
- Public Safety/Noise Pollution → Public Safety
- Healthcare → Health Department
- Education → Education Department
- Public Transport → Transport Authority

### 4. Priority Detection
Automatically assigns priority levels based on content analysis:
- **Critical**: Emergency indicators (accident, flood, fire, collapse, sewage overflow)
- **High**: Urgent issues (broken, leaking, no water/electricity, pothole, blocked drain)
- **Medium**: Standard complaints
- **Low**: Minor or informational complaints

### 5. Duplicate Grievance Detection
Identifies similar existing complaints using semantic similarity matching to prevent duplicate work and enable complaint consolidation.

### 6. Workflow Management
Complete petition lifecycle management:
- Submitted → Under Review → Assigned → In Progress → Resolved → Closed
- Officer assignment with department-wise routing
- Officer remarks and resolution tracking
- Reopen/escalation handling

### 7. Progress Tracking
- Real-time status updates for citizens
- Petition ID based tracking
- Status history with timestamps and notes
- AI analysis summary with confidence scores and explainability

## Technology Stack

### Frontend
- **React.js 18** - Modern UI framework
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool
- **Tailwind CSS** - Utility-first styling
- **React Router** - Client-side routing
- **Tailwind Merge + clsx** - Class composition utilities
- **Lucide React** - Icon library
- **Recharts** - Data visualization
- **Framer Motion** - Animations
- **Leaflet** - Map integration
- **Sonner** - Toast notifications
- **i18next / react-i18next** - Internationalization (English / Hindi / Tamil)
- **jsPDF + html2canvas + xlsx** - PDF / Excel export
- **qrcode** - Petition QR codes

### Backend (FastAPI)
- **FastAPI** - High-performance Python REST API framework (Python 3.10+)
- **MongoDB** - Document database (with automatic in-memory fallback)
- **REST APIs** - JWT-protected endpoints for auth, complaints, notifications, analytics, AI analysis
- **Email (SMTP)** - Status notifications to petitioners
- **SMS** - Pluggable SMS provider (console / Twilio)
- **JWT** - Token-based authentication
- **bcrypt** - Salted password hashing (legacy hashes upgraded on login)

### AI/ML Integration (app/ai)
- **Single Source of Truth**: Unified machine learning & NLP pipeline in `backend/app/ai/`
- **Hybrid Classifier**: TF-IDF and LLM classification with confidence scoring and audit signals
- **Sentiment Analysis**: Citizen tone scoring (positive/neutral/negative/angry)
- **Priority Prediction**: Context-aware severity & emergency routing
- **Multilingual Duplicate Detection**: Semantic embedding & TF-IDF similarity with geo and temporal constraints
- **Backend Multimodal Vision (Gemini 1.5 Flash)**: Secure backend image & document inspection

### Development & Testing Tools
- **pytest** - Backend testing suite
- **ESLint** - Code linting
- **PostCSS + Autoprefixer** - CSS processing
- **TypeScript ESLint** - TypeScript-specific linting

## Applications

1. **Government Grievance Redressal Systems** - Central/state government complaint portals
2. **Municipal Corporation Complaint Management** - City-level civic issues (roads, water, waste, lights)
3. **Smart City Administration** - Integrated urban management platforms
4. **District Collector & Public Service Offices** - District-level grievance handling
5. **E-Governance Portals** - Digital government service delivery
6. **University & College Grievance Portals** - Student/faculty complaint systems
7. **Healthcare Complaint Management Systems** - Hospital/patient grievance tracking
8. **Corporate Employee Grievance Systems** - Internal HR complaint management
9. **Customer Service & Complaint Management Platforms** - Business customer support

## Key Features Implemented

- ✅ Citizen portal for petition submission with file upload
- ✅ AI-powered text analysis (classification, sentiment, priority)
- ✅ Automatic department routing
- ✅ Duplicate detection with similarity clustering
- ✅ Image analysis using secure backend Gemini vision endpoint
- ✅ Officer dashboard with assignment management
- ✅ Admin analytics and user management
- ✅ Real-time notifications
- ✅ Petition tracking with status history
- ✅ Role-based access (Citizen, Officer, Admin)
- ✅ Responsive UI with dark mode support
- ✅ Map integration for location visualization

## Demo Roles & Local Access

In development mode (`ENV=development`), the backend automatically seeds initial test accounts:

| Role | Email | Scope |
|------|-------|-------|
| Citizen | citizen@demo.com | Citizen grievance portal, file petitions, track status |
| Officer | officer@demo.com | Department officer inbox, review, status updates |
| Admin | admin@demo.com | Administrative panel, audit log, system analytics |

> **Security Note**: Demo accounts and seeded data are strictly isolated to local development environments (`ENV=development`). In staging and production environments, seed generation is disabled and authentication relies on standard registration and administrative onboarding.

## Getting Started (Full Stack)

The project has a **React frontend** and a **FastAPI backend**. Run both for the complete experience.

### Prerequisites
- **Node.js**: v18 or higher
- **Python**: 3.10, 3.11, 3.12, or 3.13

```bash
# 1. Install frontend dependencies
npm install

# 2. Install backend dependencies (Python 3.10+)
npm run backend:install

# 3. Configure backend environment
#    Copy backend/.env.example to backend/.env and edit as needed

# 4. Start the FastAPI backend (port 8000)
npm run backend

# 5. In a new terminal, start the React dev server (port 8080)
npm run dev
```

Open http://localhost:8080 — the Vite dev server proxies `/api` requests to the backend.

> **No MongoDB? No problem.** Set `USE_MONGODB=false` in `backend/.env` and the backend uses a
> built-in in-memory store. The frontend also falls back to local mock data if the backend is offline.

```bash
# Build for production
npm run build

# Preview production build
npm run preview

# Run linting
npm run lint

# Run backend tests
cd backend && pytest tests/
```

## Environment Variables

Frontend `.env`:

```env
VITE_API_URL=/api   # defaults to /api (proxied to backend)
```

Backend `backend/.env` — see `backend/.env.example` for MongoDB URI, SMTP email,
SMS provider (console/twilio), JWT secret, and Gemini API key.

## Project Structure

```
backend/                # FastAPI backend
├── app/
│   ├── main.py        # FastAPI entry point
│   ├── config.py      # Environment configuration (ENV, DEBUG, secrets)
│   ├── database.py    # MongoDB layer (with in-memory fallback)
│   ├── models.py      # Pydantic models
│   ├── security.py    # Password hashing (bcrypt + legacy fallback)
│   ├── seed.py        # Seed users, complaints, notifications
│   ├── ai/            # Single Source of Truth for ML / NLP
│   │   ├── analyzer.py      # Pipeline orchestrator
│   │   ├── classifier.py    # Hybrid classification (TF-IDF + LLM)
│   │   ├── config.py        # AI model configuration & thresholds
│   │   ├── dedup.py         # Semantic duplicate detection
│   │   ├── duplicates.py    # Duplicate matching adapter
│   │   ├── evaluator.py     # Evaluation & metrics reporting
│   │   ├── ingestion.py     # Document/image text extraction
│   │   ├── language.py      # Language detection & normalization
│   │   ├── ml_pipeline.py   # TF-IDF pipeline & analysis generator
│   │   ├── priority.py      # Urgency & emergency prediction
│   │   └── spam.py          # Spam & quality filtering
│   ├── services/
│   │   ├── email_service.py # SMTP notifications
│   │   └── sms_service.py   # SMS notifications (console/twilio)
│   └── routers/       # REST API routers
│       ├── ai.py          # AI analysis endpoints (/api/ai/*)
│       ├── auth.py        # Login/register (JWT)
│       ├── complaints.py  # Complaint CRUD + AI analysis
│       ├── notifications.py
│       └── analytics.py
├── tests/             # Backend test suites (pytest)
│   ├── test_ai_router.py
│   └── test_ai_engine.py
├── requirements.txt   # Python dependencies
└── .env.example       # Environment template

src/                    # React frontend
├── components/          # Reusable UI components
│   ├── features/       # Feature components (AI cards, map, QR, SLA, timeline...)
│   └── layout/         # Navbar and page shell
├── pages/              # Page components
│   ├── citizen/        # Citizen portal pages
│   ├── officer/        # Officer dashboard pages
│   └── admin/          # Admin panel pages
├── hooks/              # Custom React hooks (API + local fallback)
├── lib/                # Utility libraries
│   ├── api.ts          # REST API client (talks to FastAPI backend)
│   ├── ai/             # Frontend AI API clients (thin callers with mock fallbacks)
│   │   ├── classification.ts
│   │   ├── sentimentAnalysis.ts
│   │   ├── priorityPrediction.ts
│   │   ├── duplicateDetection.ts
│   │   └── imageAnalysis.ts
│   ├── auth.ts         # Authentication utilities
│   ├── pdfExport.ts    # PDF generation
│   ├── excelExport.ts  # Excel export
│   ├── i18n.ts         # English / Hindi / Tamil translations
│   ├── sla.ts          # SLA calculations
│   └── utils.ts        # General utilities
├── constants/          # Mock data and constants
├── types/              # TypeScript type definitions
└── main.tsx            # Application entry point

public/                 # Static assets (favicons, robots.txt)
docs/                   # System diagrams & evaluation reports
```

## Credits & Acknowledgements

Developed as an intelligent civic grievance redressal and petition management initiative.
- **Engineering & System Design**: PetitionAI Project Team
- **Frontend Architecture**: React 18, Vite, Tailwind CSS, Lucide Icons, Recharts, Leaflet
- **Backend Architecture**: FastAPI, MongoDB / In-Memory Document Store, PyJWT, bcrypt
- **NLP & Multilingual AI**: scikit-learn, Sentence-Transformers, Google Gemini Multimodal API

## License

This project is licensed under the [MIT License](LICENSE).
