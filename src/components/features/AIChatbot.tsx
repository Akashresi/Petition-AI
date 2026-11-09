import { useState, useRef, useEffect } from "react";
import { MessageCircle, X, Send, Bot, User, Minimize2 } from "lucide-react";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  role: "user" | "bot";
  text: string;
  timestamp: Date;
}

const FAQ_RESPONSES: Record<string, string> = {
  "how to submit": "To submit a petition:\n1. Log in as a citizen\n2. Click 'Submit Petition' in the nav\n3. Fill in the title, description, category, and location\n4. Our AI will automatically classify and prioritise your complaint\n5. You'll receive a Petition ID for tracking.",
  "track": "You can track your petition status by going to 'My Petitions'. Each complaint shows its status: Submitted → Under Review → Assigned → In Progress → Resolved → Closed.",
  "status": "Petition statuses:\n• Submitted – Received and AI-analysed\n• Under Review – Being reviewed\n• Assigned – Given to an officer\n• In Progress – Officer working on it\n• Resolved – Issue fixed\n• Closed – Completed & confirmed",
  "ai": "Our AI engine automatically:\n• Classifies your complaint into the right category\n• Predicts the responsible department\n• Detects duplicate complaints\n• Assigns priority (Critical/High/Medium/Low)\n• Analyses sentiment to detect urgency",
  "department": "Departments include:\n• Roads & Infrastructure (potholes, construction)\n• Water Works (water supply, sanitation)\n• Electricity Board (power issues, street lights)\n• Waste Management (garbage, cleaning)\n• Public Safety (noise, safety issues)\n• Health & Education Departments",
  "register": "To register:\n1. Click 'Register' on the homepage\n2. Fill in your name, email, phone and address\n3. Create a password\n4. You're ready to submit petitions!",
  "priority": "AI assigns priority based on:\n• Critical: Accidents, danger, emergencies\n• High: No water/electricity, safety risks\n• Medium: Regular complaints\n• Low: Minor inconveniences",
  "duplicate": "If our AI detects your complaint is similar to existing ones, it will flag it as a possible duplicate and show you the related complaints. Your petition will still be processed.",
  "feedback": "After your complaint is resolved, you can:\n1. Go to 'My Petitions'\n2. Open the resolved petition\n3. Rate the resolution and leave a comment",
  "hello": "Hello! I'm PetitionAI Assistant. I can help you with:\n• Submitting complaints\n• Tracking petition status\n• Understanding AI features\n• Department information\n• Registration guidance\n\nWhat would you like to know?",
  "help": "I can assist you with:\n• How to submit a petition\n• Tracking your complaint status\n• Understanding our AI classification\n• Department information\n• Registration process\n• Priority levels\n\nType your question or choose a topic above.",
};

function getBotResponse(input: string): string {
  const lower = input.toLowerCase();
  for (const [key, response] of Object.entries(FAQ_RESPONSES)) {
    if (lower.includes(key)) return response;
  }
  if (lower.includes("contact") || lower.includes("phone") || lower.includes("email")) {
    return "For direct contact, please reach the Municipal Corporation helpline at 1800-XXX-XXXX (toll-free) or email: grievance@municipality.gov.in. Office hours: Mon–Sat, 9 AM – 5 PM.";
  }
  if (lower.includes("time") || lower.includes("long") || lower.includes("resolve")) {
    return "Average resolution times by priority:\n• Critical: 24–48 hours\n• High: 3–5 days\n• Medium: 7–10 days\n• Low: 15–20 days\n\nTimes may vary based on department workload.";
  }
  return "I'm not sure about that specific query. You can ask me about:\n• Submitting petitions\n• Tracking status\n• AI features\n• Department information\n• Registration\n• Priority levels\n\nOr contact our helpline at 1800-XXX-XXXX.";
}

const QUICK_QUESTIONS = [
  "How to submit a petition?",
  "How to track my complaint?",
  "What does AI do?",
  "Complaint priorities",
];

