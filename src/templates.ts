import type { Node, Edge } from 'reactflow';
import type { NodeData, FlowTemplate, DockedTool, DockedPersona } from './types';
import { DEFAULT_BOT_CONFIG, DEFAULT_PERSONAS } from './types';

// ── Helpers ───────────────────────────────────────────────────────────────────

let idSeq = 1;
const id = () => `n${idSeq++}`;

function makeNode(nodeId: string, type: string, x: number, y: number, data: NodeData): Node<NodeData> {
  return { id: nodeId, type, position: { x, y }, data };
}

function makeEdge(source: string, target: string, opts: Partial<Edge> = {}): Edge {
  return {
    id: `e-${source}-${opts.sourceHandle ?? 'out'}-${target}`,
    source, target,
    sourceHandle: opts.sourceHandle ?? 'out',
    targetHandle: opts.targetHandle ?? 'in',
    ...opts,
  };
}

// ── Template 1: WLO Boerdi – aktueller Produktionsflow ───────────────────────
//
//  Start → Willkommen → [persona_set: inherit]
//       → Rollenauswahl (choice, setzt Persona)
//       → Bildungsstufe (choice)  → Thema (input)
//       → MCP Sammlungssuche (tool_mcp)
//       → MCP Inhalte (tool_mcp, persona-spezifische Params)
//       → Chat → Ende
//
//  Persona-Nachrichten auf choice + input zeigen, wie sich Boerdi je Rolle anpasst.

