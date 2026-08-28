export type ViewId = 'workspace' | 'resumes' | 'templates' | 'endpoints' | 'profile' | 'tracker' | 'settings'

export type FontFamily = 'gotham' | 'poppins' | 'montserrat' | 'jakarta'

export interface AccessibilitySettings {
  fontFamily: FontFamily
  uiScale: number
  textScale: number
}

export type ProviderKind = 'openai' | 'anthropic' | 'gemini' | 'ollama'

export interface Profile {
  fullName: string
  firstName: string
  email: string
  phone: string
  tagline: string
  preferredRoles: string[]
  education: string
  skills: string[]
  portfolio: string
  github: string
  linkedin: string
  facebook?: string
  instagram?: string
  tiktok?: string
  location: string
  smtp: {
    host: string
    port: number
    username: string
    password: string
    fromEmail: string
    useTls: boolean
  }
}

export interface Resume {
  id: string
  label: string
  fileName: string
  path: string
  size: number
  createdAt: string
  tags: string[]
  active: boolean
}

export interface AiEndpoint {
  id: string
  name: string
  provider: ProviderKind
  baseUrl: string
  apiKey: string
  defaultModel: string
  models: string[]
  active: boolean
  lastTestedAt?: string
  status?: 'untested' | 'online' | 'offline'
}

export interface CoverTemplate {
  id: string
  name: string
  description: string
  body: string
  builtIn: boolean
  adaptive: boolean
}

export interface SignatureConfig {
  enabled: boolean
  accentColor: string
  customHtml: string
  useCustomHtml: boolean
  showPhone: boolean
  showPortfolio: boolean
  showEmail: boolean
  showEducation: boolean
  showGithub: boolean
  showLinkedin: boolean
  showFacebook?: boolean
  showInstagram?: boolean
  showTiktok?: boolean
}

