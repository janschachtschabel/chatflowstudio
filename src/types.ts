// ── Node categories ───────────────────────────────────────────────────────────
//
//  FLOW (blau)   – Kernschritte des Gesprächs
//    start       Event: Einstieg
//    end         Event: Abschluss
//    message     Task: Bot sendet Nachricht
//    choice      Task: User wählt eine oder mehrere Optionen
//    input       Task: User tippt Freitext
//    chat        Task: Freier LLM-Dialog
//
//  GATEWAY (amber) – Verzweigungen (BPMN-inspiriert)
//    gateway     XOR-Weiche: nach Bedingung, Persona oder Intent
//
//  TOOLS (teal) – Datenbeschaffung / externe Dienste
//    tool_mcp    Service-Task: MCP-Server-Aufruf (URL + Tools konfigurierbar)
//    tool_rag    Service-Task: RAG-Wissensbasis-Abfrage
//
//  PERSONA (lila) – Persona-Steuerung
//    persona_set Persona zuweisen / wechseln / zurücksetzen
//
//  AKTIONEN (orange) – Allgemeine Automatisierungsschritte
//    api_call    HTTP-Aufruf mit Ergebnisspeicherung + Erfolg/Fehler-Zweige
//    set_var     Variable(n) im Kontext setzen / transformieren
//    handoff     Übergabe an menschlichen Agenten

export type FlowStepType =
  | 'start' | 'end'
  | 'message' | 'choice' | 'input' | 'chat'
  | 'gateway'
  | 'tool_mcp' | 'tool_rag'
  | 'persona_set'
  | 'api_call' | 'set_var' | 'handoff';

// ── Supporting interfaces ─────────────────────────────────────────────────────

export interface FlowOption {
  id: string;
  label: string;
  value: string;
  uri?: string;
  persona?: string;   // activates this persona when chosen
  primary?: boolean;
}

/** One branch of a Gateway node */
export interface GatewayBranch {
  id: string;
  label: string;
  // For splitBy='condition':
  field?: string;
  operator?: 'equals' | 'not_equals' | 'contains';
  value?: string;
  // For splitBy='persona':
  personaId?: string;
  // For splitBy='intent':
  intentPattern?: string;
}

/** One knowledge base selectable in a RAG node */
export interface RagBase {
  id: string;
  label: string;
  description?: string;
}

// ── Docked attachment interfaces (defined before NodeData) ────────────────────

export interface DockedTool {
  stepId: string;
  stepType: 'tool_mcp' | 'tool_rag';
  message?: string;
  mcpServer?: string;
  mcpTools?: string[];
  toolParams?: Record<string, string>;
  personaToolParams?: Record<string, Record<string, string>>;
  ragBases?: RagBase[];
  queryTemplate?: string;
}

export interface DockedPersona {
  personaMode: 'set' | 'default' | 'inherit';
  personaId?: string;
}

// ── NodeData ──────────────────────────────────────────────────────────────────

export interface NodeData {
  stepType: FlowStepType;
  stepId: string;

  // ── Universal ──────────────────────────────────────────────────────────────
  message?: string;
  personaMessages?: Record<string, string>;  // persona-id → message text
  suggestions?: string[];
  notes?: string;

  // ── FLOW: choice ──────────────────────────────────────────────────────────
  options?: FlowOption[];
  multiSelect?: boolean;      // true = multiple allowed (checkbox style)
  skipLabel?: string;
  field?: string;             // profile field to store the answer in

  // ── FLOW: input ────────────────────────────────────────────────────────────
  placeholder?: string;       // also used as hint in choice

  // ── GATEWAY ────────────────────────────────────────────────────────────────
  splitBy?: 'condition' | 'persona' | 'intent';
  branches?: GatewayBranch[];

  // ── TOOLS: tool_mcp ────────────────────────────────────────────────────────
  mcpServer?: string;         // overrides botConfig.mcpServerUrl when set
  mcpTools?: string[];        // [] = all available tools; or list specific names
  toolParams?: Record<string, string>;
  personaToolParams?: Record<string, Record<string, string>>;

  // ── TOOLS: tool_rag ────────────────────────────────────────────────────────
  ragBases?: RagBase[];
  queryTemplate?: string;

  // ── PERSONA: persona_set ───────────────────────────────────────────────────
  personaMode?: 'inherit' | 'default' | 'set';
  personaId?: string;

  // ── AKTIONEN: api_call ─────────────────────────────────────────────────────
  apiUrl?: string;                           // URL, supports {{ }} templates
  apiMethod?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  apiHeaders?: Record<string, string>;       // optional request headers
  apiBody?: string;                          // JSON body template
  apiResultVar?: string;                     // context key to store response

