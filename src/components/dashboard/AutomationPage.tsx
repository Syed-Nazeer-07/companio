import React, { useState } from 'react';
import { TOOL_CATALOG, ToolSchema } from '../../services/toolCatalog';
import { desktopBridge } from '../../services/desktopBridge';
import { Play, CheckCircle2, AlertCircle, ShieldCheck, Search } from 'lucide-react';

export const AutomationPage: React.FC = () => {
  const [selectedCategory, setSelectedCategory] = useState<string>('All');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [testingToolId, setTestingToolId] = useState<string | null>(null);
  const [testResults, setTestResults] = useState<Record<string, any>>({});

  const categories = ['All', 'Browser', 'Windows Apps', 'Audio & Media', 'System'];

  const filteredTools = TOOL_CATALOG.filter((tool) => {
    const matchesCategory = selectedCategory === 'All' || tool.category === selectedCategory;
    const matchesQuery = 
      tool.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
      tool.id.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesCategory && matchesQuery;
  });

  const handleTestTool = async (tool: ToolSchema) => {
    setTestingToolId(tool.id);
    setTestResults((prev) => ({ ...prev, [tool.id]: { loading: true } }));

    // Prepare sample params
    let params: Record<string, any> = {};
    if (tool.id === 'browser.youtube.search_and_play') {
      params = { creator: 'CarryMinati', topic: '' };
    } else if (tool.id === 'browser.youtube.control') {
      params = { action: 'pause' };
    } else if (tool.id === 'browser.search_google') {
      params = { query: 'Windows 11 ARM64 Snapdragon X Elite' };
    } else if (tool.id === 'browser.open_url') {
      params = { url: 'https://github.com' };
    } else if (tool.id === 'win.explorer.open') {
      params = { folder: 'downloads' };
    } else if (tool.id === 'win.volume.set') {
      params = { level: 60 };
    } else if (tool.id === 'win.volume.mute') {
      params = { mute: false };
    } else if (tool.id === 'win.spotify.play_track') {
      params = { query: 'Graffitia Green Day' };
    } else if (tool.id === 'win.media.control') {
      params = { action: 'play' };
    }

    const missing = tool.parameters.filter((parameter) => parameter.required && !(parameter.name in params));
    if (missing.length || tool.id.startsWith('utility.') ||
        ['win.system.lock', 'win.recyclebin.empty', 'win.clipboard.clear'].includes(tool.id)) {
      setTestResults((prev) => ({ ...prev, [tool.id]: {
        loading: false, success: false, verified: false,
        error: missing.length ? 'Test inputs required: ' + missing.map((x) => x.name).join(', ')
          : 'This action requires a direct command or confirmation, not a one-click test.'
      } }));
      setTestingToolId(null);
      return;
    }
    try {
      const result = await desktopBridge.executeTool(tool.id, params);
      setTestResults((prev) => ({
        ...prev,
        [tool.id]: {
          loading: false,
          success: result?.success === true && result?.verified === true,
          message: result?.message || 'Operation executed',
          error: result?.error,
          verified: result?.verified === true
        }
      }));
    } catch (err: any) {
      setTestResults((prev) => ({
        ...prev,
        [tool.id]: {
          loading: false,
          success: false,
          error: err.message,
          verified: false
        }
      }));
    } finally {
      setTestingToolId(null);
    }
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-200">
      <header className="workspace-heading">
        <h1>Tools</h1>
        <p>Explore supported Windows and browser actions and test them on the desktop.</p>
      </header>

      {/* Filter and Search Bar */}
      <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
        {/* Category Pills */}
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              aria-pressed={selectedCategory === cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedCategory === cat
                  ? 'bg-teal-700 text-white shadow-sm'
                  : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full lg:w-56 lg:shrink-0">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            aria-label="Search tools"
            placeholder="Search tools…"
            className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-teal-500 shadow-sm"
          />
        </div>
      </div>

      {filteredTools.length === 0 && (
        <p role="status" className="workspace-panel rounded-xl p-5 text-sm text-slate-600">
          No tools match your search. Try another term or category.
        </p>
      )}

      {/* Tool Catalog List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredTools.map((tool) => {
          const testStatus = testResults[tool.id];
          const isTesting = testingToolId === tool.id;

          return (
            <div key={tool.id} className="workspace-panel rounded-2xl p-5 flex flex-col justify-between">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[11px] font-bold px-2 py-0.5 rounded-full bg-teal-50 text-teal-700 uppercase tracking-wider border border-teal-200">
                    {tool.category}
                  </span>
                  <span className="text-[11px] text-slate-400 font-mono truncate">
                    {tool.id}
                  </span>
                </div>

                <h3 className="text-base font-bold text-slate-900 mb-1.5">
                  {tool.name}
                </h3>
                <p className="text-xs text-slate-600 leading-relaxed mb-3">
                  {tool.description}
                </p>

                {/* Permissions & Security */}
                <div className="flex flex-wrap gap-1.5 mb-4">
                  {tool.permissionsRequired.map((perm) => (
                    <span key={perm} className="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
                      <ShieldCheck className="w-3 h-3 text-emerald-600" />
                      {perm}
                    </span>
                  ))}
                </div>
              </div>

              {/* Bottom Test & Status Bar */}
              <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                <button
                  onClick={() => handleTestTool(tool)}
                  disabled={isTesting}
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-teal-50 hover:bg-teal-100 text-teal-700 border border-teal-200 text-xs font-bold transition-all disabled:opacity-50"
                >
                  <Play className={`w-3.5 h-3.5 fill-current ${isTesting ? 'animate-spin' : ''}`} />
                  <span>{isTesting ? 'Verifying...' : 'Test Action'}</span>
                </button>

                {testStatus && (
                  <div className="text-xs truncate flex items-center gap-1.5">
                    {testStatus.loading ? (
                      <span className="text-teal-600 animate-pulse text-[11px] font-medium">Executing on desktop...</span>
                    ) : testStatus.success ? (
                      <span className="text-emerald-600 flex items-center gap-1 font-bold text-[11px]">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        Verified ✓
                      </span>
                    ) : (
                      <span className="text-rose-600 flex items-center gap-1 font-bold text-[11px]" title={testStatus.error}>
                        <AlertCircle className="w-3.5 h-3.5" />
                        Failed
                      </span>
                    )}
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};
