import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { motion, AnimatePresence } from "framer-motion";
import { Bell, LogOut, User, Menu, X, ChevronDown } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useNotifications } from "@/hooks/useNotifications";
import NotificationPanel from "@/components/features/NotificationPanel";
import DarkModeToggle from "@/components/features/DarkModeToggle";
import LanguageToggle from "@/components/features/LanguageToggle";

export default function Navbar() {
  const { t } = useTranslation();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const { unreadCount } = useNotifications(user?.id);
  const [showNotif, setShowNotif] = useState(false);
  const [showMenu, setShowMenu] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  function handleLogout() {
    logout();
    navigate("/");
  }

  const roleLinks = {
    citizen: [
      { to: "/citizen/dashboard", label: t("nav.dashboard") },
      { to: "/citizen/submit", label: t("nav.submitPetition") },
      { to: "/citizen/petitions", label: t("nav.myPetitions") },
    ],
    officer: [
      { to: "/officer/dashboard", label: t("nav.dashboard") },
    ],
    admin: [
      { to: "/admin/dashboard", label: t("nav.dashboard") },
      { to: "/admin/complaints", label: t("nav.complaints") },
      { to: "/admin/reviews", label: "Review Queue" },
      { to: "/admin/users", label: t("nav.users") },
      { to: "/admin/analytics", label: t("nav.analytics") },
    ],
  };

  const links = user ? (roleLinks[user.role] || []) : [];

  return (
    <nav className="bg-navy-900/95 dark:bg-navy-950/95 backdrop-blur-md border-b border-navy-800/60 dark:border-navy-900 sticky top-0 z-40 transition-colors duration-200">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link to={user ? `/${user.role}/dashboard` : "/"} className="flex items-center gap-3 group">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-gold-400 to-gold-500 flex items-center justify-center shadow-md shadow-gold-400/20 group-hover:shadow-gold-400/40 transition-all duration-200">
              <img src="/favicon.png" alt="PetitionAI Logo" className="w-5 h-5 rounded object-cover" />
            </div>
            <div className="flex flex-col justify-center select-none">
              <span className="text-white font-display font-bold text-base tracking-tight leading-none">PetitionAI</span>
              <span className="text-gold-400/90 text-[10px] font-semibold tracking-wider uppercase leading-none mt-1">Citizen Grievance Portal</span>
            </div>
          </Link>

          {/* Desktop Nav */}
          {user && (
            <div className="hidden md:flex items-center gap-1">
              {links.map(l => (
                <Link key={l.to} to={l.to} className="nav-link px-4 py-2 rounded-full hover:bg-white/10">
                  {l.label}
                </Link>
              ))}
              <Link to="/transparency" className="nav-link px-3.5 py-2 rounded-full hover:bg-white/10 text-gold-300">
                Transparency
              </Link>
            </div>
          )}

          {/* Right Actions */}
          {user ? (
            <div className="flex items-center gap-2">
              <LanguageToggle />
              <DarkModeToggle />

              {/* Notification Bell */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setShowNotif(!showNotif); setShowMenu(false); }}
                  className="relative p-2 text-white/80 hover:text-white hover:bg-white/10 rounded-full transition-colors"
                  aria-label="Notifications"
                >
                  <Bell className="w-5 h-5" />
                  {unreadCount > 0 && (
                    <span
                      className="absolute top-0.5 right-0.5 w-4.5 h-4.5 bg-red-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center min-w-[18px] h-[18px] shadow-sm"
                    >
                      {unreadCount > 9 ? "9+" : unreadCount}
                    </span>
                  )}
                </button>
                <AnimatePresence>
                  {showNotif && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-12 z-50"
                    >
                      <NotificationPanel userId={user.id} onClose={() => setShowNotif(false)} />
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* User Menu */}
              <div className="relative">
                <button
                  type="button"
                  onClick={() => { setShowMenu(!showMenu); setShowNotif(false); }}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full text-white/90 hover:text-white hover:bg-white/10 transition-colors"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-gold-400 to-gold-500 flex items-center justify-center text-navy-900 font-bold text-xs shadow-sm">
                    {user.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="hidden sm:block text-sm font-medium">{user.name.split(" ")[0]}</span>
                  <ChevronDown className="w-3.5 h-3.5 opacity-70" />
                </button>
                <AnimatePresence>
                  {showMenu && (
                    <motion.div
                      initial={{ opacity: 0, y: 6, scale: 0.98 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: 6, scale: 0.98 }}
                      transition={{ duration: 0.15 }}
                      className="absolute right-0 top-12 w-56 bg-white dark:bg-gray-900 rounded-2xl shadow-xl border border-gray-100 dark:border-gray-800 z-50 py-2 overflow-hidden"
                    >
                      <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-800">
                        <p className="font-display font-bold text-sm text-foreground">{user.name}</p>
                        <p className="text-xs text-muted-foreground truncate">{user.email}</p>
                      </div>
                      <Link
                        to={`/${user.role === "citizen" ? "citizen" : user.role}/profile`}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-foreground hover:bg-gray-50 dark:hover:bg-gray-800 transition-colors"
                        onClick={() => setShowMenu(false)}
                      >
                        <User className="w-4 h-4 text-muted-foreground" />
                        {t("nav.profile")}
                      </Link>
                      <hr className="my-1 border-gray-100 dark:border-gray-800" />
                      <button
                        onClick={handleLogout}
                        className="flex items-center gap-3 px-4 py-2.5 text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 transition-colors w-full text-left"
                      >
                        <LogOut className="w-4 h-4" />
                        {t("nav.signOut")}
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>

              {/* Mobile toggle */}
              <button
                type="button"
                className="md:hidden p-2 text-white/80 hover:text-white"
                onClick={() => setMobileOpen(!mobileOpen)}
              >
                {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2.5">
              <Link to="/transparency" className="text-white/80 hover:text-white text-sm font-medium transition-colors px-3 py-2">
                Transparency
              </Link>
              <LanguageToggle />
              <DarkModeToggle />
              <Link to="/login" className="text-white/80 hover:text-white text-sm font-medium transition-colors px-3 py-2">
                {t("nav.signIn")}
              </Link>
              <Link to="/register" className="bg-gold-400 text-navy-900 hover:bg-gold-300 font-semibold text-sm px-4 py-2 rounded-full transition-all hover:shadow-md active:scale-[0.98]">
                {t("nav.register")}
              </Link>
            </div>
          )}
        </div>

        {/* Mobile Nav */}
        <AnimatePresence>
          {mobileOpen && user && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="md:hidden overflow-hidden"
            >
              <div className="pb-4 border-t border-navy-800 dark:border-navy-900 pt-3 flex flex-col gap-1">
                {links.map(l => (
                  <Link
                    key={l.to}
                    to={l.to}
                    className="nav-link px-4 py-2.5 rounded-xl hover:bg-white/10 block"
                    onClick={() => setMobileOpen(false)}
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Backdrop */}
      <AnimatePresence>
        {(showNotif || showMenu) && (
          <div
            className="fixed inset-0 z-30"
            onClick={() => { setShowNotif(false); setShowMenu(false); }}
          />
        )}
      </AnimatePresence>
    </nav>
  );
}
