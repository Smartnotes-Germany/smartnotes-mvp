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

// --- Sub-components ---

const Node = ({ node, onClick, active, dimmed }: { node: NodeData, onClick: () => void, active: boolean, dimmed: boolean }) => {
  const scale = 0.8 + (node.importance * 0.2);
  return (
    <motion.div
      initial={{ scale: 0 }}
      animate={{ 
        scale: active ? scale * 1.2 : scale,
        opacity: dimmed ? 0.25 : 1,
      }}
      whileHover={{ scale: scale * 1.1, opacity: 1 }}
      onClick={onClick}
      className={`absolute px-4 py-2.5 rounded-sm border cursor-pointer z-10 text-[0.8125rem] font-medium transition-all duration-500 font-sans
        ${active 
          ? `bg-ink text-cream border-ink shadow-lg` 
          : `bg-surface-white text-ink-secondary border-cream-border hover:border-accent hover:text-ink`
        }`}
      style={{ left: `${node.x}%`, top: `${node.y}%`, transform: 'translate(-50%, -50%)' }}
    >
      <div className="flex items-center gap-2">
        {active && <Sparkles size={12} className="text-accent animate-pulse" />}
        {node.label}
      </div>
    </motion.div>
  );
};

export const Overview = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('folders');
  const [isSearchFocused, setIsSearchFocused] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  
  // Graph state
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);

  // Viewer state
  const [viewingFile, setViewingFile] = useState<{name: string, type: string, content: string} | null>(null);
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
    { id: '7', label: 'Aufklärung', x: 45, y: 80, category: 'History', connections: ['5', '6', '8'], importance: 2 },
    { id: '8', label: 'Differentialrechnung', x: 70, y: 70, category: 'Math', connections: ['1', '3', '10', '7'], importance: 2 },
    { id: '9', label: 'Römische Republik', x: 15, y: 20, category: 'History', connections: ['6', '5', '4'], importance: 2 },
    { id: '10', label: 'Stochastik', x: 85, y: 75, category: 'Math', connections: ['8', '1'], importance: 1 },
  ];

  // Helper to get color for a connection
  const getLineColor = (node1: NodeData, node2: NodeData) => {
    if (node1.category === node2.category) {
      const colors: Record<string, string> = {
        Science: '#1a7a6d',
        History: '#8b6914',
        Languages: '#7a5a1a',
        Math: '#57534e'
      };
      return colors[node1.category] || '#d6d3d1';
    }
    return '#c2746b'; // warm rose for cross-disciplinary
  };

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  const filteredNodes = useMemo(() => {
    return nodes.filter(n => 
      n.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, nodes]);

  const handleUpload = () => {
    setIsUploading(true);
    setTimeout(() => {
      setIsUploading(false);
      setViewingFile({
        name: "Biologie Zellatmung",
        type: "PDF Dokument",
        content: "Die Zellatmung ist ein Stoffwechselvorgang, bei dem durch Oxidation organischer Stoffe Energie gewonnen wird. In der Glykolyse wird Glucose in Pyruvat umgewandelt. Der Citratzyklus findet in der Mitochondrienmatrix statt. Die Atmungskette an der inneren Mitochondrienmembran erzeugt schließlich das Gros des ATPs."
      });
      setViewMode('viewer');
    }, 1500);
  };

  return (
    <div className="h-full bg-cream flex flex-col overflow-hidden relative">
      
      {/* --- Unified Header --- */}
      <div className="px-10 py-7 z-30 flex flex-col gap-6 border-b border-cream-border">
        <div className="flex justify-between items-center">
          <div className="flex items-center gap-4">
            {viewMode === 'viewer' && (
              <button 
                onClick={() => setViewMode('folders')}
                className="p-2 hover:bg-cream-dark/40 rounded-sm text-ink-muted transition-colors"
              >
                <ChevronLeft size={20} />
              </button>
            )}
            <div>
              <h1 className="editorial-heading text-[1.75rem] mb-1">
                {viewMode === 'viewer' ? viewingFile?.name : 'Meine Wissenswelt'}
              </h1>
              <p className="text-[0.75rem] text-ink-muted font-medium">
                {viewMode === 'viewer' ? 'Dokumenten-Analyse aktiv' : 'Organisiere und entdecke deine Notizen.'}
              </p>
            </div>
          </div>

          <div className="flex items-center gap-5">
            {/* Search Bar */}
            <div className={`relative transition-all duration-300 ${isSearchFocused ? 'w-72' : 'w-56'}`}>
              <div className="absolute inset-y-0 left-3.5 flex items-center pointer-events-none text-ink-muted">
                <Search size={14} />
              </div>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                onFocus={() => setIsSearchFocused(true)}
                onBlur={() => setIsSearchFocused(false)}
                placeholder="Suchen..."
                className="w-full pl-9 pr-4 py-2 bg-cream-dark/30 border border-cream-border rounded-sm text-[0.8125rem] text-ink outline-none focus:border-accent/40 transition-all placeholder:text-ink-muted font-sans"
              />
            </div>

            <div className="h-6 w-px bg-cream-border" />

            {/* View Toggles */}
            <div className="flex gap-1 p-1 border border-cream-border rounded-sm">
              <button
                onClick={() => setViewMode('folders')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-sm text-[0.75rem] font-medium transition-all ${
                  viewMode === 'folders' ? 'bg-ink text-cream' : 'text-ink-secondary hover:text-ink'
                }`}
              >
                <LayoutGrid size={13} />
                Ordner
              </button>
              <button
                onClick={() => setViewMode('graph')}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-sm text-[0.75rem] font-medium transition-all ${
                  viewMode === 'graph' ? 'bg-ink text-cream' : 'text-ink-secondary hover:text-ink'
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
              initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="h-full p-10 flex flex-col overflow-y-auto custom-scrollbar"
            >
              {/* Section label */}
              <div className="section-label mb-8">01 &mdash; Deine Fächer</div>

              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5">
                {/* Upload Card */}
                <button 
                  onClick={handleUpload}
                  disabled={isUploading}
                  className="p-7 border border-dashed border-cream-border rounded-sm flex flex-col items-center justify-center text-center gap-3.5 hover:border-accent hover:bg-accent/5 transition-all group"
                >
                  <div className="w-10 h-10 border border-cream-border text-ink-muted rounded-full flex items-center justify-center group-hover:border-accent group-hover:text-accent transition-all">
                    {isUploading ? <Loader2 size={18} className="animate-spin" /> : <UploadCloud size={18} />}
                  </div>
                  <div>
                    <h3 className="font-semibold text-ink text-[0.875rem]">{isUploading ? 'Importiere...' : 'Datei importieren'}</h3>
                    <p className="text-[0.6875rem] text-ink-muted mt-0.5">PDF, Bilder oder Texte</p>
                  </div>
                </button>

                {[
                  { label: "Biologie", accent: "bg-accent", count: 12, progress: 75 },
                  { label: "Geschichte", accent: "bg-[#8b6914]", count: 8, progress: 62 },
                  { label: "Mathematik", accent: "bg-ink-secondary", count: 7, progress: 80 },
                  { label: "Informatik", accent: "bg-ink-muted", count: 4, progress: 45 },
                ].map((folder) => (
                  <div 
                    key={folder.label}
                    onClick={() => {
                      setViewingFile({
                        name: `${folder.label}-Zusammenfassung`,
                        type: "PDF Dokument",
                        content: `Dies ist eine automatisch generierte Zusammenfassung für das Thema ${folder.label}. Alle relevanten Fakten aus deinen Mitschriften wurden hier konsolidiert.`
                      });
                      setViewMode('viewer');
                    }}
                    className="p-7 bg-surface-white border border-cream-border rounded-sm hover:border-ink-muted transition-all cursor-pointer group"
                  >
                    <div className="flex justify-between items-start mb-7">
                      <div className="p-2.5 rounded-sm bg-cream-dark/30 text-ink-secondary group-hover:text-ink transition-colors">
                        <Folder size={20} />
                      </div>
                      <span className="text-[0.625rem] font-semibold text-ink-muted tracking-wider uppercase">{folder.count} Notizen</span>
                    </div>
                    <h3 className="font-serif text-[1.125rem] font-semibold text-ink group-hover:text-accent transition-colors">{folder.label}</h3>
                    <div className="mt-5 flex items-center gap-2.5">
                       <div className="h-[3px] flex-1 bg-cream-dark rounded-full overflow-hidden">
                          <div className={`h-full ${folder.accent} rounded-full`} style={{ width: `${folder.progress}%` }} />
                       </div>
                       <span className="text-[0.625rem] font-semibold text-ink-muted">{folder.progress}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* 2. Graph View */}
          {viewMode === 'graph' && (
            <motion.div
              key="graph"
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="h-full relative overflow-hidden"
            >
              <div className="absolute inset-0 z-10">
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {nodes.map(node => 
                    node.connections.map(targetId => {
                      const target = nodes.find(n => n.id === targetId);
                      if (!target || parseInt(node.id) > parseInt(target.id)) return null;
                      
                      const isHighlighted = selectedNodeId === node.id || selectedNodeId === target.id;
                      const isDimmed = selectedNodeId && !isHighlighted;
                      const lineColor = getLineColor(node, target);

                      return (
                        <motion.line
                          key={`${node.id}-${target.id}`}
                          initial={{ opacity: 0 }} 
                          animate={{ 
                            opacity: isDimmed ? 0.06 : (isHighlighted ? 0.6 : 0.2),
                            stroke: isHighlighted ? '#1c1917' : lineColor,
                            strokeWidth: isHighlighted ? 2 : 1
                          }}
                          x1={`${node.x}%`} y1={`${node.y}%`}
                          x2={`${target.x}%`} y2={`${target.y}%`}
                          strokeDasharray={isHighlighted ? "none" : "4 4"}
                        />
                      );
                    })
                  )}
                </svg>
                {filteredNodes.map(node => (
                  <Node 
                    key={node.id} node={node}
                    active={selectedNodeId === node.id}
                    dimmed={!!selectedNodeId && selectedNodeId !== node.id && !selectedNode?.connections.includes(node.id)}
                    onClick={() => setSelectedNodeId(node.id === selectedNodeId ? null : node.id)} 
                  />
                ))}
              </div>
            </motion.div>
          )}

          {/* 3. Viewer View */}
          {viewMode === 'viewer' && viewingFile && (
            <motion.div
              key="viewer"
              initial={{ opacity: 0, x: 12 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -12 }}
              transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
              className="h-full flex overflow-hidden relative"
            >
              {/* Floating Toggle Buttons */}
              <AnimatePresence>
                {!showLeftSidebar && (
                  <motion.button
                    initial={{ x: -12, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: -12, opacity: 0 }}
                    onClick={() => setShowLeftSidebar(true)}
                    className="absolute left-4 top-4 z-40 p-2 bg-surface-white border border-cream-border rounded-sm text-ink-muted hover:text-accent transition-colors"
                  >
                    <Layers size={14} />
                  </motion.button>
                )}
                {!showRightSidebar && (
                  <motion.button
                    initial={{ x: 12, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 12, opacity: 0 }}
                    onClick={() => setShowRightSidebar(true)}
                    className="absolute right-4 top-4 z-40 p-2 bg-surface-white border border-cream-border rounded-sm text-ink-muted hover:text-accent transition-colors"
                  >
                    <Sparkles size={14} />
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Document Sidebar */}
              <AnimatePresence>
                {showLeftSidebar && (
                  <motion.div 
                    initial={{ width: 0, opacity: 0 }} animate={{ width: 200, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
                    className="bg-cream-light border-r border-cream-border flex flex-col overflow-hidden"
                  >
                    <div className="p-5 flex items-center justify-between">
                      <span className="section-label text-[0.5625rem]">Inhalt</span>
                      <button onClick={() => setShowLeftSidebar(false)} className="p-1 hover:bg-cream-dark/30 rounded-sm text-ink-muted">
                        <ChevronLeft size={12} />
                      </button>
                    </div>
                    <div className="h-px bg-cream-border mx-4" />
                    <div className="flex-1 overflow-y-auto px-3 pt-3 space-y-0.5 custom-scrollbar">
                      {['Übersicht', 'Kernkonzept', 'Analyse', 'Quellen'].map((item, i) => (
                        <div 
                          key={item} 
                          className={`px-3 py-2.5 rounded-sm text-[0.75rem] cursor-pointer transition-colors whitespace-nowrap ${
                            i === 0 ? 'bg-cream-dark/30 text-ink font-medium border-l-2 border-accent' : 'text-ink-muted hover:bg-cream-dark/20 hover:text-ink-secondary border-l-2 border-transparent'
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
              <div className="flex-1 bg-cream-dark/20 overflow-y-auto p-12 flex justify-center custom-scrollbar">
                <div className="w-full max-w-3xl bg-surface-white border border-cream-border rounded-sm p-16 md:p-24 min-h-[1200px] relative">
                  {/* Page Indicator */}
                  <div className="absolute top-8 right-8 text-[0.625rem] font-medium text-ink-muted tracking-wider">Seite 1 von 1</div>
                  
                  <div className="mb-14">
                    <div className="flex items-center gap-3 mb-5">
                       <span className="section-label text-[0.5625rem]">Geprüftes Dokument</span>
                       <span className="text-ink-faint text-[0.6875rem]">&middot;</span>
                       <span className="text-ink-muted text-[0.6875rem]">Zuletzt bearbeitet: Heute</span>
                    </div>
                    <h1 className="editorial-heading text-[2.5rem] mb-5">{viewingFile.name}</h1>
                    <div className="h-px w-16 bg-accent" />
                  </div>

                  <div className="space-y-8">
                    <p className="text-[1.125rem] leading-[1.8] text-ink-secondary font-sans">
                      {viewingFile.content}
                    </p>
                    <p className="text-[1.125rem] leading-[1.8] text-ink-secondary font-sans">
                      Die Energiegewinnung erfolgt in mehreren Schritten. Zunächst wird in der Glykolyse Glucose abgebaut. Dieser Prozess findet im Cytoplasma statt. Die Produkte werden dann in die Mitochondrien transportiert, wo der Citratzyklus und die Atmungskette ablaufen. 
                    </p>
                    <div className="mt-14 p-8 bg-cream-light border border-cream-border rounded-sm flex flex-col items-center gap-4">
                       <Sparkles size={20} className="text-accent" />
                       <p className="text-[0.8125rem] text-ink-muted italic font-serif">KI generiert zusätzliche Erläuterungen für diesen Abschnitt...</p>
                    </div>
                  </div>
                </div>
              </div>

              {/* AI Assistant Sidebar */}
              <AnimatePresence>
                {showRightSidebar && (
                  <motion.div 
                    initial={{ width: 0, opacity: 0 }} animate={{ width: 240, opacity: 1 }} exit={{ width: 0, opacity: 0 }}
                    className="bg-cream-light border-l border-cream-border flex flex-col overflow-hidden"
                  >
                    <div className="p-5 border-b border-cream-border flex justify-between items-center">
                      <div className="flex items-center gap-2 text-ink-muted">
                        <Sparkles size={12} className="text-accent" />
                        <span className="section-label text-[0.5625rem]">Assistent</span>
                      </div>
                      <button onClick={() => setShowRightSidebar(false)} className="p-1 hover:bg-cream-dark/30 rounded-sm text-ink-muted">
                        <ChevronRight size={12} />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-5 space-y-8 custom-scrollbar">
                       {/* Insights */}
                       <div className="whitespace-nowrap">
                          <div className="space-y-4">
                             {[
                               { t: 'Mitochondrien', d: 'Zellatmung' },
                               { t: 'ATP', d: 'Energie' },
                               { t: 'Glykolyse', d: 'Abbau' }
                             ].map(f => (
                               <div key={f.t} className="group cursor-pointer">
                                 <div className="flex justify-between items-center">
                                   <span className="text-[0.6875rem] font-medium text-ink-secondary group-hover:text-accent transition-colors">{f.t}</span>
                                   <div className="w-1.5 h-1.5 rounded-full bg-cream-dark group-hover:bg-accent transition-colors" />
                                 </div>
                                 <p className="text-[0.625rem] text-ink-muted mt-0.5">{f.d}</p>
                               </div>
                             ))}
                          </div>
                       </div>

                       {/* Minimal Link */}
                       <div className="py-4 border-y border-cream-border whitespace-nowrap overflow-hidden">
                          <p className="text-[0.625rem] text-ink-muted leading-tight mb-2">
                            Passend zu <strong className="text-ink-secondary">"Zellbiologie"</strong>.
                          </p>
                           <button className="text-[0.625rem] font-semibold text-accent hover:text-accent-dark flex items-center gap-1 transition-colors">
                             Verknüpfen <ChevronRight size={8} />
                          </button>
                       </div>

                       {/* Minimal Actions */}
                       <div className="space-y-1">
                          <button className="w-full p-2 text-left hover:bg-cream-dark/30 rounded-sm transition-all flex items-center gap-2.5 text-ink-muted hover:text-accent group">
                             <Zap size={11} />
                             <span className="text-[0.6875rem] font-medium">Quiz</span>
                          </button>
                          <button className="w-full p-2 text-left hover:bg-cream-dark/30 rounded-sm transition-all flex items-center gap-2.5 text-ink-muted hover:text-accent group">
                             <BookOpen size={11} />
                             <span className="text-[0.6875rem] font-medium">Karten</span>
                          </button>
                       </div>
                    </div>

                    <div className="p-4 border-t border-cream-border">
                      <div className="relative">
                        <input 
                          type="text"
                          placeholder="Frage..."
                          className="w-full pl-3 pr-7 py-2 bg-surface-white border border-cream-border rounded-sm text-[0.6875rem] text-ink outline-none focus:border-accent/40 transition-all placeholder:text-ink-muted font-sans"
                        />
                        <Search size={10} className="absolute right-2.5 top-2.5 text-ink-muted" />
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
