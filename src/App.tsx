import { useState, useCallback, useEffect } from 'react';
import {
  BookOpen,
  Home,
  Tags,
  Collection,
  MessageSquare,
  User,
  FileText,
  Layers,
  Send,
  Copy,
  Check,
  ChevronDown,
  ChevronRight,
  Code2,
  Server,
  Zap,
  ExternalLink,
} from 'lucide-react';

interface Endpoint {
  id: string;
  method: 'GET';
  path: string;
  label: string;
  description: string;
  category: string;
  icon: typeof BookOpen;
  params?: { name: string; placeholder: string; required: boolean }[];
  queryParams?: { name: string; placeholder: string; defaultValue?: string }[];
}

const ENDPOINTS: Endpoint[] = [
  { id: 'home', method: 'GET', path: '/api/home', label: 'Home', description: 'Trending, hot, latest, recent comments, trending collections, and top uploaders.', category: 'Discovery', icon: Home },
  { id: 'genres', method: 'GET', path: '/api/genres', label: 'Genres', description: 'All genres and demographics with manga counts.', category: 'Discovery', icon: Tags },
  { id: 'manga', method: 'GET', path: '/api/manga/:hid', label: 'Manga Detail', description: 'Full manga details, synopsis, genres, tags, recommendations, and scanlation groups.', category: 'Manga', icon: BookOpen, params: [{ name: 'hid', placeholder: 'vy36n', required: true }] },
  { id: 'chapter', method: 'GET', path: '/api/chapter/:hid/:chapterSlug', label: 'Chapter', description: 'Chapter read metadata and the parent manga detail.', category: 'Manga', icon: FileText, params: [{ name: 'hid', placeholder: 'vy36n-the-tyrants-overprotective-contract-mother', required: true }, { name: 'chapterSlug', placeholder: '5931836-chapter-1', required: true }] },
  { id: 'collections', method: 'GET', path: '/api/collections', label: 'Collections (HTML)', description: 'Collections listing scraped from the collections page.', category: 'Collections', icon: Collection },
  { id: 'collectionsList', method: 'GET', path: '/api/collections/list', label: 'Collections (API)', description: 'Paginated collections via the upstream public API.', category: 'Collections', icon: Layers, queryParams: [{ name: 'sort', placeholder: 'trending', defaultValue: 'trending' }, { name: 'page', placeholder: '1', defaultValue: '1' }, { name: 'limit', placeholder: '20', defaultValue: '20' }] },
  { id: 'collection', method: 'GET', path: '/api/collection/:id', label: 'Collection Detail', description: 'A single collection with owner, cover, and preview of contained manga.', category: 'Collections', icon: Collection, params: [{ name: 'id', placeholder: '75221', required: true }] },
  { id: 'comments', method: 'GET', path: '/api/comments', label: 'Comments', description: 'Recent site-wide comments via the upstream public API. Paginated.', category: 'Community', icon: MessageSquare, queryParams: [{ name: 'page', placeholder: '1', defaultValue: '1' }, { name: 'limit', placeholder: '20', defaultValue: '20' }] },
  { id: 'profile', method: 'GET', path: '/api/profile/:hashId', label: 'User Profile', description: 'A user profile by hashId.', category: 'Community', icon: User, params: [{ name: 'hashId', placeholder: 'qlkv9d', required: true }] },
];

const CATEGORIES = ['Discovery', 'Manga', 'Collections', 'Community'] as const;

const CATEGORY_STYLES: Record<string, { dot: string; activeBg: string; activeText: string; activeRing: string; activeIcon: string }> = {
  Discovery: { dot: 'bg-emerald-400', activeBg: 'bg-emerald-500/15', activeText: 'text-emerald-300', activeRing: 'ring-emerald-500/30', activeIcon: 'text-emerald-400' },
  Manga: { dot: 'bg-sky-400', activeBg: 'bg-sky-500/15', activeText: 'text-sky-300', activeRing: 'ring-sky-500/30', activeIcon: 'text-sky-400' },
  Collections: { dot: 'bg-amber-400', activeBg: 'bg-amber-500/15', activeText: 'text-amber-300', activeRing: 'ring-amber-500/30', activeIcon: 'text-amber-400' },
  Community: { dot: 'bg-rose-400', activeBg: 'bg-rose-500/15', activeText: 'text-rose-300', activeRing: 'ring-rose-500/30', activeIcon: 'text-rose-400' },
};

function buildUrl(ep: Endpoint, pv: Record<string, string>, qv: Record<string, string>): string {
  let url = ep.path;
  if (ep.params) for (const p of ep.params) url = url.replace(`:${p.name}`, pv[p.name] || p.placeholder);
  if (ep.queryParams && ep.queryParams.length > 0) {
    const qs = ep.queryParams.map((q) => `${q.name}=${qv[q.name] || q.defaultValue || ''}`).join('&');
    url += `?${qs}`;
  }
  return url;
}

