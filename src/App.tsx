import { useEffect, useRef, useState, type ReactNode } from 'react'
import {
  Activity, AlertCircle, AlertTriangle, Archive, Bot, BriefcaseBusiness, Check, CircleUserRound, ClipboardList, Copy, DownloadCloud, FileDown,
  ExternalLink, FileText, Image as ImageIcon, Inbox, Info, Layers3, LoaderCircle, Monitor, Moon, PanelLeftClose, PanelLeftOpen, Pencil,
  Plus, RefreshCw, RotateCcw, Search, Send, Settings2, ShieldCheck, Smartphone, Sparkles, Sun, Trash2, UploadCloud, X, Zap,
  type LucideIcon,
} from 'lucide-react'
import { open, save } from '@tauri-apps/plugin-dialog'
import { getCurrentWindow } from '@tauri-apps/api/window'
import '@fontsource/poppins/latin-400.css'
import '@fontsource/poppins/latin-500.css'
import '@fontsource/poppins/latin-600.css'
import '@fontsource/poppins/latin-700.css'
import '@fontsource-variable/montserrat'
import '@fontsource-variable/plus-jakarta-sans'
import { useAppStore } from './store'
import { toast, useToastStore } from './lib/toast'
import { discoverModels, exportTracker, generateLetter, importResume, isJobPosting, isTauri, ocrImage, openBrowser, reviewJob, sendEmail, testEndpoint } from './lib/bridge'
import { checkForAppUpdate, downloadAndInstallUpdate, type UpdateInfo } from './lib/updater'
import type { AiEndpoint, Application, ApplicationStatus, CoverTemplate, FontFamily, JobReview, Profile, ProviderKind, SignatureConfig, ViewId } from './types'
import { DEFAULT_SIGNATURE_HTML, builtInTemplates, emptyProfile } from './types'
import './index.css'

const nav: Array<{ id: ViewId; label: string; icon: LucideIcon }> = [
  { id: 'workspace', label: 'Job workspace', icon: Bot },
  { id: 'resumes', label: 'Resume library', icon: FileText },
  { id: 'templates', label: 'Templates & signature', icon: Layers3 },
  { id: 'endpoints', label: 'AI endpoints', icon: Zap },
  { id: 'profile', label: 'Profile settings', icon: CircleUserRound },
  { id: 'tracker', label: 'Application tracker', icon: ClipboardList },
  { id: 'settings', label: 'Settings', icon: Settings2 },
]

type ChatMessage =
  | { id: string; type: 'user'; text: string }
  | { id: string; type: 'assistant'; text: string }
  | { id: string; type: 'review'; description: string; review: JobReview; resumeId?: string; fromMemory?: boolean }
  | { id: string; type: 'draft'; description: string; review: JobReview; letter: string; subject: string; recipient: string; resumeId?: string; editing?: 'letter' | 'subject'; sent?: boolean; fromMemory?: boolean }
  | { id: string; type: 'notice'; text: string; tone?: 'success' | 'error' }