  // ── AKTIONEN: set_var ──────────────────────────────────────────────────────
  variables?: Array<{ key: string; value: string }>;  // key = value (template)

  // ── AKTIONEN: handoff ─────────────────────────────────────────────────────
  handoffTarget?: string;                    // queue / agent group name
  handoffMessage?: string;                   // optional farewell message

  // ── DOCKED ATTACHMENTS ────────────────────────────────────────────
  // Tool and persona modules rendered inline within this workflow node
  dockedTools?: DockedTool[];
  dockedPersona?: DockedPersona;
}

// ── Project-level config ──────────────────────────────────────────────────────

export interface PersonaConfig {
  id: string;
  label: string;
  uri: string;
  systemPrompt: string;
}

export interface BotConfig {
  name: string;
  avatar: string;
  tagline: string;
  apiModel: string;
  mcpServerUrl: string;
  defaultPersona?: string;  // persona-id active when none set; empty = no persona
}

export interface FlowTemplate {
  id: string;
  name: string;
  description: string;
  nodes: import('reactflow').Node<NodeData>[];
  edges: import('reactflow').Edge[];
  personas: PersonaConfig[];
  botConfig: BotConfig;
}

// ── Node type → React Flow component mapping ──────────────────────────────────

export const NODE_TYPE_MAP: Record<FlowStepType, string> = {
  start:       'startNode',
  end:         'endNode',
  message:     'messageNode',
  choice:      'choiceNode',
  input:       'inputNode',
  chat:        'chatNode',
  gateway:     'gatewayNode',
  tool_mcp:    'toolMcpNode',
  tool_rag:    'toolRagNode',
  persona_set: 'personaSetNode',
  api_call:    'apiCallNode',
  set_var:     'setVarNode',
  handoff:     'handoffNode',
};

export const NODE_LABELS: Record<FlowStepType, string> = {
  start:       'Start',
  end:         'Ende',
  message:     'Nachricht',
  choice:      'Auswahl',
  input:       'Eingabe',
  chat:        'Freier Chat',
  gateway:     'Weiche',
  tool_mcp:    'MCP Tool',
  tool_rag:    'RAG Suche',
  persona_set: 'Persona',
  api_call:    'API-Aufruf',
  set_var:     'Variable setzen',
  handoff:     'Übergabe',
};

// Color families:
//   Flow events  → emerald / rose
//   Flow tasks   → blue family (same family, different shades)
//   Gateway      → amber
//   Tools        → teal
//   Persona      → purple
export const NODE_COLORS: Record<FlowStepType, { bg: string; border: string; header: string; text: string }> = {
  start:       { bg: 'bg-emerald-50', border: 'border-emerald-400', header: 'bg-emerald-600', text: 'text-white' },
  end:         { bg: 'bg-rose-50',    border: 'border-rose-400',    header: 'bg-rose-600',    text: 'text-white' },
  message:     { bg: 'bg-blue-50',    border: 'border-blue-300',    header: 'bg-blue-600',    text: 'text-white' },
  choice:      { bg: 'bg-blue-50',    border: 'border-blue-300',    header: 'bg-indigo-600',  text: 'text-white' },
  input:       { bg: 'bg-blue-50',    border: 'border-blue-300',    header: 'bg-sky-600',     text: 'text-white' },
  chat:        { bg: 'bg-blue-50',    border: 'border-blue-300',    header: 'bg-blue-800',    text: 'text-white' },
  gateway:     { bg: 'bg-amber-50',   border: 'border-amber-400',   header: 'bg-amber-500',   text: 'text-white' },
  tool_mcp:    { bg: 'bg-teal-50',    border: 'border-teal-300',    header: 'bg-teal-700',    text: 'text-white' },
  tool_rag:    { bg: 'bg-teal-50',    border: 'border-teal-300',    header: 'bg-teal-600',    text: 'text-white' },
  persona_set: { bg: 'bg-purple-50',  border: 'border-purple-300',  header: 'bg-purple-600',  text: 'text-white' },
  api_call:    { bg: 'bg-orange-50',  border: 'border-orange-300',  header: 'bg-orange-600',  text: 'text-white' },
  set_var:     { bg: 'bg-orange-50',  border: 'border-orange-300',  header: 'bg-orange-500',  text: 'text-white' },
  handoff:     { bg: 'bg-orange-50',  border: 'border-orange-300',  header: 'bg-orange-800',  text: 'text-white' },
};

