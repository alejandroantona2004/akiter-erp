import { useState, useEffect, useRef, type FormEvent, type KeyboardEvent, type ChangeEvent } from 'react'
import { Send, Bot, RefreshCw, Sparkles, AlertTriangle, CheckCircle, Paperclip, X, Plus, MessageSquare } from 'lucide-react'
import { useAuthStore } from '../../store/authStore'
import { Button } from '../../components/ui/Button'
import {
  anthropic, AI_MODEL, WRITE_TOOLS,
  describeAction, executeWriteTool,
  loadDataSnapshot, buildSystemPrompt,
  type DataSnapshot,
} from '../../lib/anthropic'
import { supabase } from '../../lib/supabase'
import type Anthropic from '@anthropic-ai/sdk'
import logoImg from '../../assets/Akiter-logo.png.png'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ChatMessage {
  id: string
  role: 'user' | 'assistant'
  content: string
  imagePreview?: string
  isStreaming?: boolean
  isError?: boolean
}

interface AttachedImage {
  base64: string
  mediaType: 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif'
  previewUrl: string
  name: string
}

interface PendingAction {
  toolUseId: string
  toolName: string
  toolInput: Record<string, unknown>
  description: string
  apiHistory: Anthropic.MessageParam[]
  queuedTools: Anthropic.ToolUseBlock[]
  collectedResults: Anthropic.ToolResultBlockParam[]
  batchIndex: number
  batchTotal: number
  chatId: string | null
}

interface Chat {
  id: string
  titulo: string
  created_at: string
  updated_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

let _msgId = 0
const uid = () => `msg-${++_msgId}-${Date.now()}`

const WELCOME: ChatMessage = {
  id: uid(),
  role: 'assistant',
  content: `¡Hola! Soy el asistente de IA de Akiter Energías Renovables. Tengo acceso a todos los datos del ERP y puedo ayudarte a:

• **Consultar** clientes, proyectos, presupuestos, facturas, inventario y leads
• **Analizar** datos ("¿Cuánto hemos facturado este mes?", "¿Qué proyectos están retrasados?")
• **Crear** leads, clientes y proyectos
• **Actualizar** estados de proyectos, facturas y oportunidades
• **Gestionar** movimientos de inventario
• **Leer imágenes** de albaranes, facturas y contratos para actualizar el ERP

¿En qué puedo ayudarte hoy?`,
}

function fmtDate(iso: string) {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor((now.getTime() - d.getTime()) / 86_400_000)
  if (diffDays === 0) return d.toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })
  if (diffDays === 1) return 'Ayer'
  if (diffDays < 7)  return d.toLocaleDateString('es-ES', { weekday: 'short' })
  return d.toLocaleDateString('es-ES', { day: '2-digit', month: 'short' })
}

// Simple inline markdown: bold, code, bullets, newlines
function renderContent(text: string) {
  const lines = text.split('\n')
  return lines.map((line, i) => {
    const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g).map((part, j) => {
      if (part.startsWith('**') && part.endsWith('**'))
        return <strong key={j}>{part.slice(2, -2)}</strong>
      if (part.startsWith('`') && part.endsWith('`'))
        return <code key={j} className="bg-gray-200 text-gray-800 px-1 py-0.5 rounded text-xs font-mono">{part.slice(1, -1)}</code>
      return <span key={j}>{part}</span>
    })
    const isBullet = line.trimStart().startsWith('• ') || line.trimStart().startsWith('- ')
    return (
      <span key={i}>
        {isBullet
          ? <span className="flex gap-1.5">
              <span className="mt-1 flex-shrink-0 w-1.5 h-1.5 rounded-full bg-current opacity-50" />
              <span>{parts.map((p, j) => typeof p === 'string'
                ? <span key={j}>{p.replace(/^[•\-]\s/, '')}</span>
                : p
              )}</span>
            </span>
          : parts}
        {i < lines.length - 1 && <br />}
      </span>
    )
  })
}

// ─── Confirmation Dialog ──────────────────────────────────────────────────────