export default function AIChatbot() {
  const [open, setOpen] = useState(false);
  const [minimised, setMinimised] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "0",
      role: "bot",
      text: "Hello! I'm PetitionAI Assistant 🤖\n\nI can help you with complaint submission, tracking, and more. How can I assist you today?",
      timestamp: new Date(),
    },
  ]);
  const [input, setInput] = useState("");
  const [typing, setTyping] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (open && !minimised) bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, open, minimised]);

  function sendMessage(text: string) {
    if (!text.trim()) return;
    const userMsg: Message = { id: Date.now().toString(), role: "user", text, timestamp: new Date() };
    setMessages(prev => [...prev, userMsg]);
    setInput("");
    setTyping(true);
    setTimeout(() => {
      const botMsg: Message = {
        id: (Date.now() + 1).toString(),
        role: "bot",
        text: getBotResponse(text),
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botMsg]);
      setTyping(false);
    }, 800 + Math.random() * 500);
  }

  return (
    <>
      {/* Floating Button */}
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 w-14 h-14 bg-navy-850 hover:bg-navy-800 text-blue-300 border border-blue-500/40 rounded-full shadow-2xl flex items-center justify-center transition-all z-50 group hover:scale-105 active:scale-95"
          aria-label="Open AI Chatbot"
        >
          <MessageCircle className="w-6 h-6 text-blue-300 group-hover:text-blue-200 transition-colors" />
          <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-emerald-400 rounded-full border-2 border-navy-975" />
        </button>
      )}

      {/* Chat Window */}
      {open && (
        <div className={cn(
          "fixed right-6 z-50 w-80 bg-card text-card-foreground rounded-2xl shadow-2xl border border-border flex flex-col transition-all overflow-hidden",
          minimised ? "bottom-6 h-14" : "bottom-6 h-[480px]"
        )}>
          {/* Header */}
          <div className="flex items-center gap-2.5 px-4 py-3 bg-navy-800 dark:bg-navy-950 text-white flex-shrink-0">
            <div className="w-8 h-8 bg-gold-400 rounded-full flex items-center justify-center">
              <Bot className="w-4 h-4 text-navy-900" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold leading-none">PetitionAI Assistant</p>
              <p className="text-[11px] text-emerald-400 mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 bg-emerald-400 rounded-full inline-block" /> Online 24/7
              </p>
            </div>
            <button type="button" onClick={() => setMinimised(!minimised)} className="text-white/70 hover:text-white p-1 transition-colors">
              <Minimize2 className="w-4 h-4" />
            </button>
            <button type="button" onClick={() => setOpen(false)} className="text-white/70 hover:text-white p-1 transition-colors">
              <X className="w-4 h-4" />
            </button>
          </div>

          {!minimised && (
            <>
              {/* Messages */}
              <div className="flex-1 overflow-y-auto p-3 space-y-3 bg-card">
                {messages.map(m => (
                  <div key={m.id} className={cn("flex gap-2", m.role === "user" ? "justify-end" : "justify-start")}>
                    {m.role === "bot" && (
                      <div className="w-6 h-6 bg-navy-700 dark:bg-navy-800 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <Bot className="w-3.5 h-3.5 text-white" />
                      </div>
                    )}
                    <div className={cn(
                      "max-w-[85%] rounded-2xl px-3 py-2 text-xs leading-relaxed whitespace-pre-line shadow-sm",
                      m.role === "bot" ? "bg-muted text-foreground rounded-tl-none" : "bg-navy-700 dark:bg-navy-800 text-white rounded-tr-none"
                    )}>
                      {m.text}
                    </div>
                    {m.role === "user" && (
                      <div className="w-6 h-6 bg-gold-400 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5">
                        <User className="w-3.5 h-3.5 text-navy-900" />
                      </div>
                    )}
                  </div>
                ))}
                {typing && (
                  <div className="flex gap-2 items-center">
                    <div className="w-6 h-6 bg-navy-700 dark:bg-navy-800 rounded-full flex items-center justify-center">
                      <Bot className="w-3.5 h-3.5 text-white" />
                    </div>
                    <div className="bg-muted rounded-2xl px-3 py-2 flex gap-1">
                      {[0, 1, 2].map(i => (
                        <div key={i} className="w-1.5 h-1.5 bg-muted-foreground rounded-full" />
                      ))}
                    </div>
                  </div>
                )}
                <div ref={bottomRef} />
              </div>

              {/* Quick Questions */}
              <div className="px-3 pb-2 flex flex-wrap gap-1.5 bg-card">
                {QUICK_QUESTIONS.map(q => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => sendMessage(q)}
                    className="text-[10px] bg-navy-50 dark:bg-navy-900/60 text-navy-700 dark:text-navy-300 border border-navy-200 dark:border-navy-800 hover:bg-navy-100 dark:hover:bg-navy-800 px-2.5 py-1 rounded-full transition-colors"
                  >
                    {q}
                  </button>
                ))}
              </div>

              {/* Input */}
              <div className="border-t border-border p-3 flex gap-2 bg-card">
                <input
                  type="text"
                  value={input}
                  onChange={e => setInput(e.target.value)}
                  onKeyDown={e => e.key === "Enter" && sendMessage(input)}
                  placeholder="Ask me anything..."
                  className="flex-1 text-xs bg-muted/50 dark:bg-muted/20 border border-border rounded-xl px-3 py-2 text-foreground focus:outline-none focus:ring-1 focus:ring-navy-400 dark:focus:ring-gold-400 transition-colors"
                />
                <button
                  type="button"
                  onClick={() => sendMessage(input)}
                  disabled={!input.trim()}
                  className="w-8 h-8 bg-navy-700 dark:bg-gold-500 hover:bg-navy-800 dark:hover:bg-gold-400 disabled:opacity-40 text-white dark:text-navy-950 rounded-xl flex items-center justify-center transition-colors"
                >
                  <Send className="w-3.5 h-3.5" />
                </button>
              </div>
            </>
          )}
        </div>
      )}
    </>
  );
}
