import { invoke } from '@tauri-apps/api/core'
import type { AiEndpoint, AppState, JobReview, Profile, Resume } from '../types'

export const isTauri = () => typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

export async function loadAppState(): Promise<AppState | null> {
  if (isTauri()) return invoke<AppState>('load_state')
  const stored = localStorage.getItem('agentjob-preview-state')
  return stored ? JSON.parse(stored) : null
}

export async function saveAppState(state: AppState): Promise<void> {
  if (isTauri()) {
    await invoke('save_state', { state })
    return
  }
  const safeState = structuredClone(state)
  safeState.endpoints.forEach((endpoint) => { endpoint.apiKey = '' })
  safeState.profile.smtp.password = ''
  localStorage.setItem('agentjob-preview-state', JSON.stringify(safeState))
}

export async function importResume(path: string, label: string): Promise<Resume> {
  return invoke<Resume>('import_resume', { sourcePath: path, label })
}

export async function testEndpoint(endpoint: AiEndpoint): Promise<string> {
  return invoke<string>('test_endpoint', { endpoint })
}

export async function discoverModels(endpoint: AiEndpoint): Promise<string[]> {
  return invoke<string[]>('discover_models', { endpoint })
}

export async function reviewJob(description: string, endpoint?: AiEndpoint): Promise<JobReview> {
  if (!isTauri()) return localReview(description)
  return invoke<JobReview>('review_job', { description, endpoint: endpoint ?? null })
}

export async function generateLetter(input: {
  description: string
  review: JobReview
  profile: Profile
  template: string
  adaptive: boolean
  endpoint?: AiEndpoint
}): Promise<string> {
  if (!isTauri()) return fillTemplate(input.template, input.profile, input.review)
  return invoke<string>('generate_letter', { ...input, endpoint: input.endpoint ?? null })
}

export async function sendEmail(payload: Record<string, unknown>): Promise<string> {
  return invoke<string>('send_application_email', { payload })
}

export async function exportTracker(applications: AppState['applications'], destination: string): Promise<string> {
  return invoke<string>('export_tracker_csv', { applications, destination })
}

export async function ocrImage(imageBase64: string): Promise<string> {
  if (!isTauri()) {
    throw new Error('Native OCR is available in the desktop runtime.')
  }
  return invoke<string>('ocr_image', { imageBase64 })
}

export function isJobPosting(text: string): boolean {
  const trimmed = text.trim()
  if (!trimmed) return false
  if (/^[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}$/i.test(trimmed)) return true
  const jobKeywords = /(hiring|job|position|qualifications|requirements|responsibilities|experience|duties|apply|resume|salary|benefits|shift|full-time|part-time|remote|hybrid|we are|looking for|candidate|support|engineer|developer|technician|specialist|analyst|desk|manager|coordinator|clerk|representative)/i
  const hasJobKeywords = jobKeywords.test(trimmed)
  const lines = trimmed.split(/\r?\n/).map((l) => l.trim()).filter(Boolean)
  const hasBullets = lines.some((l) => /^[•\-\*–—\d+.]\s*/.test(l))
  const hasEmail = /[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/.test(trimmed)

  if (hasEmail && (hasJobKeywords || hasBullets)) return true
  if (trimmed.length > 50 && (hasJobKeywords || hasBullets)) return true
  if (hasBullets && hasJobKeywords) return true
  if (trimmed.length > 120 && hasJobKeywords) return true
  return false
}

export function fillTemplate(template: string, profile: Profile, review: JobReview) {
  const firstName = profile.firstName || profile.fullName.split(/\s+/)[0] || ''
  const skills = (review.mustHaveSkills.length ? review.mustHaveSkills : profile.skills).slice(0, 6)
  const topSkills = skills.slice(0, 3)
  const skill1 = topSkills[0] || profile.skills[0] || 'Technical troubleshooting & problem-solving'
  const skill2 = topSkills[1] || profile.skills[1] || 'Systems configuration & network support'
  const skill3 = topSkills[2] || profile.skills[2] || 'Process optimization & user assistance'

  const customReason = review.mustHaveSkills.length
    ? `The role's focus on ${review.mustHaveSkills.slice(0, 2).join(' and ')} is especially compelling and aligns with my hands-on background.`
    : `I am drawn to this opportunity because of the meaningful impact and practical challenges of the role.`

  const portfolio = profile.portfolio || 'Available upon request'

  const values: Record<string, string> = {
    applicant_name: profile.fullName,
    applicant_firstname: firstName,
    full_name: profile.fullName,
    fullName: profile.fullName,
    name: profile.fullName,
    'profile.name': profile.fullName,
    'profile.fullName': profile.fullName,
    first_name: firstName,
    firstName: firstName,
    'profile.firstName': firstName,
    'profile.firstname': firstName,
    "profile.name.split(' ')[0]": firstName,
    "profile.fullName.split(' ')[0]": firstName,
    company: review.company || 'the company',
    position: review.position || 'the open position',
    location: review.location || '',
    portfolio,
    'profile.portfolio': portfolio,
    email: profile.email,
    'profile.email': profile.email,
    phone: profile.phone,
    'profile.phone': profile.phone,
    tagline: profile.tagline,
    'profile.tagline': profile.tagline,
    top_skills: topSkills.join(', ') || 'technical support, configuration, and troubleshooting',
    skills: topSkills.join(', ') || 'technical support, configuration, and troubleshooting',
    skill_1: skill1,
    skill_2: skill2,
    skill_3: skill3,
    education: profile.education || '',
    'profile.education': profile.education || '',
    custom_reason: customReason,
  }

  const replacedCurly = template.replace(/\{\{([^}]+)}}/g, (_, key: string) => values[key.trim()] ?? '')
  return replacedCurly.replace(/\$\{([^}]+)}/g, (_, key: string) => values[key.trim()] ?? '')
}