export const DEFAULT_SIGNATURE_HTML = `<table cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:580px; font-family:'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin-top:20px;">
    <tr>
        <!-- ACCENT BAR -->
        <td width="4" valign="top" style="width:4px; background:\${signature.accentColor}; border-radius:4px;"></td>

        <!-- SPACING -->
        <td width="18" style="width:18px;"></td>

        <!-- MAIN CONTENT -->
        <td valign="top" style="padding:2px 0 4px 0;">
            <!-- NAME -->
            <div style="font-family:'Poppins', -apple-system, BlinkMacSystemFont, sans-serif; font-size:21px; line-height:28px; font-weight:700; letter-spacing:-0.4px; color:#111111; margin:0; padding:0;">
                \${profile.fullName}
            </div>

            <!-- JOB TITLE / TAGLINE -->
            <div style="font-family:'Poppins', -apple-system, BlinkMacSystemFont, sans-serif; font-size:13px; line-height:19px; font-weight:400; color:\${signature.accentColor}; margin-top:2px;">
                \${profile.tagline}
            </div>

            <!-- TOP SPACER -->
            <div style="height:14px; line-height:14px;">&nbsp;</div>

            <!-- CONTACT DETAILS -->
            <table cellpadding="0" cellspacing="0" border="0" style="width:100%; font-family:'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;">
                <!-- EMAIL -->
                <tr>
                    <td width="26" valign="middle" style="width:26px; padding:4px 0;">
                        <img src="https://img.icons8.com/ios/50/00c92b/new-post--v1.png" width="18" height="18" alt="Email" style="width:18px; height:18px; display:block; border:0;" />
                    </td>
                    <td width="90" valign="middle" style="width:90px; padding:4px 8px; font-size:11px; line-height:18px; font-weight:700; letter-spacing:0.5px; color:#777777;">
                        EMAIL
                    </td>
                    <td width="1" style="width:1px; background:#e2e2e2; background:rgba(128,128,128,0.25);"></td>
                    <td valign="middle" style="padding:4px 0 4px 14px; font-size:13px; line-height:19px; font-weight:500;">
                        <a href="mailto:\${profile.email}" style="color:#111111; text-decoration:none; word-break:break-word;">\${profile.email}</a>
                    </td>
                </tr>

                <tr><td colspan="4" height="3"></td></tr>

                <!-- PHONE -->
                <tr>
                    <td width="26" valign="middle" style="width:26px; padding:4px 0;">
                        <img src="https://img.icons8.com/ios/50/00c92b/phone.png" width="18" height="18" alt="Phone" style="width:18px; height:18px; display:block; border:0;" />
                    </td>
                    <td width="90" valign="middle" style="width:90px; padding:4px 8px; font-size:11px; line-height:18px; font-weight:700; letter-spacing:0.5px; color:#777777;">
                        PHONE
                    </td>
                    <td width="1" style="width:1px; background:#e2e2e2; background:rgba(128,128,128,0.25);"></td>
                    <td valign="middle" style="padding:4px 0 4px 14px; font-size:13px; line-height:19px; font-weight:500;">
                        <a href="tel:\${profile.phone}" style="color:#111111; text-decoration:none; word-break:break-word;">\${profile.phone}</a>
                    </td>
                </tr>

                <tr><td colspan="4" height="3"></td></tr>

                <!-- PORTFOLIO -->
                <tr>
                    <td width="26" valign="middle" style="width:26px; padding:4px 0;">
                        <img src="https://img.icons8.com/ios/50/00c92b/domain.png" width="18" height="18" alt="Portfolio" style="width:18px; height:18px; display:block; border:0;" />
                    </td>
                    <td width="90" valign="middle" style="width:90px; padding:4px 8px; font-size:11px; line-height:18px; font-weight:700; letter-spacing:0.5px; color:#777777;">
                        PORTFOLIO
                    </td>
                    <td width="1" style="width:1px; background:#e2e2e2; background:rgba(128,128,128,0.25);"></td>
                    <td valign="middle" style="padding:4px 0 4px 14px; font-size:13px; line-height:19px; font-weight:500;">
                        <a href="\${profile.portfolio}" target="_blank" style="color:#111111; text-decoration:none; word-break:break-word;">\${profile.portfolio}</a>
                    </td>
                </tr>

                <tr><td colspan="4" height="3"></td></tr>

                <!-- EDUCATION -->
                <tr>
                    <td width="26" valign="middle" style="width:26px; padding:4px 0;">
                        <img src="https://img.icons8.com/ios/50/00c92b/graduation-cap.png" width="18" height="18" alt="Education" style="width:18px; height:18px; display:block; border:0;" />
                    </td>
                    <td width="90" valign="middle" style="width:90px; padding:4px 8px; font-size:11px; line-height:18px; font-weight:700; letter-spacing:0.5px; color:#777777;">
                        EDUCATION
                    </td>
                    <td width="1" style="width:1px; background:#e2e2e2; background:rgba(128,128,128,0.25);"></td>
                    <td valign="middle" style="padding:4px 0 4px 14px; font-size:13px; line-height:19px; font-weight:500; color:#111111; word-break:break-word;">
                        \${profile.education}
                    </td>
                </tr>
            </table>

            <!-- DIVIDER -->
            <table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px; margin-bottom:12px;">
                <tr>
                    <td style="border-top:1px solid #e5e5e5; border-top:1px solid rgba(128,128,128,0.25); height:1px; line-height:1px; font-size:1px;">&nbsp;</td>
                </tr>
            </table>

            <!-- SOCIAL ICONS -->
            <table cellpadding="0" cellspacing="0" border="0" style="margin:0; padding:0;">
                <tr>
                    <td style="padding-right:10px; vertical-align:middle;">
                        <a href="\${profile.linkedin}" target="_blank" style="display:block; text-decoration:none; line-height:0;">
                            <img src="https://img.icons8.com/color/48/linkedin-circled--v1.png" width="22" height="22" alt="LinkedIn" style="display:block; width:22px; height:22px; border:0;" />
                        </a>
                    </td>
                    <td style="padding-right:10px; vertical-align:middle;">
                        <a href="\${profile.github}" target="_blank" style="display:block; text-decoration:none; line-height:0;">
                            <img src="https://img.icons8.com/ios-filled/50/github.png" width="22" height="22" alt="GitHub" style="display:block; width:22px; height:22px; border:0;" />
                        </a>
                    </td>
                    <td style="padding-right:10px; vertical-align:middle;">
                        <a href="\${profile.facebook}" target="_blank" style="display:block; text-decoration:none; line-height:0;">
                            <img src="https://img.icons8.com/color/48/facebook-new.png" width="22" height="22" alt="Facebook" style="display:block; width:22px; height:22px; border:0;" />
                        </a>
                    </td>
                    <td style="padding-right:10px; vertical-align:middle;">
                        <a href="\${profile.instagram}" target="_blank" style="display:block; text-decoration:none; line-height:0;">
                            <img src="https://img.icons8.com/fluency/48/instagram-new.png" width="22" height="22" alt="Instagram" style="display:block; width:22px; height:22px; border:0;" />
                        </a>
                    </td>
                    <td style="padding-right:0; vertical-align:middle;">
                        <a href="\${profile.tiktok}" target="_blank" style="display:block; text-decoration:none; line-height:0;">
                            <img src="https://img.icons8.com/color/48/tiktok--v1.png" width="22" height="22" alt="TikTok" style="display:block; width:22px; height:22px; border:0;" />
                        </a>
                    </td>
                </tr>
            </table>
        </td>
    </tr>
</table>`

