import { create } from 'zustand'
import type { AccessibilitySettings, AiEndpoint, AppState, Application, CoverTemplate, FontFamily, Profile, Resume, SignatureConfig } from './types'
import { builtInTemplates, initialState } from './types'
import { loadAppState, saveAppState } from './lib/bridge'

interface AgentJobStore extends AppState {
  hydrated: boolean
  hydrate: () => Promise<void>
  setTheme: (theme: AppState['theme']) => void
  updateAccessibility: (patch: Partial<AccessibilitySettings>) => void
  updateProfile: (profile: Profile) => void
  completeOnboarding: () => void
  addResume: (resume: Resume) => void
  removeResume: (id: string) => void
  setActiveResume: (id: string) => void
  addEndpoint: (endpoint: AiEndpoint) => void
  updateEndpoint: (id: string, patch: Partial<AiEndpoint>) => void
  removeEndpoint: (id: string) => void
  setActiveEndpoint: (id: string) => void
  addTemplate: (template: CoverTemplate) => void
  updateTemplate: (id: string, patch: Partial<CoverTemplate>) => void
  removeTemplate: (id: string) => void
  selectTemplate: (id: string) => void
  updateSignature: (patch: Partial<SignatureConfig>) => void
  addApplication: (application: Application) => void
  updateApplication: (id: string, patch: Partial<Application>) => void
  removeApplication: (id: string) => void
}

let saveTimer: ReturnType<typeof setTimeout> | undefined
const availableFonts: FontFamily[] = ['gotham', 'poppins', 'montserrat', 'jakarta']
const normalizeFont = (font?: string): FontFamily => availableFonts.includes(font as FontFamily) ? font as FontFamily : 'poppins'

export const useAppStore = create<AgentJobStore>((set, get) => {
  const persist = () => {
    clearTimeout(saveTimer)
    saveTimer = setTimeout(() => {
      const { hydrated: _hydrated, hydrate: _hydrate, ...state } = get()
      const serializable = Object.fromEntries(Object.entries(state).filter(([, value]) => typeof value !== 'function')) as unknown as AppState
      void saveAppState(serializable)
    }, 250)
  }
  const mutate = (patch: Partial<AgentJobStore> | ((state: AgentJobStore) => Partial<AgentJobStore>)) => {
    set(patch as never)
    persist()
  }
  return {
    ...initialState,
    hydrated: false,
    hydrate: async () => {
      try {
        const stored = await loadAppState()
        if (stored) {
          const templates = stored.templates && stored.templates.length > 0
            ? stored.templates.map((t) => {
                if (t.builtIn) {
                  const currentBuiltIn = builtInTemplates.find((b) => b.id === t.id)
                  return currentBuiltIn ? { ...currentBuiltIn, ...t, body: currentBuiltIn.body } : t
                }
                return t
              })
            : initialState.templates
          set({
            ...initialState,
            ...stored,
            templates,
            accessibility: { ...initialState.accessibility, ...stored.accessibility, fontFamily: normalizeFont(stored.accessibility?.fontFamily) },
            hydrated: true,
          })
        } else {
          set({ hydrated: true })
        }
      } catch (error) {
        console.error('Unable to load AgentJob state', error)
        set({ hydrated: true })
      }
    },
    setTheme: (theme) => mutate({ theme }),
    updateAccessibility: (patch) => mutate((state) => ({ accessibility: { ...state.accessibility, ...patch } })),
    updateProfile: (profile) => mutate({ profile }),
    completeOnboarding: () => mutate({ onboardingComplete: true }),
    addResume: (resume) => mutate((state) => ({ resumes: [...state.resumes.map((item) => ({ ...item, active: false })), { ...resume, active: true }] })),
    removeResume: (id) => mutate((state) => ({ resumes: state.resumes.filter((item) => item.id !== id) })),
    setActiveResume: (id) => mutate((state) => ({ resumes: state.resumes.map((item) => ({ ...item, active: item.id === id })) })),
    addEndpoint: (endpoint) => mutate((state) => ({ endpoints: [...state.endpoints.map((item) => ({ ...item, active: false })), { ...endpoint, active: true }] })),
    updateEndpoint: (id, patch) => mutate((state) => ({ endpoints: state.endpoints.map((item) => item.id === id ? { ...item, ...patch } : item) })),
    removeEndpoint: (id) => mutate((state) => ({ endpoints: state.endpoints.filter((item) => item.id !== id) })),
    setActiveEndpoint: (id) => mutate((state) => ({ endpoints: state.endpoints.map((item) => ({ ...item, active: item.id === id })) })),
    addTemplate: (template) => mutate((state) => ({ templates: [...state.templates, template], selectedTemplateId: template.id })),
    updateTemplate: (id, patch) => mutate((state) => ({ templates: state.templates.map((item) => item.id === id ? { ...item, ...patch } : item) })),
    removeTemplate: (id) => mutate((state) => {
      const filtered = state.templates.filter((item) => item.id !== id)
      const nextTemplates = filtered.length > 0 ? filtered : initialState.templates
      const nextSelected = state.selectedTemplateId === id ? nextTemplates[0]?.id ?? 'technical-problem-solver' : state.selectedTemplateId
      return { templates: nextTemplates, selectedTemplateId: nextSelected }
    }),
    selectTemplate: (id) => mutate({ selectedTemplateId: id }),
    updateSignature: (patch) => mutate((state) => ({ signature: { ...state.signature, ...patch } })),
    addApplication: (application) => mutate((state) => ({ applications: [application, ...state.applications] })),
    updateApplication: (id, patch) => mutate((state) => ({ applications: state.applications.map((item) => item.id === id ? { ...item, ...patch, updatedAt: new Date().toISOString() } : item) })),
    removeApplication: (id) => mutate((state) => ({ applications: state.applications.filter((item) => item.id !== id) })),
  }
})
