import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { PageHeader } from "@/components/ui-custom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Search, ArrowRight, Briefcase, BookOpen, Globe, Shield, Award, TrendingUp, Heart, LifeBuoy, Plane, ShoppingBag, Laptop, DollarSign, Trophy, Activity, Home, Monitor, GraduationCap, Grid, Share2, Users, FileText, Download } from "lucide-react";
import { cn } from "@/lib/utils";

function formatFileSize(bytes) {
  if (!bytes) return "";
  return bytes < 1024 * 1024 ? `${Math.round(bytes / 1024)} KB` : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
const iconMap = {
  Briefcase,
  BookOpen,
  Globe,
  Shield,
  Award,
  TrendingUp,
  Heart,
  LifeBuoy,
  Plane,
  ShoppingBag,
  Laptop,
  DollarSign,
  Trophy,
  Activity,
  Home,
  Monitor,
  GraduationCap,
  Grid,
  Share2,
  Users,
  Search,
  MessageSquare: Search
};
const colorMap = {
  blue: "bg-gradient-to-br from-blue-100 to-blue-50 text-blue-600 dark:from-blue-900/40 dark:to-blue-950/30 dark:text-blue-400",
  green: "bg-gradient-to-br from-emerald-100 to-emerald-50 text-emerald-600 dark:from-emerald-900/40 dark:to-emerald-950/30 dark:text-emerald-400",
  orange: "bg-gradient-to-br from-orange-100 to-orange-50 text-orange-600 dark:from-orange-900/40 dark:to-orange-950/30 dark:text-orange-400",
  red: "bg-gradient-to-br from-red-100 to-red-50 text-red-600 dark:from-red-900/40 dark:to-red-950/30 dark:text-red-400",
  purple: "bg-gradient-to-br from-violet-100 to-violet-50 text-violet-600 dark:from-violet-900/40 dark:to-violet-950/30 dark:text-violet-400",
  yellow: "bg-gradient-to-br from-amber-100 to-amber-50 text-amber-600 dark:from-amber-900/40 dark:to-amber-950/30 dark:text-amber-400"
};
const categories = ["All", "Career", "Education", "Networking", "Wellness", "Lifestyle", "Financial", "Recognition"];
export default function BenefitsPage() {
  const [searchParams] = useSearchParams();
  const [search, setSearch] = useState(searchParams.get("q") ?? "");
  const [category, setCategory] = useState("All");
  const [benefits, setBenefits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [detailsBenefit, setDetailsBenefit] = useState(null);
  const [resourcesBenefit, setResourcesBenefit] = useState(null);
  const [myResources, setMyResources] = useState([]);
  const [resourcesLoading, setResourcesLoading] = useState(false);
  const [resourcesError, setResourcesError] = useState(null);
  useEffect(() => {
    fetch("/api/benefits?active=true").then(res => res.json()).then(data => setBenefits(data.benefits ?? [])).catch(() => {}).finally(() => setLoading(false));
  }, []);
  const openResources = async benefit => {
    setResourcesBenefit(benefit);
    setResourcesLoading(true);
    setResourcesError(null);
    try {
      const res = await fetch(`/api/benefits/${benefit.id}/my-resources`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Could not load resources.");
      setMyResources(data.resources ?? []);
    } catch (err) {
      setResourcesError(err instanceof Error ? err.message : "Could not load resources.");
    } finally {
      setResourcesLoading(false);
    }
  };
  const filtered = benefits.filter(b => {
    const matchSearch = b.title.toLowerCase().includes(search.toLowerCase()) || b.description.toLowerCase().includes(search.toLowerCase());
    const matchCat = category === "All" || b.category === category;
    return matchSearch && matchCat;
  });
  return <>
      <PageHeader title="Benefits" description="Explore and access resources from 25+ exclusive alumni benefits." breadcrumbs={[{
      label: "Portal"
    }, {
      label: "Benefits"
    }]} />

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-3 mb-6">
        <div className="relative flex-1 max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Search benefits..." className="pl-9" value={search} onChange={e => setSearch(e.target.value)} />
        </div>
        <div className="flex gap-2 flex-wrap">
          {categories.map(cat => <Button key={cat} size="sm" variant={category === cat ? "default" : "outline"} onClick={() => setCategory(cat)} className={cn("h-9", category === cat && "td-gradient border-0 text-white")}>
              {cat}
            </Button>)}
        </div>
      </div>

      <div className="mb-4 text-sm text-muted-foreground">{loading ? "Loading..." : `${filtered.length} benefit${filtered.length !== 1 ? "s" : ""} found`}</div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5">
        {filtered.map(benefit => {
        const Icon = iconMap[benefit.icon] ?? Briefcase;
        const iconClass = colorMap[benefit.color] ?? colorMap.blue;
        return <Card key={benefit.id} className="border-border hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200 group flex flex-col">
              <CardContent className="p-5 flex flex-col flex-1">
                <div className="flex items-start justify-between mb-3">
                  <div className={cn("w-11 h-11 rounded-xl flex items-center justify-center shrink-0 group-hover:scale-110 transition-transform", iconClass)}>
                    <Icon className="h-5 w-5" />
                  </div>
                  <Badge variant="secondary" className="text-xs">{benefit.category}</Badge>
                </div>
                <h3 className="font-semibold text-foreground leading-snug">{benefit.title}</h3>
                <p className="text-sm text-muted-foreground mt-1.5 leading-relaxed line-clamp-3">{benefit.description}</p>
                <div className="flex gap-2 pt-4 mt-auto">
                  <Button variant="outline" size="sm" className="flex-1 h-8 text-xs gap-1" onClick={() => setDetailsBenefit(benefit)}>
                    Learn More<ArrowRight className="h-3 w-3" />
                  </Button>
                  <Button size="sm" className="flex-1 h-8 text-xs gap-1 td-gradient border-0 text-white" onClick={() => openResources(benefit)}>
                    <FileText className="h-3 w-3" />Resources
                  </Button>
                </div>
              </CardContent>
            </Card>;
      })}
      </div>

      <Dialog open={!!detailsBenefit} onOpenChange={open => !open && setDetailsBenefit(null)}>
        <DialogContent>
          {detailsBenefit && (() => {
          const Icon = iconMap[detailsBenefit.icon] ?? Briefcase;
          const iconClass = colorMap[detailsBenefit.color] ?? colorMap.blue;
          return <>
                <DialogHeader>
                  <div className={cn("w-12 h-12 rounded-xl flex items-center justify-center mb-2", iconClass)}>
                    <Icon className="h-6 w-6" />
                  </div>
                  <DialogTitle>{detailsBenefit.title}</DialogTitle>
                  <Badge variant="secondary" className="text-xs w-fit">{detailsBenefit.category}</Badge>
                  <DialogDescription className="pt-2 text-sm leading-relaxed text-foreground/80">
                    {detailsBenefit.description}
                  </DialogDescription>
                </DialogHeader>
                <div className="flex justify-end gap-2 mt-2">
                  <Button variant="outline" size="sm" onClick={() => setDetailsBenefit(null)}>Close</Button>
                  <Button size="sm" className="td-gradient border-0 text-white gap-1.5" onClick={() => {
                openResources(detailsBenefit);
                setDetailsBenefit(null);
              }}>
                    <FileText className="h-3.5 w-3.5" />View Resources
                  </Button>
                </div>
              </>;
        })()}
        </DialogContent>
      </Dialog>

      <Dialog open={!!resourcesBenefit} onOpenChange={o => !o && setResourcesBenefit(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Resources — {resourcesBenefit?.title}</DialogTitle></DialogHeader>
          {resourcesLoading && <p className="text-sm text-muted-foreground">Loading...</p>}
          {resourcesError && <p className="text-sm text-destructive">{resourcesError}</p>}
          {!resourcesLoading && !resourcesError && myResources.length === 0 && <p className="text-sm text-muted-foreground">No resources have been added for this benefit yet.</p>}
          {!resourcesLoading && myResources.length > 0 && <div className="space-y-2">
              {myResources.map(r => <div key={r.id} className="flex items-center justify-between gap-2 rounded-lg border border-border px-3 py-2.5">
                  <div className="flex items-center gap-2 min-w-0">
                    <FileText className="h-4 w-4 text-primary shrink-0" />
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">{r.original_filename}</p>
                      <p className="text-xs text-muted-foreground">{formatFileSize(r.file_size_bytes)}</p>
                    </div>
                  </div>
                  <Button size="sm" variant="outline" className="h-8 gap-1.5 shrink-0" asChild>
                    <a href={`/api/benefits/resources/${r.id}/download`} target="_blank" rel="noreferrer"><Download className="h-3.5 w-3.5" />Download</a>
                  </Button>
                </div>)}
            </div>}
          <div className="flex justify-end mt-2">
            <Button variant="outline" size="sm" onClick={() => setResourcesBenefit(null)}>Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    </>;
}
