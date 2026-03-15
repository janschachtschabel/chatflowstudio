import yaml from 'js-yaml';
import type { Node, Edge } from 'reactflow';
import type { NodeData, PersonaConfig, BotConfig, GatewayBranch } from './types';

// ── Export: React Flow → boerdi-config.yml ────────────────────────────────────

export function exportToYaml(
  nodes: Node<NodeData>[],
  edges: Edge[],
  personas: PersonaConfig[],
  botConfig: BotConfig,
): string {
  const steps = nodes
    .filter(n => n.data.stepType !== 'start' && n.data.stepType !== 'end')
    .map(node => {
      const d = node.data;
      const outEdges = edges.filter(e => e.source === node.id);
      const defaultEdge = outEdges.find(e => !e.sourceHandle || e.sourceHandle === 'out' || e.sourceHandle === 'default');
      const defaultTarget = defaultEdge ? nodes.find(n => n.id === defaultEdge.target) : null;

      const step: Record<string, unknown> = {
        id: d.stepId,
        type: d.stepType,
      };

      if (d.message) step.message = d.message;
      if (d.personaMessages && Object.values(d.personaMessages).some(Boolean))
        step.personaMessages = d.personaMessages;
      if (d.notes) step.notes = d.notes;

      // Default next
      if (defaultTarget && defaultTarget.data.stepType !== 'end') {
        step.next = defaultTarget.data.stepId;
      }

      // ── choice ──────────────────────────────────────────────────────────────
      if (d.stepType === 'choice') {
        if (d.field) step.field = d.field;
        if (d.multiSelect) step.multiSelect = true;
        if (d.skipLabel) step.skipLabel = d.skipLabel;
        step.options = (d.options ?? []).map((o, i) => {
          const optEdge = outEdges.find(e => e.sourceHandle === `opt-${i}`);
          const optTarget = optEdge ? nodes.find(n => n.id === optEdge.target) : null;
          const entry: Record<string, unknown> = { label: o.label, value: o.value };
          if (o.uri)     entry.uri     = o.uri;
          if (o.persona) entry.persona = o.persona;
          if (o.primary) entry.primary = true;
          if (optTarget && optTarget.data.stepType !== 'end') entry.next = optTarget.data.stepId;
          return entry;
        });
        delete step.next;
      }

      // ── input ───────────────────────────────────────────────────────────────
      if (d.stepType === 'input') {
        if (d.field)       step.field       = d.field;
        if (d.placeholder) step.placeholder = d.placeholder;
        if (d.suggestions?.length) step.suggestions = d.suggestions;
      }

      // ── chat ────────────────────────────────────────────────────────────────
      if (d.stepType === 'chat') {
        if (d.suggestions?.length) step.suggestions = d.suggestions;
      }

      // ── gateway ─────────────────────────────────────────────────────────────
      if (d.stepType === 'gateway') {
        step.splitBy = d.splitBy ?? 'condition';
        const branches = d.branches ?? [];
        step.branches = branches.map((b, i) => {
          const branchEdge = outEdges.find(e => e.sourceHandle === `branch-${i}`);
          const branchTarget = branchEdge ? nodes.find(n => n.id === branchEdge.target) : null;
          const entry: Record<string, unknown> = { label: b.label };
          if (b.field)         entry.field         = b.field;
          if (b.operator)      entry.operator      = b.operator;
          if (b.value)         entry.value         = b.value;
          if (b.personaId)     entry.personaId     = b.personaId;
          if (b.intentPattern) entry.intentPattern = b.intentPattern;
          if (branchTarget && branchTarget.data.stepType !== 'end') entry.next = branchTarget.data.stepId;
          return entry;
        });
        const defEdge = outEdges.find(e => e.sourceHandle === 'default');
        const defTarget = defEdge ? nodes.find(n => n.id === defEdge.target) : null;
        if (defTarget && defTarget.data.stepType !== 'end') step.default = defTarget.data.stepId;
        delete step.next;
      }

      // ── tool_mcp ────────────────────────────────────────────────────────────
      if (d.stepType === 'tool_mcp') {
        if (d.mcpServer) step.mcpServer = d.mcpServer;
        if (d.mcpTools?.length) step.tools = d.mcpTools;
        if (d.toolParams && Object.keys(d.toolParams).length) step.params = d.toolParams;
        if (d.personaToolParams && Object.keys(d.personaToolParams).length)
          step.personaParams = d.personaToolParams;
      }

      // ── tool_rag ────────────────────────────────────────────────────────────
      if (d.stepType === 'tool_rag') {
        if (d.ragBases?.length) step.bases = d.ragBases.map(b => b.id);
        if (d.queryTemplate) step.queryTemplate = d.queryTemplate;
      }

      // ── persona_set ─────────────────────────────────────────────────────────
      if (d.stepType === 'persona_set') {
        step.personaMode = d.personaMode ?? 'inherit';
        if (d.personaId) step.personaId = d.personaId;
      }

      // ── api_call ────────────────────────────────────────────────────────────
      if (d.stepType === 'api_call') {
        if (d.apiUrl)    step.url    = d.apiUrl;
        if (d.apiMethod) step.method = d.apiMethod;
        if (d.apiBody)   step.body   = d.apiBody;
        if (d.apiResultVar) step.resultVar = d.apiResultVar;
        if (d.apiHeaders && Object.keys(d.apiHeaders).length) step.headers = d.apiHeaders;
        // success/error edges handled via sourceHandle 'success' / 'error' in edge export
      }

      // ── set_var ─────────────────────────────────────────────────────────────
      if (d.stepType === 'set_var' && d.variables?.length) {
        step.variables = d.variables;
      }

      // ── handoff ────────────────────────────────────────────────────────────
      if (d.stepType === 'handoff') {
        if (d.handoffTarget)  step.target  = d.handoffTarget;
        if (d.handoffMessage) step.farewell = d.handoffMessage;
      }

      // ── Docked tool attachments (inline) ────────────────────────────────
      if (d.dockedTools?.length) {
        step.dockedTools = d.dockedTools.map(t => {
          const entry: Record<string, unknown> = { id: t.stepId, type: t.stepType };
          if (t.message) entry.message = t.message;
          if (t.mcpServer) entry.mcpServer = t.mcpServer;
          if (t.mcpTools?.length) entry.tools = t.mcpTools;
          if (t.toolParams && Object.keys(t.toolParams).length) entry.params = t.toolParams;
          if (t.personaToolParams && Object.keys(t.personaToolParams).length) entry.personaParams = t.personaToolParams;
          return entry;
        });
      }
      if (d.dockedPersona) {
        step.dockedPersona = { mode: d.dockedPersona.personaMode ?? 'set', personaId: d.dockedPersona.personaId };
      }

      return step;
    });

  const startEdge = edges.find(e => {
    const sourceNode = nodes.find(n => n.id === e.source);
    return sourceNode?.data.stepType === 'start';
  });
  const startTarget = startEdge ? nodes.find(n => n.id === startEdge.target) : null;

  const doc: Record<string, unknown> = {
    bot: {
      name: botConfig.name,
      avatar: botConfig.avatar,
      tagline: botConfig.tagline,
      ...(botConfig.defaultPersona ? { defaultPersona: botConfig.defaultPersona } : {}),
    },
    api: { model: botConfig.apiModel, mcpServerUrl: botConfig.mcpServerUrl },
    flow: {
      start: startTarget?.data.stepId ?? steps[0]?.id ?? '__start',
      steps,
    },
    personas: personas.map(p => ({
      id: p.id, label: p.label, uri: p.uri,
    })),
  };

  return yaml.dump(doc, { lineWidth: 120, noRefs: true });
}

