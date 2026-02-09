import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Folder,
  Sparkles,
  Network,
  LayoutGrid,
  BookOpen,
  Zap,
  UploadCloud,
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  Layers,
} from 'lucide-react';

// --- Types ---
type Category = 'Science' | 'History' | 'Languages' | 'Math';
type ViewMode = 'folders' | 'graph' | 'viewer';

interface NodeData {
  id: string;
  label: string;
  x: number;
  y: number;
  category: Category;
  connections: string[];
  importance: number;
}

// --- Color style map (explicit classes so Tailwind can detect them at build time) ---
const folderColorStyles: Record<string, { bg: string; text: string; bar: string; glow: string }> = {
  teal:     { bg: 'bg-teal/10',     text: 'text-teal',     bar: 'bg-teal',     glow: 'bg-teal/10' },
  sky:      { bg: 'bg-sky/10',      text: 'text-sky',      bar: 'bg-sky',      glow: 'bg-sky/10' },
  amethyst: { bg: 'bg-amethyst/10', text: 'text-amethyst', bar: 'bg-amethyst', glow: 'bg-amethyst/10' },
  amber:    { bg: 'bg-amber/10',    text: 'text-amber',    bar: 'bg-amber',    glow: 'bg-amber/10' },
};

// --- Sub-components ---

const Node = ({ node, onClick, active, dimmed }: { node: NodeData; onClick: () => void; active: boolean; dimmed: boolean }) => {
  const scale = 0.8 + node.importance * 0.2;
  const categoryColors: Record<Category, { bg: string; border: string; text: string; glow: string }> = {
    Science: { bg: 'bg-teal/10', border: 'border-teal/30', text: 'text-teal', glow: 'shadow-teal/20' },
    History: { bg: 'bg-sky/10', border: 'border-sky/30', text: 'text-sky', glow: 'shadow-sky/20' },
    Languages: { bg: 'bg-amber/10', border: 'border-amber/30', text: 'text-amber', glow: 'shadow-amber/20' },
    Math: { bg: 'bg-amethyst/10', border: 'border-amethyst/30', text: 'text-amethyst', glow: 'shadow-amethyst/20' },
  };
  const colors = categoryColors[node.category];

  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{
        scale: active ? scale * 1.15 : scale,
        opacity: dimmed ? 0.2 : 1,
      }}
      whileHover={{ scale: scale * 1.1, opacity: 1 }}
      onClick={onClick}
      className={`absolute px-4 py-2.5 rounded-xl border cursor-pointer z-10 font-semibold text-sm transition-all duration-500
        ${active
          ? `bg-gold/15 text-gold border-gold/40 shadow-lg glow-gold`
          : `${colors.bg} ${colors.text} ${colors.border} hover:border-gold/30`
        }`}
      style={{ left: `${node.x}%`, top: `${node.y}%`, transform: 'translate(-50%, -50%)' }}
    >
      <div className="flex items-center gap-2">
        {active && <Sparkles size={14} className="animate-pulse text-gold" />}
        {node.label}
      </div>
    </motion.div>
  );
};

