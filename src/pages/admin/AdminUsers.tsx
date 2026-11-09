import { useState } from "react";
import { Users, Building2, UserCheck, Mail, Phone, Star, Shield, Plus, Edit3, Trash2, X, Save } from "lucide-react";
import { MOCK_USERS, DEPARTMENTS, OFFICERS } from "@/constants/mockData";
import { cn } from "@/lib/utils";
import { toast } from "sonner";

type Tab = "citizens" | "officers" | "departments";

interface NewOfficer {
  name: string;
  email: string;
  department: string;
}

interface NewDepartment {
  name: string;
  code: string;
  head: string;
}

export default function AdminUsers() {
  const [tab, setTab] = useState<Tab>("citizens");
  const [showAddOfficer, setShowAddOfficer] = useState(false);
  const [showAddDept, setShowAddDept] = useState(false);
  const [editingOfficer, setEditingOfficer] = useState<string | null>(null);
  const [editingDept, setEditingDept] = useState<string | null>(null);
  const [newOfficer, setNewOfficer] = useState<NewOfficer>({ name: "", email: "", department: "" });
  const [newDept, setNewDept] = useState<NewDepartment>({ name: "", code: "", head: "" });
  const [officersList, setOfficersList] = useState(OFFICERS);
  const [departmentsList, setDepartmentsList] = useState(DEPARTMENTS);

  const citizens = MOCK_USERS.filter(u => u.role === "citizen");

  function addOfficer() {
    if (!newOfficer.name || !newOfficer.email || !newOfficer.department) {
      toast.error("Please fill all fields");
      return;
    }
    const officer = {
      id: `o${Date.now()}`,
      name: newOfficer.name,
      email: newOfficer.email,
      department: newOfficer.department,
      assignedCount: 0,
      resolvedCount: 0,
      rating: 0,
      joinedAt: new Date().toISOString(),
    };
    setOfficersList([...officersList, officer]);
    setNewOfficer({ name: "", email: "", department: "" });
    setShowAddOfficer(false);
    toast.success("Officer added successfully");
  }

  function deleteOfficer(id: string) {
    setOfficersList(officersList.filter(o => o.id !== id));
    toast.success("Officer removed");
  }

  function addDepartment() {
    if (!newDept.name || !newDept.code || !newDept.head) {
      toast.error("Please fill all fields");
      return;
    }
    const dept = {
      id: `d${Date.now()}`,
      name: newDept.name,
      code: newDept.code,
      head: newDept.head,
      officerCount: 0,
      pendingCount: 0,
      resolvedCount: 0,
      categories: [],
    };
    setDepartmentsList([...departmentsList, dept]);
    setNewDept({ name: "", code: "", head: "" });
    setShowAddDept(false);
    toast.success("Department added successfully");
  }

  function deleteDepartment(id: string) {
    setDepartmentsList(departmentsList.filter(d => d.id !== id));
    toast.success("Department removed");
  }

  return (
    <div className="min-h-screen bg-navy-975 text-foreground py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-6xl mx-auto">
        <div className="mb-6">
          <h1 className="font-serif text-2xl font-bold text-foreground">User Management</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage citizens, officers, and departments</p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-muted rounded-lg mb-6 w-fit">
          {([
            { key: "citizens", label: "Citizens", icon: Users },
            { key: "officers", label: "Officers", icon: UserCheck },
            { key: "departments", label: "Departments", icon: Building2 },
          ] as const).map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={cn("flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-all",
                tab === t.key ? "bg-card text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground")}>
              <t.icon className="w-4 h-4" /> {t.label}
            </button>
          ))}
        </div>

        {/* Citizens Tab */}
        {tab === "citizens" && (
          <div className="card-base overflow-hidden">
            <div className="bg-navy-800 text-white px-5 py-3 flex items-center gap-2">
              <Users className="w-4 h-4" />
              <span className="font-semibold text-sm">Registered Citizens ({citizens.length})</span>
            </div>
            <div className="divide-y divide-border">
              {citizens.map(u => (
                <div key={u.id} className="flex items-center gap-4 px-5 py-4">
                  <div className="w-10 h-10 bg-blue-100 dark:bg-blue-950/40 rounded-full flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold">
                    {u.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">{u.name}</p>
                    <div className="flex gap-3 mt-0.5 flex-wrap">
                      <span className="flex items-center gap-1 text-xs text-muted-foreground"><Mail className="w-3 h-3" />{u.email}</span>
                      {u.phone && <span className="flex items-center gap-1 text-xs text-muted-foreground"><Phone className="w-3 h-3" />{u.phone}</span>}
                    </div>
                  </div>
                  <span className="text-xs bg-blue-100 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 px-2 py-1 rounded-full font-semibold uppercase">Citizen</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Officers Tab */}
        {tab === "officers" && (
          <div className="card-base overflow-hidden">
            <div className="bg-navy-800 text-white px-5 py-3 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <UserCheck className="w-4 h-4" />
                <span className="font-semibold text-sm">Officers ({officersList.length})</span>
              </div>
              <button onClick={() => setShowAddOfficer(!showAddOfficer)}
                className="flex items-center gap-1 text-xs bg-gold-400 text-navy-900 px-3 py-1.5 rounded-md font-semibold hover:bg-gold-300 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Add Officer
              </button>
            </div>

            {/* Add Officer Form */}
            {showAddOfficer && (
              <div className="bg-navy-50 border-b border-border p-4 dark:bg-gray-800/60">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-foreground">New Officer</h4>
                  <button onClick={() => setShowAddOfficer(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input type="text" value={newOfficer.name} onChange={e => setNewOfficer({ ...newOfficer, name: e.target.value })}
                    placeholder="Full Name" className="border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400 dark:bg-gray-800/60 dark:text-foreground" />
                  <input type="email" value={newOfficer.email} onChange={e => setNewOfficer({ ...newOfficer, email: e.target.value })}
                    placeholder="Email" className="border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400 dark:bg-gray-800/60 dark:text-foreground" />
                  <select value={newOfficer.department} onChange={e => setNewOfficer({ ...newOfficer, department: e.target.value })}
                    className="border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400 dark:bg-gray-800/60 dark:text-foreground">
                    <option value="">Select Department</option>
                    {departmentsList.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
                  </select>
                </div>
                <button onClick={addOfficer} className="mt-3 bg-navy-800 text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-navy-700 transition-colors flex items-center gap-1">
                  <Save className="w-3.5 h-3.5" /> Save Officer
                </button>
              </div>
            )}

            <div className="divide-y divide-border">
              {officersList.map(o => (
                <div key={o.id} className="flex flex-col sm:flex-row sm:items-center gap-3 px-5 py-4">
                  <div className="w-10 h-10 bg-purple-100 dark:bg-purple-950/40 rounded-full flex items-center justify-center text-purple-700 dark:text-purple-300 font-bold flex-shrink-0">
                    {o.name.charAt(0)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground">{o.name}</p>
                    <div className="flex gap-3 mt-0.5 flex-wrap">
                      <span className="text-xs text-muted-foreground">{o.email}</span>
                      <span className="text-xs text-purple-600 dark:text-purple-300 font-medium">{o.department}</span>
                    </div>
                  </div>
                  <div className="flex items-center gap-4 flex-shrink-0">
                    <div className="text-center">
                      <p className="text-lg font-bold text-amber-500">{o.assignedCount}</p>
                      <p className="text-[10px] text-muted-foreground">Active</p>
                    </div>
                    <div className="text-center">
                      <p className="text-lg font-bold text-green-600">{o.resolvedCount}</p>
                      <p className="text-[10px] text-muted-foreground">Resolved</p>
                    </div>
                    <div className="flex items-center gap-1">
                      <Star className="w-4 h-4 text-gold-400 fill-gold-400" />
                      <span className="text-sm font-bold">{o.rating}</span>
                    </div>
                    <button onClick={() => deleteOfficer(o.id)}
                      className="text-xs text-red-500 hover:text-red-700 p-1.5 rounded-md hover:bg-red-50 transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Departments Tab */}
        {tab === "departments" && (
          <div>
            <div className="flex justify-end mb-4">
              <button onClick={() => setShowAddDept(!showAddDept)}
                className="flex items-center gap-1 text-xs bg-gold-400 text-navy-900 px-3 py-2 rounded-md font-semibold hover:bg-gold-300 transition-colors">
                <Plus className="w-3.5 h-3.5" /> Add Department
              </button>
            </div>

            {/* Add Department Form */}
            {showAddDept && (
              <div className="card-base p-4 mb-4">
                <div className="flex items-center justify-between mb-3">
                  <h4 className="text-sm font-semibold text-foreground">New Department</h4>
                  <button onClick={() => setShowAddDept(false)}><X className="w-4 h-4 text-muted-foreground" /></button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <input type="text" value={newDept.name} onChange={e => setNewDept({ ...newDept, name: e.target.value })}
                    placeholder="Department Name" className="border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400 dark:bg-gray-800/60 dark:text-foreground" />
                  <input type="text" value={newDept.code} onChange={e => setNewDept({ ...newDept, code: e.target.value })}
                    placeholder="Code (e.g. RNI)" className="border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400 dark:bg-gray-800/60 dark:text-foreground" />
                  <input type="text" value={newDept.head} onChange={e => setNewDept({ ...newDept, head: e.target.value })}
                    placeholder="Department Head" className="border border-border rounded-md px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400 dark:bg-gray-800/60 dark:text-foreground" />
                </div>
                <button onClick={addDepartment} className="mt-3 bg-navy-800 text-white px-4 py-2 rounded-md text-sm font-semibold hover:bg-navy-700 transition-colors flex items-center gap-1">
                  <Save className="w-3.5 h-3.5" /> Save Department
                </button>
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {departmentsList.map(d => (
                <div key={d.id} className="card-base p-5">
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="w-8 h-8 bg-navy-100 dark:bg-navy-800 rounded-lg flex items-center justify-center">
                        <Building2 className="w-4 h-4 text-navy-700 dark:text-navy-200" />
                      </div>
                      <div>
                        <p className="font-bold text-foreground text-sm">{d.name}</p>
                        <p className="text-xs text-muted-foreground">{d.code}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Shield className="w-3.5 h-3.5" /> {d.officerCount} officers
                      </div>
                      <button onClick={() => deleteDepartment(d.id)}
                        className="text-xs text-red-500 hover:text-red-700 p-1.5 rounded-md hover:bg-red-50 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <div className="flex gap-4 mb-3">
                    <div>
                      <p className="text-xl font-bold text-amber-600">{d.pendingCount}</p>
                      <p className="text-xs text-muted-foreground">Pending</p>
                    </div>
                    <div>
                      <p className="text-xl font-bold text-green-600">{d.resolvedCount}</p>
                      <p className="text-xs text-muted-foreground">Resolved</p>
                    </div>
                  </div>
                  <div>
                    <p className="text-xs text-muted-foreground mb-1">Handles</p>
                    <div className="flex flex-wrap gap-1">
                      {d.categories.map(c => (
                        <span key={c} className="text-[10px] bg-navy-50 text-navy-700 border border-navy-200 dark:bg-navy-800 dark:text-navy-200 dark:border-navy-700 px-1.5 py-0.5 rounded">{c}</span>
                      ))}
                    </div>
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">Head: <span className="font-medium text-foreground">{d.head}</span></p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