function App() {
  const [selectedId, setSelectedId] = useState('home');
  const [paramValues, setParamValues] = useState<Record<string, string>>({});
  const [queryValues, setQueryValues] = useState<Record<string, string>>({});
  const [response, setResponse] = useState<unknown>(null);
  const [rawText, setRawText] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});
  const [viewMode, setViewMode] = useState<'pretty' | 'raw'>('pretty');

  const selected = ENDPOINTS.find((e) => e.id === selectedId)!;
  const currentUrl = buildUrl(selected, paramValues, queryValues);
  const SelectedIcon = selected.icon;

  const fetchEndpoint = useCallback(async (url: string) => {
    setLoading(true);
    setError(null);
    setResponse(null);
    setRawText('');
    try {
      const res = await fetch(url);
      const text = await res.text();
      setRawText(text);
      if (!res.ok) setError(`HTTP ${res.status} ${res.statusText}`);
      try {
        const json = JSON.parse(text);
        setResponse(json);
        if (!res.ok && json.error) setError(json.error);
      } catch {
        setResponse({ raw: text });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Network error');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchEndpoint('/api/home'); }, [fetchEndpoint]);

  const handleSelect = (ep: Endpoint) => {
    setSelectedId(ep.id);
    setParamValues({});
    setQueryValues({});
    setError(null);
    fetchEndpoint(buildUrl(ep, {}, {}));
  };

  const copyUrl = () => {
    navigator.clipboard.writeText(window.location.origin + currentUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const toggleExpand = (key: string) => setExpanded((p) => ({ ...p, [key]: !p[key] }));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="sticky top-0 z-50 border-b border-slate-800 bg-slate-950/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-emerald-400 to-sky-500 shadow-lg shadow-emerald-500/20">
              <BookOpen className="h-5 w-5 text-slate-950" strokeWidth={2.5} />
            </div>
            <div>
              <h1 className="text-lg font-bold tracking-tight">Comix API</h1>
              <p className="text-xs text-slate-400">Scraping API for comix.to</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <span className="hidden items-center gap-1.5 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-3 py-1 text-xs font-medium text-emerald-400 sm:flex">
              <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Live
            </span>
            <a href="https://comix.to" target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs font-medium text-slate-300 transition hover:border-slate-600 hover:bg-slate-800">
              <ExternalLink className="h-3.5 w-3.5" />
              Source
            </a>
          </div>
        </div>
      </header>
      <div className="mx-auto flex max-w-7xl flex-col gap-6 px-4 py-6 sm:px-6 lg:flex-row">
        <aside className="lg:w-72 lg:shrink-0">
          <div className="lg:sticky lg:top-20">
            <div className="mb-4 flex items-center gap-2 px-1">
              <Server className="h-4 w-4 text-slate-400" />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-400">Endpoints</h2>
            </div>
            <nav className="space-y-5">
              {CATEGORIES.map((cat) => {
                const s = CATEGORY_STYLES[cat];
                const eps = ENDPOINTS.filter((e) => e.category === cat);
                return (
                  <div key={cat}>
                    <div className="mb-2 flex items-center gap-2 px-1">
                      <span className={`h-2 w-2 rounded-full ${s.dot}`} />
                      <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">{cat}</span>
                    </div>
                    <div className="space-y-1">
                      {eps.map((ep) => {
                        const Icon = ep.icon;
                        const active = ep.id === selectedId;
                        return (
                          <button key={ep.id} onClick={() => handleSelect(ep)} className={`group flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition ${active ? `${s.activeBg} ${s.activeText} ring-1 ${s.activeRing}` : 'text-slate-400 hover:bg-slate-800/60 hover:text-slate-200'}`}>
                            <Icon className={`h-4 w-4 shrink-0 ${active ? s.activeIcon : 'text-slate-500 group-hover:text-slate-300'}`} />
                            <span className="font-medium">{ep.label}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </nav>
          </div>
        </aside>
        <main className="min-w-0 flex-1 space-y-5">
          <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <div className="mb-2 flex items-center gap-2">
                  <span className="rounded-md bg-emerald-500/15 px-2 py-0.5 text-xs font-bold text-emerald-400 ring-1 ring-emerald-500/30">{selected.method}</span>
                  <code className="truncate text-sm font-mono text-slate-300">{selected.path}</code>
                </div>
                <h3 className="text-lg font-bold text-slate-100">{selected.label}</h3>
                <p className="mt-1 text-sm text-slate-400">{selected.description}</p>
              </div>
              <SelectedIcon className="hidden h-8 w-8 shrink-0 text-slate-600 sm:block" />
            </div>
            {(selected.params || selected.queryParams) && (
              <div className="mt-4 space-y-3">
                {selected.params && selected.params.length > 0 && (
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Path Parameters</label>
                    <div className="grid gap-2 sm:grid-cols-2">
                      {selected.params.map((p) => (
                        <div key={p.name}>
                          <div className="mb-1 flex items-center gap-1">
                            <code className="text-xs font-mono text-sky-400">{p.name}</code>
                            {p.required && <span className="text-xs text-rose-400">*</span>}
                          </div>
                          <input type="text" placeholder={p.placeholder} value={paramValues[p.name] || ''} onChange={(e) => setParamValues((prev) => ({ ...prev, [p.name]: e.target.value }))} className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 font-mono text-sm text-slate-100 placeholder-slate-600 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {selected.queryParams && selected.queryParams.length > 0 && (
                  <div>
                    <label className="mb-1.5 block text-xs font-semibold uppercase tracking-wider text-slate-500">Query Parameters</label>
                    <div className="grid gap-2 sm:grid-cols-3">
                      {selected.queryParams.map((q) => (
                        <div key={q.name}>
                          <code className="mb-1 block text-xs font-mono text-amber-400">{q.name}</code>
                          <input type="text" placeholder={q.placeholder} value={queryValues[q.name] || q.defaultValue || ''} onChange={(e) => setQueryValues((prev) => ({ ...prev, [q.name]: e.target.value }))} className="w-full rounded-lg border border-slate-700 bg-slate-800/50 px-3 py-2 font-mono text-sm text-slate-100 placeholder-slate-600 outline-none transition focus:border-emerald-500 focus:ring-2 focus:ring-emerald-500/20" />
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}
            <div className="mt-4 flex items-stretch gap-2">
              <div className="flex flex-1 items-center gap-2 rounded-lg border border-slate-700 bg-slate-950 px-3 py-2.5">
                <span className="text-xs font-bold text-slate-500">GET</span>
                <code className="flex-1 truncate font-mono text-sm text-emerald-400">{currentUrl}</code>
                <button onClick={copyUrl} className="shrink-0 rounded p-1 text-slate-500 transition hover:bg-slate-800 hover:text-slate-300" title="Copy full URL">
                  {copied ? <Check className="h-4 w-4 text-emerald-400" /> : <Copy className="h-4 w-4" />}
                </button>
              </div>
              <button onClick={() => fetchEndpoint(currentUrl)} disabled={loading} className="flex items-center gap-2 rounded-lg bg-gradient-to-r from-emerald-500 to-sky-500 px-5 py-2.5 text-sm font-semibold text-slate-950 shadow-lg shadow-emerald-500/20 transition hover:from-emerald-400 hover:to-sky-400 disabled:opacity-50">
                {loading ? <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" /> : <Send className="h-4 w-4" />}
                Send
              </button>
            </div>
          </section>
          <section className="rounded-2xl border border-slate-800 bg-slate-900/50 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-800 px-5 py-3">
              <div className="flex items-center gap-2">
                <Code2 className="h-4 w-4 text-slate-400" />
                <h3 className="text-sm font-semibold text-slate-200">Response</h3>
                {response && !error && <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-xs font-medium text-emerald-400">200 OK</span>}
                {error && <span className="rounded-full bg-rose-500/15 px-2 py-0.5 text-xs font-medium text-rose-400">{error}</span>}
              </div>
              <div className="flex items-center gap-1 rounded-lg border border-slate-700 p-0.5">
                <button onClick={() => setViewMode('pretty')} className={`rounded px-2.5 py-1 text-xs font-medium transition ${viewMode === 'pretty' ? 'bg-slate-700 text-slate-100' : 'text-slate-400 hover:text-slate-200'}`}>Pretty</button>
                <button onClick={() => setViewMode('raw')} className={`rounded px-2.5 py-1 text-xs font-medium transition ${viewMode === 'raw' ? 'bg-slate-700 text-slate-100' : 'text-slate-400 hover:text-slate-200'}`}>Raw</button>
              </div>
            </div>
            <div className="max-h-[600px] overflow-auto p-5">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <div className="flex flex-col items-center gap-3">
                    <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-700 border-t-emerald-400" />
                    <p className="text-sm text-slate-500">Fetching from comix.to...</p>
                  </div>
                </div>
              ) : error && !response ? (
                <div className="py-16 text-center"><p className="text-sm text-rose-400">{error}</p></div>
              ) : viewMode === 'raw' ? (
                <pre className="whitespace-pre-wrap break-words font-mono text-xs leading-relaxed text-slate-300">{rawText}</pre>
              ) : (
                <PrettyJson data={response} expanded={expanded} toggleExpand={toggleExpand} depth={0} />
              )}
            </div>
          </section>
          <section className="rounded-2xl border border-slate-800 bg-slate-900/50 p-5 shadow-xl">
            <div className="mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-amber-400" />
              <h3 className="text-sm font-semibold text-slate-200">Quick Start</h3>
            </div>
            <div className="space-y-2 text-sm text-slate-400">
              <p>This API scrapes comix.to by parsing embedded JSON in its HTML pages. No API key required.</p>
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                <p className="mb-1 text-xs text-slate-500">Fetch trending manga:</p>
                <code className="font-mono text-xs text-emerald-400">curl https://your-domain.com/api/home</code>
              </div>
              <div className="rounded-lg border border-slate-800 bg-slate-950 p-3">
                <p className="mb-1 text-xs text-slate-500">Get manga details by hid:</p>
                <code className="font-mono text-xs text-emerald-400">curl https://your-domain.com/api/manga/vy36n</code>
              </div>
            </div>
          </section>
        </main>
      </div>
      <footer className="border-t border-slate-800 py-6">
        <div className="mx-auto flex max-w-7xl flex-col items-center justify-between gap-3 px-4 text-xs text-slate-500 sm:flex-row sm:px-6">
          <p>Comix Scraping API - for educational purposes. Data belongs to comix.to.</p>
          <div className="flex items-center gap-4">
            <span>{ENDPOINTS.length} endpoints</span>
            <span>Zero dependencies</span>
            <span>Vercel &amp; Render ready</span>
          </div>
        </div>
      </footer>
    </div>
  );
}

function PrettyJson({ data, expanded, toggleExpand, depth, path = '' }: { data: unknown; expanded: Record<string, boolean>; toggleExpand: (key: string) => void; depth: number; path?: string }) {
  if (data === null) return <span className="text-slate-500">null</span>;
  if (typeof data === 'boolean') return <span className="text-amber-400">{String(data)}</span>;
  if (typeof data === 'number') return <span className="text-sky-400">{data}</span>;
  if (typeof data === 'string') {
    const display = data.length > 200 ? data.slice(0, 200) + '...' : data;
    return <span className="text-emerald-300">{JSON.stringify(display)}</span>;
  }
  if (Array.isArray(data)) {
    if (data.length === 0) return <span className="text-slate-500">[]</span>;
    const key = path || 'root';
    const isOpen = expanded[key] ?? depth < 1;
    return (
      <div className="inline-block">
        <button onClick={() => toggleExpand(key)} className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-200">
          {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <span className="text-slate-500">[</span>
          <span className="text-xs text-slate-600">{data.length}</span>
          {!isOpen && <span className="text-slate-500">]</span>}
        </button>
        {isOpen && (
          <div className="ml-4 border-l border-slate-800 pl-3">
            {data.map((item, i) => (
              <div key={i} className="py-0.5">
                <span className="text-slate-600">{i}: </span>
                <PrettyJson data={item} expanded={expanded} toggleExpand={toggleExpand} depth={depth + 1} path={`${key}[${i}]`} />
              </div>
            ))}
            <span className="text-slate-500">]</span>
          </div>
        )}
      </div>
    );
  }
  if (typeof data === 'object') {
    const entries = Object.entries(data as Record<string, unknown>);
    if (entries.length === 0) return <span className="text-slate-500">{`{}`}</span>;
    const key = path || 'root';
    const isOpen = expanded[key] ?? depth < 1;
    return (
      <div className="inline-block">
        <button onClick={() => toggleExpand(key)} className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-200">
          {isOpen ? <ChevronDown className="h-3 w-3" /> : <ChevronRight className="h-3 w-3" />}
          <span className="text-slate-500">{`{`}</span>
          <span className="text-xs text-slate-600">{entries.length}</span>
          {!isOpen && <span className="text-slate-500">{`}`}</span>}
        </button>
        {isOpen && (
          <div className="ml-4 border-l border-slate-800 pl-3">
            {entries.map(([k, v]) => (
              <div key={k} className="py-0.5">
                <span className="text-sky-400">{JSON.stringify(k)}</span>
                <span className="text-slate-500">: </span>
                <PrettyJson data={v} expanded={expanded} toggleExpand={toggleExpand} depth={depth + 1} path={`${key}.${k}`} />
              </div>
            ))}
            <span className="text-slate-500">{`}`}</span>
          </div>
        )}
      </div>
    );
  }
  return <span>{String(data)}</span>;
}

export default App;
