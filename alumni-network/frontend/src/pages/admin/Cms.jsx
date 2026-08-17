import { useEffect, useState } from "react";
import { PageHeader, EmptyState } from "@/components/ui-custom";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Edit, Trash2, Eye, FileText, HelpCircle, ChevronUp, ChevronDown } from "lucide-react";
const emptyPageForm = {
  title: "",
  slug: "",
  type: "Page",
  content: "",
  status: "draft"
};
const emptyFaqForm = {
  question: "",
  answer: "",
  published: true
};
export default function CMSPage() {
  const [activeTab, setActiveTab] = useState("pages");
  const [pages, setPages] = useState([]);
  const [pagesLoading, setPagesLoading] = useState(true);
  const [viewingPage, setViewingPage] = useState(null);
  const [editingPageId, setEditingPageId] = useState(null);
  const [openPage, setOpenPage] = useState(false);
  const [pageForm, setPageForm] = useState(emptyPageForm);
  const [pageSaving, setPageSaving] = useState(false);
  const [pageError, setPageError] = useState(null);
  const [faqs, setFaqs] = useState([]);
  const [faqsLoading, setFaqsLoading] = useState(true);
  const [openFaq, setOpenFaq] = useState(false);
  const [editingFaqId, setEditingFaqId] = useState(null);
  const [faqForm, setFaqForm] = useState(emptyFaqForm);
  const [faqSaving, setFaqSaving] = useState(false);
  const [faqError, setFaqError] = useState(null);
  const loadPages = async () => {
    setPagesLoading(true);
    const res = await fetch("/api/cms/pages");
    const data = await res.json();
    setPages(data.pages ?? []);
    setPagesLoading(false);
  };
  const loadFaqs = async () => {
    setFaqsLoading(true);
    const res = await fetch("/api/faqs");
    const data = await res.json();
    setFaqs(data.faqs ?? []);
    setFaqsLoading(false);
  };
  useEffect(() => {
    loadPages();
    loadFaqs();
  }, []);
  const openCreatePage = () => {
    setEditingPageId(null);
    setPageForm(emptyPageForm);
    setPageError(null);
    setOpenPage(true);
  };
  const openEditPage = p => {
    setEditingPageId(p.id);
    setPageForm({
      title: p.title,
      slug: p.slug,
      type: p.type,
      content: p.content,
      status: p.status
    });
    setPageError(null);
    setOpenPage(true);
  };
  const handleSavePage = async () => {
    if (!pageForm.title.trim() || !pageForm.slug.trim().startsWith("/")) {
      setPageError("Title and a URL slug starting with / are required.");
      return;
    }
    setPageSaving(true);
    setPageError(null);
    try {
      const res = await fetch(editingPageId ? `/api/cms/pages/${editingPageId}` : "/api/cms/pages", {
        method: editingPageId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(pageForm)
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Something went wrong.");
      }
      await loadPages();
      setOpenPage(false);
    } catch (err) {
      setPageError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setPageSaving(false);
    }
  };
  const handleDeletePage = async id => {
    if (!confirm("Delete this page? This cannot be undone.")) return;
    await fetch(`/api/cms/pages/${id}`, {
      method: "DELETE"
    });
    await loadPages();
  };
  const openCreateFaq = () => {
    setEditingFaqId(null);
    setFaqForm(emptyFaqForm);
    setFaqError(null);
    setOpenFaq(true);
  };
  const openEditFaq = f => {
    setEditingFaqId(f.id);
    setFaqForm({
      question: f.question,
      answer: f.answer,
      published: f.published
    });
    setFaqError(null);
    setOpenFaq(true);
  };
  const handleSaveFaq = async () => {
    if (!faqForm.question.trim() || !faqForm.answer.trim()) {
      setFaqError("Question and answer are required.");
      return;
    }
    setFaqSaving(true);
    setFaqError(null);
    try {
      const res = await fetch(editingFaqId ? `/api/faqs/${editingFaqId}` : "/api/faqs", {
        method: editingFaqId ? "PATCH" : "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify(faqForm)
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || "Something went wrong.");
      }
      await loadFaqs();
      setOpenFaq(false);
    } catch (err) {
      setFaqError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setFaqSaving(false);
    }
  };
  const handleDeleteFaq = async id => {
    if (!confirm("Delete this FAQ? This cannot be undone.")) return;
    await fetch(`/api/faqs/${id}`, {
      method: "DELETE"
    });
    await loadFaqs();
  };
  const handleTogglePublishFaq = async (id, published) => {
    await fetch(`/api/faqs/${id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        published
      })
    });
    await loadFaqs();
  };
  const handleMoveFaq = async (index, direction) => {
    const targetIndex = direction === "up" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= faqs.length) return;
    const current = faqs[index];
    const target = faqs[targetIndex];
    await Promise.all([fetch(`/api/faqs/${current.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        displayOrder: target.display_order
      })
    }), fetch(`/api/faqs/${target.id}`, {
      method: "PATCH",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        displayOrder: current.display_order
      })
    })]);
    await loadFaqs();
  };
  return <>
      <PageHeader title="CMS" description="Manage pages and FAQ content across the portal." breadcrumbs={[{
      label: "Admin Portal"
    }, {
      label: "CMS"
    }]}>
        {activeTab === "pages" && <Button className="td-gradient border-0 text-white gap-2 h-9" onClick={openCreatePage}>
            <Plus className="h-4 w-4" />New Page
          </Button>}
        {activeTab === "faq" && <Button className="td-gradient border-0 text-white gap-2 h-9" onClick={openCreateFaq}>
            <Plus className="h-4 w-4" />Add FAQ
          </Button>}
      </PageHeader>

      <Tabs defaultValue="pages" onValueChange={setActiveTab}>
        <TabsList className="mb-6">
          <TabsTrigger value="pages" className="gap-1.5"><FileText className="h-3.5 w-3.5" />Pages</TabsTrigger>
          <TabsTrigger value="faq" className="gap-1.5"><HelpCircle className="h-3.5 w-3.5" />FAQ</TabsTrigger>
        </TabsList>

        <TabsContent value="pages">
          <Card className="border-border">
            <CardHeader className="pb-3"><CardTitle className="text-base">{pages.length} Pages</CardTitle></CardHeader>
            <CardContent className="p-0">
              <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-border bg-secondary/30">
                    {["Title", "Slug", "Type", "Status", "Last Updated", "Actions"].map(h => <th key={h} className="text-left text-xs font-medium text-muted-foreground uppercase tracking-wide px-6 py-3">{h}</th>)}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {pagesLoading && <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-muted-foreground">Loading...</td></tr>}
                  {!pagesLoading && pages.length === 0 && <tr><td colSpan={6} className="px-6 py-8 text-center text-sm text-muted-foreground">No pages yet.</td></tr>}
                  {pages.map(p => <tr key={p.id} className="even:bg-muted/30 hover:bg-primary/5 transition-colors">
                      <td className="px-6 py-4">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-muted-foreground" />
                          <span className="text-sm font-medium text-foreground">{p.title}</span>
                        </div>
                      </td>
                      <td className="px-6 py-4 text-xs text-muted-foreground font-mono">{p.slug}</td>
                      <td className="px-6 py-4"><Badge variant="secondary" className="text-xs">{p.type}</Badge></td>
                      <td className="px-6 py-4">
                        <Badge className={`text-[10px] border-0 ${p.status === "published" ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400" : "bg-slate-100 text-slate-600"}`}>{p.status}</Badge>
                      </td>
                      <td className="px-6 py-4 text-xs text-muted-foreground">{new Date(p.updated_at).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric"
                      })}</td>
                      <td className="px-6 py-4">
                        <div className="flex gap-1">
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => setViewingPage(p)}><Eye className="h-3.5 w-3.5" /></Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0" onClick={() => openEditPage(p)}><Edit className="h-3.5 w-3.5" /></Button>
                          <Button size="sm" variant="ghost" className="h-7 w-7 p-0 text-destructive hover:text-destructive" onClick={() => handleDeletePage(p.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                        </div>
                      </td>
                    </tr>)}
                </tbody>
              </table>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="faq">
          <div className="space-y-3">
            {faqsLoading && <p className="text-sm text-muted-foreground">Loading FAQs...</p>}
            {!faqsLoading && faqs.length === 0 && <EmptyState icon={HelpCircle} title="No FAQs yet" description="Add questions and answers to show on the public landing page." />}
            {faqs.map((f, i) => <Card key={f.id} className="border-border">
                <CardContent className="p-5">
                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-center gap-0.5 pt-0.5 shrink-0">
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" disabled={i === 0} onClick={() => handleMoveFaq(i, "up")}><ChevronUp className="h-4 w-4" /></Button>
                      <span className="text-[10px] text-muted-foreground font-mono">{i + 1}</span>
                      <Button size="sm" variant="ghost" className="h-6 w-6 p-0" disabled={i === faqs.length - 1} onClick={() => handleMoveFaq(i, "down")}><ChevronDown className="h-4 w-4" /></Button>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-start justify-between gap-2 flex-wrap">
                        <h3 className="font-semibold text-foreground text-sm">{f.question}</h3>
                        <Badge variant="outline" className={f.published ? "text-xs border-emerald-200 text-emerald-600" : "text-xs border-border text-muted-foreground"}>
                          {f.published ? "Published" : "Draft"}
                        </Badge>
                      </div>
                      <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed">{f.answer}</p>
                    </div>
                    <div className="flex items-center gap-2 ml-auto shrink-0">
                      <Switch checked={f.published} onCheckedChange={checked => handleTogglePublishFaq(f.id, checked === true)} />
                      <Button size="sm" variant="outline" className="h-8 gap-1.5 text-xs" onClick={() => openEditFaq(f)}><Edit className="h-3.5 w-3.5" />Edit</Button>
                      <Button size="sm" variant="ghost" className="h-8 w-8 p-0 text-destructive hover:text-destructive" onClick={() => handleDeleteFaq(f.id)}><Trash2 className="h-3.5 w-3.5" /></Button>
                    </div>
                  </div>
                </CardContent>
              </Card>)}
          </div>
        </TabsContent>
      </Tabs>

      {/* Create/Edit Page Dialog */}
      <Dialog open={openPage} onOpenChange={setOpenPage}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingPageId ? "Edit Page" : "Create New Page"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5"><Label>Page Title *</Label><Input placeholder="e.g., About Us" value={pageForm.title} onChange={e => setPageForm(f => ({
              ...f,
              title: e.target.value
            }))} /></div>
            <div className="space-y-1.5"><Label>URL Slug *</Label><Input placeholder="e.g., /about" value={pageForm.slug} onChange={e => setPageForm(f => ({
              ...f,
              slug: e.target.value
            }))} /></div>
            <div className="space-y-1.5">
              <Label>Type</Label>
              <select className="w-full h-10 px-3 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring" value={pageForm.type} onChange={e => setPageForm(f => ({
              ...f,
              type: e.target.value
            }))}>
                <option value="Page">Page</option>
                <option value="Policy">Policy</option>
              </select>
            </div>
            <div className="space-y-1.5">
              <Label>Content</Label>
              <textarea className="w-full h-32 px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" placeholder="Page content (HTML or markdown)..." value={pageForm.content} onChange={e => setPageForm(f => ({
              ...f,
              content: e.target.value
            }))} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="font-normal">Publish immediately</Label>
              <Switch checked={pageForm.status === "published"} onCheckedChange={checked => setPageForm(f => ({
              ...f,
              status: checked ? "published" : "draft"
            }))} />
            </div>
            {pageError && <p className="text-sm text-destructive">{pageError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenPage(false)}>Cancel</Button>
            <Button className="td-gradient border-0 text-white" onClick={handleSavePage} disabled={pageSaving}>
              {pageSaving ? "Saving..." : editingPageId ? "Save Changes" : "Create Page"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* View Page Dialog */}
      <Dialog open={!!viewingPage} onOpenChange={o => !o && setViewingPage(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{viewingPage?.title}</DialogTitle></DialogHeader>
          {viewingPage && <div className="space-y-3 text-sm">
              <div className="grid grid-cols-2 gap-3">
                <div><p className="text-xs text-muted-foreground">Slug</p><p className="font-mono">{viewingPage.slug}</p></div>
                <div><p className="text-xs text-muted-foreground">Type</p><p>{viewingPage.type}</p></div>
                <div><p className="text-xs text-muted-foreground">Status</p><p className="capitalize">{viewingPage.status}</p></div>
                <div><p className="text-xs text-muted-foreground">Last Updated</p><p>{new Date(viewingPage.updated_at).toLocaleString()}</p></div>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Content</p>
                <p className="whitespace-pre-wrap text-foreground">{viewingPage.content || <span className="text-muted-foreground">No content yet.</span>}</p>
              </div>
            </div>}
        </DialogContent>
      </Dialog>

      {/* Create/Edit FAQ Dialog */}
      <Dialog open={openFaq} onOpenChange={setOpenFaq}>
        <DialogContent className="max-w-lg">
          <DialogHeader><DialogTitle>{editingFaqId ? "Edit FAQ" : "Add FAQ"}</DialogTitle></DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label>Question *</Label>
              <Input placeholder="e.g., Who can join the TechDemocracy Alumni Network?" value={faqForm.question} onChange={e => setFaqForm(f => ({
              ...f,
              question: e.target.value
            }))} />
            </div>
            <div className="space-y-1.5">
              <Label>Answer *</Label>
              <textarea className="w-full h-28 px-3 py-2 rounded-md border border-input bg-background text-sm focus:outline-none focus:ring-2 focus:ring-ring resize-none" placeholder="Write the answer shown to alumni..." value={faqForm.answer} onChange={e => setFaqForm(f => ({
              ...f,
              answer: e.target.value
            }))} />
            </div>
            <div className="flex items-center justify-between">
              <Label className="font-normal">Published (visible on public site)</Label>
              <Switch checked={faqForm.published} onCheckedChange={checked => setFaqForm(f => ({
              ...f,
              published: checked === true
            }))} />
            </div>
            {faqError && <p className="text-sm text-destructive">{faqError}</p>}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenFaq(false)}>Cancel</Button>
            <Button className="td-gradient border-0 text-white" onClick={handleSaveFaq} disabled={faqSaving}>
              {faqSaving ? "Saving..." : editingFaqId ? "Save Changes" : "Add FAQ"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>;
}
