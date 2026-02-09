import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Folder,
  Sparkles,
  Network,
  LayoutGrid,
  BookOpen,
  UploadCloud,
  Loader2,
  Search,
  ChevronLeft,
  ChevronRight,
  Layers,
  ArrowUpRight,
  Clock,
  FileText,
  Zap
} from 'lucide-react';

// --- Types ---
type ViewMode = 'folders' | 'graph' | 'viewer';
type Category = 'Science' | 'History' | 'Languages' | 'Math';

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
  const categoryColors: Record<Category, string> = {
    Science: 'border-emerald-600 text-emerald-800',
    History: 'border-amber-600 text-amber-800',
    Languages: 'border-purple-600 text-purple-800',
    Math: 'border-rose-600 text-rose-800'
  };
  
  return (
    <motion.div
      initial={{ scale: 0, opacity: 0 }}
      animate={{ 
        scale: active ? scale * 1.2 : scale,
        opacity: dimmed ? 0.2 : 1,
      }}
      whileHover={{ scale: scale * 1.15, opacity: 1 }}
      onClick={onClick}
      className={`absolute px-5 py-3 bg-ivory cursor-pointer z-10 font-body text-sm transition-all duration-500 border-2 ${
        active 
          ? 'border-ink bg-ink text-ivory shadow-2xl' 
          : `${categoryColors[node.category]} hover:border-ink`
      }`}
      style={{ left: `${node.x}%`, top: `${node.y}%`, transform: 'translate(-50%, -50%)' }}
    >
      <div className="flex items-center gap-2">
        {active && <Sparkles size={14} className="text-accent-gold" />}
        <span className="font-medium">{node.label}</span>
      </div>
    </motion.div>
  );
};