// Palette groups shown in sidebar
export const PALETTE_GROUPS: { group: string; items: { type: FlowStepType; emoji: string; desc: string }[] }[] = [
  {
    group: 'Flow',
    items: [
      { type: 'start',   emoji: '▶️', desc: 'Start' },
      { type: 'message', emoji: '💬', desc: 'Bot-Nachricht' },
      { type: 'choice',  emoji: '🔘', desc: 'Auswahl' },
      { type: 'input',   emoji: '✏️', desc: 'Freitext-Eingabe' },
      { type: 'chat',    emoji: '🗨️', desc: 'Freier Chat' },
      { type: 'end',     emoji: '⏹️', desc: 'Ende' },
    ],
  },
  {
    group: 'Weichen',
    items: [
      { type: 'gateway', emoji: '◇', desc: 'Weiche / Verzweigung' },
    ],
  },
  {
    group: 'Tools',
    items: [
      { type: 'tool_mcp', emoji: '🔧', desc: 'MCP-Dienst' },
      { type: 'tool_rag', emoji: '�️', desc: 'RAG-Wissensbasis' },
    ],
  },
  {
    group: 'Persona',
    items: [
      { type: 'persona_set', emoji: '👤', desc: 'Persona zuweisen' },
    ],
  },
  {
    group: 'Aktionen',
    items: [
      { type: 'api_call', emoji: '🌐', desc: 'HTTP-Aufruf / REST API' },
      { type: 'set_var',  emoji: '📝', desc: 'Variable setzen' },
      { type: 'handoff',  emoji: '🤝', desc: 'An Mensch übergeben' },
    ],
  },
];

// Flat list for drag-and-drop detection
export const PALETTE_NODES = PALETTE_GROUPS.flatMap(g => g.items);

export const DEFAULT_BOT_CONFIG: BotConfig = {
  name: 'Boerdi',
  avatar: '🦉',
  tagline: 'Dein persönlicher Guide für WirLernenOnline.de',
  apiModel: 'gpt-4.1-mini',
  mcpServerUrl: 'https://wlo-mcp-server.vercel.app/mcp',
  defaultPersona: '',
};

export const DEFAULT_PERSONAS: PersonaConfig[] = [
  { id: 'learner',    label: 'Lerner/in',  uri: 'http://w3id.org/openeduhub/vocabs/intendedEndUserRole/learner',    systemPrompt: '# Lerner/in\n\nDu bist Boerdi, ein freundlicher Lernbegleiter. Sprich Schüler:innen und Lernende direkt an (Du). Nutze einfache, klare Sprache und erkläre Konzepte anschaulich.' },
  { id: 'teacher',   label: 'Lehrer/in',  uri: 'http://w3id.org/openeduhub/vocabs/intendedEndUserRole/teacher',   systemPrompt: '# Lehrer/in\n\nDu bist Boerdi, ein professioneller Assistent für Lehrende. Sieze die Nutzer:innen. Gehe auf fachdidaktische und methodische Aspekte ein. Weise auf Differenzierungsmöglichkeiten hin.' },
  { id: 'counsellor',label: 'Berater/in', uri: 'http://w3id.org/openeduhub/vocabs/intendedEndUserRole/counsellor', systemPrompt: '# Berater/in\n\nDu bist Boerdi, ein Assistent für Bildungsberatende. Sieze die Nutzer:innen. Gehe auf strukturelle und organisatorische Fragen ein. Liefere überblickartige Informationen.' },
  { id: 'parent',    label: 'Eltern',     uri: 'http://w3id.org/openeduhub/vocabs/intendedEndUserRole/parent',    systemPrompt: '# Eltern\n\nDu bist Boerdi, ein freundlicher Assistent für Eltern. Erkläre Inhalte verständlich, gehe auf häusliches Lernen und Unterstützung der Kinder ein. Sprich die Nutzer:innen mit Sie an.' },
  { id: 'author',    label: 'Autor/in',   uri: 'http://w3id.org/openeduhub/vocabs/intendedEndUserRole/author',    systemPrompt: '# Autor/in\n\nDu bist Boerdi, ein Assistent für Materialersteller:innen. Sieze die Nutzer:innen. Gehe auf OER-Lizenzierung, Metadatenqualität und didaktische Aufbereitung ein.' },
  { id: 'manager',   label: 'Verwaltung', uri: 'http://w3id.org/openeduhub/vocabs/intendedEndUserRole/manager',   systemPrompt: '# Verwaltung / Schulleitung\n\nDu bist Boerdi, ein Assistent für Verwaltung und Schulleitung. Sieze die Nutzer:innen. Liefere überblickartige Ressourcenübersichten und beziehe dich auf Schulentwicklung.' },
  { id: 'other',     label: 'Andere',     uri: 'http://w3id.org/openeduhub/vocabs/intendedEndUserRole/other',     systemPrompt: '# Allgemein\n\nDu bist Boerdi, ein hilfreicher Assistent für WirLernenOnline.de. Hilf beim Erkunden von Bildungsressourcen.' },
];
