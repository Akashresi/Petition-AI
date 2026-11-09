import React, { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  description?: string;
  children: React.ReactNode;
  className?: string;
  maxWidth?: "sm" | "md" | "lg" | "xl";
}

export function Modal({
  isOpen,
  onClose,
  title,
  description,
  children,
  className = "",
  maxWidth = "md",
}: ModalProps) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    if (isOpen) {
      document.body.style.overflow = "hidden";
      window.addEventListener("keydown", handleKeyDown);
    }
    return () => {
      document.body.style.overflow = "unset";
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isOpen, onClose]);

  const maxWStyles = {
    sm: "max-w-sm",
    md: "max-w-md",
    lg: "max-w-lg",
    xl: "max-w-2xl",
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm"
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            initial={{ opacity: 0, scale: 0.95, y: 10 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 10 }}
            transition={{ duration: 0.2, ease: "easeOut" }}
            className={cn(
              "relative w-full bg-card text-card-foreground border border-border rounded-2xl sm:rounded-3xl shadow-2xl z-10 overflow-hidden",
              maxWStyles[maxWidth],
              className
            )}
          >
            {(title || description) && (
              <div className="p-5 sm:p-6 pb-0 flex items-start justify-between">
                <div>
                  {title && <h2 className="font-display text-lg sm:text-xl font-bold text-foreground">{title}</h2>}
                  {description && <p className="text-xs sm:text-sm text-muted-foreground mt-1">{description}</p>}
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="rounded-full p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
                  aria-label="Close"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            )}
            <div className="p-5 sm:p-6">{children}</div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}

export default Modal;

