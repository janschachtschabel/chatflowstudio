import React, { useState, useCallback, useRef, useEffect } from 'react';
import ReactFlow, {
  useNodesState, useEdgesState, addEdge, Background, Controls, MiniMap,
  useReactFlow, ConnectionLineType, type Connection, type Edge, type Node, type ReactFlowInstance,
} from 'reactflow';
import {
  Download, Upload, Printer, LayoutTemplate,
  FileDown, ChevronDown, Info, X, HelpCircle, ChevronUp,
} from 'lucide-react';
import type { NodeData, PersonaConfig, BotConfig, FlowTemplate, DockedTool } from './types';
import { PALETTE_GROUPS, NODE_COLORS, NODE_LABELS, NODE_TYPE_MAP, DEFAULT_BOT_CONFIG, DEFAULT_PERSONAS } from './types';
import { nodeTypes } from './nodeTypes';
import PropertiesPanel from './PropertiesPanel';
import { exportToYaml, exportPersonaFiles, importFromYaml, buildPrintText } from './yamlUtils';
import { ALL_TEMPLATES } from './templates';

// ── Sidebar Help panel ────────────────────────────────────────────────────────

const HELP_ENTRIES: { emoji: string; label: string; text: string }[] = [
  { emoji: '▶️', label: 'Start',           text: 'Einstiegspunkt des Flows – genau einmal vorhanden.' },
  { emoji: '⏹️', label: 'Ende',            text: 'Beendet das Gespräch. Kann mehrfach eingesetzt werden.' },
  { emoji: '💬', label: 'Nachricht',       text: 'Bot sendet eine feste Nachricht. Unterstützt Persona-Varianten.' },
  { emoji: '🔘', label: 'Auswahl',         text: 'User wählt per Button. Jede Option kann Persona + Folgeschritt auslösen.' },
  { emoji: '✏️', label: 'Eingabe',         text: 'User tippt Freitext, der als Variable gespeichert wird.' },
  { emoji: '🗨️', label: 'Freier Chat',    text: 'Öffnet LLM-Dialog. MCP- und RAG-Tools andockbar.' },
  { emoji: '◇',  label: 'Weiche',          text: 'Verzweigt nach Bedingung, Persona oder Intent.' },
  { emoji: '🔧', label: 'MCP Tool',        text: 'Ruft einen MCP-Server auf. Als Anhang an Chat-Knoten dockbar.' },
  { emoji: '🗃️', label: 'RAG Suche',      text: 'Durchsucht eine Wissensbasis semantisch. (Planung)' },
  { emoji: '👤', label: 'Persona',         text: 'Setzt, erbt oder resettet die aktive Persona.' },
  { emoji: '🌐', label: 'API-Aufruf',      text: 'HTTP-Request mit Erfolg/Fehler-Ausgängen. Ergebnis als Variable.' },
  { emoji: '📝', label: 'Variable setzen', text: 'Schreibt Key=Value-Paare in den Kontext. Unterstützt {{ }}-Templates.' },
  { emoji: '🤝', label: 'Übergabe',        text: 'Übergibt an menschlichen Agenten – Ende des automatisierten Flows.' },
];