export function buildBoerdiWloTemplate(): FlowTemplate {
  idSeq = 100;
  const nStart = id(), nWelcome = id(), nRole = id();
  const nEdu = id(), nInterest = id(), nChat = id(), nEnd = id();

  const nodes: Node<NodeData>[] = [
    makeNode(nStart,   'startNode',   80,   300, { stepType: 'start', stepId: '__start' }),
    makeNode(nWelcome, 'messageNode', 264,  300, {
      stepType: 'message', stepId: 'welcome',
      message: 'Hi, ich bin **Boerdi** 🦉 und möchte dich bei der Suche nach Bildungsressourcen unterstützen!\n\nAuf **WirLernenOnline.de** findest du tausende freie Bildungsmaterialien (OER) – und ich helfe dir, genau das Richtige für dich zu entdecken. 👇',
    }),
    makeNode(nRole, 'choiceNode', 624, 300, {
      stepType: 'choice', stepId: 'role', field: 'role',
      message: 'Für wen suchst du Materialien? Das hilft mir, besser auf dich einzugehen.',
      options: [
        { id: 'opt-0', label: '🎒 Ich lerne (Schüler/in, Student/in)',      value: 'learner',    uri: 'http://w3id.org/openeduhub/vocabs/intendedEndUserRole/learner',    persona: 'learner',    primary: true },
        { id: 'opt-1', label: '📚 Ich unterrichte (Lehrer/in)',              value: 'teacher',    uri: 'http://w3id.org/openeduhub/vocabs/intendedEndUserRole/teacher',    persona: 'teacher' },
        { id: 'opt-2', label: '👪 Als Elternteil / Erziehungsberechtigte*r', value: 'parent',     uri: 'http://w3id.org/openeduhub/vocabs/intendedEndUserRole/parent',     persona: 'parent' },
        { id: 'opt-3', label: '🤝 Als Berater/in',                           value: 'counsellor', uri: 'http://w3id.org/openeduhub/vocabs/intendedEndUserRole/counsellor', persona: 'counsellor' },
        { id: 'opt-4', label: '✏️ Als Autor/in (Materialerstellung)',         value: 'author',     uri: 'http://w3id.org/openeduhub/vocabs/intendedEndUserRole/author',     persona: 'author' },
        { id: 'opt-5', label: '🏛️ Verwaltung / Schulleitung',                value: 'manager',    uri: 'http://w3id.org/openeduhub/vocabs/intendedEndUserRole/manager',    persona: 'manager' },
        { id: 'opt-6', label: '🔍 Anderes / Nur erkunden',                   value: 'other',      uri: 'http://w3id.org/openeduhub/vocabs/intendedEndUserRole/other',      persona: 'other' },
      ],
    }),
    makeNode(nEdu, 'choiceNode', 984, 300, {
      stepType: 'choice', stepId: 'educationLevel', field: 'educationLevels',
      personaMessages: {
        learner: 'In welcher Schulstufe lernst du gerade?', teacher: 'Für welche Bildungsstufen unterrichten Sie?',
        counsellor: 'Auf welche Bildungsstufen bezieht sich Ihre Beratungstätigkeit?', parent: 'Welche Schulstufe besucht Ihr Kind?',
        author: 'Für welche Bildungsstufen erstellen Sie Materialien?', manager: 'Welche Bildungsstufen umfasst Ihre Einrichtung?',
        other: 'Welche Bildungsbereiche interessieren dich?',
      },
      message: 'Welche Bildungsstufe interessiert dich?',
      options: [
        { id: 'opt-0',  label: '🧒 Elementarbereich',            value: 'elementarbereich',   uri: 'http://w3id.org/openeduhub/vocabs/educationalContext/elementarbereich' },
        { id: 'opt-1',  label: '🏫 Schule (allgemein)',           value: 'schule',             uri: 'http://w3id.org/openeduhub/vocabs/educationalContext/schule' },
        { id: 'opt-2',  label: '📗 Primarstufe (Grundschule)',    value: 'grundschule',        uri: 'http://w3id.org/openeduhub/vocabs/educationalContext/grundschule' },
        { id: 'opt-3',  label: '📘 Sekundarstufe I (Kl. 5–10)',  value: 'sekundarstufe_1',    uri: 'http://w3id.org/openeduhub/vocabs/educationalContext/sekundarstufe_1' },
        { id: 'opt-4',  label: '📙 Sekundarstufe II (Kl. 11–13)',value: 'sekundarstufe_2',    uri: 'http://w3id.org/openeduhub/vocabs/educationalContext/sekundarstufe_2' },
        { id: 'opt-5',  label: '🎓 Hochschule',                  value: 'hochschule',         uri: 'http://w3id.org/openeduhub/vocabs/educationalContext/hochschule' },
        { id: 'opt-6',  label: '🔧 Berufliche Bildung',          value: 'berufliche_bildung', uri: 'http://w3id.org/openeduhub/vocabs/educationalContext/berufliche_bildung' },
        { id: 'opt-7',  label: '📈 Fortbildung',                 value: 'fortbildung',        uri: 'http://w3id.org/openeduhub/vocabs/educationalContext/fortbildung' },
        { id: 'opt-8',  label: '🌱 Erwachsenenbildung',          value: 'erwachsenenbildung', uri: 'http://w3id.org/openeduhub/vocabs/educationalContext/erwachsenenbildung' },
        { id: 'opt-9',  label: '🌟 Förderschule',               value: 'foerderschule',      uri: 'http://w3id.org/openeduhub/vocabs/educationalContext/foerderschule' },
        { id: 'opt-10', label: '💻 Fernunterricht',              value: 'fernunterricht',     uri: 'http://w3id.org/openeduhub/vocabs/educationalContext/fernunterricht' },
        { id: 'opt-11', label: '🔓 Informelles Lernen',          value: 'informelles_lernen', uri: 'http://w3id.org/openeduhub/vocabs/educationalContext/informelles_lernen' },
      ],
    }),
    makeNode(nInterest, 'inputNode', 1344, 300, {
      stepType: 'input', stepId: 'interest', field: 'interest',
      personaMessages: {
        learner: 'Super! 🎉 Für welches **Thema** suchst du Lernmaterialien?',
        teacher: 'Für welches **Thema** suchen Sie Unterrichtsmaterialien?',
        counsellor: 'Zu welchem **Thema** suchen Sie Beratungs- oder Fördermaterial?',
        parent: 'Wobei möchtest du dein Kind unterstützen? Welches **Thema**?',
        author: 'Zu welchem **Thema** suchen Sie Quellen oder Inspiration?',
        manager: 'Zu welchem **Thema** suchen Sie Ressourcen für Ihre Einrichtung?',
        other: 'Für welches **Thema** soll ich suchen?',
      },
      message: 'Welches Thema interessiert dich?',
      placeholder: 'z.B. Mathematik Bruchrechnung, Klimawandel …',
      suggestions: [
        'Addition und Subtraktion', 'Klimawandel und Nachhaltigkeit', 'Demokratie und Gesellschaft',
        'Bruchrechnung', 'Deutsch Grammatik', 'Programmieren lernen',
        'Englisch Grundschule', 'Biologie Zelle', 'Geschichte Zweiter Weltkrieg', 'Physik Mechanik',
      ],
    }),

    // ── Chat-Knoten mit 2 inline gedockten MCP-Tools ────────────────────────
    makeNode(nChat, 'chatNode', 1704, 300, {
      stepType: 'chat', stepId: 'chat',
      personaMessages: {
        learner:    'Ich habe passende Themenseiten für dich gefunden! 😊 Stelle mir weitere Fragen – z.B. zu den Inhalten einer Sammlung.',
        teacher:    'Hier sind passende Sammlungen. Möchten Sie die Inhalte einer Sammlung sehen, oder haben Sie weitere Fragen?',
        counsellor: 'Hier sind passende Sammlungen zum Thema. Wie kann ich weiter helfen?',
        parent:     'Hier sind passende Themenseiten. Soll ich die Inhalte anzeigen oder ein anderes Thema erkunden?',
        author:     'Hier sind thematisch passende Sammlungen. Möchten Sie mehr dazu?',
        manager:    'Hier sind relevante Sammlungen für Ihre Einrichtung. Wie kann ich weiter helfen?',
        other:      'Hier sind die gefundenen Themenseiten. Wie kann ich weiter helfen?',
      },
      message: 'Hier sind passende Inhalte. Wie kann ich dir weiterhelfen?',
      suggestions: ['Zeig mir die Inhalte dieser Sammlung', 'Gibt es Untersammlungen dazu?', 'Suche nach einem anderen Thema', 'Was ist WirLernenOnline?', 'Gibt es Videos dazu?'],
      dockedTools: [
        {
          stepId: 'search_collections', stepType: 'tool_mcp',
          message: 'Suche passende Themenseiten …',
          mcpTools: ['search_wlo_collections'],
          toolParams: { query: '{{ profile.interest }}', educationLevel: '{{ profile.educationLevels }}' },
        } satisfies DockedTool,
        {
          stepId: 'search_content', stepType: 'tool_mcp',
          message: 'Lade Inhalte aus der Sammlung …',
          mcpTools: ['get_collection_contents'],
          toolParams: { nodeId: '{{ mcpResult.nodeId }}', maxResults: '4', contentFilter: 'files' },
          personaToolParams: {
            teacher: { maxResults: '8', contentFilter: 'files' },
            counsellor: { maxResults: '6', contentFilter: 'files' },
            author: { maxResults: '10', contentFilter: 'files' },
          },
        } satisfies DockedTool,
      ],
    }),
    makeNode(nEnd, 'endNode', 2064, 300, { stepType: 'end', stepId: '__end' }),
  ];

  const edges: Edge[] = [
    makeEdge(nStart,    nWelcome),
    makeEdge(nWelcome,  nRole),
    makeEdge(nRole,     nEdu),
    makeEdge(nEdu,      nInterest),
    makeEdge(nInterest, nChat),
    makeEdge(nChat,     nEnd),
  ];

  return {
    id: 'boerdi-wlo',
    name: '🦉 WLO Boerdi (Produktionsflow)',
    description: 'Linearer Flow · 7 Rollen · 12 Bildungsstufen · 2 MCP-Tools gedockt am Chat-Knoten',
    nodes, edges,
    personas: DEFAULT_PERSONAS,
    botConfig: DEFAULT_BOT_CONFIG,
  };
}

