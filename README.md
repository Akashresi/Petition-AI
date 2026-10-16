# PetitionAI - AI-Powered Grievance & Petition Management System

## Aim / Objective

The aim of this project is to develop an AI-powered grievance and petition management system that intelligently analyzes petitions using Artificial Intelligence (AI) and Natural Language Processing (NLP), automatically categorizes them into the appropriate government departments, identifies urgent and repetitive grievances, sends automated reminders to responsible officials, tracks the progress of each petition until resolution, and provides real-time status updates to petitioners. The system is designed to improve the efficiency, transparency, accountability, and responsiveness of grievance redressal processes while reducing manual effort and ensuring timely resolution of public complaints.

## Methodology

### 1. Petition Submission
Citizens submit complaints through a user-friendly web interface with support for text descriptions, images, and document uploads (JPG, PNG, PDF up to 5MB). The system captures location, category, and district information for proper routing.

### 2. AI-Based Text Analysis
- **NLP Classification**: Analyzes complaint title and description using keyword-based classification
- **Sentiment Analysis**: Detects emotional tone (positive, neutral, negative, angry) to gauge urgency
- **Keyword Extraction**: Identifies key terms for categorization and search

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
- **Critical**: Emergency keywords (accident, flood, fire, collapse, sewage overflow)
- **High**: Urgent issues (broken, leaking, no water/electricity, pothole, blocked drain)
- **Medium**: Standard complaints
- **Low**: Brief/minor complaints

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
- AI analysis summary with confidence scores

## Technology Stack

### Frontend
- **React.js 18** - Modern UI framework
- **TypeScript** - Type-safe development
- **Vite** - Fast build tool
- **Tailwind CSS** - Utility-first styling
- **shadcn/ui** - Accessible component library
- **Radix UI** - Headless UI primitives
- **React Router** - Client-side routing
- **React Hook Form + Zod** - Form validation
- **TanStack Query** - Server state management
- **Redux Toolkit** - Global state management
- **Lucide React** - Icon library
- **Recharts** - Data visualization
- **Framer Motion** - Animations
- **Leaflet/React-Leaflet** - Map integration

### Backend (FastAPI)
- **FastAPI** - High-performance Python REST API framework
- **MongoDB** - Document database (with automatic in-memory fallback)
- **REST APIs** - JWT-protected endpoints for auth, complaints, notifications, analytics
- **Email (SMTP)** - Status notifications to petitioners
- **SMS** - Pluggable SMS provider (console / Twilio)
- **JWT** - Token-based authentication
- **bcrypt** - Salted password hashing (legacy hashes upgraded on login)

### AI/ML Integration
- **TF-IDF + Cosine Similarity (scikit-learn style)** - Real NLP text classification for category/department routing
- **Sentiment Analysis** - Detects emotional tone (positive/neutral/negative/angry)
- **Priority Prediction** - Critical/High/Medium/Low urgency detection
- **Duplicate Detection** - TF-IDF similarity matching against existing complaints
- **Google Generative AI (Gemini 1.5 Flash)** - Image analysis for uploaded photos/documents

### Development Tools
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
- ✅ Duplicate detection
- ✅ Image analysis using Gemini AI
- ✅ Officer dashboard with assignment management
- ✅ Admin analytics and user management
- ✅ Real-time notifications
- ✅ Petition tracking with status history
- ✅ Role-based access (Citizen, Officer, Admin)
- ✅ Responsive UI with dark mode support
- ✅ Map integration for location visualization

## Demo Users

| Role | Email | Password |
|------|-------|----------|
| Citizen | citizen@demo.com | citizen123 |
| Citizen | bala@demo.com | citizen123 |
| Citizen | arun@demo.com | citizen123 |
| Citizen | aathi@demo.com | citizen123 |
| Officer | officer@demo.com | officer123 |
| Admin | admin@demo.com | admin123 |

## Getting Started (Full Stack)

The project has a **React frontend** and a **FastAPI backend**. Run both for the complete experience.

```bash
# 1. Install frontend dependencies
npm install

# 2. Install backend (Python 3.14+) and its dependencies
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
```

## Environment Variables

Frontend `.env` (for AI image analysis):

```env
VITE_GEMINI_API_KEY=your_gemini_api_key_here
VITE_API_URL=/api   # defaults to /api (proxied to backend)
```

Backend `backend/.env` — see `backend/.env.example` for MongoDB URI, SMTP email,
SMS provider (console/twilio), JWT secret, and Gemini key.

## Project Structure

```
backend/                # FastAPI backend
├── app/
│   ├── main.py        # FastAPI entry point
│   ├── config.py      # Environment configuration
│   ├── database.py    # MongoDB layer (with in-memory fallback)
│   ├── models.py      # Pydantic models
│   ├── security.py    # Password hashing (bcrypt + legacy fallback)
│   ├── seed.py        # Seed users, complaints, notifications
│   ├── ai/
│   │   ├── ml_pipeline.py   # NLP/ML: TF-IDF classification, sentiment, priority
│   │   └── duplicates.py    # Duplicate grievance detection
│   ├── services/
│   │   ├── email_service.py # SMTP notifications
│   │   └── sms_service.py   # SMS notifications (console/twilio)
│   └── routers/       # REST API routers
│       ├── auth.py        # Login/register (JWT)
│       ├── complaints.py  # Complaint CRUD + AI analysis
│       ├── notifications.py
│       └── analytics.py
├── requirements.txt   # Python dependencies
└── .env.example       # Environment template

src/                    # React frontend
├── components/          # Reusable UI components
│   ├── ui/             # shadcn/ui components
│   └── features/       # Feature-specific components
├── pages/              # Page components
│   ├── citizen/        # Citizen portal pages
│   ├── officer/        # Officer dashboard pages
│   └── admin/          # Admin panel pages
├── hooks/              # Custom React hooks (API + local fallback)
├── lib/                # Utility libraries
│   ├── api.ts          # REST API client (talks to FastAPI backend)
│   ├── ai/             # Frontend AI modules
│   │   ├── classification.ts
│   │   ├── sentimentAnalysis.ts
│   │   ├── priorityPrediction.ts
│   │   ├── duplicateDetection.ts
│   │   └── imageAnalysis.ts  # Gemini image analysis
│   ├── auth.ts         # Authentication utilities
│   └── utils.ts        # General utilities
├── constants/          # Mock data and constants
├── types/              # TypeScript type definitions
└── main.tsx            # Application entry point
```