// ── Export: Persona markdown files ────────────────────────────────────────────

export function exportPersonaMarkdown(persona: PersonaConfig): string {
  return persona.systemPrompt;
}

export function exportPersonaFiles(personas: PersonaConfig[]): Record<string, string> {
  const result: Record<string, string> = {};
  personas.forEach(p => { result[`${p.id}.md`] = p.systemPrompt; });
  return result;
}

// ── Human-readable print text ─────────────────────────────────────────────────

export function buildPrintText(
  nodes: Node<NodeData>[],
  edges: Edge[],
  botConfig: BotConfig,
): string {
  const lines: string[] = [
    `# ${botConfig.avatar} ${botConfig.name} – Flow`,
    `> ${botConfig.tagline}`,
    '',
  ];

  const sorted = [...nodes].sort((a, b) => a.position.x - b.position.x || a.position.y - b.position.y);
  for (const node of sorted) {
    const d = node.data;
    if (d.stepType === 'start') { lines.push('---\n**▶ START**'); continue; }
    if (d.stepType === 'end')   { lines.push('---\n**⏹ ENDE**'); continue; }

    lines.push(`\n## ${d.stepId}`);

    const typeLabels: Record<string, string> = {
      message: '💬 Nachricht', choice: '🔘 Auswahl', input: '✏️ Eingabe',
      chat: '🗨️ Chat', gateway: '◇ Weiche', tool_mcp: '🔧 MCP Tool',
      tool_rag: '🗃️ RAG Suche', persona_set: '👤 Persona',
    };
    lines.push(`*Typ: ${typeLabels[d.stepType] ?? d.stepType}*`);

    if (d.message) lines.push(`\n> ${d.message}`);

    if (d.options?.length) {
      lines.push('\n**Optionen:**');
      d.options.forEach(o => lines.push(`- ${o.label} (${o.value})${o.persona ? ` → Persona: ${o.persona}` : ''}`));
    }
    if (d.branches?.length) {
      lines.push('\n**Zweige:**');
      d.branches.forEach(b => {
        const crit = b.personaId ? `Persona = ${b.personaId}` :
          b.field ? `${b.field} ${b.operator} ${b.value}` :
          b.intentPattern ?? b.label;
        lines.push(`- ${b.label}: ${crit}`);
      });
      lines.push('- Standard-Ausgang');
    }
    if (d.stepType === 'tool_mcp') {
      lines.push(`\n**Server:** ${d.mcpServer || '(Standard)'}`);
      lines.push(`**Tools:** ${d.mcpTools?.join(', ') || 'Alle'}`);
      if (d.toolParams) lines.push(`**Parameter:** ${JSON.stringify(d.toolParams)}`);
    }
    if (d.stepType === 'tool_rag') {
      lines.push(`\n**Basen:** ${d.ragBases?.map(b => b.label).join(', ') || '-'}`);
    }
    if (d.stepType === 'persona_set') {
      lines.push(`\n**Modus:** ${d.personaMode}${d.personaId ? ` → ${d.personaId}` : ''}`);
    }
    if (d.personaMessages && Object.keys(d.personaMessages).length) {
      lines.push('\n**Persona-Varianten:**');
      Object.entries(d.personaMessages).forEach(([pid, msg]) => {
        if (msg) lines.push(`- *${pid}*: ${msg.slice(0, 80)}${msg.length > 80 ? '…' : ''}`);
      });
    }

    const outEdges = edges.filter(e => e.source === node.id);
    if (outEdges.length) {
      const targets = outEdges.map(e => {
        const t = nodes.find(n => n.id === e.target);
        return t ? `${t.data.stepId}` : '?';
      });
      lines.push(`\n→ ${targets.join(' · ')}`);
    }
  }

  return lines.join('\n');
}