function cleanText(raw: string): string {
  return raw
    .replace(/^[-:•*–—\s]+/, '')
    .replace(/[?]+$/, '')
    .trim()
}

function localReview(description: string): JobReview {
  const emails = description.match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/g) ?? []
  const lines = description.split(/\r?\n/).map((line) => line.trim()).filter(Boolean)
  const roleKeywords = /developer|engineer|support|network|system|analyst|designer|manager|administrator|specialist|assistant|technician|intern|associate|officer|lead|consultant|programmer|architect|coordinator|operator|representative|supervisor|director|executive|clerk|helpdesk|desk/i

  let position = ''
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const prefixMatch = line.match(/^(position|role|job title|title|we are|now hiring|hiring|urgently hiring|looking for)\s*[:-]?\s*(.*)/i)
    if (prefixMatch) {
      const rest = prefixMatch[2].trim()
      if (rest.length > 0) {
        position = cleanText(rest)
        break
      } else if (i + 1 < lines.length) {
        position = cleanText(lines[i + 1])
        break
      }
    }
  }

  if (!position) {
    const matchedLine = lines.find((line) =>
      roleKeywords.test(line)
      && !/qualifications|requirements|degree|graduate|experience in|knowledgeable in|responsible for|looking to/i.test(line)
    )
    if (matchedLine) {
      position = cleanText(matchedLine)
    }
  }

  let company = ''
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]
    const match = line.match(/^(company|about us|employer|organization)\s*[:-]\s*(.*)/i)
    if (match) {
      company = cleanText(match[2])
      break
    }
  }

  if (!company && lines.length > 0) {
    const firstLine = lines[0]
    if (!roleKeywords.test(firstLine) && !firstLine.toLowerCase().includes('qualification') && firstLine.length < 60) {
      let candidate = cleanText(firstLine)
      if (lines.length > 1 && /services|group|company|corp|inc|ltd|agency|hr|human resource|enterprises|solutions|technologies|systems/i.test(lines[1])) {
        candidate = `${candidate} ${lines[1].trim()}`.trim()
      }
      company = candidate
    }
  }

  const locationLine = lines.find((line) =>
    /remote|hybrid|on-site|location|building|brgy|street|st\.|ave|city|province|laguna|manila|state|country/i.test(line)
    && !/send your resume|apply now|bring your|email/i.test(line)
  )
  const location = locationLine ? cleanText(locationLine.replace(/^(location|address|site)\s*[:-]?\s*/i, '')) : ''

  const knownSkills = [
    'Network support', 'Networking', 'Technical support', 'Customer support',
    'Basic configuration', 'Internet functionality', 'Troubleshooting',
    'React', 'TypeScript', 'JavaScript', 'Python', 'Rust', 'SQL', 'AWS',
    'Azure', 'Docker', 'Linux', 'Windows Server', 'Figma', 'Active Directory'
  ]
  const lower = description.toLowerCase()
  const mustHaveSkills = knownSkills
    .filter((skill) => lower.includes(skill.toLowerCase()))
    .slice(0, 6)

  return {
    company: company || 'Company',
    position: position || 'Technical Support',
    location,
    emails: [...new Set(emails)],
    mustHaveSkills,
    jobTone: 'professional',
    confidence: 0.85,
  }
}

export async function openBrowser(url: string): Promise<void> {
  if (isTauri()) {
    try {
      await invoke('open_browser', { url })
      return
    } catch {
      // fallback
    }
  }
  window.open(url, '_blank', 'noopener,noreferrer')
}