function ConfirmActionDialog({
  action, onConfirm, onCancel, loading,
}: {
  action: PendingAction; onConfirm: () => void; onCancel: () => void; loading: boolean
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/40">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-md p-6 space-y-4">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center flex-shrink-0">
            <AlertTriangle size={18} className="text-amber-600" />
          </div>
          <div className="flex-1">
            <div className="flex items-center justify-between gap-2">
              <h3 className="font-semibold text-gray-900">Confirmar acción</h3>
              {action.batchTotal > 1 && (
                <span className="text-xs font-medium text-amber-600 bg-amber-100 px-2 py-0.5 rounded-full">
                  {action.batchIndex} / {action.batchTotal}
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">El asistente quiere realizar la siguiente modificación:</p>
          </div>
        </div>
        <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-gray-800 leading-relaxed">
          {renderContent(action.description)}
        </div>
        <div className="flex gap-3 justify-end">
          <Button variant="ghost" onClick={onCancel} disabled={loading}>Cancelar</Button>
          <Button onClick={onConfirm} loading={loading}>
            <CheckCircle size={15} /> Confirmar
          </Button>
        </div>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AsistenteIA() {
  const { user } = useAuthStore()

  // Chat UI state
  const [messages, setMessages]         = useState<ChatMessage[]>([WELCOME])
  const [apiHistory, setApiHistory]     = useState<Anthropic.MessageParam[]>([])
  const [input, setInput]               = useState('')
  const [isLoading, setIsLoading]       = useState(false)
  const [isLoadingData, setIsLoadingData] = useState(true)
  const [dataSnap, setDataSnap]         = useState<DataSnapshot | null>(null)
  const [pendingAction, setPendingAction] = useState<PendingAction | null>(null)
  const [confirmLoading, setConfirmLoading] = useState(false)
  const [attachedImage, setAttachedImage] = useState<AttachedImage | null>(null)

  // Chat history state
  const [currentChatId, setCurrentChatId]   = useState<string | null>(null)
  const [chatList, setChatList]             = useState<Chat[]>([])
  const [chatListLoading, setChatListLoading] = useState(true)
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false)

  const bottomRef  = useRef<HTMLDivElement>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  // ── DB helpers ────────────────────────────────────────────────────────────

  const loadChatList = async () => {
    if (!user) return
    setChatListLoading(true)
    const { data } = await supabase
      .from('akiter_chats')
      .select('id,titulo,created_at,updated_at')
      .order('updated_at', { ascending: false })
      .limit(60)
    setChatList((data ?? []) as Chat[])
    setChatListLoading(false)
  }

  // Fire-and-forget message save — failures are silent so they never block the UI
  const saveMsg = (chatId: string, role: 'user' | 'assistant', content: string, imagePreview?: string) => {
    supabase.from('akiter_chat_mensajes').insert({
      chat_id: chatId,
      role,
      content,
      image_preview: imagePreview ?? null,
    }).then(() => {})
  }

  const touchChat = (chatId: string) => {
    supabase
      .from('akiter_chats')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', chatId)
      .then(() => loadChatList())
  }

  const openChat = async (chat: Chat) => {
    if (isLoading) return
    setMobileSidebarOpen(false)
    setCurrentChatId(chat.id)
    setPendingAction(null)
    setInput('')
    setAttachedImage(null)

    const { data } = await supabase
      .from('akiter_chat_mensajes')
      .select('id,role,content,image_preview,created_at')
      .eq('chat_id', chat.id)
      .order('created_at', { ascending: true })

    if (!data || data.length === 0) { setMessages([WELCOME]); setApiHistory([]); return }

    setMessages(data.map(row => ({
      id: uid(),
      role: row.role as 'user' | 'assistant',
      content: row.content as string,
      imagePreview: (row.image_preview as string | null) ?? undefined,
    })))

    // Rebuild simplified API history from saved text (image/tool blocks are not stored)
    setApiHistory(data.map(row => ({
      role: row.role as 'user' | 'assistant',
      content: (row.content as string) || '',
    })))
  }

  // ── Load ERP data + chat list on mount ───────────────────────────────────

  useEffect(() => {
    loadDataSnapshot()
      .then(snap => { setDataSnap(snap); setIsLoadingData(false) })
      .catch(() => setIsLoadingData(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    if (user) loadChatList()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.id])

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages, pendingAction])

  // ── Core: stream a response from Claude ──────────────────────────────────

  const streamFromClaude = async (
    history: Anthropic.MessageParam[],
    onToken: (t: string) => void,
  ): Promise<{ text: string; toolUses: Anthropic.ToolUseBlock[]; stopReason: string; finalContent: Anthropic.ContentBlock[] }> => {
    let text = ''

    const stream = anthropic.messages.stream({
      model: AI_MODEL,
      max_tokens: 2048,
      system: dataSnap ? buildSystemPrompt(dataSnap) : 'Eres el asistente de IA de Akiter Energías Renovables. Responde en español.',
      tools: WRITE_TOOLS,
      tool_choice: { type: 'auto' },
      messages: history,
    })

    stream.on('text', (delta: string) => { text += delta; onToken(delta) })

    const final = await stream.finalMessage()
    const toolUses = final.content.filter((b): b is Anthropic.ToolUseBlock => b.type === 'tool_use')
    return { text, toolUses, stopReason: final.stop_reason ?? 'end_turn', finalContent: final.content }
  }

  // ── Send user message ─────────────────────────────────────────────────────

  const sendMessage = async (text: string) => {
    const trimmed = text.trim()
    if ((!trimmed && !attachedImage) || isLoading) return
    setIsLoading(true)

    const imageSnap = attachedImage
    setAttachedImage(null)

    // Create chat record on first message in this session
    let chatId = currentChatId
    if (!chatId && user) {
      const titulo = (trimmed || 'Imagen adjunta').slice(0, 60)
      const { data, error } = await supabase
        .from('akiter_chats')
        .insert({ usuario_id: user.id, titulo })
        .select('id')
        .single()
      if (!error && data) {
        chatId = (data as { id: string }).id
        setCurrentChatId(chatId)
        loadChatList()
      }
    }

    const userMsg: ChatMessage = {
      id: uid(),
      role: 'user',
      content: trimmed,
      imagePreview: imageSnap?.previewUrl,
    }
    const aiMsgId = uid()
    setMessages(prev => [...prev, userMsg, { id: aiMsgId, role: 'assistant', content: '', isStreaming: true }])

    // Save user message (fire-and-forget)
    if (chatId) saveMsg(chatId, 'user', trimmed, imageSnap?.previewUrl)

    // Build Anthropic content
    let userContent: Anthropic.MessageParam['content']
    if (imageSnap) {
      userContent = [
        { type: 'image', source: { type: 'base64', media_type: imageSnap.mediaType, data: imageSnap.base64 } },
        { type: 'text', text: trimmed || 'Analiza esta imagen y extrae toda la información relevante para el ERP (productos, cantidades, importes, datos de cliente/proveedor).' },
      ] as unknown as Anthropic.MessageParam['content']
    } else {
      userContent = trimmed
    }

    const newHistory: Anthropic.MessageParam[] = [
      ...apiHistory,
      { role: 'user', content: userContent },
    ]

    try {
      const { text: responseText, toolUses, stopReason, finalContent } = await streamFromClaude(
        newHistory,
        delta => setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, content: m.content + delta } : m)),
      )

      setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, content: responseText, isStreaming: false } : m))

      const assistantHistory: Anthropic.MessageParam = {
        role: 'assistant',
        content: finalContent as unknown as Anthropic.MessageParam['content'],
      }
      const historyWithAssistant = [...newHistory, assistantHistory]

      if (stopReason === 'tool_use' && toolUses.length > 0) {
        const [first, ...rest] = toolUses
        setPendingAction({
          toolUseId: first.id,
          toolName: first.name,
          toolInput: first.input as Record<string, unknown>,
          description: describeAction(first.name, first.input as Record<string, unknown>),
          apiHistory: historyWithAssistant,
          queuedTools: rest,
          collectedResults: [],
          batchIndex: 1,
          batchTotal: toolUses.length,
          chatId,
        })
      } else {
        setApiHistory(historyWithAssistant)
        // Save assistant response
        if (chatId) { saveMsg(chatId, 'assistant', responseText); touchChat(chatId) }
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setMessages(prev => prev.map(m =>
        m.id === aiMsgId
          ? { ...m, content: `⚠️ Error al conectar con la IA: ${msg}\n\nVerifica que la clave VITE_ANTHROPIC_API_KEY es correcta.`, isStreaming: false, isError: true }
          : m
      ))
    } finally {
      setIsLoading(false)
    }
  }

  // ── Confirm write action ──────────────────────────────────────────────────

  const confirmAction = async () => {
    if (!pendingAction) return
    setConfirmLoading(true)

    let result: string
    try {
      result = await executeWriteTool(pendingAction.toolName, pendingAction.toolInput)
    } catch (err: unknown) {
      const errMsg = err instanceof Error ? err.message : 'Error desconocido'
      result = `Error al ejecutar "${pendingAction.toolName}": ${errMsg}`
      setMessages(prev => [...prev, {
        id: uid(), role: 'assistant',
        content: `⚠️ Falló **${pendingAction.toolName}**: ${errMsg}`,
        isError: true,
      }])
    }

    const newResult: Anthropic.ToolResultBlockParam = {
      type: 'tool_result', tool_use_id: pendingAction.toolUseId, content: result,
    }
    const allCollected = [...pendingAction.collectedResults, newResult]
    setConfirmLoading(false)

    if (pendingAction.queuedTools.length > 0) {
      const [next, ...remaining] = pendingAction.queuedTools
      setPendingAction({
        toolUseId: next.id,
        toolName: next.name,
        toolInput: next.input as Record<string, unknown>,
        description: describeAction(next.name, next.input as Record<string, unknown>),
        apiHistory: pendingAction.apiHistory,
        queuedTools: remaining,
        collectedResults: allCollected,
        batchIndex: pendingAction.batchIndex + 1,
        batchTotal: pendingAction.batchTotal,
        chatId: pendingAction.chatId,
      })
      return
    }

    // All tools done — send all results to Claude
    setPendingAction(null)
    setIsLoading(true)

    const historyWithResults: Anthropic.MessageParam[] = [
      ...pendingAction.apiHistory,
      { role: 'user', content: allCollected as unknown as Anthropic.MessageParam['content'] },
    ]

    try {
      const aiMsgId = uid()
      setMessages(prev => [...prev, { id: aiMsgId, role: 'assistant', content: '', isStreaming: true }])

      const { text: finalText, finalContent: finalResponseContent } = await streamFromClaude(
        historyWithResults,
        delta => setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, content: m.content + delta } : m)),
      )

      setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, content: finalText, isStreaming: false } : m))

      const newHistory = [...historyWithResults, {
        role: 'assistant' as const,
        content: finalResponseContent as unknown as Anthropic.MessageParam['content'],
      }]
      setApiHistory(newHistory)

      // Save assistant response
      if (pendingAction.chatId) {
        saveMsg(pendingAction.chatId, 'assistant', finalText)
        touchChat(pendingAction.chatId)
      }

      loadDataSnapshot().then(snap => setDataSnap(snap)).catch(() => {})
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Error desconocido'
      setMessages(prev => [...prev, {
        id: uid(), role: 'assistant',
        content: `⚠️ Error al obtener respuesta: ${msg}`, isError: true,
      }])
    } finally {
      setIsLoading(false)
    }
  }

  // ── Cancel write action ───────────────────────────────────────────────────

  const cancelAction = async () => {
    if (!pendingAction) return

    const cancelledResults: Anthropic.ToolResultBlockParam[] = [
      ...pendingAction.collectedResults,
      { type: 'tool_result', tool_use_id: pendingAction.toolUseId, content: 'El usuario canceló esta acción.' },
      ...pendingAction.queuedTools.map(t => ({
        type: 'tool_result' as const, tool_use_id: t.id, content: 'Cancelado por el usuario.',
      })),
    ]

    const historyWithCancel: Anthropic.MessageParam[] = [
      ...pendingAction.apiHistory,
      { role: 'user', content: cancelledResults as unknown as Anthropic.MessageParam['content'] },
    ]
    const savedChatId = pendingAction.chatId
    setPendingAction(null)
    setIsLoading(true)

    const aiMsgId = uid()
    setMessages(prev => [...prev, { id: aiMsgId, role: 'assistant', content: '', isStreaming: true }])

    try {
      const { text, finalContent: cancelResponseContent } = await streamFromClaude(
        historyWithCancel,
        delta => setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, content: m.content + delta } : m)),
      )
      setMessages(prev => prev.map(m => m.id === aiMsgId ? { ...m, content: text, isStreaming: false } : m))
      setApiHistory([...historyWithCancel, {
        role: 'assistant',
        content: cancelResponseContent as unknown as Anthropic.MessageParam['content'],
      }])
      if (savedChatId) { saveMsg(savedChatId, 'assistant', text); touchChat(savedChatId) }
    } catch {
      setMessages(prev => prev.filter(m => m.id !== aiMsgId))
    } finally {
      setIsLoading(false)
    }
  }

  // ── Form handlers ─────────────────────────────────────────────────────────

  const handleImageSelect = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    e.target.value = ''
    const ALLOWED = ['image/jpeg', 'image/png', 'image/webp', 'image/gif']
    if (!ALLOWED.includes(file.type)) { alert('Tipo no soportado. Usa JPG, PNG, WEBP o GIF.'); return }
    if (file.size > 5 * 1024 * 1024) { alert('La imagen es demasiado grande (máximo 5 MB).'); return }
    const reader = new FileReader()
    reader.onload = () => {
      const dataUrl = reader.result as string
      setAttachedImage({
        base64: dataUrl.split(',')[1],
        mediaType: file.type as AttachedImage['mediaType'],
        previewUrl: dataUrl,
        name: file.name,
      })
    }
    reader.readAsDataURL(file)
  }

  const handleSubmit = (e?: FormEvent) => {
    e?.preventDefault()
    const text = input.trim()
    if (!text && !attachedImage) return
    setInput('')
    sendMessage(text)
    textareaRef.current?.focus()
  }

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); handleSubmit() }
  }

  const resetChat = () => {
    setMessages([WELCOME])
    setApiHistory([])
    setPendingAction(null)
    setInput('')
    setAttachedImage(null)
    setCurrentChatId(null)
    setMobileSidebarOpen(false)
  }

  const reloadData = () => {
    setIsLoadingData(true)
    loadDataSnapshot()
      .then(snap => { setDataSnap(snap); setIsLoadingData(false) })
      .catch(() => setIsLoadingData(false))
  }

  const userInitial = user?.nombre?.[0]?.toUpperCase() ?? user?.email?.[0]?.toUpperCase() ?? 'U'

  // ── Render ────────────────────────────────────────────────────────────────

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* New conversation */}
      <div className="p-3 border-b border-gray-100 flex-shrink-0">
        <button
          onClick={resetChat}
          className="flex items-center gap-2 w-full px-3 py-2 rounded-xl text-sm font-medium text-[#1a4a2e] border border-[#1a4a2e]/20 hover:bg-[#1a4a2e] hover:text-white transition-colors cursor-pointer"
        >
          <Plus size={14} />
          Nueva conversación
        </button>
      </div>

      {/* Chat list */}
      <div className="flex-1 overflow-y-auto py-2">
        {chatListLoading ? (
          <p className="text-xs text-gray-400 text-center py-6">Cargando…</p>
        ) : chatList.length === 0 ? (
          <div className="flex flex-col items-center gap-2 py-8 px-4">
            <MessageSquare size={20} className="text-gray-300" />
            <p className="text-xs text-gray-400 text-center">Sin conversaciones guardadas</p>
          </div>
        ) : chatList.map(chat => (
          <button
            key={chat.id}
            onClick={() => openChat(chat)}
            className={`w-full text-left px-3 py-2.5 mx-1 rounded-xl text-sm transition-colors cursor-pointer ${
              currentChatId === chat.id
                ? 'bg-[#1a4a2e]/10 text-[#1a4a2e]'
                : 'text-gray-600 hover:bg-gray-100'
            }`}
            style={{ width: 'calc(100% - 8px)' }}
          >
            <p className="font-medium truncate text-xs leading-snug">{chat.titulo}</p>
            <p className="text-[10px] text-gray-400 mt-0.5">{fmtDate(chat.updated_at)}</p>
          </button>
        ))}
      </div>
    </div>
  )

  return (
    <div className="flex h-full max-h-[calc(100vh-8rem)] bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden">

      {/* ── Desktop history sidebar ───────────────────────────────────────── */}
      <aside className="hidden lg:flex flex-col w-52 flex-shrink-0 border-r border-gray-100 bg-gray-50/60">
        {sidebarContent}
      </aside>

      {/* ── Mobile history sidebar (overlay) ─────────────────────────────── */}
      {mobileSidebarOpen && (
        <div className="lg:hidden fixed inset-0 z-40 flex">
          <div className="absolute inset-0 bg-black/40" onClick={() => setMobileSidebarOpen(false)} />
          <aside className="relative w-64 bg-white border-r border-gray-200 flex flex-col">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-100">
              <span className="text-sm font-semibold text-gray-700">Conversaciones</span>
              <button onClick={() => setMobileSidebarOpen(false)} className="p-1 rounded-lg text-gray-400 hover:text-gray-700 cursor-pointer">
                <X size={16} />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">{sidebarContent}</div>
          </aside>
        </div>
      )}

      {/* ── Chat area ────────────────────────────────────────────────────── */}
      <div className="flex flex-col flex-1 min-w-0">

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3.5 border-b border-gray-100 flex-shrink-0">
          <div className="flex items-center gap-2">
            {/* Mobile sidebar toggle */}
            <button
              onClick={() => setMobileSidebarOpen(true)}
              className="lg:hidden p-1.5 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer"
              title="Historial de conversaciones"
            >
              <MessageSquare size={16} />
            </button>

            <div className="relative">
              <img src={logoImg} alt="Akiter" className="w-7 h-7 object-contain" />
              <span className="absolute -bottom-0.5 -right-0.5 w-2 h-2 bg-green-500 rounded-full border-2 border-white" />
            </div>
            <div>
              <p className="font-semibold text-gray-900 text-sm">Asistente Akiter IA</p>
              <p className="text-xs text-gray-400 flex items-center gap-1">
                <Sparkles size={10} />
                {isLoadingData ? 'Cargando datos…' : `Actualizado · ${dataSnap?.loadedAt ?? '—'}`}
              </p>
            </div>
          </div>

          <div className="flex gap-1.5">
            <button onClick={reloadData} disabled={isLoadingData}
              className="p-2 rounded-lg text-gray-400 hover:text-gray-700 hover:bg-gray-100 cursor-pointer disabled:opacity-40 transition-colors"
              title="Recargar datos del ERP">
              <RefreshCw size={14} className={isLoadingData ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto px-4 py-5 space-y-4">
          {messages.map(msg => (
            <div key={msg.id} className={`flex gap-3 ${msg.role === 'user' ? 'flex-row-reverse' : 'flex-row'}`}>

              {/* Avatar */}
              {msg.role === 'assistant' ? (
                <div className="w-7 h-7 rounded-full bg-[#f0f7f3] border border-[#1a4a2e]/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                  <img src={logoImg} alt="AI" className="w-4 h-4 object-contain" />
                </div>
              ) : (
                <div className="w-7 h-7 rounded-full bg-[#c9a84c] flex items-center justify-center flex-shrink-0 mt-0.5">
                  <span className="text-white text-xs font-bold">{userInitial}</span>
                </div>
              )}

              {/* Bubble */}
              <div className={`max-w-[78%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#1a4a2e] text-white rounded-tr-sm'
                  : msg.isError
                    ? 'bg-red-50 text-red-800 border border-red-200 rounded-tl-sm'
                    : 'bg-gray-50 text-gray-800 border border-gray-200 rounded-tl-sm'
              }`}>
                {msg.isStreaming && msg.content === '' ? (
                  <span className="flex gap-1 items-center py-0.5">
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
                  </span>
                ) : (
                  <div className="space-y-2">
                    {msg.imagePreview && (
                      <img src={msg.imagePreview} alt="Imagen adjunta" className="max-w-full rounded-lg max-h-48 object-contain bg-white/10" />
                    )}
                    {(msg.content || msg.isStreaming) && (
                      <div className="whitespace-pre-wrap">
                        {msg.role === 'assistant' ? renderContent(msg.content) : msg.content}
                        {msg.isStreaming && <span className="inline-block w-0.5 h-4 bg-gray-500 ml-0.5 animate-pulse align-middle" />}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
          <div ref={bottomRef} />
        </div>

        {/* Quick suggestions */}
        {messages.length === 1 && !isLoading && (
          <div className="px-4 pb-3 flex flex-wrap gap-1.5">
            {[
              '¿Cuánto hemos facturado este mes?',
              '¿Qué proyectos están en curso?',
              '¿Hay facturas pendientes de cobro?',
              '¿Qué artículos tienen stock bajo?',
            ].map(q => (
              <button key={q} onClick={() => sendMessage(q)}
                className="text-xs px-3 py-1.5 rounded-full border border-[#1a4a2e]/20 text-[#1a4a2e] hover:bg-[#1a4a2e] hover:text-white transition-colors cursor-pointer">
                {q}
              </button>
            ))}
          </div>
        )}

        {/* Input */}
        <div className="border-t border-gray-100 px-4 py-3 flex-shrink-0">
          {attachedImage && (
            <div className="mb-2 flex items-start gap-2 p-2 bg-gray-50 rounded-xl border border-gray-200">
              <img src={attachedImage.previewUrl} alt={attachedImage.name} className="w-12 h-12 rounded-lg object-cover flex-shrink-0 border border-gray-200" />
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-gray-700 truncate">{attachedImage.name}</p>
                <p className="text-xs text-gray-400 mt-0.5">Imagen lista para enviar</p>
              </div>
              <button type="button" onClick={() => setAttachedImage(null)}
                className="flex-shrink-0 p-1 rounded-lg text-gray-400 hover:text-red-500 hover:bg-red-50 cursor-pointer transition-colors">
                <X size={13} />
              </button>
            </div>
          )}

          <form onSubmit={handleSubmit} className="flex gap-2 items-end">
            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp,image/gif" onChange={handleImageSelect} className="hidden" />

            <button type="button" onClick={() => fileInputRef.current?.click()} disabled={isLoading}
              className="w-9 h-9 rounded-xl border border-gray-200 text-gray-400 flex items-center justify-center flex-shrink-0 hover:text-[#1a4a2e] hover:border-[#1a4a2e]/40 hover:bg-[#1a4a2e]/5 disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer"
              title="Adjuntar imagen">
              <Paperclip size={15} />
            </button>

            <textarea
              ref={textareaRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder={attachedImage ? 'Instrucción opcional… (Enter para enviar)' : 'Escribe tu consulta… (Enter para enviar, Shift+Enter nueva línea)'}
              disabled={isLoading}
              rows={1}
              className="flex-1 resize-none rounded-xl border border-gray-200 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1a4a2e]/30 focus:border-[#1a4a2e] disabled:bg-gray-50 disabled:text-gray-400 transition-colors max-h-32 overflow-y-auto"
              style={{ height: 'auto' }}
              onInput={e => {
                const t = e.currentTarget
                t.style.height = 'auto'
                t.style.height = `${Math.min(t.scrollHeight, 128)}px`
              }}
            />

            <button type="submit" disabled={(!input.trim() && !attachedImage) || isLoading}
              className="w-9 h-9 rounded-xl bg-[#1a4a2e] text-white flex items-center justify-center flex-shrink-0 hover:bg-[#2d6b45] disabled:opacity-40 disabled:cursor-not-allowed transition-colors cursor-pointer">
              {isLoading ? <Bot size={15} className="animate-pulse" /> : <Send size={15} />}
            </button>
          </form>

          <p className="text-xs text-gray-400 mt-1.5 text-center">
            IA puede cometer errores. Verifica información crítica antes de actuar.
          </p>
        </div>
      </div>

      {/* Confirmation Dialog */}
      {pendingAction && (
        <ConfirmActionDialog
          action={pendingAction}
          onConfirm={confirmAction}
          onCancel={cancelAction}
          loading={confirmLoading}
        />
      )}
    </div>
  )
}