// ── Import: boerdi-config.yml → React Flow ────────────────────────────────────

let nodeCounter = 2000;
const newId = () => `n${++nodeCounter}`;

function resolveNodeType(stepType: string): string {
  const map: Record<string, string> = {
    message: 'messageNode', choice: 'choiceNode', input: 'inputNode',
    chat: 'chatNode', gateway: 'gatewayNode',
    tool_mcp: 'toolMcpNode', tool_rag: 'toolRagNode',
    persona_set: 'personaSetNode',
    api_call: 'apiCallNode', set_var: 'setVarNode', handoff: 'handoffNode',
    // legacy aliases
    freetext: 'inputNode', mcp_search: 'toolMcpNode', mcp_tool: 'toolMcpNode',
    rag_search: 'toolRagNode', condition: 'gatewayNode', intent_detect: 'gatewayNode',
    persona_route: 'gatewayNode', multiChoice: 'choiceNode',
  };
  return map[stepType] ?? 'messageNode';
}

function normalizeStepType(t: string): NodeData['stepType'] {
  const map: Record<string, NodeData['stepType']> = {
    freetext: 'input', mcp_search: 'tool_mcp', mcp_tool: 'tool_mcp',
    rag_search: 'tool_rag', condition: 'gateway', intent_detect: 'gateway',
    persona_route: 'gateway', multiChoice: 'choice',
  };
  return (map[t] ?? t) as NodeData['stepType'];
}

