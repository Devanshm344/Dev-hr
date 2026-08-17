import { useEffect, useState } from "react";
import { PageHeader, EmptyState } from "@/components/ui-custom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { FileText, Download } from "lucide-react";

const DOC_TYPE_LABELS = {
  salary_certificate: "Salary Certificate"
};

function formatFileSize(bytes) {
  if (!bytes) return "";
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(dateStr) {
  return new Date(dateStr).toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function DocumentsPage() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/documents")
      .then(res => res.json())
      .then(data => setDocuments(data.documents ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  return <>
      <PageHeader
        title="Documents"
        description="Salary certificates and other documents shared with you by HR."
        breadcrumbs={[{ label: "Alumni Portal" }, { label: "Documents" }]}
      />

      {loading && <p className="text-sm text-muted-foreground">Loading documents...</p>}

      {!loading && documents.length === 0 && (
        <EmptyState icon={FileText} title="No documents yet" description="Documents that HR sends you, like salary certificates, will show up here." />
      )}

      {!loading && documents.length > 0 && <div className="space-y-3">
          {documents.map(d => <Card key={d.id} className="border-border hover:shadow-sm transition-all">
              <CardContent className="p-4 flex items-center justify-between gap-4">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                    <FileText className="h-5 w-5 text-primary" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-foreground truncate">
                      {DOC_TYPE_LABELS[d.doc_type] || d.doc_type}{d.period_label ? ` — ${d.period_label}` : ""}
                    </p>
                    <p className="text-xs text-muted-foreground truncate">
                      {d.original_filename} · {formatFileSize(d.file_size_bytes)} · Sent {formatDate(d.uploaded_at)}
                    </p>
                  </div>
                </div>
                <Button size="sm" variant="outline" className="gap-1.5 h-9 shrink-0" asChild>
                  <a href={`/api/documents/${d.id}/download`} target="_blank" rel="noreferrer">
                    <Download className="h-3.5 w-3.5" />Download
                  </a>
                </Button>
              </CardContent>
            </Card>)}
        </div>}
    </>;
}
