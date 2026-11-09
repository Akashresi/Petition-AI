import { useState } from "react";
import { Search, Filter, FileText, Download, FileSpreadsheet, CheckSquare, Square, Trash2, ArrowUpCircle } from "lucide-react";
import { useComplaints } from "@/hooks/useComplaints";
import { Link } from "react-router-dom";
import { cn, statusClass, statusLabel, priorityClass, formatDate } from "@/lib/utils";
import { ComplaintStatus, Priority } from "@/types";
import { DEPARTMENTS, OFFICERS } from "@/constants/mockData";
import { useNotifications } from "@/hooks/useNotifications";
import { exportComplaintsToExcel } from "@/lib/excelExport";
import SLABadge from "@/components/features/SLABadge";

export default function AdminComplaints() {
  const { complaints, updateComplaint } = useComplaints();
  const { addNotification } = useNotifications(undefined);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<ComplaintStatus | "all">("all");
  const [priorityFilter, setPriorityFilter] = useState<Priority | "all">("all");
  const [deptFilter, setDeptFilter] = useState("all");
  const [assigningId, setAssigningId] = useState<string | null>(null);
  const [selectedOfficer, setSelectedOfficer] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkStatus, setBulkStatus] = useState<ComplaintStatus>("in_progress");

  const filtered = complaints.filter(c => {
    const ms = statusFilter === "all" || c.status === statusFilter;
    const mp = priorityFilter === "all" || c.priority === priorityFilter;
    const md = deptFilter === "all" || c.assignedDepartment === deptFilter;
    const mq = !search || c.title.toLowerCase().includes(search.toLowerCase()) || c.petitionId.toLowerCase().includes(search.toLowerCase());
    return ms && mp && md && mq;
  });

  function toggleSelect(id: string) {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleSelectAll() {
    if (selectedIds.size === filtered.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(filtered.map(c => c.id)));
    }
  }

  function bulkUpdateStatus() {
    selectedIds.forEach(id => {
      const c = complaints.find(x => x.id === id);
      if (c) {
        updateComplaint(id, {
          status: bulkStatus,
          statusHistory: [
            ...c.statusHistory,
            { status: bulkStatus, timestamp: new Date().toISOString(), note: `Bulk status update to ${statusLabel(bulkStatus)}`, updatedBy: "Admin" },
          ],
        });
      }
    });
    setSelectedIds(new Set());
  }

  function exportSelected() {
    const toExport = selectedIds.size > 0
      ? complaints.filter(c => selectedIds.has(c.id))
      : filtered;
    exportComplaintsToExcel(toExport);
  }

  function assignOfficer(cId: string) {
    const officer = OFFICERS.find(o => o.id === selectedOfficer);
    if (!officer) return;
    updateComplaint(cId, {
      assignedOfficer: officer.id,
      assignedOfficerName: officer.name,
      status: "assigned",
      statusHistory: [
        ...(complaints.find(c => c.id === cId)?.statusHistory || []),
        { status: "assigned", timestamp: new Date().toISOString(), note: `Assigned to Officer ${officer.name}`, updatedBy: "Admin" },
      ],
    });
    const c = complaints.find(x => x.id === cId);
    if (c) {
      addNotification({ userId: c.submittedBy, title: "Officer Assigned", message: `Officer ${officer.name} has been assigned to your petition ${c.petitionId}.`, type: "info", isRead: false, petitionId: c.petitionId });
    }
    setAssigningId(null);
    setSelectedOfficer("");
  }

  return (
    <div className="min-h-screen bg-navy-975 text-foreground py-8 px-4 sm:px-6 lg:px-8">
      <div className="max-w-7xl mx-auto">
        <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div>
            <h1 className="font-serif text-2xl font-bold text-foreground">Complaint Management</h1>
            <p className="text-muted-foreground text-sm mt-1">{filtered.length} of {complaints.length} complaints shown</p>
          </div>
          <div className="flex gap-2">
            <button onClick={exportSelected}
              className="inline-flex items-center gap-1.5 text-xs bg-green-50 text-green-700 border border-green-200 px-3 py-2 rounded-md hover:bg-green-100 dark:bg-green-950/40 dark:text-green-300 dark:border-green-800/60 dark:hover:bg-green-900/40 transition-colors font-medium">
              <FileSpreadsheet className="w-3.5 h-3.5" /> {selectedIds.size > 0 ? `Export ${selectedIds.size} Selected` : "Export All"}
            </button>
          </div>
        </div>

        {/* Bulk Operations Bar */}
        {selectedIds.size > 0 && (
          <div className="bg-navy-50 border border-navy-200 dark:bg-navy-900/60 dark:border-navy-700 rounded-lg p-3 mb-4 flex items-center gap-3 flex-wrap">
            <span className="text-sm font-semibold text-navy-800 dark:text-navy-200">{selectedIds.size} selected</span>
            <select value={bulkStatus} onChange={e => setBulkStatus(e.target.value as ComplaintStatus)}
              className="text-xs border border-border rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-navy-400">
              {(["under_review", "assigned", "in_progress", "resolved", "closed"] as const).map(s => (
                <option key={s} value={s}>{statusLabel(s)}</option>
              ))}
            </select>
            <button onClick={bulkUpdateStatus}
              className="text-xs bg-navy-800 text-white px-3 py-1.5 rounded-md hover:bg-navy-700 transition-colors flex items-center gap-1">
              <ArrowUpCircle className="w-3.5 h-3.5" /> Bulk Update
            </button>
            <button onClick={() => setSelectedIds(new Set())}
              className="text-xs text-muted-foreground hover:text-foreground px-2 py-1.5">Clear</button>
          </div>
        )}

        {/* Filters */}
        <div className="card-base p-4 mb-5 space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
            <input type="text" value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by title or petition ID..."
              className="w-full border border-border rounded-md pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-navy-400" />
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            <Filter className="w-3.5 h-3.5 text-muted-foreground" />
            {(["all", "submitted", "under_review", "assigned", "in_progress", "resolved", "closed"] as const).map(s => (
              <button key={s} onClick={() => setStatusFilter(s as ComplaintStatus | "all")}
                className={cn("text-xs px-2.5 py-1 rounded-full border transition-colors", statusFilter === s ? "bg-navy-800 dark:bg-gold-500 text-white dark:text-navy-950 border-navy-800 dark:border-gold-500" : "bg-card text-muted-foreground border-border hover:border-navy-300 hover:text-foreground")}>
                {s === "all" ? "All Status" : statusLabel(s as ComplaintStatus)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-2 items-center">
            {(["all", "critical", "high", "medium", "low"] as const).map(p => (
              <button key={p} onClick={() => setPriorityFilter(p as Priority | "all")}
                className={cn("text-xs px-2.5 py-1 rounded-full border capitalize transition-colors", priorityFilter === p ? "bg-navy-800 dark:bg-gold-500 text-white dark:text-navy-950 border-navy-800 dark:border-gold-500" : "bg-card text-muted-foreground border-border hover:border-navy-300 hover:text-foreground")}>
                {p === "all" ? "All Priority" : p}
              </button>
            ))}
            <select value={deptFilter} onChange={e => setDeptFilter(e.target.value)}
              className="text-xs border border-border rounded-full px-3 py-1 focus:outline-none focus:ring-1 focus:ring-navy-400 bg-card text-foreground">
              <option value="all">All Departments</option>
              {DEPARTMENTS.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="card-base overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-navy-800 text-white">
                  <th className="text-left px-4 py-3 text-xs font-semibold w-8">
                    <button onClick={toggleSelectAll} className="flex items-center justify-center">
                      {selectedIds.size === filtered.length && filtered.length > 0
                        ? <CheckSquare className="w-4 h-4" />
                        : <Square className="w-4 h-4" />}
                    </button>
                  </th>
                  <th className="text-left px-4 py-3 text-xs font-semibold">Petition ID</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold">Title</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold">AI Category</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold">Priority</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold">SLA</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold">Officer</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold">Date</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.length === 0 ? (
                  <tr><td colSpan={10} className="text-center py-10 text-muted-foreground">No complaints found.</td></tr>
                ) : (
                  filtered.map(c => (
                    <>
                      <tr key={c.id} className="hover:bg-muted transition-colors">
                        <td className="px-4 py-3">
                          <button onClick={() => toggleSelect(c.id)} className="flex items-center justify-center">
                            {selectedIds.has(c.id)
                              ? <CheckSquare className="w-4 h-4 text-navy-600 dark:text-navy-300" />
                              : <Square className="w-4 h-4 text-muted-foreground" />}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <Link to={`/admin/complaint/${c.id}`} className="font-mono text-xs text-navy-600 hover:text-navy-800 dark:text-navy-300 dark:hover:text-navy-200 font-bold">{c.petitionId}</Link>
                        </td>
                        <td className="px-4 py-3 max-w-[200px]">
                          <p className="font-medium text-foreground truncate">{c.title}</p>
                          <p className="text-xs text-muted-foreground">{c.submittedByName}</p>
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          <div>{c.category}</div>
                          <div className="text-[10px] text-navy-500 dark:text-navy-300">{Math.round(c.aiAnalysis.categoryConfidence * 100)}% conf.</div>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("text-xs font-semibold px-2 py-0.5 rounded border", priorityClass(c.priority))}>{c.priority.toUpperCase()}</span>
                        </td>
                        <td className="px-4 py-3">
                          <span className={cn("text-xs font-semibold px-2 py-0.5 rounded border", statusClass(c.status))}>{statusLabel(c.status)}</span>
                        </td>
                        <td className="px-4 py-3">
                          <SLABadge complaint={c} showDeadline={false} />
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">
                          {c.assignedOfficerName || <span className="text-amber-600">Unassigned</span>}
                        </td>
                        <td className="px-4 py-3 text-xs text-muted-foreground">{formatDate(c.submittedAt)}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-1.5">
                            <Link to={`/admin/complaint/${c.id}`} className="text-xs text-navy-600 border border-navy-300 px-2 py-1 rounded hover:bg-navy-50 dark:text-navy-300 dark:border-navy-700 dark:hover:bg-gray-800 transition-colors">View</Link>
                            {!c.assignedOfficer && (
                              <button onClick={() => setAssigningId(assigningId === c.id ? null : c.id)}
                                className="text-xs text-purple-600 border border-purple-300 px-2 py-1 rounded hover:bg-purple-50 dark:text-purple-300 dark:border-purple-700 dark:hover:bg-gray-800 transition-colors">
                                Assign
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                      {assigningId === c.id && (
                        <tr className="bg-purple-50 dark:bg-purple-950/30 dark:text-foreground">
                          <td colSpan={10} className="px-4 py-3">
                            <div className="flex items-center gap-3">
                              <select value={selectedOfficer} onChange={e => setSelectedOfficer(e.target.value)}
                                className="border border-border rounded-md px-3 py-1.5 text-sm focus:outline-none focus:ring-1 focus:ring-navy-400">
                                <option value="">Select Officer</option>
                                {OFFICERS.filter(o => o.department === c.assignedDepartment).map(o => (
                                  <option key={o.id} value={o.id}>{o.name} ({o.assignedCount} active)</option>
                                ))}
                                {OFFICERS.filter(o => o.department === c.assignedDepartment).length === 0 &&
                                  OFFICERS.map(o => <option key={o.id} value={o.id}>{o.name} - {o.department}</option>)}
                              </select>
                              <button onClick={() => assignOfficer(c.id)} disabled={!selectedOfficer}
                                className="text-sm bg-purple-600 hover:bg-purple-700 text-white px-4 py-1.5 rounded-md disabled:opacity-50 transition-colors">
                                Assign
                              </button>
                              <button onClick={() => setAssigningId(null)} className="text-sm text-muted-foreground hover:text-foreground">Cancel</button>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}