function App() {
  const store = useAppStore()
  const [view, setView] = useState<ViewId>('workspace')
  const [collapsed, setCollapsed] = useState(false)
  const [searchByView, setSearchByView] = useState<Partial<Record<ViewId, string>>>({})
  const { hydrate } = store
  const search = searchByView[view] ?? ''
  const searchPlaceholder: Partial<Record<ViewId, string>> = {
    resumes: 'Search resumes…',
    templates: 'Search templates…',
    endpoints: 'Search endpoints or models…',
    tracker: 'Search companies, roles, or statuses…',
  }

  useEffect(() => { void hydrate() }, [hydrate])
  useEffect(() => { document.documentElement.classList.toggle('dark', store.theme === 'dark') }, [store.theme])
  useEffect(() => {
    const root = document.documentElement
    root.dataset.font = store.accessibility.fontFamily
    root.dataset.uiScale = String(store.accessibility.uiScale)
    root.style.setProperty('--ui-scale', String(store.accessibility.uiScale))
    root.style.setProperty('--text-scale', String(store.accessibility.textScale))
  }, [store.accessibility])

  if (!store.hydrated) return <LoadingScreen />
  return (
    <div className="app-shell">
      <TitleBar title={`AgentJob — ${nav.find((item) => item.id === view)?.label}`} />
      <div className="flex min-h-0 flex-1">
        <aside className={`sidebar ${collapsed ? 'sidebar-collapsed' : 'sidebar-expanded'}`}>
          <div className="sidebar-brand flex h-14 items-center gap-2.5 px-4">
            <div className="grid h-8 w-8 shrink-0 place-items-center rounded-lg border border-emerald-400/20 bg-emerald-400/10 text-emerald-400"><BriefcaseBusiness size={16} /></div>
            {!collapsed && <div><div className="text-sm font-bold tracking-tight">AgentJob</div><div className="text-[10px] text-muted">Application copilot</div></div>}
          </div>
          <nav className="flex-1 space-y-1 px-2 py-3">
            {nav.map(({ id, label, icon: Icon }) => {
              const count = id === 'resumes' ? store.resumes.length : id === 'tracker' ? store.applications.length : undefined
              return <button key={id} title={collapsed ? label : undefined} onClick={() => setView(id)} className={`nav-item ${view === id ? 'active' : ''} ${collapsed ? 'justify-center px-0' : ''}`}><Icon size={16} />{!collapsed && <><span className="flex-1 truncate text-left">{label}</span>{count !== undefined && count > 0 && <span className="text-[10px] text-muted">{count}</span>}</>}</button>
            })}
          </nav>
          <div className="border-t border-line p-2 space-y-1">
            <button
              onClick={() => store.setTheme(store.theme === 'dark' ? 'light' : 'dark')}
              className={`nav-item ${collapsed ? 'justify-center px-0' : ''}`}
              title={collapsed ? (store.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode') : undefined}
            >
              {store.theme === 'dark' ? <Sun size={16} /> : <Moon size={16} />}
              {!collapsed && <span>{store.theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>}
            </button>
            <div className={`flex items-center gap-2 rounded-lg p-2 ${collapsed ? 'justify-center' : ''}`}>
              <StatusDot online={store.endpoints.find((endpoint) => endpoint.active)?.status === 'online'} warning={!store.endpoints.length} />
              {!collapsed && <div className="min-w-0 flex-1"><div className="truncate text-[11px] font-semibold">{store.endpoints.find((endpoint) => endpoint.active)?.name ?? 'Local mode'}</div><div className="text-[10px] text-muted">{store.endpoints.length ? 'Endpoint ready' : 'Add an AI endpoint'}</div></div>}
            </div>
          </div>
        </aside>
        <main className="flex min-w-0 flex-1 flex-col overflow-hidden">
          <header className="app-header flex h-14 shrink-0 items-center justify-between gap-3 border-b border-line px-4">
            <div className="flex items-center gap-3">
              <button className="icon-button" aria-label="Toggle sidebar" onClick={() => setCollapsed(!collapsed)}>
                {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
              </button>
              {view === 'workspace' && (
                <div className="flex items-center gap-2 text-xs font-semibold text-muted">
                  <Bot size={15} className="text-emerald-400" />
                  <span>Application copilot</span>
                </div>
              )}
            </div>
            {searchPlaceholder[view] ? <div className="relative hidden w-full max-w-sm md:block"><input className="input h-8 pr-8" value={search} onChange={(event) => setSearchByView((values) => ({ ...values, [view]: event.target.value }))} placeholder={searchPlaceholder[view]} /><Search size={14} className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-muted" /></div> : <div className="flex-1" />}
          </header>
          <div className={`unified-scroll workspace-scroll ${view === 'workspace' ? '' : 'hidden'}`} aria-hidden={view !== 'workspace'}>
            <WorkspaceView onNavigate={setView} />
          </div>
          {view !== 'workspace' && <div className="unified-scroll">
            {view === 'resumes' && <ResumesView filter={search} />}
            {view === 'templates' && <TemplatesView filter={search} />}
            {view === 'endpoints' && <EndpointsView filter={search} />}
            {view === 'profile' && <ProfileView />}
            {view === 'tracker' && <TrackerView filter={search} />}
            {view === 'settings' && <SettingsView />}
          </div>}
        </main>
      </div>
      {!store.onboardingComplete && <OnboardingModal />}
      <Toaster />
    </div>
  )
}

function Toaster() {
  const { toasts, removeToast } = useToastStore()
  if (!toasts.length) return null

  return (
    <div className="toast-container" aria-live="polite" role="region">
      {toasts.map((item) => (
        <div key={item.id} className={`toast-item toast-${item.type}`}>
          <div className="flex items-center gap-2.5 min-w-0">
            {item.type === 'success' && <Check className="toast-icon shrink-0" size={16} />}
            {item.type === 'error' && <AlertCircle className="toast-icon shrink-0" size={16} />}
            {item.type === 'info' && <Info className="toast-icon shrink-0" size={16} />}
            {item.type === 'warning' && <AlertTriangle className="toast-icon shrink-0" size={16} />}
            <span className="truncate max-w-[340px]">{item.text}</span>
          </div>
          <button type="button" className="toast-dismiss" onClick={() => removeToast(item.id)} aria-label="Dismiss notification">
            <X size={13} />
          </button>
        </div>
      ))}
    </div>
  )
}

function TitleBar({ title }: { title: string }) {
  const action = async (kind: 'close' | 'minimize' | 'maximize') => { if (!isTauri()) return; const win = getCurrentWindow(); if (kind === 'close') await win.close(); if (kind === 'minimize') await win.minimize(); if (kind === 'maximize') await win.toggleMaximize() }
  const drag = async (event: React.MouseEvent) => { if (!isTauri() || (event.target as HTMLElement).closest('button,input,a')) return; if (event.detail === 2) await getCurrentWindow().toggleMaximize(); else if (event.buttons === 1) await getCurrentWindow().startDragging() }
  return <div className="titlebar" onMouseDown={drag}><div className="traffic-group"><button className="traffic traffic-close" aria-label="Close" onClick={() => void action('close')}><X size={7} strokeWidth={3} /></button><button className="traffic traffic-minimize" aria-label="Minimize" onClick={() => void action('minimize')}><span>−</span></button><button className="traffic traffic-maximize" aria-label="Maximize" onClick={() => void action('maximize')}><span>+</span></button></div><div className="flex-1 text-center text-[11px] font-medium text-muted">{title}</div><div className="w-[54px]" /></div>
}

function cleanJobFingerprint(text: string): string {
  return text.toLowerCase().replace(/[^a-z0-9]/g, '')
}

function findMatchingJobMemory(
  text: string,
  messages: ChatMessage[],
  applications: Application[],
): { type: 'draft'; draft: Extract<ChatMessage, { type: 'draft' }> } | { type: 'review'; review: Extract<ChatMessage, { type: 'review' }> } | null {
  const norm = cleanJobFingerprint(text)
  if (!norm || norm.length < 15) return null

  for (let i = messages.length - 1; i >= 0; i--) {
    const msg = messages[i]
    if (msg.type === 'draft') {
      const msgNorm = cleanJobFingerprint(msg.description)
      if (msgNorm && (norm === msgNorm || ((norm.includes(msgNorm) || msgNorm.includes(norm)) && Math.min(norm.length, msgNorm.length) / Math.max(norm.length, msgNorm.length) >= 0.65))) {
        return { type: 'draft', draft: msg }
      }
      const emailsInText = (text.match(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g) || []).map((e) => e.toLowerCase())
      const msgEmails = msg.review.emails.map((e) => e.toLowerCase())
      if (emailsInText.some((e) => msgEmails.includes(e)) && msg.review.position && norm.includes(cleanJobFingerprint(msg.review.position))) {
        return { type: 'draft', draft: msg }
      }
    }
    if (msg.type === 'review') {
      const msgNorm = cleanJobFingerprint(msg.description)
      if (msgNorm && (norm === msgNorm || ((norm.includes(msgNorm) || msgNorm.includes(norm)) && Math.min(norm.length, msgNorm.length) / Math.max(norm.length, msgNorm.length) >= 0.65))) {
        return { type: 'review', review: msg }
      }
    }
  }

  const emailsInText = (text.match(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g) || []).map((e) => e.toLowerCase())
  for (const app of applications) {
    if (emailsInText.includes(app.email.toLowerCase())) {
      const posNorm = cleanJobFingerprint(app.position)
      if (!posNorm || norm.includes(posNorm)) {
        const review: JobReview = {
          company: app.company,
          position: app.position,
          location: app.location,
          emails: [app.email],
          mustHaveSkills: [],
          jobTone: 'Professional',
          confidence: 1,
        }
        return {
          type: 'review',
          review: {
            id: crypto.randomUUID(),
            type: 'review',
            description: text,
            review,
            resumeId: app.resumeId,
            fromMemory: true,
          },
        }
      }
    }
  }

  return null
}

function WorkspaceView({ onNavigate }: { onNavigate: (view: ViewId) => void }) {
  const store = useAppStore()
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [composer, setComposer] = useState('')
  const [attachedImage, setAttachedImage] = useState<{ file: File; previewUrl: string; name: string; size: number } | null>(null)
  const [isDragging, setIsDragging] = useState(false)
  const [ocrStatus, setOcrStatus] = useState<'idle' | 'running' | 'done' | 'error'>('idle')
  const [ocrNotice, setOcrNotice] = useState('')
  const [busy, setBusy] = useState<'review' | 'generate' | 'send' | null>(null)
  const feedRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const activeEndpoint = store.endpoints.find((endpoint) => endpoint.active)
  const selectedTemplate = store.templates.find((template) => template.id === store.selectedTemplateId) ?? store.templates[0] ?? builtInTemplates[0]

  const prevMsgCountRef = useRef(messages.length)
  useEffect(() => {
    if (messages.length > prevMsgCountRef.current || busy) {
      feedRef.current?.scrollTo({ top: feedRef.current.scrollHeight, behavior: 'smooth' })
    }
    prevMsgCountRef.current = messages.length
  }, [messages.length, busy])

  function updateMessage(id: string, patch: Partial<ChatMessage>) {
    setMessages((items) => items.map((item) => (item.id === id ? ({ ...item, ...patch } as ChatMessage) : item)))
  }

  async function processImageFile(file: File) {
    if (!file.type.startsWith('image/')) return
    const reader = new FileReader()
    reader.onload = async (e) => {
      const dataUrl = e.target?.result as string
      if (!dataUrl) return
      setAttachedImage({ file, previewUrl: dataUrl, name: file.name || 'Pasted Image', size: file.size })
      setOcrStatus('running')
      setOcrNotice('Extracting text via native OCR...')
      try {
        const extracted = await ocrImage(dataUrl)
        if (extracted && extracted.trim().length > 0) {
          setComposer((prev) => (prev.trim() ? `${prev}\n\n${extracted.trim()}` : extracted.trim()))
          setOcrStatus('done')
          setOcrNotice(`OCR extracted ${extracted.length} chars`)
        } else {
          setOcrStatus('error')
          setOcrNotice('No readable text detected')
        }
      } catch (error) {
        setOcrStatus('error')
        setOcrNotice(errorMessage(error))
      }
    }
    reader.readAsDataURL(file)
  }

  function handlePaste(event: React.ClipboardEvent<HTMLTextAreaElement>) {
    const items = event.clipboardData?.items
    if (!items) return
    for (let i = 0; i < items.length; i++) {
      const item = items[i]
      if (item.type.startsWith('image/')) {
        event.preventDefault()
        const file = item.getAsFile()
        if (file) void processImageFile(file)
        return
      }
    }
  }

  function handleDragOver(event: React.DragEvent) {
    event.preventDefault()
    setIsDragging(true)
  }

  function handleDragLeave(event: React.DragEvent) {
    event.preventDefault()
    setIsDragging(false)
  }

  function handleDrop(event: React.DragEvent) {
    event.preventDefault()
    setIsDragging(false)
    const files = event.dataTransfer?.files
    if (files && files.length > 0 && files[0].type.startsWith('image/')) {
      void processImageFile(files[0])
    }
  }

  async function sendJob() {
    const text = composer.trim()
    if (!text || busy) return
    setMessages((items) => [...items, { id: crypto.randomUUID(), type: 'user', text }])
    setComposer('')
    setAttachedImage(null)
    setOcrStatus('idle')

    if (!isJobPosting(text)) {
      if (/^(hi|hello|hey|yo|sup|greetings|good morning|good evening|good afternoon)\b/i.test(text)) {
        setMessages((items) => [
          ...items,
          {
            id: crypto.randomUUID(),
            type: 'assistant',
            text: "Hello! I'm your job application copilot. Paste a job description, flyer text, or press Ctrl+V with a screenshot, and I'll extract the details, match your profile, and craft your application.",
          },
        ])
        return
      }
      if (text.length < 50) {
        setMessages((items) => [
          ...items,
          {
            id: crypto.randomUUID(),
            type: 'assistant',
            text: "Please paste a complete job description or screenshot (Ctrl+V) containing role requirements, qualifications, or company details so I can review it.",
          },
        ])
        return
      }
    }

    // Check memory first (0 tokens)
    const memoryMatch = findMatchingJobMemory(text, messages, store.applications)
    if (memoryMatch) {
      if (memoryMatch.type === 'draft') {
        const d = memoryMatch.draft
        setMessages((items) => [
          ...items,
          {
            id: crypto.randomUUID(),
            type: 'draft',
            description: text,
            review: d.review,
            letter: d.letter,
            subject: d.subject,
            recipient: d.recipient,
            resumeId: d.resumeId,
            fromMemory: true,
            sent: false,
          },
        ])
        return
      } else if (memoryMatch.type === 'review') {
        const r = memoryMatch.review
        setMessages((items) => [
          ...items,
          {
            id: crypto.randomUUID(),
            type: 'review',
            description: text,
            review: r.review,
            resumeId: r.resumeId,
            fromMemory: true,
          },
        ])
        return
      }
    }

    setBusy('review')
    try {
      const result = await reviewJob(text, activeEndpoint)
      setMessages((items) => [...items, { id: crypto.randomUUID(), type: 'review', description: text, review: result }])
    } catch (error) {
      setMessages((items) => [...items, { id: crypto.randomUUID(), type: 'notice', tone: 'error', text: errorMessage(error) }])
    } finally { setBusy(null) }
  }

  async function chooseResume(message: Extract<ChatMessage, { type: 'review' }>, resumeId?: string) {
    if (!store.profile.fullName) {
      setMessages((items) => [...items, { id: crypto.randomUUID(), type: 'notice', tone: 'error', text: 'Complete your profile before generating a cover letter.' }])
      return
    }
    if (resumeId) store.setActiveResume(resumeId)
    updateMessage(message.id, { resumeId })
    setBusy('generate')
    try {
      const letter = await generateLetter({ description: message.description, review: message.review, profile: store.profile, template: selectedTemplate.body, adaptive: selectedTemplate.adaptive, endpoint: activeEndpoint })
      const subject = message.review.position ? `Application for ${message.review.position}${message.review.company ? ` — ${message.review.company}` : ''}` : 'Job application'
      setMessages((items) => [...items, { id: crypto.randomUUID(), type: 'draft', description: message.description, review: message.review, letter, subject, recipient: message.review.emails.join(', '), resumeId }])
    } catch (error) {
      setMessages((items) => [...items, { id: crypto.randomUUID(), type: 'notice', tone: 'error', text: errorMessage(error) }])
    } finally { setBusy(null) }
  }

  async function regenerateDraft(message: Extract<ChatMessage, { type: 'draft' }>) {
    setBusy('generate')
    try {
      const letter = await generateLetter({ description: message.description, review: message.review, profile: store.profile, template: selectedTemplate.body, adaptive: selectedTemplate.adaptive, endpoint: activeEndpoint })
      const subject = message.review.position ? `Application for ${message.review.position}${message.review.company ? ` — ${message.review.company}` : ''}` : 'Job application'
      updateMessage(message.id, { letter, subject, fromMemory: false })
    } catch (error) {
      setMessages((items) => [...items, { id: crypto.randomUUID(), type: 'notice', tone: 'error', text: errorMessage(error) }])
    } finally { setBusy(null) }
  }

  async function sendDraft(message: Extract<ChatMessage, { type: 'draft' }>) {
    if (!message.recipient.trim()) {
      setMessages((items) => [...items, { id: crypto.randomUUID(), type: 'notice', tone: 'error', text: 'Add at least one recipient email before sending.' }])
      return
    }
    if (!isTauri()) {
      setMessages((items) => [...items, { id: crypto.randomUUID(), type: 'notice', text: 'Email sending is available in the desktop app. Your draft is ready to copy.' }])
      return
    }
    setBusy('send')
    try {
      const resume = store.resumes.find((item) => item.id === message.resumeId)
      const resumeName = resume ? (resume.fileName || (resume.label.toLowerCase().endsWith('.pdf') ? resume.label : `${resume.label}.pdf`)) : null
      await sendEmail({
        recipient: message.recipient,
        subject: message.subject,
        plainBody: message.letter,
        profile: store.profile,
        signature: store.signature,
        resumePath: resume?.path ?? null,
        resumeName,
      })
      const now = new Date().toISOString()
      store.addApplication({ id: crypto.randomUUID(), company: message.review.company, position: message.review.position, location: message.review.location, email: message.recipient, subject: message.subject, status: 'Sent', resumeId: message.resumeId, createdAt: now, updatedAt: now, notes: '' })
      updateMessage(message.id, { sent: true, editing: undefined })
      setMessages((items) => [...items, { id: crypto.randomUUID(), type: 'notice', tone: 'success', text: `Email sent successfully to ${message.recipient}. The application was added to your tracker.` }])
    } catch (error) {
      setMessages((items) => [...items, { id: crypto.randomUUID(), type: 'notice', tone: 'error', text: errorMessage(error) }])
    } finally { setBusy(null) }
  }

  return <div className={`chat-workspace relative ${isDragging ? 'ring-2 ring-emerald-400/80 ring-inset bg-emerald-500/5' : ''}`} onDragOver={handleDragOver} onDragLeave={handleDragLeave} onDrop={handleDrop}>
    <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={(event) => { if (event.target.files?.[0]) void processImageFile(event.target.files[0]) }} />
    {isDragging && <div className="pointer-events-none absolute inset-0 z-30 flex flex-col items-center justify-center bg-app/80 backdrop-blur-xs"><UploadCloud size={44} className="text-emerald-400 animate-bounce" /><div className="mt-2 text-sm font-bold text-emerald-400">Drop job screenshot or flyer here</div><p className="text-xs text-muted">Native OCR will extract the text automatically</p></div>}
    <div className="chat-feed" ref={feedRef}>
      {messages.length > 0 && (
        <div className="flex justify-end pb-2">
          <button className="chat-quiet-button" onClick={() => setMessages([])}>
            <Plus size={13} /> New chat
          </button>
        </div>
      )}
      {!messages.length && <div className="chat-empty"><div className="chat-mark"><Bot size={24} /></div><h2>Send me a job description</h2><p>Paste text or screenshot (Ctrl+V / Drop image) — I’ll extract the facts with native OCR, match your profile, and craft your application.</p><div className="chat-empty-actions"><button onClick={() => setComposer('Company: Example Company\nPosition: IT Support Specialist\nLocation: Remote\n\nRequirements:\n- Troubleshooting\n- Customer support\n\nApply at: careers@example.com')}>Try an example</button><button onClick={() => fileInputRef.current?.click()}><ImageIcon size={13} /> Upload screenshot</button>{!activeEndpoint && <button onClick={() => onNavigate('endpoints')}>Configure AI endpoint</button>}</div></div>}
      {messages.map((message) => <div className={`chat-row ${message.type === 'user' ? 'user' : 'assistant'}`} key={message.id}>
        {message.type !== 'user' && <div className="chat-avatar"><Bot size={15} /></div>}
        <div className={`chat-bubble ${message.type === 'user' ? 'user-bubble' : ''} ${message.type === 'notice' && message.tone ? message.tone : ''}`}>
          {message.type === 'user' && <div className="whitespace-pre-wrap">{message.text}</div>}
          {message.type === 'assistant' && <div className="whitespace-pre-wrap leading-relaxed">{message.text}</div>}
          {message.type === 'notice' && <div className="flex gap-2"><Check size={15} className={message.tone === 'error' ? 'text-rose-400' : 'text-emerald-400'} /><span>{message.text}</span></div>}
          {message.type === 'review' && <><div className="flex items-center justify-between gap-3"><div><div className="chat-message-title">I reviewed the job posting</div><p className="chat-message-copy">Please verify these details before I create your cover letter.</p></div>{message.fromMemory && <span className="tag bg-emerald-500/10 text-emerald-400 border-emerald-500/20"><Zap size={11} /> Memory (0 tokens)</span>}</div><div className="chat-facts"><EditableFact label="Company" value={message.review.company} onChange={(company) => updateMessage(message.id, { review: { ...message.review, company } })} /><EditableFact label="Position" value={message.review.position} onChange={(position) => updateMessage(message.id, { review: { ...message.review, position } })} /><EditableFact label="Location" value={message.review.location} onChange={(location) => updateMessage(message.id, { review: { ...message.review, location } })} /><EditableFact label="HR email" value={message.review.emails.join(', ')} onChange={(emails) => updateMessage(message.id, { review: { ...message.review, emails: emails.split(',').map((item) => item.trim()).filter(Boolean) } })} /></div>{message.review.mustHaveSkills.length > 0 && <div className="mt-3 flex flex-wrap gap-1.5">{message.review.mustHaveSkills.map((skill) => <span key={skill} className="tag">{skill}</span>)}</div>}<div className="chat-question">Which resume do you want to attach?</div><div className="chat-choice-grid">{store.resumes.map((resume) => <button key={resume.id} disabled={busy !== null} onClick={() => void chooseResume(message, resume.id)}><FileText size={14} /><span>{resume.label}</span>{message.resumeId === resume.id && <Check size={13} />}</button>)}<button disabled={busy !== null} onClick={() => void chooseResume(message)}><X size={14} /><span>No attachment</span></button>{!store.resumes.length && <button onClick={() => onNavigate('resumes')}><Plus size={14} /><span>Add a resume</span></button>}</div></>}
          {message.type === 'draft' && <><div className="flex items-center justify-between gap-3"><div><div className="flex items-center gap-2"><div className="chat-message-title">Your application is ready</div>{message.fromMemory && <span className="tag bg-emerald-500/10 text-emerald-400 border-emerald-500/20"><Zap size={11} /> Agent memory (0 tokens)</span>}</div><p className="chat-message-copy">{message.fromMemory ? 'Reused your previous application draft for this role instantly.' : 'Review everything below, then copy, edit, or send it.'}</p></div>{message.sent && <span className="sent-badge"><Check size={11} /> Sent</span>}</div><label className="chat-mail-field"><span>To</span><input value={message.recipient} onChange={(event) => updateMessage(message.id, { recipient: event.target.value })} placeholder="hr@company.com" /></label><div className="chat-mail-field"><span>Subject</span>{message.editing === 'subject' ? <input autoFocus value={message.subject} onChange={(event) => updateMessage(message.id, { subject: event.target.value })} /> : <div>{message.subject}</div>}<button type="button" className="chat-inline-edit" aria-label={message.editing === 'subject' ? 'Finish editing subject' : 'Edit subject'} onClick={() => updateMessage(message.id, { editing: message.editing === 'subject' ? undefined : 'subject' })}><Pencil size={12} />{message.editing === 'subject' ? 'Done' : 'Edit'}</button></div><div className="chat-letter-wrap"><div className="chat-letter-head"><span>Cover letter</span><button type="button" className="chat-inline-edit" aria-label={message.editing === 'letter' ? 'Finish editing cover letter' : 'Edit cover letter'} onClick={() => updateMessage(message.id, { editing: message.editing === 'letter' ? undefined : 'letter' })}><Pencil size={12} />{message.editing === 'letter' ? 'Done' : 'Edit'}</button></div><div className="chat-letter">{message.editing === 'letter' ? <textarea autoFocus value={message.letter} onChange={(event) => updateMessage(message.id, { letter: event.target.value })} /> : <div className="whitespace-pre-wrap">{message.letter}</div>}</div></div><div className="chat-draft-meta"><span><Layers3 size={12} /> {selectedTemplate.name}</span><span><FileText size={12} /> {store.resumes.find((resume) => resume.id === message.resumeId)?.label ?? 'No attachment'}</span></div><div className="chat-actions">
            <button type="button" onClick={() => { void navigator.clipboard.writeText(message.letter); toast.success('Cover letter copied to clipboard!') }}>
              <Copy size={14} /> Copy letter
            </button>
            {message.fromMemory && <button type="button" disabled={busy !== null} onClick={() => void regenerateDraft(message)} title="Re-write draft with active AI endpoint"><RefreshCw size={13} className={busy === 'generate' ? 'animate-spin' : ''} /> Regenerate with AI</button>}
            <button type="button" className="send" disabled={busy !== null || message.sent} onClick={() => void sendDraft(message)}>
              {busy === 'send' ? <LoaderCircle className="animate-spin" size={14} /> : <Send size={14} />} Send to HR
            </button>
          </div>
        </>}
        </div>
      </div>)}
      {busy && <div className="chat-row assistant"><div className="chat-avatar"><Bot size={15} /></div><div className="typing-bubble"><span /><span /><span /><div>{busy === 'review' ? 'Reviewing the job posting…' : busy === 'generate' ? 'Writing your tailored cover letter…' : 'Sending your application…'}</div></div></div>}
    </div>
    <div className="chat-composer-wrap">
      <div className="chat-composer">
        {attachedImage && <div className="m-2 mb-0 flex items-center justify-between gap-2.5 rounded-lg border border-line bg-inset p-2">
          <div className="flex min-w-0 items-center gap-2.5">
            <img src={attachedImage.previewUrl} alt="Attached screenshot" className="h-10 w-10 shrink-0 rounded-md border border-line object-cover" />
            <div className="min-w-0 text-left">
              <div className="truncate text-xs font-semibold">{attachedImage.name}</div>
              <div className="mt-0.5 flex items-center gap-1.5 text-[10px] text-muted">
                <span>{formatBytes(attachedImage.size)}</span>
                <span>·</span>
                {ocrStatus === 'running' && <span className="flex items-center gap-1 font-medium text-amber-400"><LoaderCircle className="animate-spin" size={10} /> OCR extracting text…</span>}
                {ocrStatus === 'done' && <span className="flex items-center gap-1 font-medium text-emerald-400"><Check size={10} /> {ocrNotice}</span>}
                {ocrStatus === 'error' && <span className="font-medium text-rose-400">{ocrNotice || 'OCR failed'}</span>}
              </div>
            </div>
          </div>
          <button type="button" className="icon-button" onClick={() => { setAttachedImage(null); setOcrStatus('idle'); setOcrNotice('') }} title="Remove attached image"><X size={14} /></button>
        </div>}
        <textarea value={composer} onPaste={handlePaste} onChange={(event) => setComposer(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter' && !event.shiftKey) { event.preventDefault(); void sendJob() } }} placeholder="Paste a complete job description or press Ctrl+V with a screenshot…" rows={3} />
        <div className="chat-composer-footer">
          <div className="flex min-w-0 items-center gap-2">
            <button type="button" className="icon-button" onClick={() => fileInputRef.current?.click()} title="Upload screenshot / image for OCR"><ImageIcon size={14} /></button>
            <select value={store.selectedTemplateId} onChange={(event) => store.selectTemplate(event.target.value)}>{store.templates.map((template) => <option key={template.id} value={template.id}>{template.name}</option>)}</select>
            <span className="chat-model"><span className={`h-1.5 w-1.5 rounded-full ${activeEndpoint ? 'bg-emerald-400' : 'bg-amber-400'}`} />{activeEndpoint?.defaultModel || 'Local reviewer'}</span>
          </div>
          <button className="chat-send" disabled={!composer.trim() || busy !== null} onClick={() => void sendJob()} aria-label="Send job description">{busy === 'review' ? <LoaderCircle className="animate-spin" size={16} /> : <Send size={16} />}</button>
        </div>
      </div>
      <p>Enter to send · Shift + Enter for newline · Paste screenshot with Ctrl+V for OCR</p>
    </div>
  </div>
}

function ResumesView({ filter }: { filter: string }) {
  const store = useAppStore(); const [busy, setBusy] = useState(false)
  const shown = store.resumes.filter((resume) => `${resume.label} ${resume.tags.join(' ')}`.toLowerCase().includes(filter.toLowerCase()))
  async function addResume() {
    if (!isTauri()) return toast.info('Resume import is available in the desktop build.')
    const source = await open({ multiple: false, filters: [{ name: 'PDF resume', extensions: ['pdf'] }] })
    if (!source) return
    const fileName = source.split(/[\\/]/).pop()?.replace(/\.pdf$/i, '') ?? 'Resume'
    setBusy(true)
    try {
      store.addResume(await importResume(source, fileName))
      toast.success(`Imported ${fileName} into resume library.`)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(false)
    }
  }
  return <div className="space-y-4">
    <PageIntro title="Resume library" description="Keep role-specific PDFs organized and choose the active attachment in one click." action={<button className="primary-button" onClick={() => void addResume()} disabled={busy}>{busy ? <LoaderCircle className="animate-spin" size={14} /> : <UploadCloud size={14} />} Import PDF</button>} />
    <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
      {shown.map((resume) => <article className={`bento-card ${resume.active ? 'ring-1 ring-emerald-400/50' : ''}`} key={resume.id}>
        <div>
          <div className="flex items-start justify-between">
            <div className="brand-icon"><FileText size={20} /></div>
            <button className="icon-button danger" onClick={() => { store.removeResume(resume.id); toast.info(`Removed ${resume.label}.`) }} title="Delete resume"><Trash2 size={14} /></button>
          </div>
          <h3 className="mt-4 truncate text-sm font-bold">{resume.label}</h3>
          <p className="mt-1 truncate text-[11px] text-muted">{resume.fileName}</p>
          <div className="mt-4 grid grid-cols-2 gap-2"><Inset label="Size" value={formatBytes(resume.size)} /><Inset label="Added" value={new Date(resume.createdAt).toLocaleDateString()} /></div>
        </div>
        <div className="mt-4 border-t border-line pt-3">
          <button className={resume.active ? 'status-button active' : 'status-button'} onClick={() => { store.setActiveResume(resume.id); toast.success(`Active resume set to ${resume.label}.`) }}>{resume.active ? <><Check size={13} /> Active resume</> : 'Use this resume'}</button>
        </div>
      </article>)}
      <button className="empty-card" onClick={() => void addResume()}><UploadCloud size={22} /><span>Import another PDF</span><small>Files are copied into private app storage</small></button>
    </div>
  </div>
}

function TemplatesView({ filter }: { filter: string }) {
  const store = useAppStore(); const [tab, setTab] = useState<'templates' | 'signature'>('templates'); const [editing, setEditing] = useState<CoverTemplate | null>(null)
  const templates = store.templates.filter((template) => template.name.toLowerCase().includes(filter.toLowerCase()))
  function newTemplate() { setEditing({ id: crypto.randomUUID(), name: 'Custom template', description: 'Your reusable application format.', body: 'Dear Hiring Manager,\n\nI am applying for the {{position}} role at {{company}}.\n\nBest regards,\n{{applicant_name}}', builtIn: false, adaptive: false }) }
  function saveTemplate() {
    if (!editing) return
    const exists = store.templates.some((item) => item.id === editing.id)
    if (exists) store.updateTemplate(editing.id, editing)
    else store.addTemplate(editing)
    toast.success(`Template "${editing.name}" saved.`)
    setEditing(null)
  }
  return <div className="space-y-4">
    <PageIntro title="Templates & signature" description="Use deterministic smart tags or let the creator adapt only the sections that need AI." action={<div className="segmented"><button className={tab === 'templates' ? 'active' : ''} onClick={() => setTab('templates')}>Templates</button><button className={tab === 'signature' ? 'active' : ''} onClick={() => setTab('signature')}>Signature</button></div>} />
    {tab === 'templates' ? <>
      <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
        {templates.map((template) => <article key={template.id} className={`bento-card ${store.selectedTemplateId === template.id ? 'ring-1 ring-emerald-400/50' : ''}`}>
          <div>
            <div className="flex items-start justify-between">
              <div className="brand-icon"><Layers3 size={20} /></div>
              <div className="flex items-center gap-1.5"><span className="tag">{template.adaptive ? 'AI adaptive' : '0 tokens'}</span><button className="icon-button danger" onClick={() => { store.removeTemplate(template.id); toast.info(`Deleted template "${template.name}".`) }} title="Delete template"><Trash2 size={13} /></button></div>
            </div>
            <h3 className="mt-4 text-sm font-bold">{template.name}</h3>
            <p className="mt-1 text-[11px] leading-5 text-muted">{template.description}</p>
            <div className="mt-4 line-clamp-4 whitespace-pre-line rounded-lg border border-line bg-inset p-3 font-mono text-[10px] leading-4 text-muted">{template.body}</div>
          </div>
          <div className="mt-4 flex items-center gap-2 border-t border-line pt-3">
            <button className={store.selectedTemplateId === template.id ? 'status-button active' : 'status-button'} onClick={() => { store.selectTemplate(template.id); toast.success(`Selected template "${template.name}".`) }}>{store.selectedTemplateId === template.id ? <><Check size={13} /> Selected</> : 'Select'}</button>
            <button className="icon-button" onClick={() => setEditing(template)} title="Edit template"><Pencil size={13} /></button>
            <button className="icon-button danger" onClick={() => { store.removeTemplate(template.id); toast.info(`Deleted template "${template.name}".`) }} title="Delete template"><Trash2 size={13} /></button>
          </div>
        </article>)}
        <button className="empty-card" onClick={newTemplate}><Plus size={22} /><span>Create custom template</span><small>Supports standard smart tags</small></button>
      </div>
      {editing && <Modal title={editing.builtIn ? 'Customize template' : 'Custom template'} onClose={() => setEditing(null)} footer={<><button className="secondary-button" onClick={() => setEditing(null)}>Cancel</button><button className="primary-button" onClick={saveTemplate}>Save template</button></>}><div className="space-y-3"><label className="field"><span>Name</span><input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} /></label><label className="field"><span>Description</span><input className="input" value={editing.description} onChange={(e) => setEditing({ ...editing, description: e.target.value })} /></label><label className="flex items-center gap-2 text-xs"><input type="checkbox" checked={editing.adaptive} onChange={(e) => setEditing({ ...editing, adaptive: e.target.checked })} /> Allow AI adaptation</label><label className="field"><span>Body</span><textarea className="input min-h-[300px] p-3 font-mono text-xs" value={editing.body} onChange={(e) => setEditing({ ...editing, body: e.target.value })} /></label><p className="text-[10px] text-muted">Tags: {'{{applicant_name}} {{company}} {{position}} {{location}} {{portfolio}} {{top_skills}} {{education}} {{custom_reason}}'}</p></div></Modal>}
    </> : <SignatureEditor />}
  </div>
}

function interpolateSignatureHtml(template: string, p: Profile, s: SignatureConfig): string {
  const accent = s.accentColor || '#c84e89'
  const portfolioClean = p.portfolio.replace(/^https?:\/\//i, '')
  const portfolioUrl = p.portfolio ? (p.portfolio.startsWith('http') ? p.portfolio : `https://${p.portfolio}`) : ''
  const fbUrl = p.facebook ? (p.facebook.startsWith('http') ? p.facebook : `https://${p.facebook}`) : 'https://facebook.com/'
  const igUrl = p.instagram ? (p.instagram.startsWith('http') ? p.instagram : `https://${p.instagram}`) : 'https://instagram.com/'
  const ttUrl = p.tiktok ? (p.tiktok.startsWith('http') ? p.tiktok : `https://${p.tiktok}`) : 'https://tiktok.com/'
  const liUrl = p.linkedin ? (p.linkedin.startsWith('http') ? p.linkedin : `https://${p.linkedin}`) : 'https://linkedin.com/'
  const ghUrl = p.github ? (p.github.startsWith('http') ? p.github : `https://${p.github}`) : 'https://github.com/'

  const values: Record<string, string> = {
    'profile.fullName': p.fullName || 'Your Name',
    fullName: p.fullName || 'Your Name',
    'profile.firstName': p.firstName || p.fullName.split(/\s+/)[0] || '',
    firstName: p.firstName || p.fullName.split(/\s+/)[0] || '',
    'profile.tagline': p.tagline || 'Professional Tagline',
    tagline: p.tagline || 'Professional Tagline',
    'profile.phone': p.phone || '+1 234 567 8900',
    phone: p.phone || '+1 234 567 8900',
    'profile.email': p.email || 'you@example.com',
    email: p.email || 'you@example.com',
    'profile.portfolio': portfolioUrl || 'https://yrodev.site/',
    portfolio: portfolioUrl || 'https://yrodev.site/',
    portfolio_domain: portfolioClean || 'yrodev.site',
    'profile.education': p.education || 'BS Information Technology',
    education: p.education || 'BS Information Technology',
    'profile.facebook': fbUrl,
    facebook: fbUrl,
    'profile.instagram': igUrl,
    instagram: igUrl,
    'profile.tiktok': ttUrl,
    tiktok: ttUrl,
    'profile.linkedin': liUrl,
    linkedin: liUrl,
    'profile.github': ghUrl,
    github: ghUrl,
    'signature.accentColor': accent,
    accentColor: accent,
  }

  const replacedCurly = template.replace(/\{\{([a-zA-Z0-9_.]+?)}}/g, (_, key: string) => values[key] ?? '')
  return replacedCurly.replace(/\$\{([a-zA-Z0-9_. '()[\]]+?)}/g, (_, key: string) => values[key] ?? '')
}

function renderSignatureHtml(p: Profile, s: SignatureConfig): string {
  if (!s.enabled) return '<!DOCTYPE html><html><body style="margin:0;padding:24px;color:#9ca3af;font-family:sans-serif;font-size:12px;text-align:center;">Signature is disabled</body></html>'
  if (s.useCustomHtml && s.customHtml) {
    const raw = interpolateSignatureHtml(s.customHtml, p, s)
    if (raw.includes('<html')) return raw
    return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');body{background:transparent !important;}</style></head><body style="margin:0;padding:16px 20px;color:#111111;font-family:'Poppins',-apple-system,BlinkMacSystemFont,sans-serif;">${raw}</body></html>`
  }

  const accent = s.accentColor || '#00c92b'
  const contactRows: string[] = []

  if (s.showEmail !== false && p.email) {
    contactRows.push(`<tr><td width="26" valign="middle" style="width:26px; padding:4px 0;"><img src="https://img.icons8.com/ios/50/00c92b/new-post--v1.png" width="18" height="18" alt="Email" style="width:18px; height:18px; display:block; border:0;" /></td><td width="90" valign="middle" style="width:90px; padding:4px 8px; font-size:11px; line-height:18px; font-weight:700; letter-spacing:0.5px; color:#777777;">EMAIL</td><td width="1" style="width:1px; background:#e2e2e2; background:rgba(128,128,128,0.25);"></td><td valign="middle" style="padding:4px 0 4px 14px; font-size:13px; line-height:19px; font-weight:500;"><a href="mailto:${p.email}" style="color:#111111; text-decoration:none; word-break:break-word;">${p.email}</a></td></tr>`)
  }

  if (s.showPhone !== false && p.phone) {
    contactRows.push(`<tr><td width="26" valign="middle" style="width:26px; padding:4px 0;"><img src="https://img.icons8.com/ios/50/00c92b/phone.png" width="18" height="18" alt="Phone" style="width:18px; height:18px; display:block; border:0;" /></td><td width="90" valign="middle" style="width:90px; padding:4px 8px; font-size:11px; line-height:18px; font-weight:700; letter-spacing:0.5px; color:#777777;">PHONE</td><td width="1" style="width:1px; background:#e2e2e2; background:rgba(128,128,128,0.25);"></td><td valign="middle" style="padding:4px 0 4px 14px; font-size:13px; line-height:19px; font-weight:500;"><a href="tel:${p.phone}" style="color:#111111; text-decoration:none; word-break:break-word;">${p.phone}</a></td></tr>`)
  }

  if (s.showPortfolio !== false && p.portfolio) {
    const url = p.portfolio.startsWith('http') ? p.portfolio : `https://${p.portfolio}`
    contactRows.push(`<tr><td width="26" valign="middle" style="width:26px; padding:4px 0;"><img src="https://img.icons8.com/ios/50/00c92b/domain.png" width="18" height="18" alt="Portfolio" style="width:18px; height:18px; display:block; border:0;" /></td><td width="90" valign="middle" style="width:90px; padding:4px 8px; font-size:11px; line-height:18px; font-weight:700; letter-spacing:0.5px; color:#777777;">PORTFOLIO</td><td width="1" style="width:1px; background:#e2e2e2; background:rgba(128,128,128,0.25);"></td><td valign="middle" style="padding:4px 0 4px 14px; font-size:13px; line-height:19px; font-weight:500;"><a href="${url}" target="_blank" style="color:#111111; text-decoration:none; word-break:break-word;">${p.portfolio}</a></td></tr>`)
  }

  if (s.showEducation !== false && p.education) {
    contactRows.push(`<tr><td width="26" valign="middle" style="width:26px; padding:4px 0;"><img src="https://img.icons8.com/ios/50/00c92b/graduation-cap.png" width="18" height="18" alt="Education" style="width:18px; height:18px; display:block; border:0;" /></td><td width="90" valign="middle" style="width:90px; padding:4px 8px; font-size:11px; line-height:18px; font-weight:700; letter-spacing:0.5px; color:#777777;">EDUCATION</td><td width="1" style="width:1px; background:#e2e2e2; background:rgba(128,128,128,0.25);"></td><td valign="middle" style="padding:4px 0 4px 14px; font-size:13px; line-height:19px; font-weight:500; color:#111111; word-break:break-word;">${p.education}</td></tr>`)
  }

  const socialIcons: string[] = []
  if (s.showLinkedin !== false) {
    const url = p.linkedin ? (p.linkedin.startsWith('http') ? p.linkedin : `https://${p.linkedin}`) : 'https://linkedin.com/'
    socialIcons.push(`<td style="padding-right:10px; vertical-align:middle;"><a href="${url}" target="_blank" style="display:block; text-decoration:none; line-height:0;"><img src="https://img.icons8.com/color/48/linkedin-circled--v1.png" width="22" height="22" alt="LinkedIn" style="display:block; width:22px; height:22px; border:0;" /></a></td>`)
  }
  if (s.showGithub !== false) {
    const url = p.github ? (p.github.startsWith('http') ? p.github : `https://${p.github}`) : 'https://github.com/'
    socialIcons.push(`<td style="padding-right:10px; vertical-align:middle;"><a href="${url}" target="_blank" style="display:block; text-decoration:none; line-height:0;"><img src="https://img.icons8.com/ios-filled/50/github.png" width="22" height="22" alt="GitHub" style="display:block; width:22px; height:22px; border:0;" /></a></td>`)
  }
  if (s.showFacebook !== false) {
    const url = p.facebook ? (p.facebook.startsWith('http') ? p.facebook : `https://${p.facebook}`) : 'https://facebook.com/'
    socialIcons.push(`<td style="padding-right:10px; vertical-align:middle;"><a href="${url}" target="_blank" style="display:block; text-decoration:none; line-height:0;"><img src="https://img.icons8.com/color/48/facebook-new.png" width="22" height="22" alt="Facebook" style="display:block; width:22px; height:22px; border:0;" /></a></td>`)
  }
  if (s.showInstagram !== false) {
    const url = p.instagram ? (p.instagram.startsWith('http') ? p.instagram : `https://${p.instagram}`) : 'https://instagram.com/'
    socialIcons.push(`<td style="padding-right:10px; vertical-align:middle;"><a href="${url}" target="_blank" style="display:block; text-decoration:none; line-height:0;"><img src="https://img.icons8.com/fluency/48/instagram-new.png" width="22" height="22" alt="Instagram" style="display:block; width:22px; height:22px; border:0;" /></a></td>`)
  }
  if (s.showTiktok !== false) {
    const url = p.tiktok ? (p.tiktok.startsWith('http') ? p.tiktok : `https://${p.tiktok}`) : 'https://tiktok.com/'
    socialIcons.push(`<td style="padding-right:0; vertical-align:middle;"><a href="${url}" target="_blank" style="display:block; text-decoration:none; line-height:0;"><img src="https://img.icons8.com/color/48/tiktok--v1.png" width="22" height="22" alt="TikTok" style="display:block; width:22px; height:22px; border:0;" /></a></td>`)
  }

  const contactTable = contactRows.length > 0
    ? `<table cellpadding="0" cellspacing="0" border="0" style="width:100%; font-family:'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;">${contactRows.join('<tr><td colspan="4" height="3"></td></tr>')}</table>`
    : ''

  const socialTable = socialIcons.length > 0
    ? `<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px; margin-bottom:12px;"><tr><td style="border-top:1px solid #e5e5e5; border-top:1px solid rgba(128,128,128,0.25); height:1px; line-height:1px; font-size:1px;">&nbsp;</td></tr></table><table cellpadding="0" cellspacing="0" border="0" style="margin:0; padding:0;"><tr>${socialIcons.join('')}</tr></table>`
    : ''

  return `<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><style>@import url('https://fonts.googleapis.com/css2?family=Poppins:wght@400;500;600;700&display=swap');body{background:transparent !important;}</style></head><body style="margin:0;padding:16px 20px;color:#111111;font-family:'Poppins',-apple-system,BlinkMacSystemFont,sans-serif;"><table cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:580px; font-family:'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin-top:20px;"><tr><td width="4" valign="top" style="width:4px; background:${accent}; border-radius:4px;"></td><td width="18" style="width:18px;"></td><td valign="top" style="padding:2px 0 4px 0;"><div style="font-family:'Poppins', -apple-system, BlinkMacSystemFont, sans-serif; font-size:21px; line-height:28px; font-weight:700; letter-spacing:-0.4px; color:#111111; margin:0; padding:0;">${p.fullName || 'Your Name'}</div><div style="font-family:'Poppins', -apple-system, BlinkMacSystemFont, sans-serif; font-size:13px; line-height:19px; font-weight:400; color:${accent}; margin-top:2px;">${p.tagline || 'Professional Tagline'}</div><div style="height:14px; line-height:14px;">&nbsp;</div>${contactTable}${socialTable}</td></tr></table></body></html>`
}

function SignatureEditor() {
  const store = useAppStore()
  const p = store.profile
  const s = store.signature
  const [editorTab, setEditorTab] = useState<'preset' | 'html'>(s.useCustomHtml ? 'html' : 'preset')
  const [previewMode, setPreviewMode] = useState<'desktop' | 'mobile'>('desktop')

  function insertTag(tag: string) {
    const current = s.customHtml || DEFAULT_SIGNATURE_HTML
    store.updateSignature({ customHtml: `${current}\n${tag}` })
    toast.info(`Appended ${tag} token.`)
  }

  function resetToDefault() {
    store.updateSignature({ customHtml: DEFAULT_SIGNATURE_HTML, accentColor: '#00c92b' })
    toast.success('Reset signature HTML to default.')
  }

  return <div className="grid gap-4 xl:grid-cols-[minmax(360px,.8fr)_1fr]">
    <section className="card space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2>HTML signature</h2>
          <p className="text-[11px] text-muted">Appended to outgoing email when enabled.</p>
        </div>
        <Switch checked={s.enabled} onChange={(enabled) => store.updateSignature({ enabled })} />
      </div>

      <div className="segmented">
        <button className={editorTab === 'preset' ? 'active' : ''} onClick={() => { setEditorTab('preset'); store.updateSignature({ useCustomHtml: false }) }}>Preset config</button>
        <button className={editorTab === 'html' ? 'active' : ''} onClick={() => { setEditorTab('html'); store.updateSignature({ useCustomHtml: true, customHtml: s.customHtml || DEFAULT_SIGNATURE_HTML }) }}>Custom HTML</button>
      </div>

      {editorTab === 'preset' ? <>
        <div className="field">
          <div className="flex items-center justify-between">
            <span>Professional tagline</span>
            <span className="text-[9px] text-muted">Press Enter to add tag</span>
          </div>
          <TagInput
            value={p.tagline ? p.tagline.split(/[|·•,]/).map((t) => t.trim()).filter(Boolean) : []}
            onChange={(tags) => store.updateProfile({ ...p, tagline: tags.join(' | ') })}
            placeholder="Type a title (e.g. IT Support) and press Enter"
          />
        </div>

        <label className="field">
          <span>Accent color</span>
          <div className="flex gap-2">
            <input type="color" value={s.accentColor || '#00c92b'} onChange={(e) => store.updateSignature({ accentColor: e.target.value })} className="h-9 w-12 rounded border border-line bg-transparent p-1 cursor-pointer" />
            <input className="input" value={s.accentColor || '#00c92b'} onChange={(e) => store.updateSignature({ accentColor: e.target.value })} />
          </div>
        </label>

        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-muted">Contact details</div>
          <div className="grid grid-cols-2 gap-2">
            {(['showPhone', 'showPortfolio', 'showEmail', 'showEducation'] as const).map((key) => (
              <label key={key} className="check-row">
                <input type="checkbox" checked={s[key]} onChange={(e) => store.updateSignature({ [key]: e.target.checked })} />
                {key.replace('show', '')}
              </label>
            ))}
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="text-[11px] font-semibold text-muted">Connect & social icons</div>
          <div className="grid grid-cols-2 gap-2">
            {(['showFacebook', 'showInstagram', 'showTiktok', 'showLinkedin', 'showGithub'] as const).map((key) => (
              <label key={key} className="check-row">
                <input type="checkbox" checked={s[key] !== false} onChange={(e) => store.updateSignature({ [key]: e.target.checked })} />
                {key.replace('show', '')}
              </label>
            ))}
          </div>
        </div>
      </> : <>
        <div className="flex items-center justify-between">
          <span className="text-[11px] font-semibold text-muted">Smart tag tokens (click to copy)</span>
          <button type="button" className="chat-inline-edit text-xs" onClick={resetToDefault}><RotateCcw size={11} /> Reset to default HTML</button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {['${profile.fullName}', '${profile.tagline}', '${signature.accentColor}', '${profile.phone}', '${profile.email}', '${profile.portfolio}', '${profile.education}', '${profile.facebook}', '${profile.instagram}', '${profile.tiktok}', '${profile.linkedin}', '${profile.github}'].map((token) => (
            <button key={token} type="button" className="tag cursor-pointer hover:border-emerald-400 hover:text-emerald-400" onClick={() => insertTag(token)} title="Click to append token">
              {token}
            </button>
          ))}
        </div>
        <label className="field">
          <span>Custom HTML code</span>
          <textarea
            className="input min-h-[300px] p-3 font-mono text-xs leading-5"
            value={s.customHtml || DEFAULT_SIGNATURE_HTML}
            onChange={(e) => store.updateSignature({ customHtml: e.target.value, useCustomHtml: true })}
            placeholder="Paste email-safe HTML here..."
          />
        </label>
      </>}
    </section>

    <section className="card flex flex-col">
      <div className="mb-4 flex items-center justify-between gap-3">
        <div>
          <h2>Live preview</h2>
          <p className="text-[11px] text-muted">Rendered in an isolated frame matching actual email clients.</p>
        </div>
        <div className="segmented">
          <button className={previewMode === 'desktop' ? 'active' : ''} onClick={() => setPreviewMode('desktop')} title="Desktop preview"><Monitor size={13} /> Desktop</button>
          <button className={previewMode === 'mobile' ? 'active' : ''} onClick={() => setPreviewMode('mobile')} title="Mobile preview"><Smartphone size={13} /> Mobile</button>
        </div>
      </div>
      <div className={`flex-1 min-h-[460px] rounded-xl border border-line bg-zinc-900/40 p-3 overflow-hidden flex items-center justify-center`}>
        <div className={`w-full transition-all duration-200 ${previewMode === 'mobile' ? 'max-w-[360px] rounded-2xl border-2 border-zinc-700 bg-white p-1 shadow-2xl' : 'max-w-full rounded-xl bg-white shadow-sm'}`}>
          <iframe title="Signature preview" sandbox="" srcDoc={renderSignatureHtml(p, s)} className="h-[460px] w-full border-0 rounded-lg" />
        </div>
      </div>
    </section>
  </div>
}

function EndpointsView({ filter }: { filter: string }) {
  const store = useAppStore(); const [editing, setEditing] = useState<AiEndpoint | null>(null); const [busy, setBusy] = useState<string | null>(null)
  const shown = store.endpoints.filter((endpoint) => `${endpoint.name} ${endpoint.provider} ${endpoint.defaultModel}`.toLowerCase().includes(filter.toLowerCase()))
  function newEndpoint() { setEditing({ id: crypto.randomUUID(), name: '', provider: 'openai', baseUrl: 'https://api.openai.com/v1', apiKey: '', defaultModel: '', models: [], active: false, status: 'untested' }) }
  async function runTest(endpoint: AiEndpoint) {
    if (!isTauri()) return toast.info('Live endpoint tests run from the desktop backend.')
    setBusy(endpoint.id)
    try {
      const message = await testEndpoint(endpoint)
      store.updateEndpoint(endpoint.id, { status: 'online', lastTestedAt: new Date().toISOString() })
      toast.success(message)
    } catch (error) {
      store.updateEndpoint(endpoint.id, { status: 'offline' })
      toast.error(errorMessage(error))
    } finally {
      setBusy(null)
    }
  }
  async function runDiscover() {
    if (!editing || !isTauri()) return toast.info('Model discovery runs from the desktop backend.')
    setBusy(editing.id)
    try {
      const models = await discoverModels(editing)
      setEditing({ ...editing, models, defaultModel: editing.defaultModel || models[0] || '' })
      toast.success(`Discovered ${models.length} models for ${editing.name || 'endpoint'}.`)
    } catch (error) {
      toast.error(errorMessage(error))
    } finally {
      setBusy(null)
    }
  }
  function saveEndpoint() {
    if (!editing?.name || !editing.baseUrl) return toast.error('Endpoint name and base URL are required.')
    const exists = store.endpoints.some((item) => item.id === editing.id)
    if (exists) {
      store.updateEndpoint(editing.id, editing)
      toast.success(`Updated endpoint "${editing.name}".`)
    } else {
      store.addEndpoint(editing)
      toast.success(`Added endpoint "${editing.name}".`)
    }
    setEditing(null)
  }
  return <div className="space-y-4">
    <PageIntro title="AI endpoints" description="Bring any supported provider. Keys stay on-device and requests go directly to the configured URL." action={<button className="primary-button" onClick={newEndpoint}><Plus size={14} /> Add endpoint</button>} />
    <div className="grid gap-3.5 md:grid-cols-2 xl:grid-cols-3">
      {shown.map((endpoint) => <article className={`bento-card ${endpoint.active ? 'ring-1 ring-emerald-400/50' : ''}`} key={endpoint.id}>
        <div>
          <div className="flex items-start justify-between">
            <div className="brand-icon uppercase text-xs font-black">{endpoint.name.slice(0, 2)}</div>
            <div className="flex gap-1">
              <StatusDot online={endpoint.status === 'online'} warning={endpoint.status === 'untested'} />
              <button className="icon-button" onClick={() => setEditing(endpoint)} title="Edit endpoint"><Pencil size={13} /></button>
              <button className="icon-button danger" onClick={() => { store.removeEndpoint(endpoint.id); toast.info(`Removed endpoint "${endpoint.name}".`) }} title="Delete endpoint"><Trash2 size={13} /></button>
            </div>
          </div>
          <h3 className="mt-4 text-sm font-bold">{endpoint.name}</h3>
          <p className="mt-1 text-[11px] capitalize text-muted">{endpoint.provider}</p>
          <div className="mt-4 space-y-2">
            <Inset label="Base URL" value={endpoint.baseUrl} mono />
            <Inset label="Default model" value={endpoint.defaultModel || 'Not selected'} mono />
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2 border-t border-line pt-3">
          <button className={endpoint.active ? 'status-button active' : 'status-button'} onClick={() => { store.setActiveEndpoint(endpoint.id); toast.success(`Active endpoint set to "${endpoint.name}".`) }}>{endpoint.active ? <><Check size={13} /> Active</> : 'Make active'}</button>
          <button className="secondary-button h-8 px-2.5" onClick={() => void runTest(endpoint)} disabled={busy === endpoint.id}>{busy === endpoint.id ? <LoaderCircle className="animate-spin" size={13} /> : <Activity size={13} />} Test</button>
        </div>
      </article>)}
      <button className="empty-card" onClick={newEndpoint}><Plus size={22} /><span>Add custom endpoint</span><small>OpenAI, Anthropic, Gemini, or Ollama</small></button>
    </div>
    {editing && <Modal title={store.endpoints.some((item) => item.id === editing.id) ? 'Edit endpoint' : 'New endpoint'} onClose={() => setEditing(null)} footer={<><button className="secondary-button" onClick={() => setEditing(null)}>Cancel</button><button className="primary-button" onClick={saveEndpoint}>Save endpoint</button></>}><div className="grid gap-3 sm:grid-cols-2"><label className="field"><span>Name</span><input className="input" value={editing.name} onChange={(e) => setEditing({ ...editing, name: e.target.value })} placeholder="OpenRouter" /></label><label className="field"><span>Provider protocol</span><select className="input" value={editing.provider} onChange={(e) => setEditing({ ...editing, provider: e.target.value as ProviderKind })}><option value="openai">OpenAI compatible</option><option value="anthropic">Anthropic Messages</option><option value="gemini">Google Gemini</option><option value="ollama">Local Ollama</option></select></label><label className="field sm:col-span-2"><span>Base URL</span><input className="input font-mono" value={editing.baseUrl} onChange={(e) => setEditing({ ...editing, baseUrl: e.target.value })} /></label><label className="field sm:col-span-2"><span>API key</span><input className="input font-mono" type="password" value={editing.apiKey} onChange={(e) => setEditing({ ...editing, apiKey: e.target.value })} placeholder={editing.provider === 'ollama' ? 'Optional' : 'Stored securely on this device'} /></label><label className="field"><span>Default model</span><input list="endpoint-models" className="input font-mono" value={editing.defaultModel} onChange={(e) => setEditing({ ...editing, defaultModel: e.target.value })} /><datalist id="endpoint-models">{editing.models.map((model) => <option key={model} value={model} />)}</datalist></label><div className="field"><span>Model catalog</span><button className="secondary-button h-9 justify-center" disabled={busy === editing.id} onClick={() => void runDiscover()}>{busy === editing.id ? <LoaderCircle className="animate-spin" size={14} /> : <RefreshCw size={14} />} Discover models</button></div></div></Modal>}
  </div>
}

function ProfileView() {
  const store = useAppStore(); const [profile, setProfile] = useState({ ...store.profile, smtp: store.profile.smtp.host ? store.profile.smtp : { ...store.profile.smtp, host: 'smtp.gmail.com', port: 587, useTls: true } }); const [saved, setSaved] = useState(false)
  function update<K extends keyof Profile>(key: K, value: Profile[K]) { setProfile({ ...profile, [key]: value }) }
  function submit(event: React.FormEvent) {
    event.preventDefault()
    store.updateProfile(profile)
    store.completeOnboarding()
    setSaved(true)
    toast.success('Profile settings saved successfully.')
    setTimeout(() => setSaved(false), 1800)
  }
  return <form className="space-y-4" onSubmit={submit}><PageIntro title="Profile settings" description="Your profile is the source of truth for every generated application and signature." action={<button className="primary-button" type="submit">{saved ? <Check size={14} /> : <Archive size={14} />}{saved ? 'Saved' : 'Save profile'}</button>} /><section className="card"><SectionTitle title="Applicant identity" description="Core details used in smart tags and application drafts." /><div className="form-grid"><Field label="Full name"><input className="input" value={profile.fullName} onChange={(e) => update('fullName', e.target.value)} /></Field><Field label="Preferred first name"><input className="input" value={profile.firstName} onChange={(e) => update('firstName', e.target.value)} /></Field><Field label="Email"><input type="email" className="input" value={profile.email} onChange={(e) => update('email', e.target.value)} /></Field><Field label="Phone"><input className="input" value={profile.phone} onChange={(e) => update('phone', e.target.value)} /></Field><Field label="Professional tagline" wide><TagInput value={profile.tagline ? profile.tagline.split(/[|·•,]/).map((t) => t.trim()).filter(Boolean) : []} onChange={(tags) => update('tagline', tags.join(' | '))} placeholder="Type a title (e.g. IT Support) and press Enter" /></Field><Field label="Location"><input className="input" value={profile.location} onChange={(e) => update('location', e.target.value)} /></Field></div></section><section className="card"><SectionTitle title="Experience & targeting" description="Type a complete role or skill, then press Enter to save it as a tag." /><div className="form-grid"><Field label="Preferred roles" wide><TagInput value={profile.preferredRoles} onChange={(preferredRoles) => update('preferredRoles', preferredRoles)} placeholder="Type a role and press Enter" /></Field><Field label="Skills inventory" wide><TagInput value={profile.skills} onChange={(skills) => update('skills', skills)} placeholder="Type a skill and press Enter" multiline /></Field><Field label="Education" wide><textarea className="input min-h-20 p-3" value={profile.education} onChange={(e) => update('education', e.target.value)} /></Field></div></section><section className="card"><SectionTitle title="Links & Socials" description="Optional URLs included when selected in templates or signatures." /><div className="form-grid"><Field label="Portfolio"><input className="input" value={profile.portfolio} onChange={(e) => update('portfolio', e.target.value)} placeholder="https://yrodev.site/" /></Field><Field label="LinkedIn"><input className="input" value={profile.linkedin} onChange={(e) => update('linkedin', e.target.value)} placeholder="https://linkedin.com/in/..." /></Field><Field label="GitHub"><input className="input" value={profile.github} onChange={(e) => update('github', e.target.value)} placeholder="https://github.com/..." /></Field><Field label="Facebook"><input className="input" value={profile.facebook || ''} onChange={(e) => update('facebook', e.target.value)} placeholder="https://facebook.com/..." /></Field><Field label="Instagram"><input className="input" value={profile.instagram || ''} onChange={(e) => update('instagram', e.target.value)} placeholder="https://instagram.com/..." /></Field><Field label="TikTok"><input className="input" value={profile.tiktok || ''} onChange={(e) => update('tiktok', e.target.value)} placeholder="https://tiktok.com/@..." /></Field></div></section><section className="card"><SectionTitle title="SMTP delivery" description="Used only when you explicitly click Send application." /><SmtpSetupHelp onPreset={(host, port) => setProfile({ ...profile, smtp: { ...profile.smtp, host, port, useTls: true } })} /><div className="form-grid"><Field label="SMTP host"><input className="input" value={profile.smtp.host} onChange={(e) => setProfile({ ...profile, smtp: { ...profile.smtp, host: e.target.value } })} placeholder="smtp.example.com" /></Field><Field label="Port"><input type="number" className="input" value={profile.smtp.port} onChange={(e) => setProfile({ ...profile, smtp: { ...profile.smtp, port: Number(e.target.value) } })} /></Field><Field label="Username"><input className="input" value={profile.smtp.username} onChange={(e) => setProfile({ ...profile, smtp: { ...profile.smtp, username: e.target.value } })} placeholder="Your full email address" /></Field><Field label="App password"><input type="password" className="input" value={profile.smtp.password} onChange={(e) => setProfile({ ...profile, smtp: { ...profile.smtp, password: e.target.value } })} placeholder="Provider-generated app password" /></Field><Field label="From email"><input type="email" className="input" value={profile.smtp.fromEmail} onChange={(e) => setProfile({ ...profile, smtp: { ...profile.smtp, fromEmail: e.target.value } })} placeholder="The same email as your username" /></Field><label className="check-row mb-2 self-end"><input type="checkbox" checked={profile.smtp.useTls} onChange={(e) => setProfile({ ...profile, smtp: { ...profile.smtp, useTls: e.target.checked } })} />Require TLS</label></div></section></form>
}

function TrackerView({ filter }: { filter: string }) {
  const store = useAppStore(); const shown = store.applications.filter((item) => `${item.company} ${item.position} ${item.email} ${item.status}`.toLowerCase().includes(filter.toLowerCase())); const statuses: ApplicationStatus[] = ['Draft','Sent','Interview','Offer','Rejected','Withdrawn']
  async function doExport() {
    if (!isTauri()) return toast.info('CSV export is available in the desktop build.')
    const destination = await save({ defaultPath: 'AgentJob_Applications.csv', filters: [{ name: 'CSV', extensions: ['csv'] }] })
    if (!destination) return
    try {
      const path = await exportTracker(store.applications, destination)
      toast.success(`Exported tracker to ${path}`)
    } catch (error) {
      toast.error(errorMessage(error))
    }
  }
  return <div className="space-y-4">
    <PageIntro title="Application tracker" description="Every sent application becomes a local record you can update or export." action={<button className="primary-button" onClick={() => void doExport()}><FileDown size={14} /> Export CSV</button>} />
    <section className="card overflow-hidden p-0">
      <div className="overflow-x-auto">
        <table>
          <thead>
            <tr><th>Company</th><th>Position</th><th>Recipient</th><th>Applied</th><th>Status</th><th className="text-right">Actions</th></tr>
          </thead>
          <tbody>
            {shown.map((item) => <tr key={item.id}>
              <td className="font-semibold">{item.company || 'Unknown company'}</td>
              <td>{item.position || 'Unknown position'}</td>
              <td className="font-mono text-[11px]">{item.email}</td>
              <td>{new Date(item.createdAt).toLocaleDateString()}</td>
              <td><select className={`status-select status-${item.status.toLowerCase()}`} value={item.status} onChange={(e) => store.updateApplication(item.id, { status: e.target.value as ApplicationStatus })}>{statuses.map((status) => <option key={status}>{status}</option>)}</select></td>
              <td className="text-right"><button className="icon-button danger" onClick={() => { store.removeApplication(item.id); toast.info(`Deleted record for ${item.company || 'application'}.`) }} title="Delete application record"><Trash2 size={13} /></button></td>
            </tr>)}
            {!shown.length && <tr><td colSpan={6}><div className="grid min-h-52 place-items-center text-center"><div><Inbox size={28} className="mx-auto mb-3 text-muted" /><div className="text-sm font-semibold">No applications yet</div><p className="mt-1 text-[11px] text-muted">Sent applications will appear here automatically.</p></div></div></td></tr>}
          </tbody>
        </table>
      </div>
    </section>
  </div>
}

const fontChoices: Array<{ id: FontFamily; name: string; sample: string; description: string }> = [
  { id: 'gotham', name: 'Gotham', sample: 'Go', description: 'Uses a licensed Gotham installation on this device' },
  { id: 'poppins', name: 'Poppins', sample: 'Po', description: 'Clean geometric rounded sans' },
  { id: 'montserrat', name: 'Montserrat', sample: 'Mo', description: 'Classic urban signage aesthetic' },
  { id: 'jakarta', name: 'Plus Jakarta Sans', sample: 'Jk', description: 'Refined contemporary geometric sans' },
]

function SettingsView() {
  const store = useAppStore()
  const [tab, setTab] = useState<'appearance' | 'accessibility' | 'updates'>('updates')
  const [checkingUpdate, setCheckingUpdate] = useState(false)
  const [updateInfo, setUpdateInfo] = useState<UpdateInfo | null>(null)
  const [updateError, setUpdateError] = useState<string | null>(null)
  const [downloadProgress, setDownloadProgress] = useState<{ downloaded: number; total: number | null } | null>(null)
  const [updateReady, setUpdateReady] = useState(false)

  const uiScales = [
    { value: 0.9, label: 'Compact', detail: '90%' },
    { value: 1, label: 'Default', detail: '100%' },
    { value: 1.1, label: 'Large', detail: '110%' },
    { value: 1.2, label: 'Extra large', detail: '120%' },
  ]
  const textScales = [
    { value: 0.9, label: 'Small', detail: '90%' },
    { value: 1, label: 'Default', detail: '100%' },
    { value: 1.125, label: 'Large', detail: '112%' },
    { value: 1.25, label: 'Extra large', detail: '125%' },
  ]

  async function handleCheckUpdate() {
    setCheckingUpdate(true)
    setUpdateError(null)
    setDownloadProgress(null)
    setUpdateReady(false)
    try {
      const info = await checkForAppUpdate()
      setUpdateInfo(info)
      if (info.available) {
        toast.info(`New version v${info.version} is available!`)
      } else {
        toast.success(`You are on the latest version (v${info.currentVersion})`)
      }
    } catch (error) {
      const msg = errorMessage(error)
      setUpdateError(msg)
      toast.error('Failed to check for updates from GitHub')
    } finally {
      setCheckingUpdate(false)
    }
  }

  async function handleInstallUpdate() {
    if (!updateInfo?.available) return
    setUpdateError(null)
    setDownloadProgress({ downloaded: 0, total: null })
    try {
      await downloadAndInstallUpdate((downloaded, total) => {
        setDownloadProgress({ downloaded, total })
      })
      setUpdateReady(true)
      toast.success('Update installed! Restarting application...')
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (error) {
      setUpdateError(errorMessage(error))
      toast.error('Failed to download update')
      setDownloadProgress(null)
    }
  }

  return (
    <div className="flex flex-1 flex-col space-y-4">
      <PageIntro
        title="Settings"
        description="Personalize AgentJob for your screen, reading comfort, and manage software updates."
        action={
          <div className="segmented">
            <button role="tab" aria-selected={tab === 'updates'} className={tab === 'updates' ? 'active' : ''} onClick={() => setTab('updates')}>
              Updates
            </button>
            <button role="tab" aria-selected={tab === 'appearance'} className={tab === 'appearance' ? 'active' : ''} onClick={() => setTab('appearance')}>
              Appearance
            </button>
            <button role="tab" aria-selected={tab === 'accessibility'} className={tab === 'accessibility' ? 'active' : ''} onClick={() => setTab('accessibility')}>
              Accessibility
            </button>
          </div>
        }
      />

      {tab === 'updates' && (
        <section className="card flex flex-1 min-h-[440px] flex-col items-center justify-center p-8 text-center sm:p-12">
          <div className="mx-auto flex max-w-md flex-col items-center">
            <div className="grid h-16 w-16 place-items-center rounded-2xl border border-emerald-500/20 bg-emerald-500/10 text-emerald-400 shadow-lg shadow-emerald-500/5">
              <RefreshCw size={28} className={checkingUpdate ? 'animate-spin' : ''} />
            </div>

            <h3 className="mt-5 text-lg font-bold tracking-tight">Software updates</h3>
            <p className="mt-1.5 text-xs text-muted leading-relaxed">
              Check for new releases, install updates automatically, or stay up to date with official GitHub releases.
            </p>

            <div className="mt-3.5 flex flex-wrap items-center justify-center gap-2">
              <span className="tag bg-emerald-500/10 text-emerald-400 border-emerald-500/20 font-mono font-bold">
                v0.1.0
              </span>
              <span className="tag bg-inset text-muted font-mono">
                Channel: GitHub Releases
              </span>
            </div>

            <div className="mt-6 flex flex-col items-center gap-3 w-full">
              <button
                className="primary-button h-10 px-6 text-xs font-bold cursor-pointer shadow-md"
                disabled={checkingUpdate || downloadProgress !== null}
                onClick={() => void handleCheckUpdate()}
              >
                <RefreshCw size={15} className={checkingUpdate ? 'animate-spin' : ''} />
                {checkingUpdate ? 'Checking GitHub…' : 'Check for updates'}
              </button>

              {updateInfo && !updateInfo.available && !checkingUpdate && (
                <div className="mt-3 flex items-center gap-2 rounded-full border border-emerald-500/30 bg-emerald-500/10 px-4 py-2 text-xs font-semibold text-emerald-400">
                  <ShieldCheck size={16} />
                  <span>You are on the latest version of AgentJob (v{updateInfo.currentVersion})</span>
                </div>
              )}
            </div>

            {updateInfo?.available && (
              <div className="mt-6 w-full text-left rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm font-bold text-emerald-400">
                    <Sparkles size={16} />
                    <span>AgentJob v{updateInfo.version} is available!</span>
                  </div>
                  {updateInfo.date && <span className="text-[10px] text-muted">{new Date(updateInfo.date).toLocaleDateString()}</span>}
                </div>
                {updateInfo.notes && (
                  <div className="max-h-40 overflow-y-auto rounded-lg border border-line bg-inset p-3 text-xs leading-relaxed text-muted whitespace-pre-wrap">
                    {updateInfo.notes}
                  </div>
                )}
                {downloadProgress !== null && (
                  <div className="space-y-1.5 pt-1">
                    <div className="flex justify-between text-[11px] font-semibold">
                      <span>Downloading update…</span>
                      <span>
                        {downloadProgress.total ? `${Math.round((downloadProgress.downloaded / downloadProgress.total) * 100)}%` : formatBytes(downloadProgress.downloaded)}
                      </span>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-inset">
                      <div
                        className="h-full bg-emerald-400 transition-all duration-200"
                        style={{
                          width: downloadProgress.total ? `${(downloadProgress.downloaded / downloadProgress.total) * 100}%` : '60%',
                        }}
                      />
                    </div>
                  </div>
                )}
                <div className="flex justify-end pt-1">
                  {updateReady ? (
                    <button className="primary-button" onClick={() => window.location.reload()}>
                      <Check size={14} /> Relaunch application
                    </button>
                  ) : (
                    <button
                      className="primary-button"
                      disabled={downloadProgress !== null}
                      onClick={() => void handleInstallUpdate()}
                    >
                      {downloadProgress !== null ? <LoaderCircle size={14} className="animate-spin" /> : <DownloadCloud size={14} />}
                      {downloadProgress !== null ? 'Downloading…' : 'Download & install update'}
                    </button>
                  )}
                </div>
              </div>
            )}

            {updateError && (
              <div className="mt-4 flex w-full items-start justify-between gap-3 text-left rounded-lg border border-rose-500/30 bg-rose-500/5 p-3 text-xs">
                <div className="flex items-start gap-2.5">
                  <AlertCircle size={16} className="text-rose-400 shrink-0 mt-0.5" />
                  <div>
                    <b className="text-rose-400">Update check notice</b>
                    <p className="mt-0.5 text-muted text-[11px]">{updateError}</p>
                  </div>
                </div>
                <button
                  className="icon-button"
                  onClick={() => void openBrowser('https://github.com/byronreyes/agentjob/releases')}
                  title="Open GitHub Releases in browser"
                >
                  <ExternalLink size={13} />
                </button>
              </div>
            )}
          </div>
        </section>
      )}

      {tab === 'appearance' && (
        <section className="card space-y-4">
          <SectionTitle title="Theme preset" description="Choose the contrast that feels best for your workspace." />
          <div className="grid gap-3.5 sm:grid-cols-2">
            <button className={`theme-choice-btn ${store.theme === 'light' ? 'active' : ''}`} onClick={() => store.setTheme('light')}>
              <Sun size={24} className="text-amber-400" />
              <b className="mt-2 text-sm">Light</b>
              <span className="text-xs text-muted">Bright surfaces & high readability</span>
            </button>
            <button className={`theme-choice-btn ${store.theme === 'dark' ? 'active' : ''}`} onClick={() => store.setTheme('dark')}>
              <Moon size={24} className="text-indigo-400" />
              <b className="mt-2 text-sm">Dark</b>
              <span className="text-xs text-muted">Reduced glare for low-light environments</span>
            </button>
          </div>
        </section>
      )}

      {tab === 'accessibility' && (
        <section className="card space-y-6">
          <div>
            <SectionTitle title="Font style" description="Poppins, Montserrat, and Plus Jakarta Sans are bundled for offline use. Gotham uses your licensed local installation." />
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {fontChoices.map((font) => (
                <button
                  data-preview-font={font.id}
                  className={`font-choice-card ${store.accessibility.fontFamily === font.id ? 'active' : ''}`}
                  key={font.id}
                  onClick={() => store.updateAccessibility({ fontFamily: font.id })}
                >
                  <span className="font-sample">{font.sample}</span>
                  <div className="font-choice-copy">
                    <b>{font.name}</b>
                    <small>{font.description}</small>
                  </div>
                  {store.accessibility.fontFamily === font.id && <Check size={16} className="text-emerald-400 shrink-0" />}
                </button>
              ))}
            </div>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <div>
              <SectionTitle title="Interface scale" description="Resize controls, spacing, and navigation together." />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {uiScales.map((option) => (
                  <button
                    className={`scale-choice-btn ${store.accessibility.uiScale === option.value ? 'active' : ''}`}
                    key={option.value}
                    onClick={() => store.updateAccessibility({ uiScale: option.value })}
                  >
                    <b>{option.label}</b>
                    <span>{option.detail}</span>
                  </button>
                ))}
              </div>
            </div>

            <div>
              <SectionTitle title="Text size" description="Adjust text independently for easier reading." />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {textScales.map((option) => (
                  <button
                    className={`scale-choice-btn ${store.accessibility.textScale === option.value ? 'active' : ''}`}
                    key={option.value}
                    onClick={() => store.updateAccessibility({ textScale: option.value })}
                  >
                    <b>{option.label}</b>
                    <span>{option.detail}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="type-preview">
            <span>Live typography preview</span>
            <h3>Find the right role without straining your eyes.</h3>
            <p>Review job descriptions, prepare tailored applications, and manage your progress with text that feels comfortable to read.</p>
          </div>

          <div className="flex justify-end pt-2 border-t border-line">
            <button className="settings-reset cursor-pointer text-xs" onClick={() => store.updateAccessibility({ fontFamily: 'poppins', uiScale: 1, textScale: 1 })}>
              Reset accessibility settings to default
            </button>
          </div>
        </section>
      )}
    </div>
  )
}


function OnboardingModal() {
  const store = useAppStore(); const [step, setStep] = useState(0); const [profile, setProfile] = useState<Profile>({ ...emptyProfile, ...store.profile }); const steps = ['Identity', 'Target roles', 'Links']
  function finish() { store.updateProfile(profile); store.completeOnboarding() }
  return <div className="modal-backdrop"><div className="onboarding-modal"><div className="border-b border-line px-6 py-5"><div className="mb-5 flex items-center gap-3"><div className="brand-icon text-emerald-400"><BriefcaseBusiness size={20} /></div><div><h2 className="text-base font-bold">Set up AgentJob</h2><p className="text-[11px] text-muted">A private workspace built around your profile.</p></div></div><div className="flex gap-2">{steps.map((label, index) => <div key={label} className="flex-1"><div className={`h-1 rounded-full ${index <= step ? 'bg-emerald-500' : 'bg-inset'}`} /><div className="mt-1.5 text-[9px] font-bold uppercase tracking-wider text-muted">{label}</div></div>)}</div></div><div className="min-h-[310px] p-6">{step === 0 && <div className="space-y-4"><SectionTitle title="Start with the essentials" description="Nothing from the legacy bot is prefilled." /><Field label="Full name"><input autoFocus className="input" value={profile.fullName} onChange={(e) => setProfile({ ...profile, fullName: e.target.value, firstName: profile.firstName || e.target.value.split(' ')[0] })} /></Field><div className="grid grid-cols-2 gap-3"><Field label="First name"><input className="input" value={profile.firstName} onChange={(e) => setProfile({ ...profile, firstName: e.target.value })} /></Field><Field label="Email"><input className="input" type="email" value={profile.email} onChange={(e) => setProfile({ ...profile, email: e.target.value })} /></Field></div><Field label="Professional tagline" wide><TagInput value={profile.tagline ? profile.tagline.split(/[|·•,]/).map((t) => t.trim()).filter(Boolean) : []} onChange={(tags) => setProfile({ ...profile, tagline: tags.join(' | ') })} placeholder="Type a title (e.g. IT Support) and press Enter" /></Field></div>}{step === 1 && <div className="space-y-4"><SectionTitle title="What are you targeting?" description="Type a complete role or skill, then press Enter to create a tag." /><Field label="Preferred roles"><TagInput autoFocus value={profile.preferredRoles} onChange={(preferredRoles) => setProfile({ ...profile, preferredRoles })} placeholder="e.g. Frontend Developer" /></Field><Field label="Skills inventory"><TagInput value={profile.skills} onChange={(skills) => setProfile({ ...profile, skills })} placeholder="e.g. React" multiline /></Field><Field label="Education"><input className="input" value={profile.education} onChange={(e) => setProfile({ ...profile, education: e.target.value })} /></Field></div>}{step === 2 && <div className="space-y-4"><SectionTitle title="Add your proof of work" description="All links are optional and remain editable." /><Field label="Portfolio"><input autoFocus className="input" value={profile.portfolio} onChange={(e) => setProfile({ ...profile, portfolio: e.target.value })} placeholder="https://your-portfolio.com" /></Field><Field label="GitHub"><input className="input" value={profile.github} onChange={(e) => setProfile({ ...profile, github: e.target.value })} placeholder="https://github.com/you" /></Field><Field label="LinkedIn"><input className="input" value={profile.linkedin} onChange={(e) => setProfile({ ...profile, linkedin: e.target.value })} placeholder="https://linkedin.com/in/you" /></Field></div>}</div><div className="flex items-center justify-between border-t border-line px-6 py-4"><button className="secondary-button" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>{step < 2 ? <button className="primary-button" disabled={step === 0 && !profile.fullName.trim()} onClick={() => setStep(step + 1)}>Continue</button> : <button className="primary-button" onClick={finish}><Check size={14} /> Enter workspace</button>}</div></div></div>
}

function PageIntro({ title, description, action }: { title: string; description: string; action?: ReactNode }) { return <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-base font-bold tracking-tight">{title}</h2><p className="mt-1 text-[11px] text-muted">{description}</p></div>{action}</div> }
function SectionTitle({ title, description }: { title: string; description: string }) { return <div className="mb-4"><h3 className="text-sm font-bold">{title}</h3><p className="mt-1 text-[11px] text-muted">{description}</p></div> }
type SmtpGuide = { name: string; host: string; port: number; description: string; url: string; action: string }
const smtpGuides: SmtpGuide[] = [
  { name: 'Gmail', host: 'smtp.gmail.com', port: 587, description: 'Turn on 2-Step Verification, then create a 16-digit app password.', url: 'https://support.google.com/mail/answer/185833?hl=en', action: 'Open Gmail guide' },
]

async function openExternalHelp(url: string) {
  try {
    await openBrowser(url)
  } catch (error) {
    console.error('Failed to open URL', error)
    window.open(url, '_blank', 'noopener,noreferrer')
  }
}

function SmtpSetupHelp({ onPreset }: { onPreset: (host: string, port: number) => void }) {
  return <div className="smtp-help"><div className="smtp-help-intro"><div><h4>Set up Gmail delivery</h4><p>Use your full Gmail address for Username and From email. Use a Google-generated app password—not your normal account password.</p></div><ExternalLink size={15} /></div><div className="smtp-guide-grid">{smtpGuides.map((guide) => <article className="smtp-guide-card" key={guide.name}><div><div className="smtp-guide-name">{guide.name}</div><p>{guide.description}</p></div><div className="smtp-guide-actions"><button type="button" onClick={() => { onPreset(guide.host, guide.port); toast.success(`Applied ${guide.name} settings (${guide.host}:${guide.port})`) }}>Use Gmail settings</button><button type="button" className="smtp-guide-link" onClick={() => void openExternalHelp(guide.url)}>{guide.action}<ExternalLink size={11} /></button></div></article>)}</div><div className="smtp-field-guide"><span><b>SMTP host</b> smtp.gmail.com</span><span><b>Port</b> 587 with STARTTLS</span><span><b>App password</b> comes from your Google Account</span></div></div>
}
function Field({ label, children, wide }: { label: string; children: ReactNode; wide?: boolean }) { return <label className={`field ${wide ? 'sm:col-span-2' : ''}`}><span>{label}</span>{children}</label> }
function TagInput({ value, onChange, placeholder, autoFocus, multiline }: { value: string[]; onChange: (value: string[]) => void; placeholder?: string; autoFocus?: boolean; multiline?: boolean }) {
  const [draft, setDraft] = useState('')
  const commit = () => {
    const tag = draft.trim()
    if (!tag) return
    if (!value.some((item) => item.toLocaleLowerCase() === tag.toLocaleLowerCase())) onChange([...value, tag])
    setDraft('')
  }
  const remove = (index: number) => onChange(value.filter((_, itemIndex) => itemIndex !== index))
  return <div className={`tag-input ${multiline ? 'min-h-28 items-start content-start' : ''}`} onClick={(event) => (event.currentTarget.querySelector('input') as HTMLInputElement | null)?.focus()}>{value.map((tag, index) => <span className="tag-chip" key={`${tag}-${index}`}>{tag}<button type="button" aria-label={`Remove ${tag}`} onClick={(event) => { event.stopPropagation(); remove(index) }}><X size={11} /></button></span>)}<input autoFocus={autoFocus} value={draft} onChange={(event) => setDraft(event.target.value)} onBlur={commit} onKeyDown={(event) => { if (event.key === 'Enter') { event.preventDefault(); commit() } else if (event.key === 'Backspace' && !draft && value.length) remove(value.length - 1) }} placeholder={value.length ? 'Add another…' : placeholder} /></div>
}
function EditableFact({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) { return <label className="rounded-lg border border-line bg-inset px-2.5 py-2"><span className="eyebrow">{label}</span><input className="mt-1 w-full bg-transparent text-xs font-semibold outline-none" value={value} onChange={(e) => onChange(e.target.value)} placeholder="Not found — add manually" /></label> }
function Inset({ label, value, mono }: { label: string; value: string; mono?: boolean }) { return <div className="min-w-0 rounded-lg border border-line bg-inset px-2.5 py-2"><div className="eyebrow">{label}</div><div className={`mt-1 truncate text-[11px] font-semibold ${mono ? 'font-mono' : ''}`}>{value}</div></div> }
function StatusDot({ online, warning }: { online?: boolean; warning?: boolean }) { const color = online ? 'bg-emerald-500' : warning ? 'bg-amber-500' : 'bg-rose-500'; return <span className="relative flex h-2.5 w-2.5 shrink-0"><span className={`absolute inline-flex h-full w-full animate-ping rounded-full ${color} opacity-40`} /><span className={`relative inline-flex h-2.5 w-2.5 rounded-full ${color}`} /></span> }
function Switch({ checked, onChange }: { checked: boolean; onChange: (checked: boolean) => void }) { return <button type="button" role="switch" aria-checked={checked} onClick={() => onChange(!checked)} className={`switch ${checked ? 'active' : ''}`}><span /></button> }
function Modal({ title, onClose, children, footer }: { title: string; onClose: () => void; children: ReactNode; footer: ReactNode }) { return <div className="modal-backdrop" onMouseDown={(e) => { if (e.currentTarget === e.target) onClose() }}><div className="modal"><div className="flex items-center justify-between border-b border-line px-5 py-4"><h2 className="text-sm font-bold">{title}</h2><button className="icon-button" onClick={onClose}><X size={15} /></button></div><div className="max-h-[70vh] overflow-y-auto p-5">{children}</div><div className="flex justify-end gap-2 border-t border-line px-5 py-4">{footer}</div></div></div> }
function LoadingScreen() { return <div className="grid h-screen place-items-center bg-app"><div className="text-center"><LoaderCircle className="mx-auto animate-spin text-emerald-400" /><p className="mt-3 text-xs text-muted">Loading your private workspace…</p></div></div> }
function formatBytes(value: number) { if (!value) return '0 KB'; return value > 1024 * 1024 ? `${(value / 1024 / 1024).toFixed(1)} MB` : `${Math.round(value / 1024)} KB` }
function errorMessage(error: unknown) { return error instanceof Error ? error.message : String(error) }

export default App
