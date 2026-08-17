import { useEffect, useState } from "react";
import { PageHeader, EmptyState, StatusBadge } from "@/components/ui-custom";
import { Card, CardContent } from "@/components/ui/card";
import { Avatar, AvatarImage, AvatarFallback } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Search, Upload, FileText, Download, Trash2, Users } from "lucide-react";
import { cn } from "@/lib/utils";

function formatFileSize(bytes) {
  if (!bytes) return "";
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function HRSalaryCertificates() {
  const [search, setSearch] = useState("");
  const [alumni, setAlumni] = useState([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState(null);
  const [documents, setDocuments] = useState([]);
  const [docsLoading, setDocsLoading] = useState(false);
  const [pendingFiles, setPendingFiles] = useState([]);
  const [periodLabel, setPeriodLabel] = useState("");
  const [docError, setDocError] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (!search.trim()) {
      setAlumni([]);
      return;
    }
    setLoading(true);
    const t = setTimeout(() => {
      fetch(`/api/users?status=active,inactive&pageSize=20&search=${encodeURIComponent(search)}`)
        .then(res => res.json())
        .then(data => setAlumni(data.users ?? []))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  const loadDocuments = async alumniId => {
    setDocsLoading(true);
    try {
      const res = await fetch(`/api/hr/alumni/${alumniId}/documents`);
      const data = await res.json();
      setDocuments(data.documents ?? []);
    } finally {
      setDocsLoading(false);
    }
  };

  useEffect(() => {
    if (selected) {
      loadDocuments(selected.id);
      setPendingFiles([]);
      setPeriodLabel("");
      setDocError(null);
    } else {
      setDocuments([]);
    }
  }, [selected]);

  const handleFilesPicked = fileList => {
    const files = Array.from(fileList ?? []);
    const nonPdf = files.find(f => f.type !== "application/pdf");
    if (nonPdf) {
      setDocError(`"${nonPdf.name}" is not a PDF file.`);
      return;
    }
    setDocError(null);
    setPendingFiles(prev => [...prev, ...files]);
  };

  const handleUploadDocuments = async () => {
    if (!selected || pendingFiles.length === 0) return;
    setUploading(true);
    setDocError(null);
    try {
      const formData = new FormData();
      pendingFiles.forEach(f => formData.append("files", f));
      formData.append("periodLabel", periodLabel);
      const res = await fetch(`/api/hr/alumni/${selected.id}/documents`, {
        method: "POST",
        body: formData
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error || "Upload failed.");
      }
      setPendingFiles([]);
      setPeriodLabel("");
      await loadDocuments(selected.id);
    } catch (err) {
      setDocError(err instanceof Error ? err.message : "Upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteDocument = async docId => {
    if (!confirm("Delete this document? The alumni will no longer be able to access it.")) return;
    const res = await fetch(`/api/hr/documents/${docId}`, { method: "DELETE" });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      setDocError(data.error || "Could not delete this document.");
      return;
    }
    if (selected) await loadDocuments(selected.id);
  };

  return <>
      <PageHeader
        title="Salary Certificates"
        description="Search for an employee and send them salary certificates or other documents."
        breadcrumbs={[{ label: "HR Portal" }, { label: "Salary Certificates" }]}
      />

      <div className="relative max-w-sm mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input placeholder="Search employee by name or email..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
      </div>

      {!search.trim() && <EmptyState icon={Users} title="Search for an employee" description="Start typing a name or email above to find who you want to send a document to." />}

      {search.trim() && loading && <p className="text-sm text-muted-foreground">Searching...</p>}

      {search.trim() && !loading && alumni.length === 0 && <EmptyState icon={Users} title="No matches" description="Try a different name or email." />}

      {search.trim() && !loading && alumni.length > 0 && <div className="space-y-2">
          {alumni.map(a => <Card key={a.id} className="border-border hover:shadow-sm hover:border-primary/30 transition-all cursor-pointer" onClick={() => setSelected(a)}>
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <Avatar className="w-10 h-10">
                    <AvatarImage src={a.profile_photo_path ?? undefined} alt={a.full_name} className="object-cover" />
                    <AvatarFallback className="td-gradient text-white text-sm font-semibold">{a.full_name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">{a.full_name}</p>
                    <p className="text-xs text-muted-foreground truncate">{a.email}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 shrink-0">
                  <StatusBadge status={a.status} />
                  <Button size="sm" variant="outline" className="gap-1.5 h-8"><Upload className="h-3.5 w-3.5" />Upload</Button>
                </div>
              </CardContent>
            </Card>)}
        </div>}

      {/* Upload Dialog */}
      <Dialog open={!!selected} onOpenChange={() => setSelected(null)}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader><DialogTitle>Salary Certificates — {selected?.full_name}</DialogTitle></DialogHeader>
          {selected && <div className="space-y-4">
              <div className="flex items-center gap-3">
                <Avatar className="w-12 h-12">
                  <AvatarImage src={selected.profile_photo_path ?? undefined} alt={selected.full_name} className="object-cover" />
                  <AvatarFallback className="td-gradient text-white font-semibold">{selected.full_name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                  <p className="text-sm font-semibold text-foreground">{selected.full_name}</p>
                  <p className="text-xs text-muted-foreground">{selected.email}</p>
                </div>
              </div>

              {docsLoading && <p className="text-xs text-muted-foreground">Loading documents...</p>}
              {!docsLoading && documents.length === 0 && <p className="text-xs text-muted-foreground">No documents sent yet.</p>}
              {!docsLoading && documents.length > 0 && <div className="space-y-2">
                  {documents.map(d => <div key={d.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2">
                      <div className="flex items-center gap-2 min-w-0">
                        <FileText className="h-4 w-4 text-primary shrink-0" />
                        <div className="min-w-0">
                          <p className="text-xs font-medium text-foreground truncate">{d.original_filename}</p>
                          <p className="text-[11px] text-muted-foreground">{d.period_label || "No period label"} · {formatFileSize(d.file_size_bytes)}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0" asChild>
                          <a href={`/api/hr/documents/${d.id}/download`} target="_blank" rel="noreferrer"><Download className="h-3.5 w-3.5" /></a>
                        </Button>
                        <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDeleteDocument(d.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                      </div>
                    </div>)}
                </div>}

              <div className={cn("border-2 border-dashed rounded-lg p-4 text-center transition-colors cursor-pointer", dragOver ? "border-primary bg-primary/5" : "border-border hover:border-primary/50")} onClick={() => document.getElementById("hr-doc-file-input")?.click()} onDragOver={e => {
              e.preventDefault();
              setDragOver(true);
            }} onDragLeave={() => setDragOver(false)} onDrop={e => {
              e.preventDefault();
              setDragOver(false);
              handleFilesPicked(e.dataTransfer.files);
            }}>
                <input id="hr-doc-file-input" type="file" accept="application/pdf" multiple className="hidden" onChange={e => handleFilesPicked(e.target.files)} />
                <Upload className="h-5 w-5 text-muted-foreground mx-auto mb-1.5" />
                <p className="text-xs text-muted-foreground">Drag and drop PDF(s), or <span className="text-primary font-medium">browse</span></p>
              </div>

              {pendingFiles.length > 0 && <div className="space-y-1">
                  {pendingFiles.map((f, i) => <div key={i} className="flex items-center justify-between text-xs bg-secondary/50 rounded px-2 py-1">
                      <span className="truncate">{f.name}</span>
                      <button type="button" className="text-muted-foreground hover:text-destructive shrink-0 ml-2" onClick={() => setPendingFiles(prev => prev.filter((_, idx) => idx !== i))}>×</button>
                    </div>)}
                </div>}

              {docError && <p className="text-xs text-destructive">{docError}</p>}

              <div className="flex gap-2">
                <Input placeholder="Period (e.g. March 2024)" value={periodLabel} onChange={e => setPeriodLabel(e.target.value)} className="h-9 text-sm" />
                <Button size="sm" className="h-9 td-gradient border-0 text-white shrink-0" disabled={pendingFiles.length === 0 || uploading} onClick={handleUploadDocuments}>
                  {uploading ? "Sending..." : "Send"}
                </Button>
              </div>
            </div>}
        </DialogContent>
      </Dialog>
    </>;
}
