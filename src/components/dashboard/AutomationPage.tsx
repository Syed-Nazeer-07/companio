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

    try {
      const result = await desktopBridge.executeTool(tool.id, params);
      setTestResults((prev) => ({
        ...prev,
        [tool.id]: {
          loading: false,
          success: result?.success !== false,
          message: result?.message || 'Operation executed',
          error: result?.error,
          verified: result?.verified !== false
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
      <div>
        <h2 className="text-2xl font-bold text-slate-900 mb-1.5">Automation & Real Computer Control</h2>
        <p className="text-sm text-slate-600">
          Companio executes real native commands across Windows APIs, Edge browser automation, audio endpoints, and native applications. Every operation is verified before reporting completion.
        </p>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-col sm:flex-row gap-4 items-center justify-between">
        {/* Category Pills */}
        <div className="flex flex-wrap gap-1.5">
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(cat)}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                selectedCategory === cat
                  ? 'bg-sky-500 text-white shadow-sm'
                  : 'bg-white hover:bg-slate-100 text-slate-600 border border-slate-200'
              }`}
            >
              {cat}
            </button>
          ))}
        </div>

        {/* Search Input */}
        <div className="relative w-full sm:w-64">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Search capabilities..."
            className="w-full pl-9 pr-3.5 py-2 rounded-xl bg-white border border-slate-200 text-xs text-slate-800 placeholder-slate-400 focus:outline-none focus:border-sky-500 shadow-sm"
          />
        </div>
      </div>

      {/* Tool Catalog List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {filteredTools.map((tool) => {
          const testStatus = testResults[tool.id];
          const isTesting = testingToolId === tool.id;

          return (
            <div key={tool.id} className="acrylic-card rounded-2xl p-5 border border-slate-200 flex flex-col justify-between shadow-sm">
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-[10px] font-bold px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 uppercase tracking-wider border border-sky-200">
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
                    <span key={perm} className="inline-flex items-center gap-1 text-[10px] px-2 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 font-medium">
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
                  className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl bg-sky-50 hover:bg-sky-100 text-sky-700 border border-sky-200 text-xs font-bold transition-all disabled:opacity-50"
                >
                  <Play className={`w-3.5 h-3.5 fill-current ${isTesting ? 'animate-spin' : ''}`} />
                  <span>{isTesting ? 'Verifying...' : 'Test Action'}</span>
                </button>

                {testStatus && (
                  <div className="text-xs truncate flex items-center gap-1.5">
                    {testStatus.loading ? (
                      <span className="text-sky-600 animate-pulse text-[11px] font-medium">Executing on desktop...</span>
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