function SidebarHelp() {
  const [open, setOpen] = useState(false);
  return (
    <div className="border-t border-gray-100">
      <button
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center justify-between px-3 py-2 text-[10px] font-semibold text-gray-500 hover:bg-gray-50 transition-colors"
      >
        <span className="flex items-center gap-1.5">
          <HelpCircle size={12} /> Knotenhilfe
        </span>
        {open ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
      </button>
      {open && (
        <div className="max-h-72 overflow-y-auto px-2 pb-2 space-y-1.5">
          {HELP_ENTRIES.map(e => (
            <div key={e.label} className="bg-gray-50 rounded-md px-2 py-1.5">
              <p className="text-[10px] font-semibold text-gray-700">{e.emoji} {e.label}</p>
              <p className="text-[9px] text-gray-500 leading-snug mt-0.5">{e.text}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Main App (inner, needs ReactFlowProvider from main.tsx) ──────────────────

export default function App() {
  const firstTemplate = ALL_TEMPLATES[0];
  const [nodes, setNodes, onNodesChange] = useNodesState<NodeData>(firstTemplate.nodes);
  const [edges, setEdges, onEdgesChange] = useEdgesState(firstTemplate.edges);
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const [personas, setPersonas] = useState<PersonaConfig[]>(firstTemplate.personas);
  const [botConfig, setBotConfig] = useState<BotConfig>(firstTemplate.botConfig);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [showPrintModal, setShowPrintModal] = useState(false);
  const [printContent, setPrintContent] = useState('');
  const [rfInstance, setRfInstance] = useState<ReactFlowInstance | null>(null);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const { screenToFlowPosition } = useReactFlow();
  const fileInputRef = useRef<HTMLInputElement>(null);
  let nodeIdCounter = useRef(5000);

  const newNodeId = () => `node-${++nodeIdCounter.current}`;

  // ── Connections ─────────────────────────────────────────────────────────────
  const onConnect = useCallback(
    (params: Connection) => setEdges(eds => addEdge({ ...params, type: 'smoothstep' }, eds)),
    [setEdges],
  );

  // ── Node selection ──────────────────────────────────────────────────────────
  const onNodeClick = useCallback((_: React.MouseEvent, node: Node) => {
    setSelectedNodeId(node.id);
  }, []);

  const onPaneClick = useCallback(() => setSelectedNodeId(null), []);

  const selectedNode = nodes.find(n => n.id === selectedNodeId) ?? null;

  // ── Update node data ────────────────────────────────────────────────────────
  const onUpdateNode = useCallback((nodeId: string, patch: Partial<NodeData>) => {
    setNodes(nds => nds.map(n => n.id === nodeId ? { ...n, data: { ...n.data, ...patch } } : n));
  }, [setNodes]);

  // ── Delete selected node ─────────────────────────────────────────────────────────
  const deleteSelected = useCallback(() => {
    if (!selectedNodeId) return;
    setNodes(nds => nds.filter(n => n.id !== selectedNodeId));
    setEdges(eds => eds.filter(e => e.source !== selectedNodeId && e.target !== selectedNodeId));
    setSelectedNodeId(null);
  }, [selectedNodeId, setNodes, setEdges]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedNodeId && !(e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement || e.target instanceof HTMLSelectElement)) {
        deleteSelected();
      }
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [deleteSelected, selectedNodeId]);

  // ── postMessage bridge for iframe embedding (admin-dashboard) ───────────────
  useEffect(() => {
    const handler = (e: MessageEvent) => {
      if (e.data?.type === 'YAML_IMPORT' && typeof e.data.yaml === 'string') {
        try {
          const result = importFromYaml(e.data.yaml);
          setNodes(result.nodes);
          setEdges(result.edges);
          setPersonas(result.personas);
          setBotConfig(result.botConfig);
        } catch (err) {
          console.error('postMessage YAML_IMPORT failed:', err);
        }
      }
      if (e.data?.type === 'YAML_EXPORT_REQUEST') {
        try {
          const yamlStr = exportToYaml(nodes, edges, personas, botConfig);
          (e.source as Window)?.postMessage({ type: 'YAML_EXPORT', yaml: yamlStr }, '*');
        } catch (err) {
          console.error('postMessage YAML_EXPORT failed:', err);
        }
      }
    };
    window.addEventListener('message', handler);
    return () => window.removeEventListener('message', handler);
  }, [nodes, edges, personas, botConfig, setNodes, setEdges]);

  // ── Drag & Drop from palette ────────────────────────────────────────────────
  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const stepType = e.dataTransfer.getData('application/boerdi-node') as NodeData['stepType'];
    if (!stepType) return;

    const dropPos = screenToFlowPosition({ x: e.clientX, y: e.clientY });
    const nodeId = newNodeId();

    // ── Dock detection: tool/persona dropped onto a workflow node? ──────────
    const dockableTypes: NodeData['stepType'][] = ['tool_mcp', 'tool_rag', 'persona_set'];
    const workflowTypes: NodeData['stepType'][] = ['message', 'choice', 'input', 'chat'];

    if (dockableTypes.includes(stepType)) {
      const targetParent = nodes.find(n => {
        if (!workflowTypes.includes(n.data.stepType)) return false;
        const nx = n.position.x, ny = n.position.y;
        return dropPos.x >= nx && dropPos.x <= nx + 280 && dropPos.y >= ny && dropPos.y <= ny + 280;
      });

      if (targetParent) {
        const stepId = `${stepType}_${nodeId.slice(-3)}`;
        if (stepType === 'persona_set') {
          setNodes(nds => nds.map(n => n.id !== targetParent.id ? n : {
            ...n, data: { ...n.data, dockedPersona: { personaMode: 'set' as const } },
          }));
          setSelectedNodeId(targetParent.id);
        } else {
          const newTool: DockedTool = {
            stepId,
            stepType: stepType as 'tool_mcp' | 'tool_rag',
          };
          setNodes(nds => nds.map(n => n.id !== targetParent.id ? n : {
            ...n, data: {
              ...n.data,
              dockedTools: [...(n.data.dockedTools ?? []), newTool],
            },
          }));
          setSelectedNodeId(targetParent.id);
        }
        return;
      }
    }

    // Default: standalone node on canvas
    const data: NodeData = { stepType, stepId: `${stepType}_${nodeId.slice(-3)}` };
    setNodes(nds => [...nds, {
      id: nodeId,
      type: NODE_TYPE_MAP[stepType],
      position: dropPos,
      data,
    }]);
    setSelectedNodeId(nodeId);
  }, [nodes, screenToFlowPosition, setNodes]);

  // ── Load template ───────────────────────────────────────────────────────────
  const loadTemplate = (tpl: FlowTemplate) => {
    setNodes(tpl.nodes as Node<NodeData>[]);
    setEdges(tpl.edges);
    setPersonas(tpl.personas);
    setBotConfig(tpl.botConfig);
    setSelectedNodeId(null);
    setShowTemplateModal(false);
    setTimeout(() => rfInstance?.fitView({ padding: 0.1, duration: 400 }), 100);
  };

  // ── Export YAML + personas ──────────────────────────────────────────────────
  const downloadYaml = () => {
    const yamlStr = exportToYaml(nodes, edges, personas, botConfig);
    const blob = new Blob([yamlStr], { type: 'text/yaml' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'boerdi-config.yml';
    a.click();
  };

  const downloadPersonas = async () => {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    const folder = zip.folder('personas')!;
    const files = exportPersonaFiles(personas);
    Object.entries(files).forEach(([name, content]) => folder.file(name, content));
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'personas.zip';
    a.click();
  };

  const downloadAll = async () => {
    const { default: JSZip } = await import('jszip');
    const zip = new JSZip();
    zip.file('boerdi-config.yml', exportToYaml(nodes, edges, personas, botConfig));
    const personasFolder = zip.folder('assets/personas')!;
    Object.entries(exportPersonaFiles(personas)).forEach(([n, c]) => personasFolder.file(n, c));
    const blob = await zip.generateAsync({ type: 'blob' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'boerdi-export.zip';
    a.click();
  };

  // ── Import YAML ─────────────────────────────────────────────────────────────
  const onImportFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = ev => {
      try {
        const { nodes: n, edges: ed, personas: p, botConfig: bc } = importFromYaml(ev.target!.result as string);
        setNodes(n as Node<NodeData>[]);
        setEdges(ed);
        setPersonas(p.length ? p : DEFAULT_PERSONAS);
        setBotConfig(bc);
        setSelectedNodeId(null);
        setTimeout(() => rfInstance?.fitView({ padding: 0.1, duration: 400 }), 100);
      } catch (err) {
        alert('Fehler beim Einlesen der YAML-Datei: ' + (err as Error).message);
      }
    };
    reader.readAsText(file);
    e.target.value = '';
  };

  // ── Print / human-readable ──────────────────────────────────────────────────
  const openPrint = () => {
    setPrintContent(buildPrintText(nodes, edges, botConfig));
    setShowPrintModal(true);
  };

  const triggerPrint = () => window.print();

  // ── Fit view on load ────────────────────────────────────────────────────────
  const onInit = useCallback((instance: ReactFlowInstance) => {
    setRfInstance(instance);
    setTimeout(() => instance.fitView({ padding: 0.1, duration: 300 }), 100);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-gray-100 overflow-hidden">

      {/* ── HEADER ── */}
      <header className="flex items-center gap-3 px-4 py-2.5 bg-white border-b border-gray-200 shadow-sm z-10 no-print">
        <div className="flex items-center gap-2 mr-2">
          <span className="text-xl">🦉</span>
          <div>
            <span className="font-bold text-gray-800 text-sm">Boerdi Flow Studio</span>
            <span className="text-gray-400 text-xs ml-1">– visueller Flow-Editor</span>
          </div>
        </div>

        {/* Templates */}
        <button onClick={() => setShowTemplateModal(true)}
          className="flex items-center gap-1.5 text-xs bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg px-3 py-1.5 hover:bg-indigo-100 font-medium">
          <LayoutTemplate size={13} /> Vorlagen <ChevronDown size={11} />
        </button>

        <div className="h-5 w-px bg-gray-200 mx-1" />

        {/* Import */}
        <button onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-1.5 text-xs bg-gray-50 text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-100 font-medium">
          <Upload size={13} /> YAML importieren
        </button>
        <input ref={fileInputRef} type="file" accept=".yml,.yaml" className="hidden" onChange={onImportFile} />

        <div className="flex-1" />

        {/* Selected node info */}
        {selectedNode && (
          <div className={`flex items-center gap-1.5 text-xs px-2 py-1 rounded-full ${NODE_COLORS[selectedNode.data.stepType]?.header ?? 'bg-gray-500'} text-white`}>
            <span>{NODE_LABELS[selectedNode.data.stepType]}</span>
            <span className="opacity-70">#{selectedNode.data.stepId}</span>
            <button onClick={deleteSelected} className="ml-1 opacity-70 hover:opacity-100"><X size={11} /></button>
          </div>
        )}

        <div className="h-5 w-px bg-gray-200 mx-1" />

        {/* Print */}
        <button onClick={openPrint}
          className="flex items-center gap-1.5 text-xs bg-gray-50 text-gray-700 border border-gray-200 rounded-lg px-3 py-1.5 hover:bg-gray-100 font-medium">
          <Printer size={13} /> Drucken / Lesen
        </button>

        {/* Export */}
        <div className="relative group">
          <button className="flex items-center gap-1.5 text-xs bg-emerald-600 text-white rounded-lg px-3 py-1.5 hover:bg-emerald-700 font-medium">
            <FileDown size={13} /> Exportieren <ChevronDown size={11} />
          </button>
          <div className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg py-1 hidden group-hover:block z-50 w-48">
            <button onClick={downloadYaml} className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs hover:bg-gray-50">
              <Download size={12} /> boerdi-config.yml
            </button>
            <button onClick={downloadPersonas} className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs hover:bg-gray-50">
              <Download size={12} /> personas.zip
            </button>
            <div className="border-t border-gray-100 my-1" />
            <button onClick={downloadAll} className="flex items-center gap-2 w-full text-left px-3 py-2 text-xs hover:bg-gray-50 font-semibold text-emerald-700">
              <Download size={12} /> Alles als .zip
            </button>
          </div>
        </div>
      </header>

      {/* ── MAIN AREA ── */}
      <div className="flex flex-1 overflow-hidden">

        {/* ── LEFT: Node Palette ── */}
        <aside className="flex flex-col bg-white border-r border-gray-200 no-print" style={{ width: 164 }}>
          <div className="px-3 py-2 border-b border-gray-100">
            <p className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Baukasten</p>
            <p className="text-[9px] text-gray-300">Ziehen auf Canvas</p>
          </div>
          <div className="flex-1 overflow-y-auto py-2 px-2">
            {PALETTE_GROUPS.map(group => {
              const GROUP_ICONS: Record<string, string> = {
                Flow: '🔵 Flow',
                Weichen: '🟡 Weichen',
                Tools: '🟢 Tools',
                Persona: '🟣 Persona',
                Aktionen: '🟠 Aktionen',
              };
              return (
                <div key={group.group} className="mb-3">
                  <p className="text-[9px] font-bold text-gray-400 uppercase tracking-wider px-1 mb-1">
                    {GROUP_ICONS[group.group] ?? group.group}
                  </p>
                  <div className="space-y-1">
                    {group.items.map(({ type, emoji, desc }) => (
                      <div
                        key={type}
                        draggable
                        onDragStart={e => {
                          e.dataTransfer.setData('application/boerdi-node', type);
                          e.dataTransfer.effectAllowed = 'move';
                        }}
                        className={`flex items-center gap-2 px-2 py-1.5 rounded-lg border cursor-grab active:cursor-grabbing select-none transition-all hover:shadow-sm hover:scale-[1.02] ${NODE_COLORS[type].bg} ${NODE_COLORS[type].border}`}
                      >
                        <span className="text-sm leading-none flex-shrink-0">{emoji}</span>
                        <div className="min-w-0">
                          <p className={`text-[10px] font-semibold leading-tight truncate ${NODE_COLORS[type].header.replace('bg-', 'text-').replace(/-[0-9]+$/, '-700')}`}>
                            {NODE_LABELS[type]}
                          </p>
                          <p className="text-[9px] text-gray-400 leading-tight truncate">{desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ── Help panel ── */}
          <SidebarHelp />
        </aside>

        {/* ── CENTER: React Flow Canvas ── */}
        <div className="flex-1 relative" ref={wrapperRef}>
          <ReactFlow
            nodes={nodes}
            edges={edges}
            onNodesChange={onNodesChange}
            onEdgesChange={onEdgesChange}
            onConnect={onConnect}
            onNodeClick={onNodeClick}
            onPaneClick={onPaneClick}
            onDragOver={onDragOver}
            onDrop={onDrop}
            onInit={onInit}
            nodeTypes={nodeTypes}
            connectionLineType={ConnectionLineType.SmoothStep}
            defaultEdgeOptions={{ type: 'smoothstep', animated: false, style: { stroke: '#94a3b8', strokeWidth: 2 } }}
            deleteKeyCode={null}
            fitView
            fitViewOptions={{ padding: 0.15 }}
            proOptions={{ hideAttribution: true }}
          >
            <Background color="#e2e8f0" gap={20} size={1} />
            <Controls className="!shadow-md" />
            <MiniMap
              nodeColor={n => {
                const st = (n.data as NodeData).stepType;
                const colorMap: Record<string, string> = {
                  start: '#10b981', end: '#f43f5e',
                  message: '#2563eb', choice: '#4f46e5', input: '#0284c7', chat: '#1e40af',
                  gateway: '#f59e0b',
                  tool_mcp: '#0f766e', tool_rag: '#0d9488',
                  persona_set: '#9333ea',
                };
                return colorMap[st] ?? '#94a3b8';
              }}
              className="!shadow-md !rounded-lg"
            />
            {/* Empty state hint */}
            {nodes.length === 0 && (
              <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                <div className="text-center text-gray-400">
                  <p className="text-4xl mb-2">🦉</p>
                  <p className="text-sm font-medium">Knoten aus der Palette ziehen</p>
                  <p className="text-xs">oder eine Vorlage laden</p>
                </div>
              </div>
            )}
          </ReactFlow>
        </div>

        {/* ── RIGHT: Properties Panel ── */}
        <PropertiesPanel
          node={selectedNode}
          personas={personas}
          botConfig={botConfig}
          onUpdateNode={onUpdateNode}
          onUpdatePersonas={setPersonas}
          onUpdateBotConfig={setBotConfig}
        />
      </div>

      {/* ── TEMPLATE MODAL ── */}
      {showTemplateModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
            <div className="flex items-center justify-between px-6 py-4 border-b">
              <h2 className="text-base font-bold text-gray-800">Vorlage laden</h2>
              <button onClick={() => setShowTemplateModal(false)} className="text-gray-400 hover:text-gray-600"><X size={18} /></button>
            </div>
            <div className="p-6 grid grid-cols-1 gap-3">
              {ALL_TEMPLATES.map(tpl => (
                <button key={tpl.id} onClick={() => loadTemplate(tpl)}
                  className="flex items-start gap-4 p-4 rounded-xl border-2 border-gray-200 hover:border-indigo-400 hover:bg-indigo-50 text-left transition-all group">
                  <span className="text-3xl leading-none">{tpl.botConfig.avatar}</span>
                  <div>
                    <p className="font-semibold text-gray-800 group-hover:text-indigo-700 text-sm">{tpl.name}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{tpl.description}</p>
                    <p className="text-[10px] text-gray-400 mt-1">{tpl.nodes.length} Knoten · {tpl.personas.length} Personas</p>
                  </div>
                </button>
              ))}
              <button onClick={() => { setNodes([]); setEdges([]); setPersonas(DEFAULT_PERSONAS); setBotConfig(DEFAULT_BOT_CONFIG); setSelectedNodeId(null); setShowTemplateModal(false); }}
                className="flex items-center gap-3 p-4 rounded-xl border-2 border-dashed border-gray-300 hover:border-red-300 hover:bg-red-50 text-left transition-all group">
                <span className="text-3xl leading-none">➕</span>
                <div>
                  <p className="font-semibold text-gray-600 group-hover:text-red-600 text-sm">Leerer Flow</p>
                  <p className="text-xs text-gray-400">Mit einem leeren Canvas starten</p>
                </div>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── PRINT / READABLE VIEW MODAL ── */}
      {showPrintModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-2xl shadow-2xl flex flex-col" style={{ width: '90%', maxWidth: 800, height: '85vh' }}>
            <div className="flex items-center justify-between px-6 py-4 border-b flex-shrink-0">
              <h2 className="text-base font-bold text-gray-800">Flow-Dokumentation (lesbare Ansicht)</h2>
              <div className="flex items-center gap-2">
                <button onClick={triggerPrint}
                  className="flex items-center gap-1.5 text-xs bg-indigo-600 text-white rounded-lg px-3 py-1.5 hover:bg-indigo-700">
                  <Printer size={12} /> Drucken
                </button>
                <button onClick={() => {
                  const blob = new Blob([printContent], { type: 'text/markdown' });
                  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'flow-dokumentation.md'; a.click();
                }} className="flex items-center gap-1.5 text-xs bg-gray-100 text-gray-700 rounded-lg px-3 py-1.5 hover:bg-gray-200">
                  <FileDown size={12} /> .md herunterladen
                </button>
                <button onClick={() => setShowPrintModal(false)} className="text-gray-400 hover:text-gray-600 ml-2"><X size={18} /></button>
              </div>
            </div>
            <div className="flex-1 overflow-y-auto p-6">
              <pre className="whitespace-pre-wrap text-xs font-mono text-gray-700 leading-relaxed print-only-content">
                {printContent}
              </pre>
            </div>
          </div>
        </div>
      )}

      {/* ── BOTTOM STATUS BAR ── */}
      <footer className="flex items-center gap-4 px-4 py-1.5 bg-white border-t border-gray-200 text-[10px] text-gray-400 no-print">
        <span>🦉 Boerdi Flow Studio</span>
        <span>·</span>
        <span>{nodes.length} Knoten</span>
        <span>·</span>
        <span>{edges.length} Verbindungen</span>
        <span>·</span>
        <span>{personas.length} Personas</span>
        <span>·</span>
        <span>{botConfig.name} {botConfig.avatar}</span>
        <div className="flex-1" />
        <span className="flex items-center gap-1 text-blue-400">
          <Info size={10} /> Klicken zum Auswählen · Drag für Verbindungen · Del zum Löschen
        </span>
      </footer>
    </div>
  );
}
