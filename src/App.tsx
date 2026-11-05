import { BrowserRouter, Routes, Route, Navigate, useLocation } from "react-router-dom";
import { Toaster } from "sonner";
import { AnimatePresence, motion } from "framer-motion";
import { AuthProvider } from "@/hooks/useAuthProvider";
import { AccessibilityProvider } from "@/contexts/AccessibilityContext";
import { useAuth } from "@/lib/auth";
import "@/lib/i18n";

import Navbar from "@/components/layout/Navbar";
import AIChatbot from "@/components/features/AIChatbot";

import LandingPage from "@/pages/LandingPage";
import LoginPage from "@/pages/LoginPage";
import RegisterPage from "@/pages/RegisterPage";
import TransparencyPortal from "@/pages/public/TransparencyPortal";
import NotFound from "@/pages/NotFound";

// Citizen
import CitizenDashboard from "@/pages/citizen/CitizenDashboard";
import SubmitPetition from "@/pages/citizen/SubmitPetition";
import MyPetitions from "@/pages/citizen/MyPetitions";
import PetitionDetail from "@/pages/citizen/PetitionDetail";
import TrackComplaint from "@/pages/citizen/TrackComplaint";
import CitizenProfile from "@/pages/citizen/CitizenProfile";

// Officer
import OfficerDashboard from "@/pages/officer/OfficerDashboard";
import OfficerPetitionDetail from "@/pages/officer/OfficerPetitionDetail";

// Admin
import AdminDashboard from "@/pages/admin/AdminDashboard";
import AdminComplaints from "@/pages/admin/AdminComplaints";
import AdminUsers from "@/pages/admin/AdminUsers";
import AdminAnalytics from "@/pages/admin/AdminAnalytics";
import AdminComplaintDetail from "@/pages/admin/AdminComplaintDetail";
import AdminReviewQueue from "@/pages/admin/AdminReviewQueue";

const pageVariants = {
  initial: { opacity: 0 },
  enter: { opacity: 1, transition: { duration: 0.15 } },
  exit: { opacity: 0, transition: { duration: 0.1 } },
};

function AnimatedPage({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial="initial"
      animate="enter"
      exit="exit"
      variants={pageVariants}
    >
      {children}
    </motion.div>
  );
}

function ProtectedRoute({ children, roles }: { children: React.ReactNode; roles: string[] }) {
  const { user, isLoading } = useAuth();
  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <div className="relative">
            <div className="w-12 h-12 border-4 border-navy-200 border-t-navy-700 rounded-full animate-spin dark:border-navy-800 dark:border-t-navy-300" />
            <div className="absolute inset-0 w-12 h-12 border-4 border-transparent border-b-gold-400 rounded-full animate-spin" style={{ animationDirection: "reverse", animationDuration: "1.5s" }} />
          </div>
          <p className="text-sm text-muted-foreground font-medium">Loading...</p>
        </div>
      </div>
    );
  }
  if (!user) return <Navigate to="/login" replace />;
  if (!roles.includes(user.role)) return <Navigate to={`/${user.role}/dashboard`} replace />;
  return <>{children}</>;
}