// ── Template 2: Persona-Weiche → je eigener MCP-Aufruf pro Zielgruppe ────────
//
//  Zeigt: Gateway (splitBy=persona) → 3 Zweige + Default
//
//  Rollenauswahl → Thema → Gateway (Persona-Weiche)
//    Zweig Lernende   → tool_mcp (Lernmaterialien, educationLevel)
//    Zweig Lehrende   → tool_mcp (Unterrichtsmaterialien, didaktisch, mehr Treffer)
//    Zweig Berater/in → tool_mcp (Beratungsressourcen, Projekt-Kontext)
//    Default (alle anderen) → tool_mcp (allgemein)
//  → Gemeinsamer Chat → Ende

// ── Template 2: Persona-Weiche → je eigener Chat+Tool pro Zielgruppe ─────────
//  Gateway (persona) → 4 Chat-Knoten, jeder mit einem gedockten MCP-Tool
//  → jede Persona bekommt einen eigenen Suchaufruf mit angepassten Parametern

export function buildPersonaDemoTemplate(): FlowTemplate {
  idSeq = 200;
  const nStart = id(), nWelcome = id(), nRole = id(), nInterest = id(), nGateway = id();
  const nChatLearner = id(), nChatTeacher = id(), nChatCounsellor = id(), nChatGeneral = id();
  const nEnd = id();

  //  Einstieg: x=80..1404 (linear, y=300)
  //  4 Chat-Zweige: x=1784, y=60/250/440/630
  //  End: x=2164, y=300

  const nodes: Node<NodeData>[] = [
    makeNode(nStart,   'startNode',   80,   300, { stepType: 'start', stepId: '__start' }),
    makeNode(nWelcome, 'messageNode', 264,  300, {
      stepType: 'message', stepId: 'welcome',
      message: 'Hallo! Ich bin **Boerdi** 🦉.\n\nWähle deine Rolle – die Suche wird automatisch auf dich abgestimmt.',
    }),
    makeNode(nRole, 'choiceNode', 644, 300, {
      stepType: 'choice', stepId: 'role', field: 'role',
      message: 'Für wen suchst du Materialien?',
      options: [
        { id: 'opt-0', label: '🎒 Lernende/r',  value: 'learner',    uri: 'http://w3id.org/openeduhub/vocabs/intendedEndUserRole/learner',    persona: 'learner',    primary: true },
        { id: 'opt-1', label: '📚 Lehrende/r',  value: 'teacher',    uri: 'http://w3id.org/openeduhub/vocabs/intendedEndUserRole/teacher',    persona: 'teacher' },
        { id: 'opt-2', label: '🤝 Berater/in',  value: 'counsellor', uri: 'http://w3id.org/openeduhub/vocabs/intendedEndUserRole/counsellor', persona: 'counsellor' },
        { id: 'opt-3', label: '🔍 Andere',      value: 'other',      uri: 'http://w3id.org/openeduhub/vocabs/intendedEndUserRole/other',      persona: 'other' },
      ],
    }),
    makeNode(nInterest, 'inputNode', 1024, 300, {
      stepType: 'input', stepId: 'interest', field: 'interest',
      personaMessages: {
        learner: '🎉 Für welches Thema suchst du Lernmaterialien?',
        teacher: 'Für welches Thema suchen Sie Unterrichtsmaterialien?',
        counsellor: 'Zu welchem Thema suchen Sie Beratungsressourcen?',
        other: 'Für welches Thema soll ich suchen?',
      },
      message: 'Welches Thema interessiert dich?',
      placeholder: 'z.B. Klimawandel, Bruchrechnung …',
      suggestions: ['Klimawandel', 'Bruchrechnung', 'Demokratie', 'Programmieren', 'Physik Mechanik'],
    }),
    makeNode(nGateway, 'gatewayNode', 1404, 300, {
      stepType: 'gateway', stepId: 'persona_weiche',
      splitBy: 'persona',
      branches: [
        { id: 'branch-0', label: 'Lernende/r',  personaId: 'learner' },
        { id: 'branch-1', label: 'Lehrende/r',  personaId: 'teacher' },
        { id: 'branch-2', label: 'Berater/in',  personaId: 'counsellor' },
      ],
    }),

    // ── Zweig Lernende (y=60) ─────────────────────────────────────────────────────
    makeNode(nChatLearner, 'chatNode', 1784, 60, {
      stepType: 'chat', stepId: 'chat_learner',
      message: 'Hier sind Lernmaterialien für dich! 😊 Hast du weitere Fragen?',
      suggestions: ['Zeig mehr', 'Anderes Thema', 'Was ist WirLernenOnline?'],
      dockedTools: [{ stepId: 'mcp_learner', stepType: 'tool_mcp', message: 'Suche Lernmaterialien …', mcpTools: ['search_wlo_collections'], toolParams: { query: '{{ profile.interest }}', educationLevel: '{{ profile.educationLevels }}', maxResults: '5', audience: 'learner' } } satisfies DockedTool],
    }),

    // ── Zweig Lehrende (y=250) ────────────────────────────────────────────────────
    makeNode(nChatTeacher, 'chatNode', 1784, 250, {
      stepType: 'chat', stepId: 'chat_teacher',
      message: 'Hier sind Unterrichtsmaterialien. Haben Sie weitere Fragen?',
      suggestions: ['Zeig mehr', 'Anderes Thema', 'Untersammlungen anzeigen'],
      dockedTools: [{ stepId: 'mcp_teacher', stepType: 'tool_mcp', message: 'Suche Unterrichtsmaterialien …', mcpTools: ['search_wlo_collections'], toolParams: { query: '{{ profile.interest }}', educationLevel: '{{ profile.educationLevels }}', maxResults: '10', audience: 'teacher', contentFilter: 'didactic' } } satisfies DockedTool],
    }),

    // ── Zweig Berater/in (y=440) ────────────────────────────────────────────────────
    makeNode(nChatCounsellor, 'chatNode', 1784, 440, {
      stepType: 'chat', stepId: 'chat_counsellor',
      message: 'Hier sind Beratungsressourcen. Wie kann ich weiter helfen?',
      suggestions: ['Zeig mehr', 'Anderes Thema', 'Überblick geben'],
      dockedTools: [{ stepId: 'mcp_counsellor', stepType: 'tool_mcp', message: 'Suche Beratungsressourcen …', mcpTools: ['search_wlo_collections'], toolParams: { query: '{{ profile.interest }}', maxResults: '8', audience: 'counsellor', contentFilter: 'overview' } } satisfies DockedTool],
    }),

    // ── Default-Zweig (y=630) ─────────────────────────────────────────────────────
    makeNode(nChatGeneral, 'chatNode', 1784, 630, {
      stepType: 'chat', stepId: 'chat_general',
      message: 'Hier sind passende Inhalte. Wie kann ich helfen?',
      suggestions: ['Zeig mehr', 'Anderes Thema', 'Was ist WirLernenOnline?'],
      dockedTools: [{ stepId: 'mcp_general', stepType: 'tool_mcp', message: 'Suche passende Inhalte …', mcpTools: ['search_wlo_collections'], toolParams: { query: '{{ profile.interest }}', maxResults: '6' } } satisfies DockedTool],
    }),

    makeNode(nEnd, 'endNode', 2164, 380, { stepType: 'end', stepId: '__end' }),
  ];

  const edges: Edge[] = [
    makeEdge(nStart,    nWelcome),
    makeEdge(nWelcome,  nRole),
    makeEdge(nRole,     nInterest),
    makeEdge(nInterest, nGateway),
    makeEdge(nGateway, nChatLearner,   { sourceHandle: 'branch-0', label: '🎒 Lernende/r' }),
    makeEdge(nGateway, nChatTeacher,   { sourceHandle: 'branch-1', label: '📚 Lehrende/r' }),
    makeEdge(nGateway, nChatCounsellor,{ sourceHandle: 'branch-2', label: '🤝 Berater/in' }),
    makeEdge(nGateway, nChatGeneral,   { sourceHandle: 'default',  label: 'Alle anderen' }),
    makeEdge(nChatLearner,    nEnd),
    makeEdge(nChatTeacher,    nEnd),
    makeEdge(nChatCounsellor, nEnd),
    makeEdge(nChatGeneral,    nEnd),
  ];

  return {
    id: 'persona-weiche-demo',
    name: '◇ Persona-Weiche + gedockte Tools',
    description: 'Gateway (Persona) → 4 Chat-Knoten, jeder mit eigenem gedockten MCP-Tool',
    nodes, edges,
    personas: DEFAULT_PERSONAS,
    botConfig: DEFAULT_BOT_CONFIG,
  };
}