export interface JobReview {
  company: string
  position: string
  location: string
  emails: string[]
  mustHaveSkills: string[]
  jobTone: string
  confidence: number
}

export type ApplicationStatus = 'Draft' | 'Sent' | 'Interview' | 'Offer' | 'Rejected' | 'Withdrawn'

export interface Application {
  id: string
  company: string
  position: string
  location: string
  email: string
  emails?: string[]
  subject: string
  status: ApplicationStatus
  resumeId?: string
  resumeIds?: string[]
  createdAt: string
  updatedAt: string
  notes: string
}

export interface AppState {
  version: number
  profile: Profile
  resumes: Resume[]
  endpoints: AiEndpoint[]
  templates: CoverTemplate[]
  signature: SignatureConfig
  applications: Application[]
  selectedTemplateId: string
  onboardingComplete: boolean
  theme: 'dark' | 'light'
  accessibility: AccessibilitySettings
}

export const builtInTemplates: CoverTemplate[] = [
  {
    id: 'technical-problem-solver',
    name: 'Technical Problem-Solver',
    description: 'For IT, support, systems, and operations roles.',
    builtIn: true,
    adaptive: true,
    body: `Dear Hiring Manager,

My name is {{applicant_firstname}}, and I am writing to express my strong interest in the {{position}} role at {{company}}. [AI_WRITE: 1-2 sentences naturally connecting the candidate's background to what this specific role involves — do NOT mention requirements like "Graduate of BS" or "6 months experience"]

After reviewing the job requirements, I am confident my skills align well with your needs, particularly in [AI_WRITE: 2-3 actual competency areas relevant to this specific role].

In this role, I can immediately support your team with:
• [AI_WRITE: bullet 1 — specific contribution the candidate brings, bridged to what this role actually does]
• [AI_WRITE: bullet 2 — specific contribution the candidate brings, bridged to what this role actually does]
• [AI_WRITE: bullet 3 — specific contribution the candidate brings, bridged to what this role actually does]

I am highly proactive, adaptable, and committed to taking ownership of my work. Whether it involves learning new tools, troubleshooting complex issues, or optimizing team workflows, I am eager to contribute effectively to your operations.

You can view my projects and background here:
Portfolio: {{portfolio}}
(My resume is also attached for your review)

Thank you for your time and consideration. I look forward to the possibility of discussing this opportunity with you.

Best regards,
{{applicant_name}}`,
  },
  {
    id: 'direct-impactful',
    name: 'Direct & Impactful',
    description: 'Concise, high-signal letter following the exact tailored format.',
    builtIn: true,
    adaptive: true,
    body: `Dear Hiring Manager,

My name is \${profile.name.split(' ')[0]}, and I am writing to express my strong interest in the \${position} role at \${company}. [AI_WRITE: 1-2 sentences naturally connecting the candidate's background to what this specific role involves — do NOT mention requirements like "Graduate of BS" or experience durations]

After reviewing the job requirements, I am confident my skills align well with your needs, particularly in [AI_WRITE: 2-3 actual competency areas relevant to this specific role].

In this role, I can immediately support your team with:
• [AI_WRITE: bullet 1 — specific contribution bridged to what this role actually does day-to-day]
• [AI_WRITE: bullet 2 — specific contribution bridged to what this role actually does day-to-day]
• [AI_WRITE: bullet 3 — specific contribution bridged to what this role actually does day-to-day]

I am highly proactive, adaptable, and committed to taking ownership of my work. Whether it involves learning new tools, troubleshooting complex issues, or optimizing team workflows, I am eager to contribute effectively to your operations.

You can learn more about my background and view some of my projects through my portfolio:

Portfolio:\${profile.portfolio}

I’ve also attached my resume for your review, which provides additional details about my experience, skills, and qualifications.

Thank you for your time and consideration. I look forward to the possibility of discussing this opportunity with you.

Best regards,
\${profile.name}`,
  },
  {
    id: 'builder-developer',
    name: 'Builder & Developer',
    description: 'For software, web, data, and engineering roles.',
    builtIn: true,
    adaptive: true,
    body: `Dear Hiring Manager,

I am excited to apply for the {{position}} role at {{company}}. [AI_WRITE: 1-2 sentences connecting candidate's technical background to this specific engineering/dev role]

I focus on thoughtful architecture, readable implementation, and measurable user outcomes. In this role, I can immediately contribute with:
• [AI_WRITE: bullet 1 — specific technical contribution]
• [AI_WRITE: bullet 2 — specific technical contribution]
• [AI_WRITE: bullet 3 — specific technical contribution]

You can view my projects and background here:
Portfolio: {{portfolio}}
(My resume is also attached for your review)

Thank you for your time. I would be glad to discuss how I can contribute.

Best regards,
{{applicant_name}}`,
  },
  {
    id: 'fresh-graduate',
    name: 'Fresh Graduate & Fast Learner',
    description: 'Shows potential, fundamentals, and adaptability.',
    builtIn: true,
    adaptive: true,
    body: `Dear Hiring Manager,

I am applying for the {{position}} opportunity at {{company}}. My foundation in {{top_skills}}, combined with {{education}}, has prepared me to learn quickly and contribute with care. [AI_WRITE: 1 sentence showing genuine interest in what this specific role involves]

I am looking for a team where curiosity, feedback, and dependable execution matter. In this role, I can contribute with:
• [AI_WRITE: bullet 1 — transferable skill or foundational knowledge relevant to this role]
• [AI_WRITE: bullet 2 — transferable skill or foundational knowledge relevant to this role]
• [AI_WRITE: bullet 3 — transferable skill or foundational knowledge relevant to this role]

You can view my projects and background here:
Portfolio: {{portfolio}}
(My resume is also attached for your review)

Thank you for reviewing my application. I would value the opportunity to speak with you.

Best regards,
{{applicant_name}}`,
  },
  {
    id: 'senior-leadership',
    name: 'Senior / Leadership',
    description: 'Emphasizes ownership, alignment, and operations.',
    builtIn: true,
    adaptive: true,
    body: `Dear Hiring Manager,

I am interested in the {{position}} role at {{company}}. [AI_WRITE: 1-2 sentences connecting candidate's leadership/senior experience to this specific role's scope and outcomes]

I would bring accountable ownership, clear decision-making, and a bias toward sustainable improvement. Specifically:
• [AI_WRITE: bullet 1 — leadership contribution relevant to this role]
• [AI_WRITE: bullet 2 — leadership contribution relevant to this role]
• [AI_WRITE: bullet 3 — leadership contribution relevant to this role]

You can view my projects and background here:
Portfolio: {{portfolio}}
(My resume is also attached for your review)

Thank you for your consideration. I welcome a conversation about the outcomes this role is expected to own.

Best regards,
{{applicant_name}}`,
  },
]

export const emptyProfile: Profile = {
  fullName: '', firstName: '', email: '', phone: '', tagline: '', preferredRoles: [], education: '', skills: [], portfolio: '', github: '', linkedin: '', facebook: '', instagram: '', tiktok: '', location: '',
  smtp: { host: 'smtp.gmail.com', port: 587, username: '', password: '', fromEmail: '', useTls: true },
}

export const initialState: AppState = {
  version: 1,
  profile: emptyProfile,
  resumes: [],
  endpoints: [],
  templates: builtInTemplates,
  signature: {
    enabled: true,
    accentColor: '#00c92b',
    customHtml: DEFAULT_SIGNATURE_HTML,
    useCustomHtml: false,
    showPhone: true,
    showPortfolio: true,
    showEmail: true,
    showEducation: true,
    showGithub: true,
    showLinkedin: true,
    showFacebook: true,
    showInstagram: true,
    showTiktok: true,
  },
  applications: [],
  selectedTemplateId: 'technical-problem-solver',
  onboardingComplete: false,
  theme: 'dark',
  accessibility: { fontFamily: 'poppins', uiScale: 1, textScale: 1 },
}
