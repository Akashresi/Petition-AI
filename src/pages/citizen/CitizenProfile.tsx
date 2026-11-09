import { useState } from "react";
import { User, Mail, Phone, MapPin, Calendar, Edit3, Save, X } from "lucide-react";
import { useAuth } from "@/lib/auth";
import { useComplaints } from "@/hooks/useComplaints";
import { formatDate, statusClass, statusLabel } from "@/lib/utils";
import { cn } from "@/lib/utils";

export default function CitizenProfile() {
  const { user } = useAuth();
  const { getByUser } = useComplaints();
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(user?.name || "");
  const [phone, setPhone] = useState(user?.phone || "");
  const [address, setAddress] = useState(user?.address || "");

  const complaints = getByUser(user?.id || "u1");
  const resolved = complaints.filter(c => c.status === "resolved" || c.status === "closed").length;

  return (
    <div className="min-h-screen bg-navy-975 text-foreground py-8 px-4">
      <div className="max-w-3xl mx-auto">
        <h1 className="font-serif text-2xl font-bold text-foreground mb-6">My Profile</h1>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          {/* Profile Card */}
          <div className="lg:col-span-2 card-reference p-6 bg-surface-card border-surface-border">
            <div className="flex items-start justify-between mb-5">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 bg-navy-700 rounded-full flex items-center justify-center text-white text-2xl font-bold">
                  {(user?.name || "U").charAt(0).toUpperCase()}
                </div>
                <div>
                  <h2 className="font-bold text-foreground text-lg">{user?.name}</h2>
                  <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-semibold uppercase dark:bg-blue-950/40 dark:text-blue-300">Citizen</span>
                </div>
              </div>
              {!editing ? (
                <button onClick={() => setEditing(true)} className="flex items-center gap-1.5 text-sm text-navy-600 border border-navy-300 px-3 py-1.5 rounded-md hover:bg-navy-50 transition-colors dark:text-navy-300 dark:border-navy-700 dark:hover:bg-gray-800">
                  <Edit3 className="w-3.5 h-3.5" /> Edit
                </button>
              ) : (
                <div className="flex gap-2">
                  <button onClick={() => setEditing(false)} className="flex items-center gap-1 text-sm text-green-600 border border-green-300 px-3 py-1.5 rounded-md hover:bg-green-50 dark:text-green-400 dark:border-green-800/60 dark:hover:bg-green-950/40">
                    <Save className="w-3.5 h-3.5" /> Save
                  </button>
                  <button onClick={() => setEditing(false)} className="flex items-center gap-1 text-sm text-muted-foreground border border-border px-2 py-1.5 rounded-md hover:bg-muted">
                    <X className="w-3.5 h-3.5" />
                  </button>
                </div>
              )}
            </div>

            <div className="space-y-4">
              <Field icon={<User className="w-4 h-4" />} label="Full Name">
                {editing ? <input value={name} onChange={e => setName(e.target.value)} className="w-full border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-navy-400" /> : <span className="text-sm font-medium">{user?.name}</span>}
              </Field>
              <Field icon={<Mail className="w-4 h-4" />} label="Email Address">
                <span className="text-sm font-medium text-muted-foreground">{user?.email}</span>
              </Field>
              <Field icon={<Phone className="w-4 h-4" />} label="Phone Number">
                {editing ? <input value={phone} onChange={e => setPhone(e.target.value)} className="w-full border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-navy-400" /> : <span className="text-sm font-medium">{user?.phone || "Not provided"}</span>}
              </Field>
              <Field icon={<MapPin className="w-4 h-4" />} label="Address">
                {editing ? <textarea value={address} onChange={e => setAddress(e.target.value)} rows={2} className="w-full border border-border rounded px-2 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-navy-400 resize-none" /> : <span className="text-sm font-medium">{user?.address || "Not provided"}</span>}
              </Field>
              <Field icon={<Calendar className="w-4 h-4" />} label="Member Since">
                <span className="text-sm font-medium">{user?.joinedAt ? formatDate(user.joinedAt) : "N/A"}</span>
              </Field>
            </div>
          </div>

          {/* Stats */}
          <div className="space-y-4">
            <div className="card-base p-4">
              <h3 className="font-semibold text-foreground text-sm mb-3">Petition Summary</h3>
              <div className="space-y-3">
                {[
                  { label: "Total Filed", value: complaints.length, color: "text-navy-700 dark:text-navy-300" },
                  { label: "Resolved", value: resolved, color: "text-green-600" },
                  { label: "Pending", value: complaints.length - resolved, color: "text-amber-600" },
                ].map(s => (
                  <div key={s.label} className="flex justify-between items-center">
                    <span className="text-sm text-muted-foreground">{s.label}</span>
                    <span className={cn("text-lg font-bold", s.color)}>{s.value}</span>
                  </div>
                ))}
              </div>
            </div>

            <div className="card-base p-4">
              <h3 className="font-semibold text-foreground text-sm mb-3">Security</h3>
              <div className="space-y-2">
                <div className="flex items-center gap-2 text-xs text-green-600">
                  <div className="w-2 h-2 rounded-full bg-green-500" /> JWT Authenticated
                </div>
                <div className="flex items-center gap-2 text-xs text-green-600">
                  <div className="w-2 h-2 rounded-full bg-green-500" /> Role: Citizen
                </div>
                <div className="flex items-center gap-2 text-xs text-green-600">
                  <div className="w-2 h-2 rounded-full bg-green-500" /> Password Hashed (bcrypt)
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Recent Complaints */}
        <div className="card-reference p-5 bg-surface-card border-surface-border mt-5">
          <h3 className="font-semibold text-foreground mb-4">Recent Petitions</h3>
          {complaints.slice(0, 5).map(c => (
            <div key={c.id} className="flex items-center justify-between py-2.5 border-b border-border last:border-b-0">
              <div>
                <p className="text-sm font-medium text-foreground">{c.title}</p>
                <p className="text-xs text-muted-foreground">{c.petitionId} · {formatDate(c.submittedAt)}</p>
              </div>
              <span className={cn("text-xs font-semibold px-2 py-1 rounded border", statusClass(c.status))}>{statusLabel(c.status)}</span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function Field({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3">
      <div className="text-muted-foreground mt-0.5">{icon}</div>
      <div className="flex-1">
        <p className="text-xs text-muted-foreground mb-0.5">{label}</p>
        {children}
      </div>
    </div>
  );
}