// ── Template 3: Bedingungsweiche → Chat+Tool je Bildungsstufe ────────────────
//  Persona-Badge gedockt über dem Willkommens-Knoten
//  Gateway (condition) → 4 Chat-Knoten, jeder mit eigenem gedockten MCP-Tool

export function buildSimpleStudentTemplate(): FlowTemplate {
  idSeq = 300;
  const nStart = id(), nWelcome = id();
  const nEdu = id(), nInterest = id(), nGateway = id();
  const nChatGs = id(), nChatSek1 = id(), nChatSek2 = id(), nChatGeneral = id();
  const nEnd = id();

  const nodes: Node<NodeData>[] = [
    makeNode(nStart, 'startNode', 80, 300, { stepType: 'start', stepId: '__start' }),

    // ── Willkommen mit gedocktem Persona-Badge ────────────────────────────────
    makeNode(nWelcome, 'messageNode', 264, 300, {
      stepType: 'message', stepId: 'welcome',
      message: '📚 Hallo! Ich bin dein **Lernassistent**.\n\nIch helfe dir, passendes Lernmaterial auf WirLernenOnline zu finden – abgestimmt auf deine Schulstufe.',
      dockedPersona: { personaMode: 'set', personaId: 'learner' } satisfies DockedPersona,
    }),

    makeNode(nEdu, 'choiceNode', 624, 300, {
      stepType: 'choice', stepId: 'educationLevel', field: 'educationLevels',
      message: 'Welche Schulstufe besuchst du?',
      options: [
        { id: 'opt-0', label: '📗 Grundschule (Kl. 1–4)',      value: 'grundschule',     uri: 'http://w3id.org/openeduhub/vocabs/educationalContext/grundschule' },
        { id: 'opt-1', label: '📘 Sekundarstufe I (Kl. 5–10)', value: 'sekundarstufe_1', uri: 'http://w3id.org/openeduhub/vocabs/educationalContext/sekundarstufe_1' },
        { id: 'opt-2', label: '📙 Sekundarstufe II (Kl. 11–13)',value: 'sekundarstufe_2', uri: 'http://w3id.org/openeduhub/vocabs/educationalContext/sekundarstufe_2' },
        { id: 'opt-3', label: '🎓 Hochschule / Sonstiges',     value: 'hochschule',      uri: 'http://w3id.org/openeduhub/vocabs/educationalContext/hochschule' },
      ],
    }),
    makeNode(nInterest, 'inputNode', 984, 300, {
      stepType: 'input', stepId: 'interest', field: 'interest',
      message: 'Für welches **Thema** suchst du Lernmaterialien?',
      placeholder: 'z.B. Bruchrechnung, Klimawandel …',
      suggestions: ['Bruchrechnung', 'Klimawandel', 'Demokratie', 'Englisch Vokabeln', 'Physik Mechanik'],
    }),
    makeNode(nGateway, 'gatewayNode', 1304, 300, {
      stepType: 'gateway', stepId: 'stufen_weiche',
      splitBy: 'condition',
      branches: [
        { id: 'branch-0', label: 'Grundschule',     field: 'educationLevels', operator: 'equals', value: 'grundschule' },
        { id: 'branch-1', label: 'Sekundarstufe I', field: 'educationLevels', operator: 'equals', value: 'sekundarstufe_1' },
        { id: 'branch-2', label: 'Sekundarstufe II',field: 'educationLevels', operator: 'equals', value: 'sekundarstufe_2' },
      ],
    }),

    // ── Chat + gedocktes Tool je Zweig ────────────────────────────────────────
    makeNode(nChatGs,      'chatNode', 1684, 60,  { stepType: 'chat', stepId: 'chat_gs',      message: 'Hier sind Materialien für die Grundschule! 😊', suggestions: ['Zeig mehr', 'Anderes Thema'], dockedTools: [{ stepId: 'mcp_grundschule', stepType: 'tool_mcp', message: 'Suche Grundschulmaterialien …', mcpTools: ['search_wlo_collections'], toolParams: { query: '{{ profile.interest }}', educationLevel: 'grundschule', maxResults: '5' } } satisfies DockedTool] }),
    makeNode(nChatSek1,    'chatNode', 1684, 250, { stepType: 'chat', stepId: 'chat_sek1',    message: 'Hier sind Materialien für die Sekundarstufe I! 😊', suggestions: ['Zeig mehr', 'Anderes Thema'], dockedTools: [{ stepId: 'mcp_sek1', stepType: 'tool_mcp', message: 'Suche Materialien für Sek I …', mcpTools: ['search_wlo_collections'], toolParams: { query: '{{ profile.interest }}', educationLevel: 'sekundarstufe_1', maxResults: '7' } } satisfies DockedTool] }),
    makeNode(nChatSek2,    'chatNode', 1684, 440, { stepType: 'chat', stepId: 'chat_sek2',    message: 'Hier sind Materialien für die Sekundarstufe II! 😊', suggestions: ['Zeig mehr', 'Anderes Thema'], dockedTools: [{ stepId: 'mcp_sek2', stepType: 'tool_mcp', message: 'Suche Materialien für Sek II …', mcpTools: ['search_wlo_collections'], toolParams: { query: '{{ profile.interest }}', educationLevel: 'sekundarstufe_2', maxResults: '7' } } satisfies DockedTool] }),
    makeNode(nChatGeneral, 'chatNode', 1684, 630, { stepType: 'chat', stepId: 'chat_general', message: 'Hier sind passende Lernmaterialien! 😊', suggestions: ['Zeig mehr', 'Anderes Thema'], dockedTools: [{ stepId: 'mcp_general', stepType: 'tool_mcp', message: 'Suche allgemeine Lernmaterialien …', mcpTools: ['search_wlo_collections'], toolParams: { query: '{{ profile.interest }}', maxResults: '10' } } satisfies DockedTool] }),

    makeNode(nEnd, 'endNode', 2064, 380, { stepType: 'end', stepId: '__end' }),
  ];

  const edges: Edge[] = [
    makeEdge(nStart,    nWelcome),
    makeEdge(nWelcome,  nEdu),
    makeEdge(nEdu,      nInterest),
    makeEdge(nInterest, nGateway),
    makeEdge(nGateway, nChatGs,      { sourceHandle: 'branch-0', label: 'Grundschule' }),
    makeEdge(nGateway, nChatSek1,    { sourceHandle: 'branch-1', label: 'Sek I' }),
    makeEdge(nGateway, nChatSek2,    { sourceHandle: 'branch-2', label: 'Sek II' }),
    makeEdge(nGateway, nChatGeneral, { sourceHandle: 'default',  label: 'Hochschule / Sonstiges' }),
    makeEdge(nChatGs,      nEnd),
    makeEdge(nChatSek1,    nEnd),
    makeEdge(nChatSek2,    nEnd),
    makeEdge(nChatGeneral, nEnd),
  ];

  return {
    id: 'stufen-assistent',
    name: '📚 Lernassistent mit Stufenweiche',
    description: 'Persona-Badge gedockt · Bedingungsweiche → Chat-Knoten mit je eigenem gedockten MCP-Tool',
    nodes, edges,
    personas: DEFAULT_PERSONAS.filter(p => p.id === 'learner' || p.id === 'other'),
    botConfig: { ...DEFAULT_BOT_CONFIG, name: 'Lernbot', avatar: '📚', tagline: 'Dein persönlicher Lernassistent', defaultPersona: 'learner' },
  };
}