export function importFromYaml(yamlText: string): {
  nodes: Node<NodeData>[];
  edges: Edge[];
  personas: PersonaConfig[];
  botConfig: BotConfig;
} {
  const doc = yaml.load(yamlText) as Record<string, unknown>;
  const botDoc = (doc.bot ?? {}) as Record<string, unknown>;
  const apiDoc = (doc.api ?? {}) as Record<string, unknown>;
  const mcpDoc = (doc.mcp ?? {}) as Record<string, unknown>;   // old format

  // ── Normalise flow section ─────────────────────────────────────────────────
  // Old format: flow = [{id, type, ...}, ...]  (flat array)
  // New format: flow = { start: 'id', steps: [{...}] }
  let steps: Record<string, unknown>[];
  let firstStepIdHint: string | undefined;

  const rawFlow = doc.flow;
  if (Array.isArray(rawFlow)) {
    // Old format
    steps = rawFlow as Record<string, unknown>[];
    firstStepIdHint = (steps[0]?.id as string) ?? undefined;
  } else {
    const flowDoc = (rawFlow ?? {}) as Record<string, unknown>;
    steps = (flowDoc.steps ?? []) as Record<string, unknown>[];
    firstStepIdHint = flowDoc.start as string | undefined;
  }

  // ── Bot config ─────────────────────────────────────────────────────────────
  const botConfig: BotConfig = {
    name:          (botDoc.name  as string) ?? 'Boerdi',
    avatar:        (botDoc.avatar as string) ?? '🦉',
    tagline:       (botDoc.tagline as string) ?? '',
    apiModel:      (apiDoc.model  as string) ?? 'gpt-4.1-mini',
    // prefer new format, fall back to old mcp section
    mcpServerUrl:  (apiDoc.mcpServerUrl as string) ?? (mcpDoc.serverUrl as string) ?? '',
    defaultPersona: (botDoc.defaultPersona as string) ?? '',
  };

  // ── Normalise personas section ─────────────────────────────────────────────
  // Old format: personas = { learner: { label, uri, personaFile }, ... }
  // New format: personas = [{ id, label, uri, systemPrompt }, ...]
  let personas: PersonaConfig[];
  const rawPersonas = doc.personas;
  if (Array.isArray(rawPersonas)) {
    // New format
    personas = (rawPersonas as Record<string, unknown>[]).map(p => ({
      id:           (p.id           as string) ?? '',
      label:        (p.label        as string) ?? '',
      uri:          (p.uri          as string) ?? '',
      systemPrompt: (p.systemPrompt as string) ?? '',
    }));
  } else if (rawPersonas && typeof rawPersonas === 'object') {
    // Old format: object map keyed by id
    personas = Object.entries(rawPersonas as Record<string, Record<string, unknown>>).map(([key, p]) => ({
      id:           key,
      label:        (p.label as string) ?? key,
      uri:          (p.uri   as string) ?? '',
      systemPrompt: '',   // persona files referenced externally; no inline prompt in old format
    }));
  } else {
    personas = [];
  }

  // ── Layout calculation ─────────────────────────────────────────────────────
  const SPACING_X = 380;
  const SPACING_Y = 300;

  const stepIdToNodeId = new Map<string, string>();
  const nodeIdList: string[] = [];
  steps.forEach(s => {
    const nid = newId();
    stepIdToNodeId.set(s.id as string, nid);
    nodeIdList.push(nid);
  });

  const startId = newId();
  const endId   = newId();

  // Simple left-to-right layout (BFS from first step)
  const positions = new Map<string, { x: number; y: number }>();
  let col = 0;
  steps.forEach((_, i) => {
    positions.set(nodeIdList[i], { x: 264 + col * SPACING_X, y: 300 });
    col++;
  });

  const nodes: Node<NodeData>[] = [];
  const edges: Edge[] = [];

  // Start + End events
  nodes.push({
    id: startId, type: 'startNode',
    position: { x: 80, y: 300 },
    data: { stepType: 'start', stepId: '__start' },
  });
  nodes.push({
    id: endId, type: 'endNode',
    position: { x: 264 + steps.length * SPACING_X, y: 300 },
    data: { stepType: 'end', stepId: '__end' },
  });

  // Link start → first step
  const firstStepId = firstStepIdHint ?? (steps[0]?.id as string);
  const firstNodeId = stepIdToNodeId.get(firstStepId);
  if (firstNodeId) {
    edges.push({ id: `e-start-${firstNodeId}`, source: startId, target: firstNodeId, sourceHandle: 'out', targetHandle: 'in' });
  }

  // Build nodes + edges from steps
  steps.forEach((step, stepIndex) => {
    const sourceId = nodeIdList[stepIndex];
    const rawType = (step.type as string) ?? 'message';
    const stepType = normalizeStepType(rawType);
    const nodeType = resolveNodeType(rawType);

    const data: NodeData = {
      stepType,
      stepId: (step.id as string) ?? `step-${stepIndex}`,
      message: (step.message as string) ?? undefined,
      personaMessages: (step.personaMessages as Record<string, string>) ?? undefined,
      notes: (step.notes as string) ?? undefined,
    };

    // choice
    if (stepType === 'choice') {
      data.field = (step.field as string) ?? undefined;
      data.multiSelect = (step.multiSelect as boolean) ?? undefined;
      data.skipLabel = (step.skipLabel as string) ?? undefined;
      data.options = ((step.options as Record<string, unknown>[]) ?? []).map((o, j) => ({
        id: `opt-${j}`, label: (o.label as string) ?? '', value: (o.value as string) ?? '',
        uri: o.uri as string | undefined, persona: o.persona as string | undefined,
        primary: o.primary as boolean | undefined,
      }));
    }

    // input
    if (stepType === 'input') {
      data.field = (step.field as string) ?? undefined;
      data.placeholder = (step.placeholder as string) ?? undefined;
      data.suggestions = (step.suggestions as string[]) ?? [];
    }

    // chat
    if (stepType === 'chat') {
      data.suggestions = (step.suggestions as string[]) ?? [];
    }

    // gateway
    if (stepType === 'gateway') {
      data.splitBy = ((step.splitBy as string) ?? 'condition') as NodeData['splitBy'];
      data.branches = ((step.branches as Record<string, unknown>[]) ?? []).map((b, j) => ({
        id: `branch-${j}`,
        label: (b.label as string) ?? `Zweig ${j + 1}`,
        field: b.field as string | undefined,
        operator: b.operator as GatewayBranch['operator'] | undefined,
        value: b.value as string | undefined,
        personaId: b.personaId as string | undefined,
        intentPattern: b.intentPattern as string | undefined,
      }));
    }

    // tool_mcp
    if (stepType === 'tool_mcp') {
      data.mcpServer = (step.mcpServer as string) ?? undefined;
      data.mcpTools = (step.tools as string[]) ?? [];
      data.toolParams = (step.params as Record<string, string>) ?? {};
      data.personaToolParams = (step.personaParams as Record<string, Record<string, string>>) ?? undefined;
    }

    // tool_rag
    if (stepType === 'tool_rag') {
      const baseIds = (step.bases as string[]) ?? [];
      data.ragBases = baseIds.map(id => ({ id, label: id }));
      data.queryTemplate = (step.queryTemplate as string) ?? undefined;
    }

    // persona_set
    if (stepType === 'persona_set') {
      data.personaMode = ((step.personaMode as string) ?? 'inherit') as NodeData['personaMode'];
      data.personaId = (step.personaId as string) ?? undefined;
    }

    // api_call
    if (stepType === 'api_call') {
      data.apiUrl       = (step.url       as string) ?? undefined;
      data.apiMethod    = ((step.method   as string) ?? 'GET') as NodeData['apiMethod'];
      data.apiBody      = (step.body      as string) ?? undefined;
      data.apiResultVar = (step.resultVar as string) ?? undefined;
      data.apiHeaders   = (step.headers   as Record<string, string>) ?? undefined;
    }

    // set_var
    if (stepType === 'set_var') {
      const rawVars = (step.variables as Array<{ key: string; value: string }>) ?? [];
      data.variables = rawVars.map(v => ({ key: String(v.key ?? ''), value: String(v.value ?? '') }));
    }

    // handoff
    if (stepType === 'handoff') {
      data.handoffTarget  = (step.target  as string) ?? undefined;
      data.handoffMessage = (step.farewell as string) ?? undefined;
    }

    const pos = positions.get(sourceId) ?? { x: 264 + stepIndex * SPACING_X, y: 300 };
    nodes.push({ id: sourceId, type: nodeType, position: pos, data });

    // ── Reconstruct inline docked tools/persona into parent node data ──────
    const rawDockedTools = (step.dockedTools as Record<string, unknown>[]) ?? [];
    if (rawDockedTools.length) {
      data.dockedTools = rawDockedTools.map((t, order) => ({
        stepId: (t.id as string) ?? `dock_tool_${order}`,
        stepType: (normalizeStepType((t.type as string) ?? 'tool_mcp')) as 'tool_mcp' | 'tool_rag',
        message: (t.message as string) ?? undefined,
        mcpServer: (t.mcpServer as string) ?? undefined,
        mcpTools: (t.tools as string[]) ?? [],
        toolParams: (t.params as Record<string, string>) ?? {},
        personaToolParams: (t.personaParams as Record<string, Record<string, string>>) ?? undefined,
      }));
      // patch the already-pushed node
      const pushed = nodes[nodes.length - 1];
      if (pushed.id === sourceId) pushed.data = { ...pushed.data, dockedTools: data.dockedTools };
    }

    if (step.dockedPersona) {
      const dp = step.dockedPersona as Record<string, unknown>;
      data.dockedPersona = {
        personaMode: (dp.mode as NodeData['personaMode']) ?? 'set',
        personaId: (dp.personaId as string) ?? undefined,
      };
      const pushed = nodes[nodes.length - 1];
      if (pushed.id === sourceId) pushed.data = { ...pushed.data, dockedPersona: data.dockedPersona };
    }

    // Edges from 'next'
    if (step.next) {
      const targetId = stepIdToNodeId.get(step.next as string) ?? endId;
      edges.push({ id: `e-${sourceId}-out`, source: sourceId, target: targetId, sourceHandle: 'out', targetHandle: 'in' });
    }

    // Edges from choice options
    if (stepType === 'choice') {
      ((step.options as Record<string, unknown>[]) ?? []).forEach((o, i) => {
        if (o.next) {
          const targetId = stepIdToNodeId.get(o.next as string) ?? endId;
          edges.push({ id: `e-${sourceId}-opt${i}`, source: sourceId, target: targetId, sourceHandle: `opt-${i}`, targetHandle: 'in', label: o.label as string });
        }
      });
    }

    // Edges from gateway branches
    if (stepType === 'gateway') {
      ((step.branches as Record<string, unknown>[]) ?? []).forEach((b, i) => {
        if (b.next) {
          const targetId = stepIdToNodeId.get(b.next as string) ?? endId;
          edges.push({ id: `e-${sourceId}-branch${i}`, source: sourceId, target: targetId, sourceHandle: `branch-${i}`, targetHandle: 'in', label: b.label as string });
        }
      });
      if (step.default) {
        const targetId = stepIdToNodeId.get(step.default as string) ?? endId;
        edges.push({ id: `e-${sourceId}-default`, source: sourceId, target: targetId, sourceHandle: 'default', targetHandle: 'in', label: 'Standard', style: { strokeDasharray: '5 4' } });
      }
    }

    // If no explicit next edge, link to next step in list
    const hasOutEdge = edges.some(e => e.source === sourceId);
    if (!hasOutEdge && stepType !== 'choice' && stepType !== 'gateway') {
      const nextStepId = steps[stepIndex + 1] ? nodeIdList[stepIndex + 1] : endId;
      edges.push({ id: `e-${sourceId}-auto`, source: sourceId, target: nextStepId, sourceHandle: 'out', targetHandle: 'in' });
    }
  });

  return { nodes, edges, personas, botConfig };
}