export const Overview = () => {
  const [viewMode, setViewMode] = useState<ViewMode>('folders');
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
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

  const filteredNodes = useMemo(() => {
    return nodes.filter(n => 
      n.label.toLowerCase().includes(searchQuery.toLowerCase())
    );
  }, [searchQuery, nodes]);

  const selectedNode = nodes.find(n => n.id === selectedNodeId);

  const handleUpload = () => {
    setIsUploading(true);
    setTimeout(() => {
      setIsUploading(false);
      setViewingFile({
        name: "Biologie Zellatmung",
        type: "PDF Dokument",
        content: "Die Zellatmung ist ein Stoffwechselvorgang, bei dem durch Oxidation organischer Stoffe Energie gewonnen wird. In der Glykolyse wird Glucose in Pyruvat umgewandelt. Der Citratzyklus findet in der Mitochondrienmatrix statt."
      });
      setViewMode('viewer');
    }, 1500);
  };

  const folders = [
    { label: "Biologie", subtitle: "Zellbiologie & Genetik", color: "#1a2f23", bg: "bg-[#e8f0ec]", count: 12, accent: "border-[#1a2f23]" },
    { label: "Geschichte", subtitle: "Antike bis Neuzeit", color: "#c9a227", bg: "bg-[#f9f5e8]", count: 8, accent: "border-[#c9a227]" },
    { label: "Mathematik", subtitle: "Analysis & Stochastik", color: "#c73e1d", bg: "bg-[#fdf2ef]", count: 7, accent: "border-[#c73e1d]" },
    { label: "Informatik", subtitle: "Algorithmen & Daten", color: "#4a4a52", bg: "bg-[#f0f0f2]", count: 4, accent: "border-[#4a4a52]" },
  ];

  return (
    <div className="h-full bg-ivory flex flex-col overflow-hidden relative">
      
      {/* === EDITORIAL HEADER === */}
      <div className="px-10 py-8 z-30 bg-ivory border-b border-ivory-muted">
        <div className="flex justify-between items-end">
          <div className="flex items-end gap-6">
            {viewMode === 'viewer' && (
              <button 
                onClick={() => setViewMode('folders')}
                className="p-3 border border-ink text-ink hover:bg-ink hover:text-ivory transition-all mb-2"
              >
                <ChevronLeft size={20} />
              </button>
            )}
            <div>
              <motion.p 
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="text-caption text-accent-slate mb-2"
              >
                {viewMode === 'viewer' ? 'Dokumentenansicht' : 'Übersicht'}
              </motion.p>
              <motion.h1 
                key={viewMode === 'viewer' ? viewingFile?.name : 'folders'}
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-display-md text-ink"
              >
                {viewMode === 'viewer' ? viewingFile?.name : 'Meine Wissenswelt'}
              </motion.h1>
            </div>
          </div>

          <div className="flex items-center gap-6">
            {/* Search - Editorial Style */}
            <div className="relative">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Suchen..."
                className="input-editorial w-64"
              />
              <Search size={16} className="absolute right-0 top-1/2 -translate-y-1/2 text-text-muted" />
            </div>

            <div className="h-8 w-px bg-ivory-muted" />

            {/* View Toggles - Minimal */}
            <div className="flex gap-1">
              <button
                onClick={() => setViewMode('folders')}
                className={`p-3 transition-all ${
                  viewMode === 'folders' 
                    ? 'bg-ink text-ivory' 
                    : 'text-text-muted hover:text-ink'
                }`}
              >
                <LayoutGrid size={18} />
              </button>
              <button
                onClick={() => setViewMode('graph')}
                className={`p-3 transition-all ${
                  viewMode === 'graph' 
                    ? 'bg-ink text-ivory' 
                    : 'text-text-muted hover:text-ink'
                }`}
              >
                <Network size={18} />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* === MAIN CONTENT === */}
      <div className="flex-1 relative overflow-hidden">
        <AnimatePresence mode="wait">
          
          {/* FOLDERS VIEW */}
          {viewMode === 'folders' && (
            <motion.div
              key="folders"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.4 }}
              className="h-full p-10 overflow-y-auto"
            >
              {/* Upload Card - Editorial */}
              <motion.button 
                onClick={handleUpload}
                disabled={isUploading}
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="w-full mb-8 p-8 border-2 border-dashed border-ivory-muted hover:border-ink transition-all group flex items-center justify-between"
              >
                <div className="flex items-center gap-6">
                  <div className="w-16 h-16 border border-ink flex items-center justify-center group-hover:bg-ink group-hover:text-ivory transition-all">
                    {isUploading ? <Loader2 size={24} className="animate-spin" /> : <UploadCloud size={24} />}
                  </div>
                  <div className="text-left">
                    <h3 className="font-display text-xl font-medium mb-1">
                      {isUploading ? 'Importiere...' : 'Datei importieren'}
                    </h3>
                    <p className="text-body-md text-text-secondary">
                      PDF, Bilder oder Texte hochladen
                    </p>
                  </div>
                </div>
                <ArrowUpRight size={24} className="text-text-muted group-hover:text-ink transition-colors" />
              </motion.button>

              {/* Folders Grid - Asymmetric */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {folders.map((folder, index) => (
                  <motion.div 
                    key={folder.label}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: 0.2 + index * 0.1 }}
                    onClick={() => {
                      setViewingFile({
                        name: `${folder.label}-Zusammenfassung`,
                        type: "PDF Dokument",
                        content: `Dies ist eine automatisch generierte Zusammenfassung für das Thema ${folder.label}. Alle relevanten Fakten aus deinen Mitschriften wurden hier konsolidiert.`
                      });
                      setViewMode('viewer');
                    }}
                    className="card-editorial group cursor-pointer relative overflow-hidden"
                  >
                    {/* Accent Border */}
                    <div className="absolute left-0 top-0 bottom-0 w-1" style={{ backgroundColor: folder.color }} />
                    
                    <div className="flex justify-between items-start mb-8">
                      <div className={`w-14 h-14 ${folder.bg} flex items-center justify-center border`} style={{ borderColor: folder.color, color: folder.color }}>
                        <Folder size={24} />
                      </div>
                      <span className="text-caption text-text-muted">{folder.count} Notizen</span>
                    </div>
                    
                    <h3 className="font-display text-2xl font-medium mb-2 text-ink group-hover:opacity-80 transition-all" style={{ ['--hover-color' as string]: folder.color }}>
                      <span className="group-hover:text-[color:var(--hover-color)] transition-colors duration-300">
                        {folder.label}
                      </span>
                    </h3>
                    <p className="text-body-md text-text-secondary mb-6">{folder.subtitle}</p>
                    
                    {/* Progress Bar - Editorial */}
                    <div className="flex items-center gap-4">
                      <div className="flex-1 h-0.5 bg-ivory-muted overflow-hidden">
                        <motion.div 
                          initial={{ width: 0 }}
                          animate={{ width: '75%' }}
                          transition={{ delay: 0.5 + index * 0.1, duration: 0.8 }}
                          className="h-full"
                          style={{ backgroundColor: folder.color }}
                        />
                      </div>
                      <span className="text-caption text-text-muted">75%</span>
                    </div>
                  </motion.div>
                ))}
              </div>

              {/* Recent Activity Section */}
              <motion.div
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 }}
                className="mt-10 pt-10 border-t border-ivory-muted"
              >
                <h3 className="font-display text-xl font-medium mb-6">Kürzlich bearbeitet</h3>
                <div className="space-y-3">
                  {[
                    { title: 'Zellatmung - Mitochondrien', time: 'Vor 2 Stunden', type: 'PDF' },
                    { title: 'Französische Revolution', time: 'Gestern', type: 'Notiz' },
                    { title: 'Analysis Grundlagen', time: 'Vor 3 Tagen', type: 'PDF' },
                  ].map((item, i) => (
                    <div key={i} className="flex items-center justify-between py-4 border-b border-ivory-muted/50 hover:bg-ivory-warm/50 px-4 -mx-4 transition-colors cursor-pointer group">
                      <div className="flex items-center gap-4">
                        <FileText size={18} className="text-text-muted" />
                        <span className="font-body text-text-primary group-hover:text-accent-burnt transition-colors">{item.title}</span>
                      </div>
                      <div className="flex items-center gap-6">
                        <span className="text-caption text-text-muted">{item.type}</span>
                        <span className="text-caption text-text-muted flex items-center gap-1">
                          <Clock size={12} />
                          {item.time}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </motion.div>
            </motion.div>
          )}

          {/* GRAPH VIEW */}
          {viewMode === 'graph' && (
            <motion.div
              key="graph"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full relative overflow-hidden bg-ivory-warm"
            >
              <div className="absolute inset-0 z-10">
                {/* Connection Lines */}
                <svg className="absolute inset-0 w-full h-full pointer-events-none">
                  {nodes.map(node => 
                    node.connections.map(targetId => {
                      const target = nodes.find(n => n.id === targetId);
                      if (!target || parseInt(node.id) > parseInt(target.id)) return null;
                      
                      const isHighlighted = selectedNodeId === node.id || selectedNodeId === target.id;
                      const isDimmed = selectedNodeId && !isHighlighted;
                      
                      return (
                        <motion.line
                          key={`${node.id}-${target.id}`}
                          initial={{ pathLength: 0, opacity: 0 }}
                          animate={{ 
                            pathLength: 1,
                            opacity: isDimmed ? 0.05 : (isHighlighted ? 1 : 0.3),
                            stroke: isHighlighted ? '#0a0a0f' : '#4a4a52',
                            strokeWidth: isHighlighted ? 2 : 1
                          }}
                          transition={{ duration: 1, ease: "easeOut" }}
                          x1={`${node.x}%`} y1={`${node.y}%`}
                          x2={`${target.x}%`} y2={`${target.y}%`}
                        />
                      );
                    })
                  )}
                </svg>
                
                {/* Nodes */}
                {filteredNodes.map(node => (
                  <Node 
                    key={node.id} 
                    node={node}
                    active={selectedNodeId === node.id}
                    dimmed={!!selectedNodeId && selectedNodeId !== node.id && !selectedNode?.connections.includes(node.id)}
                    onClick={() => setSelectedNodeId(node.id === selectedNodeId ? null : node.id)} 
                  />
                ))}
              </div>

              {/* Graph Info Panel */}
              <AnimatePresence>
                {selectedNode && (
                  <motion.div
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    className="absolute right-8 top-8 w-80 bg-ivory border border-ivory-muted p-6 z-20 shadow-2xl"
                  >
                    <div className="flex items-center justify-between mb-4">
                      <span className="text-caption text-accent-slate">{selectedNode.category}</span>
                      <button 
                        onClick={() => setSelectedNodeId(null)}
                        className="text-text-muted hover:text-ink"
                      >
                        ×
                      </button>
                    </div>
                    <h3 className="font-display text-2xl font-medium mb-4">{selectedNode.label}</h3>
                    <div className="space-y-2">
                      <p className="text-body-md text-text-secondary">
                        {selectedNode.connections.length} Verbindungen
                      </p>
                      <div className="flex flex-wrap gap-2 mt-4">
                        {selectedNode.connections.map(connId => {
                          const conn = nodes.find(n => n.id === connId);
                          return conn ? (
                            <span key={connId} className="text-caption px-3 py-1 bg-ivory-warm border border-ivory-muted">
                              {conn.label}
                            </span>
                          ) : null;
                        })}
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}

          {/* VIEWER VIEW */}
          {viewMode === 'viewer' && viewingFile && (
            <motion.div
              key="viewer"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex overflow-hidden relative bg-ivory-warm"
            >
              {/* Floating Toggle Buttons */}
              <AnimatePresence>
                {!showLeftSidebar && (
                  <motion.button
                    initial={{ x: -20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -20, opacity: 0 }}
                    onClick={() => setShowLeftSidebar(true)}
                    className="absolute left-4 top-4 z-40 p-3 bg-ivory border border-ivory-muted text-text-muted hover:text-ink hover:border-ink transition-all"
                  >
                    <Layers size={16} />
                  </motion.button>
                )}
              </AnimatePresence>

              {/* Document Sidebar */}
              <AnimatePresence>
                {showLeftSidebar && (
                  <motion.div 
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 220, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    className="bg-ivory border-r border-ivory-muted flex flex-col overflow-hidden"
                  >
                    <div className="p-6 flex items-center justify-between border-b border-ivory-muted">
                      <span className="text-caption text-text-muted">Inhalt</span>
                      <button 
                        onClick={() => setShowLeftSidebar(false)} 
                        className="text-text-muted hover:text-ink transition-colors"
                      >
                        <ChevronLeft size={16} />
                      </button>
                    </div>
                    <div className="flex-1 overflow-y-auto py-4">
                      {['Übersicht', 'Kernkonzept', 'Analyse', 'Quellen'].map((item, i) => (
                        <div 
                          key={item} 
                          className={`px-6 py-3 cursor-pointer transition-colors ${
                            i === 0 ? 'text-ink font-medium border-l-2 border-ink' : 'text-text-secondary hover:text-ink hover:bg-ivory-warm'
                          }`}
                        >
                          <span className="text-body-md">{item}</span>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Main Reading Area */}
              <div className="flex-1 overflow-y-auto p-12 flex justify-center">
                <motion.div 
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="w-full max-w-3xl bg-ivory shadow-2xl p-16 min-h-[1200px] relative"
                >
                  {/* Page Number */}
                  <div className="absolute top-8 right-8 text-caption text-text-muted">
                    Seite 1 von 1
                  </div>
                  
                  {/* Document Header */}
                  <div className="mb-12">
                    <div className="flex items-center gap-4 mb-6">
                      <span className="text-caption px-3 py-1 border border-ink text-ink">Geprüft</span>
                      <span className="text-caption text-text-muted">{new Date().toLocaleDateString('de-DE')}</span>
                    </div>
                    <h1 className="font-display text-5xl font-medium text-ink mb-6 leading-tight">
                      {viewingFile.name}
                    </h1>
                    <div className="h-0.5 w-24 bg-accent-gold" />
                  </div>

                  {/* Content */}
                  <div className="space-y-6">
                    <p className="text-body-lg text-text-primary leading-relaxed">
                      {viewingFile.content}
                    </p>
                    <p className="text-body-lg text-text-primary leading-relaxed">
                      Die Energiegewinnung erfolgt in mehreren Schritten. Zunächst wird in der Glykolyse Glucose abgebaut. Dieser Prozess findet im Cytoplasma statt. Die Produkte werden dann in die Mitochondrien transportiert.
                    </p>
                    
                    {/* AI Insight Box */}
                    <div className="mt-12 p-8 bg-ivory-warm border border-ivory-muted">
                      <div className="flex items-center gap-3 mb-4">
                        <Sparkles size={20} className="text-accent-gold" />
                        <span className="text-caption text-accent-gold">KI-ERKENNTNIS</span>
                      </div>
                      <p className="text-body-md text-text-secondary italic">
                        Dieser Abschnitt ist eng verknüpft mit "Photosynthese" in deinem Wissensnetz.
                      </p>
                    </div>
                  </div>
                </motion.div>
              </div>

              {/* AI Assistant Sidebar */}
              <AnimatePresence>
                {showRightSidebar && (
                  <motion.div 
                    initial={{ width: 0, opacity: 0 }}
                    animate={{ width: 260, opacity: 1 }}
                    exit={{ width: 0, opacity: 0 }}
                    className="bg-ivory border-l border-ivory-muted flex flex-col overflow-hidden"
                  >
                    <div className="p-6 border-b border-ivory-muted flex justify-between items-center">
                      <div className="flex items-center gap-2">
                        <Sparkles size={14} className="text-accent-gold" />
                        <span className="text-caption text-text-muted">Assistent</span>
                      </div>
                      <button 
                        onClick={() => setShowRightSidebar(false)} 
                        className="text-text-muted hover:text-ink"
                      >
                        <ChevronRight size={16} />
                      </button>
                    </div>

                    <div className="flex-1 overflow-y-auto p-6 space-y-8">
                      {/* Key Concepts */}
                      <div>
                        <h4 className="text-caption text-text-muted mb-4">KERNBEGRIFFE</h4>
                        <div className="space-y-3">
                          {['Mitochondrien', 'ATP', 'Glykolyse'].map(term => (
                            <div key={term} className="group cursor-pointer">
                              <span className="text-body-md text-text-primary group-hover:text-accent-burnt transition-colors">
                                {term}
                              </span>
                              <div className="h-px bg-ivory-muted mt-2 group-hover:bg-accent-burnt transition-colors" />
                            </div>
                          ))}
                        </div>
                      </div>

                      {/* Actions */}
                      <div>
                        <h4 className="text-caption text-text-muted mb-4">AKTIONEN</h4>
                        <div className="space-y-2">
                          <button className="w-full py-3 px-4 border border-ivory-muted text-body-md text-text-secondary hover:border-ink hover:text-ink transition-all flex items-center justify-between group">
                            <span>Quiz starten</span>
                            <Zap size={14} className="text-text-muted group-hover:text-accent-gold" />
                          </button>
                          <button className="w-full py-3 px-4 border border-ivory-muted text-body-md text-text-secondary hover:border-ink hover:text-ink transition-all flex items-center justify-between group">
                            <span>Lernkarten</span>
                            <BookOpen size={14} className="text-text-muted group-hover:text-accent-gold" />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Input */}
                    <div className="p-4 border-t border-ivory-muted">
                      <div className="relative">
                        <input 
                          type="text"
                          placeholder="Frage stellen..."
                          className="w-full pl-3 pr-10 py-3 bg-ivory-warm border-none text-body-md outline-none placeholder:text-text-muted"
                        />
                        <Search size={14} className="absolute right-3 top-1/2 -translate-y-1/2 text-text-muted" />
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