// ── Template 4: Bestellstatus-Bot ─────────────────────────────────────────────
//
//  Start → Begrüßung → Eingabe (Bestellnr) → API-Aufruf (GET /orders/{{id}})
//       → Erfolg: Variable setzen → Status-Nachricht → Ende
//       → Fehler: Fehler-Nachricht → Übergabe (Support-Queue)
//
//  Zeigt: api_call mit Erfolg/Fehler-Zweigen · set_var · handoff

export function buildOrderStatusTemplate(): FlowTemplate {
  idSeq = 400;
  const nStart = id(), nGreet = id(), nInput = id();
  const nApi = id(), nSetVar = id(), nStatusMsg = id();
  const nErrMsg = id(), nHandoff = id(), nEnd = id();

  const nodes: Node<NodeData>[] = [
    makeNode(nStart,     'startNode',   80,   300, { stepType: 'start', stepId: '__start' }),
    makeNode(nGreet,     'messageNode', 460,  300, {
      stepType: 'message', stepId: 'welcome',
      message: 'Hallo! 📦 Ich helfe dir, deinen Bestellstatus abzufragen.\n\nBitte halte deine **Bestellnummer** bereit.',
    }),
    makeNode(nInput,     'inputNode',   840,  300, {
      stepType: 'input', stepId: 'orderInput', field: 'orderId',
      message: 'Wie lautet deine Bestellnummer?',
      placeholder: 'z.B. ORD-2024-001234',
    }),
    makeNode(nApi,       'apiCallNode', 1220, 300, {
      stepType: 'api_call', stepId: 'fetchOrder',
      apiMethod: 'GET',
      apiUrl: 'https://api.example.com/orders/{{ profile.orderId }}',
      apiResultVar: 'orderData',
      notes: 'URL im Panel auf eigenen Endpunkt anpassen.',
    }),
    makeNode(nSetVar,    'setVarNode',  1600, 120, {
      stepType: 'set_var', stepId: 'extractStatus',
      variables: [
        { key: 'orderStatus', value: '{{ orderData.status }}' },
        { key: 'orderItem',   value: '{{ orderData.itemName }}' },
        { key: 'orderEta',    value: '{{ orderData.estimatedDelivery }}' },
      ],
    }),
    makeNode(nStatusMsg, 'messageNode', 1980, 120, {
      stepType: 'message', stepId: 'statusReply',
      message: '✅ Deine Bestellung **{{ orderItem }}** hat den Status: **{{ orderStatus }}**.\n\n📅 Voraussichtliche Lieferung: {{ orderEta }}',
    }),
    makeNode(nErrMsg,    'messageNode', 1600, 480, {
      stepType: 'message', stepId: 'errorReply',
      message: '❌ Die Bestellung **{{ profile.orderId }}** wurde nicht gefunden.\n\nBitte überprüfe die Nummer oder wende dich an unseren Support.',
    }),
    makeNode(nHandoff,   'handoffNode', 1980, 480, {
      stepType: 'handoff', stepId: 'supportHandoff',
      handoffTarget: 'order-support',
      handoffMessage: 'Ich verbinde dich mit unserem Support-Team. Bitte habe deine Bestellnummer bereit.',
    }),
    makeNode(nEnd, 'endNode', 2360, 300, { stepType: 'end', stepId: '__end' }),
  ];

  const edges: Edge[] = [
    makeEdge(nStart,     nGreet),
    makeEdge(nGreet,     nInput),
    makeEdge(nInput,     nApi),
    makeEdge(nApi,       nSetVar,    { sourceHandle: 'success', label: '✓ Erfolg' }),
    makeEdge(nApi,       nErrMsg,    { sourceHandle: 'error',   label: '✗ Fehler' }),
    makeEdge(nSetVar,    nStatusMsg),
    makeEdge(nStatusMsg, nEnd),
    makeEdge(nErrMsg,    nHandoff),
  ];

  return {
    id: 'order-status-bot',
    name: '📦 Bestellstatus-Bot',
    description: 'API-Aufruf · Variable setzen · Erfolg/Fehler-Zweige · Übergabe an Support',
    nodes, edges,
    personas: [],
    botConfig: {
      name: 'ShopBot', avatar: '📦',
      tagline: 'Dein persönlicher Shop-Assistent',
      apiModel: 'gpt-4.1-mini', mcpServerUrl: '', defaultPersona: '',
    },
  };
}