export const Overview = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('folders');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Graph state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Viewer state
  const [viewingFile, setViewingFile] = useState<{ name: string; type: string; content: string } | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [showLeftSidebar, setShowLeftSidebar] = useState(true);
  const [showRightSidebar, setShowRightSidebar] = useState(true);

  const nodes: NodeData[] = [
    { id: '1', label: 'Zellbiologie', x: 50, y: 45, category: 'Science', connections: ['2', '3', '8', '10'], importance: 3 },
    { id: '2', label: 'Photosynthese', x: 38, y: 30, category: 'Science', connections: ['1', '3'], importance: 2 },
    { id: '3', label: 'Genetik', x: 62, y: 35, category: 'Science', connections: ['1', '2', '4', '8'], importance: 2 },
    { id: '4', label: 'Evolution', x: 75, y: 25, category: 'Science', connections: ['3', '7', '9'], importance: 1 },
    { id: '5', label: 'Franz. Revolution', x: 30, y: 70, category: 'History', connections: ['6', '7', '9', '1'], importance: 3 },
    { id: '6', label: 'Napoleon', x: 15, y: 60, category: 'History', connections: ['5', '9', '7'], importance: 2 },
    { id: '7', label: 'Aufkl\u00e4rung', x: 45, y: 80, category: 'History', connections: ['5', '6', '8'], importance: 2 },
    { id: '8', label: 'Differentialrechnung', x: 70, y: 70, category: 'Math', connections: ['1', '3', '10', '7'], importance: 2 },
    { id: '9', label: 'R\u00f6mische Republik', x: 15, y: 20, category: 'History', connections: ['6', '5', '4'], importance: 2 },
    { id: '10', label: 'Stochastik', x: 85, y: 75, category: 'Math', connections: ['8', '1'], importance: 1 },
  ];

  const getLineColor = (node1: NodeData, node2: NodeData) => {
    if (node1.category === node2.category) {
      const colors: Record<string, string> = {
        Science: '#3dbda7',
        History: '#5b8def',
        Languages: '#e8a84c',
        Math: '#9b7aef',
      };
      return colors[node1.category] || '#2a3050';
    }
    return '#d4a853'; // gold for cross-disciplinary links
  };

  const selectedNode = nodes.find((n) => n.id === selectedNodeId);

  const visibleNodeIds = useMemo(() => {
    return nodes.map((n) => n.id);
  }, [nodes]);

  const filteredNodes = useMemo(() => {
    return nodes.filter(
      (n) =>
        visibleNodeIds.includes(n.id) &&
        n.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, visibleNodeIds, nodes]);

  const handleUpload = () => {
    setIsUploading(true);
    setTimeout(() => {
      setIsUploading(false);
      setViewingFile({
        name: 'Biologie Zellatmung',
        type: 'PDF Dokument',
        content:
          'Die Zellatmung ist ein Stoffwechselvorgang, bei dem durch Oxidation organischer Stoffe Energie gewonnen wird. In der Glykolyse wird Glucose in Pyruvat umgewandelt. Der Citratzyklus findet in der Mitochondrienmatrix statt. Die Atmungskette an der inneren Mitochondrienmembran erzeugt schlie\u00dflich das Gros des ATPs.',
      });
      setViewMode('viewer');
    }, 1500);
  };

  return (
    <div className="h-full bg-void flex flex-col overflow-hidden relative">
      {/* --- Header --- */}
      <div className="px-8 py-5 z-30 flex flex-col gap-5 bg-deep/80 backdrop-blur-xl border-b border-border-subtle">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            {viewMode === 'viewer' && (
              <button
                onClick={() => setViewMode('folders')}
                className="p-2 hover:bg-elevated rounded-xl text-text-muted hover:text-gold transition-colors"
              >
                <ChevronLeft size={22} />
              </button>
            )}
            <div>
              <h1 className="text-2xl font-serif text-text-primary tracking-tight">
                {viewMode === 'viewer' ? viewingFile?.name : 'Meine Wissenswelt'}
              </h1>
              <p className="text-xs text-text-muted mt-0.5">
                {viewMode === 'viewer' ? 'Dokumenten-Analyse aktiv' : 'Organisiere und entdecke deine Notizen.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Search */}
            <div className={`relative transition-all duration-500 ${isSearchFocused ? 'w-80' : 'w-56'}`}>
              <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-text-ghost">
                <Search size={15} />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                placeholder="Suchen..."
                className="w-full pl-9 pr-4 py-2 bg-elevated border border-border-subtle rounded-xl text-sm text-text-primary outline-none focus:border-gold/30 focus:bg-raised transition-all placeholder:text-text-ghost"
              />
            </div>

            <div className="h-6 w-px bg-border-subtle" />

            {/* View Toggles */}
            <div className="flex bg-elevated p-1 rounded-xl border border-border-subtle">
              <button
                onClick={() => setViewMode('folders')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'folders'
                    ? 'bg-gold/10 text-gold shadow-sm'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                <LayoutGrid size={13} />
                Ordner
              </button>
              <button
                onClick={() => setViewMode('graph')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-semibold transition-all ${
                  viewMode === 'graph'
                    ? 'bg-gold/10 text-gold shadow-sm'
                    : 'text-text-muted hover:text-text-secondary'
                }`}
              >
                <Network size={13} />
                Graph
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* --- Main Content Area --- */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          {/* 1. Folders View */}
          {viewMode === 'folders' && (
            <motion.div
              key="folders"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              transition={{ duration: 0.3 }}
              className="h-full p-8 flex flex-col overflow-y-auto"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {/* Upload Card */}
                <motion.button
                  onClick={handleUpload}
                  disabled={isUploading}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  className="p-6 rounded-2xl border border-dashed border-border-strong flex flex-col items-center justify-center text-center gap-3 hover:border-gold/40 hover:bg-gold/[0.03] transition-all group cursor-pointer"
                >
                  <div className="w-12 h-12 bg-gold/10 text-gold rounded-full flex items-center justify-center group-hover:scale-110 transition-transform">
                    {isUploading ? <Loader2 size={22} className="animate-spin" /> : <UploadCloud size={22} />}
                  </div>
                  <div>
                    <h3 className="font-semibold text-text-primary text-sm">{isUploading ? 'Importiere...' : 'Datei importieren'}</h3>
                    <p className="text-[10px] text-text-muted mt-1">PDF, Bilder oder Texte</p>
                  </div>
                </motion.button>

                {[
                  { label: 'Biologie', color: 'teal', count: 12, progress: 75 },
                  { label: 'Geschichte', color: 'sky', count: 8, progress: 62 },
                  { label: 'Mathematik', color: 'amethyst', count: 7, progress: 88 },
                  { label: 'Informatik', color: 'amber', count: 4, progress: 41 },
                ].map((folder, i) => (
                  <motion.div
                    key={folder.label}
                    initial={{ opacity: 0, y: 16 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.1 + i * 0.06, duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
                    onClick={() => {
                      setViewingFile({
                        name: `${folder.label}-Zusammenfassung`,
                        type: 'PDF Dokument',
                        content: `Dies ist eine automatisch generierte Zusammenfassung f\u00fcr das Thema ${folder.label}. Alle relevanten Fakten aus deinen Mitschriften wurden hier konsolidiert.`,
                      });
                      setViewMode('viewer');
                    }}
                    className="group p-6 bg-surface rounded-2xl border border-border-subtle hover:border-border-strong transition-all cursor-pointer relative overflow-hidden"
                  >
                    {/* Subtle corner glow on hover */}
                    <div className={`absolute -top-8 -right-8 w-24 h-24 ${folderColorStyles[folder.color].glow} rounded-full blur-2xl opacity-0 group-hover:opacity-100 transition-opacity duration-500`} />

                    <div className="relative z-10">
                      <div className="flex justify-between items-start mb-6">
                        <div className={`p-3 rounded-xl ${folderColorStyles[folder.color].bg} ${folderColorStyles[folder.color].text}`}>
                          <Folder size={22} />
                        </div>
                        <span className="text-[10px] font-semibold text-text-ghost">{folder.count} Notizen</span>
                      </div>
                      <h3 className="font-semibold text-text-primary group-hover:text-gold transition-colors">{folder.label}</h3>
                      <div className="mt-4 flex items-center gap-2">
                        <div className="h-1 flex-1 bg-elevated rounded-full overflow-hidden">
                          <motion.div
                            initial={{ width: 0 }}
                            animate={{ width: `${folder.progress}%` }}
                            transition={{ delay: 0.3 + i * 0.1, duration: 1, ease: 'easeOut' }}
                            className={`h-full ${folderColorStyles[folder.color].bar} rounded-full`}
                          />
                        </div>
                        <span className="text-[9px] font-semibold text-text-ghost">{folder.progress}%</span>
                      </div>
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* 2. Graph View */}
          {viewMode === 'graph' && (
            <motion.div
              key="graph"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full relative overflow-hidden"
            >
              {/* Atmospheric radial gradient background */}
              <div className="absolute inset-0 pointer-events-none">
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[700px] h-[700px] bg-gold/[0.02] rounded-full blur-[150px]" />
              </div>

              <div className="absolute inset-0 z-10">
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {nodes.map((node) =>
                    node.connections.map((targetId) => {
                      const target = nodes.find((n) => n.id === targetId);
                      if (!target || parseInt(node.id) > parseInt(target.id)) return null;

                      const isHighlighted = selectedNodeId === node.id || selectedNodeId === target.id;
                      const isDimmed = selectedNodeId && !isHighlighted;
                      const lineColor = getLineColor(node, target);

                      return (
                        <motion.line
                          key={`${node.id}-${target.id}`}
                          initial={{ opacity: 0 }}
                          animate={{
                            opacity: isDimmed ? 0.04 : isHighlighted ? 0.6 : 0.15,
                            stroke: isHighlighted ? '#d4a853' : lineColor,
                            strokeWidth: isHighlighted ? 2 : 1,
                          }}
                          x1={`${node.x}%`}
                          y1={`${node.y}%`}
                          x2={`${target.x}%`}
                          y2={`${target.y}%`}
                          strokeDasharray={isHighlighted ? '0' : '4 4'}
                        />
                      );
                    })
                  )}
                </svg>
                {filteredNodes.map((node) => (
                  <Node
                    key={node.id}
                    node={node}
                    active={selectedNodeId === node.id}
                    dimmed={!!selectedNodeId && selectedNodeId !== node.id && !selectedNode?.connections.includes(node.id)}
                    onClick={() => setSelectedNodeId(node.id === selectedNodeId ? null : node.id)}
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* 3. Viewer */}
          {viewMode === 'viewer' && viewingFile && (
            <motion.div
              key="viewer"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="h-full flex overflow-hidden relative"
            >
              {/* Floating Toggle Buttons */}
              <AnimatePresence>
                {!showLeftSidebar && (
                  <motion.button
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -20, opacity: 0 }}
                    onClick={() => setShowLeftSidebar(true)}
                    className="absolute left-4 top-4 z-40 p-2 bg-surface border border-border-subtle rounded-lg text-text-muted hover:text-gold transition-colors"
                  >
                    <Layers size={14} />
                  </motion.button>
                )}
                {!showRightSidebar && (
                  <motion.button
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: 20, opacity: 0 }}
                    onClick={() => setShowRightSidebar(true)}
                    className="absolute right-4 top-4 z-40 p-2 bg-surface border border-border-subtle rounded-lg text-text-muted hover:text-gold transition-colors"
                  >
                    <Sparkles size={14} />
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Document Sidebar */}
              <AnimatePresence>
                {showLeftSidebar && (
                  <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 192, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    className="bg-deep border-r border-border-subtle flex flex-col overflow-hidden"
                  >
                    <div className="p-4 flex items-center justify-between">
                      <span className="text-[9px] font-bold text-text-ghost uppercase tracking-[0.2em]">Inhalt</span>
                      <button onClick={() => setShowLeftSidebar(false)} className="p-1 hover:bg-elevated rounded text-text-ghost hover:text-text-muted transition-colors">
                        <ChevronLeft size={12} />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto px-2 space-y-0.5">
                      {['\u00dcbersicht', 'Kernkonzept', 'Analyse', 'Quellen'].map((item, i) => (
                        <div
                          key={item}
                          className={`px-3 py-2 rounded-lg text-[11px] cursor-pointer transition-colors whitespace-nowrap ${
                            i === 0
                              ? 'bg-gold/10 text-gold font-semibold'
                              : 'text-text-muted hover:bg-elevated hover:text-text-secondary'
                          }`}
                        >
                          {item}
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Main Reading Area */}
              <div className="flex-1 bg-surface/50 overflow-y-auto p-12 flex justify-center">
                <div className="w-full max-w-3xl bg-deep border border-border-subtle rounded-lg p-16 md:p-24 min-h-[1200px] relative shadow-2xl shadow-black/30">
                  {/* Page Indicator */}
                  <div className="absolute top-8 right-8 text-[10px] font-medium text-text-ghost">Seite 1 von 1</div>

                  <div className="mb-12">
                    <div className="flex items-center gap-2 mb-4">
                      <span className="px-2.5 py-0.5 bg-gold/10 text-gold text-[9px] font-bold uppercase tracking-wider rounded-md">
                        Gepr\u00fcftes Dokument
                      </span>
                      <span className="text-text-ghost text-[10px]">Zuletzt bearbeitet: Heute</span>
                    </div>
                    <h1 className="text-4xl font-serif text-text-primary mb-4">{viewingFile.name}</h1>
                    <div className="line-gold w-20" />
                  </div>

                  <div className="space-y-6">
                    <p className="text-lg leading-relaxed text-text-secondary font-sans">{viewingFile.content}</p>
                    <p className="text-lg leading-relaxed text-text-secondary font-sans">
                      Die Energiegewinnung erfolgt in mehreren Schritten. Zun\u00e4chst wird in der Glykolyse Glucose abgebaut. Dieser Prozess findet im Cytoplasma statt. Die
                      Produkte werden dann in die Mitochondrien transportiert, wo der Citratzyklus und die Atmungskette ablaufen.
                    </p>
                    <div className="mt-12 p-8 bg-gold/[0.04] rounded-xl border border-gold/10 flex flex-col items-center gap-4">
                      <Sparkles size={24} className="text-gold animate-pulse" />
                      <p className="text-sm text-text-muted italic font-serif">KI generiert zus\u00e4tzliche Erl\u00e4uterungen f\u00fcr diesen Abschnitt...</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Assistant Sidebar */}
              <AnimatePresence>
                {showRightSidebar && (
                  <motion.div
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 240, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    className="bg-deep border-l border-border-subtle flex flex-col overflow-hidden"
                  >
                    <div className="p-4 border-b border-border-subtle flex justify-between items-center">
                      <div className="flex items-center gap-2 text-gold">
                        <Sparkles size={12} />
                        <span className="text-[9px] font-bold uppercase tracking-[0.2em]">Assistent</span>
                      </div>
                      <button onClick={() => setShowRightSidebar(false)} className="p-1 hover:bg-elevated rounded text-text-ghost hover:text-text-muted transition-colors">
                        <ChevronRight size={12} />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 space-y-8">
                      {/* Insights */}
                      <div className="whitespace-nowrap">
                        <div className="space-y-4">
                          {[
                            { t: 'Mitochondrien', d: 'Zellatmung' },
                            { t: 'ATP', d: 'Energie' },
                            { t: 'Glykolyse', d: 'Abbau' },
                          ].map((f) => (
                            <div key={f.t} className="group cursor-pointer">
                              <div className="flex justify-between items-center">
                                <span className="text-[10px] font-semibold text-text-secondary group-hover:text-gold transition-colors">{f.t}</span>
                                <div className="w-1 h-1 rounded-full bg-border-subtle group-hover:bg-gold transition-colors" />
                              </div>
                              <p className="text-[9px] text-text-muted">{f.d}</p>
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Link */}
                      <div className="py-4 border-y border-border-subtle whitespace-nowrap overflow-hidden">
                        <p className="text-[9px] text-text-muted leading-tight mb-2">
                          Passend zu <strong className="text-text-secondary">"Zellbiologie"</strong>.
                        </p>
                        <button className="text-[9px] font-semibold text-gold/60 hover:text-gold flex items-center gap-1 transition-colors">
                          Verkn\u00fcpfen <ChevronRight size={8} />
                        </button>
                      </div>

                      {/* Actions */}
                      <div className="space-y-1">
                        <button className="w-full p-2 text-left hover:bg-elevated rounded-lg transition-all flex items-center gap-2.5 text-text-muted hover:text-gold group">
                          <Zap size={12} className="text-text-ghost group-hover:text-amber" />
                          <span className="text-[10px] font-medium">Quiz erstellen</span>
                        </button>
                        <button className="w-full p-2 text-left hover:bg-elevated rounded-lg transition-all flex items-center gap-2.5 text-text-muted hover:text-gold group">
                          <BookOpen size={12} className="text-text-ghost group-hover:text-amethyst" />
                          <span className="text-[10px] font-medium">Karteikarten</span>
                        </button>
                      </div>
                    </div>

                    <div className="p-3 bg-surface/50">
                      <div className="relative">
                        <input
                          type="text"
                          placeholder="Frage..."
                          className="w-full pl-3 pr-7 py-2 bg-elevated border border-border-subtle rounded-lg text-[10px] text-text-primary outline-none focus:border-gold/30 transition-all"
                        />
                        <Search size={10} className="absolute right-2.5 top-2.5 text-text-ghost" />
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
};