function AppRoutes() {
  const { user } = useAuth();
  const location = useLocation();

  return (
    <div className="min-h-screen bg-background text-foreground transition-colors duration-200">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:left-3 focus:z-50 focus:px-4 focus:py-2 focus:bg-amber-400 focus:text-slate-900 focus:font-bold focus:rounded-lg focus:shadow-xl focus:outline-none"
      >
        Skip to main content
      </a>
      <Navbar />
      <main id="main-content" tabIndex={-1} className="focus:outline-none">
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={
              user ? <Navigate to={`/${user.role}/dashboard`} replace /> : <AnimatedPage><LandingPage /></AnimatedPage>
            } />
            <Route path="/transparency" element={<AnimatedPage><TransparencyPortal /></AnimatedPage>} />
            <Route path="/login" element={<AnimatedPage><LoginPage /></AnimatedPage>} />
            <Route path="/register" element={<AnimatedPage><RegisterPage /></AnimatedPage>} />

            {/* Citizen Routes */}
            <Route path="/citizen" element={<Navigate to="/citizen/dashboard" replace />} />
            <Route path="/citizen/dashboard" element={<ProtectedRoute roles={["citizen"]}><AnimatedPage><CitizenDashboard /></AnimatedPage></ProtectedRoute>} />
            <Route path="/citizen/submit" element={<ProtectedRoute roles={["citizen"]}><AnimatedPage><SubmitPetition /></AnimatedPage></ProtectedRoute>} />
            <Route path="/citizen/track" element={<ProtectedRoute roles={["citizen"]}><AnimatedPage><TrackComplaint /></AnimatedPage></ProtectedRoute>} />
            <Route path="/citizen/petitions" element={<ProtectedRoute roles={["citizen"]}><AnimatedPage><MyPetitions /></AnimatedPage></ProtectedRoute>} />
            <Route path="/citizen/petition/:id" element={<ProtectedRoute roles={["citizen"]}><AnimatedPage><PetitionDetail /></AnimatedPage></ProtectedRoute>} />
            <Route path="/citizen/petitions/:id" element={<ProtectedRoute roles={["citizen"]}><AnimatedPage><PetitionDetail /></AnimatedPage></ProtectedRoute>} />
            <Route path="/citizen/profile" element={<ProtectedRoute roles={["citizen"]}><AnimatedPage><CitizenProfile /></AnimatedPage></ProtectedRoute>} />

            {/* Officer Routes */}
            <Route path="/officer/dashboard" element={<ProtectedRoute roles={["officer"]}><AnimatedPage><OfficerDashboard /></AnimatedPage></ProtectedRoute>} />
            <Route path="/officer/petition/:id" element={<ProtectedRoute roles={["officer"]}><AnimatedPage><OfficerPetitionDetail /></AnimatedPage></ProtectedRoute>} />
            <Route path="/officer/profile" element={<ProtectedRoute roles={["officer"]}><AnimatedPage><CitizenProfile /></AnimatedPage></ProtectedRoute>} />

            {/* Admin Routes */}
            <Route path="/admin/dashboard" element={<ProtectedRoute roles={["admin"]}><AnimatedPage><AdminDashboard /></AnimatedPage></ProtectedRoute>} />
            <Route path="/admin/complaints" element={<ProtectedRoute roles={["admin"]}><AnimatedPage><AdminComplaints /></AnimatedPage></ProtectedRoute>} />
            <Route path="/admin/reviews" element={<ProtectedRoute roles={["admin"]}><AnimatedPage><AdminReviewQueue /></AnimatedPage></ProtectedRoute>} />
            <Route path="/admin/complaint/:id" element={<ProtectedRoute roles={["admin"]}><AnimatedPage><AdminComplaintDetail /></AnimatedPage></ProtectedRoute>} />
            <Route path="/admin/users" element={<ProtectedRoute roles={["admin"]}><AnimatedPage><AdminUsers /></AnimatedPage></ProtectedRoute>} />
            <Route path="/admin/analytics" element={<ProtectedRoute roles={["admin"]}><AnimatedPage><AdminAnalytics /></AnimatedPage></ProtectedRoute>} />
            <Route path="/admin/profile" element={<ProtectedRoute roles={["admin"]}><AnimatedPage><CitizenProfile /></AnimatedPage></ProtectedRoute>} />

            <Route path="*" element={<AnimatedPage><NotFound /></AnimatedPage>} />
          </Routes>
        </AnimatePresence>
      </main>
      <AIChatbot />
      <Toaster position="top-right" richColors />
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AccessibilityProvider>
        <BrowserRouter>
          <AppRoutes />
        </BrowserRouter>
      </AccessibilityProvider>
    </AuthProvider>
  );
}