// ── Template 5: Support-Eskalation ────────────────────────────────────────────
//
//  Start → Begrüßung → Variable setzen (Kanal/Priorität)
//       → Themenauswahl (choice)
//       → Technik: FAQ-Nachricht → Eingabe → Weiche (Intent: gelöst / eskaliert)
//                  gelöst  → Ende
//                  eskaliert / Standard → Übergabe Technik-L2
//       → Rechnung: Übergabe Rechnungs-Team
//       → Sonstiges: Übergabe Allgemein
//
//  Zeigt: set_var · choice · message (FAQ) · input · gateway (intent) · handoff

export function buildSupportEscalationTemplate(): FlowTemplate {
  idSeq = 500;
  const nStart = id(), nGreet = id(), nSetVar = id(), nChoice = id();
  const nTechFaq = id(), nTechInput = id(), nGateway = id(), nTechHandoff = id();
  const nRechHandoff = id(), nSonstHandoff = id(), nEnd = id();

  const nodes: Node<NodeData>[] = [
    makeNode(nStart,        'startNode',   80,   440, { stepType: 'start', stepId: '__start' }),
    makeNode(nGreet,        'messageNode', 460,  440, {
      stepType: 'message', stepId: 'welcome',
      message: 'Hallo! 👋 Willkommen beim **Support-Center**.\n\nWie kann ich dir heute helfen?',
    }),
    makeNode(nSetVar,       'setVarNode',  840,  440, {
      stepType: 'set_var', stepId: 'initSession',
      variables: [
        { key: 'channel',  value: 'chat' },
        { key: 'priority', value: 'normal' },
      ],
    }),
    makeNode(nChoice,       'choiceNode',  1220, 440, {
      stepType: 'choice', stepId: 'topicSelect',
      message: 'Was ist dein Anliegen?',
      options: [
        { id: 'opt-0', label: '💻 Technisches Problem', value: 'tech',    primary: true },
        { id: 'opt-1', label: '💳 Frage zur Rechnung',  value: 'billing' },
        { id: 'opt-2', label: '📋 Sonstiges Anliegen',  value: 'other' },
      ],
    }),
    // ── Technik-Pfad ────────────────────────────────────────────────────────
    makeNode(nTechFaq,      'messageNode', 1600, 160, {
      stepType: 'message', stepId: 'techFaq',
      message: '💡 **Häufige Lösungen:**\n- Gerät neu starten\n- Cache leeren\n- App neu installieren\n\nHat eine davon geholfen?',
    }),
    makeNode(nTechInput,    'inputNode',   1980, 160, {
      stepType: 'input', stepId: 'techFeedback', field: 'techFeedback',
      message: 'Beschreibe kurz ob das Problem gelöst wurde oder was noch nicht klappt.',
      placeholder: '„Neustart hat geholfen" oder „Fehler XY bleibt"',
    }),
    makeNode(nGateway,      'gatewayNode', 2360, 160, {
      stepType: 'gateway', stepId: 'resolvedCheck', splitBy: 'intent',
      branches: [
        { id: 'branch-0', label: 'Gelöst',       intentPattern: 'ja|gelöst|klappt|funktioniert|danke' },
        { id: 'branch-1', label: 'Nicht gelöst', intentPattern: 'nein|nicht|immer noch|Problem' },
      ],
    }),
    makeNode(nTechHandoff,  'handoffNode', 2740, 160, {
      stepType: 'handoff', stepId: 'techHandoff',
      handoffTarget: 'tech-support-l2',
      handoffMessage: 'Ein Technik-Experte übernimmt jetzt – bitte kurz warten.',
    }),
    // ── Rechnungs-Pfad ──────────────────────────────────────────────────────
    makeNode(nRechHandoff,  'handoffNode', 1600, 440, {
      stepType: 'handoff', stepId: 'billingHandoff',
      handoffTarget: 'billing-team',
      handoffMessage: 'Ich leite dich jetzt an unser Rechnungs-Team weiter.',
    }),
    // ── Sonstiges-Pfad ──────────────────────────────────────────────────────
    makeNode(nSonstHandoff, 'handoffNode', 1600, 720, {
      stepType: 'handoff', stepId: 'generalHandoff',
      handoffTarget: 'general-support',
      handoffMessage: 'Ein Mitarbeiter kümmert sich gleich um dein Anliegen.',
    }),
    makeNode(nEnd, 'endNode', 2740, 440, { stepType: 'end', stepId: '__end' }),
  ];

  const edges: Edge[] = [
    makeEdge(nStart,       nGreet),
    makeEdge(nGreet,       nSetVar),
    makeEdge(nSetVar,      nChoice),
    makeEdge(nChoice,      nTechFaq,    { sourceHandle: 'opt-0', label: '💻 Technik' }),
    makeEdge(nChoice,      nRechHandoff,{ sourceHandle: 'opt-1', label: '💳 Rechnung' }),
    makeEdge(nChoice,      nSonstHandoff,{ sourceHandle: 'opt-2', label: '📋 Sonstiges' }),
    makeEdge(nTechFaq,     nTechInput),
    makeEdge(nTechInput,   nGateway),
    makeEdge(nGateway,     nEnd,        { sourceHandle: 'branch-0', label: '✓ Gelöst' }),
    makeEdge(nGateway,     nTechHandoff,{ sourceHandle: 'branch-1', label: '→ Eskalation' }),
    makeEdge(nGateway,     nTechHandoff,{ sourceHandle: 'default',  label: 'Standard' }),
  ];

  return {
    id: 'support-escalation',
    name: '🎧 Support-Eskalation',
    description: 'Variable setzen · FAQ mit Intent-Weiche · Übergabe an menschliche Agenten',
    nodes, edges,
    personas: [],
    botConfig: {
      name: 'SupportBot', avatar: '🎧',
      tagline: 'Dein persönlicher Support-Assistent',
      apiModel: 'gpt-4.1-mini', mcpServerUrl: '', defaultPersona: '',
    },
  };
}

export const ALL_TEMPLATES: FlowTemplate[] = [
  buildBoerdiWloTemplate(),
  buildPersonaDemoTemplate(),
  buildSimpleStudentTemplate(),
  buildOrderStatusTemplate(),
  buildSupportEscalationTemplate(),
];
