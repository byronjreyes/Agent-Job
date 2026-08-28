use chrono::Utc;
use lettre::{
    message::{header::ContentType, Attachment, Mailbox, MultiPart, SinglePart},
    transport::smtp::authentication::Credentials,
    Message, SmtpTransport, Transport,
};
use regex::Regex;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::{
    collections::HashMap,
    fs,
    path::{Path, PathBuf},
};
use tauri::{AppHandle, Manager};
use uuid::Uuid;

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct SmtpConfig {
    pub host: String,
    pub port: u16,
    pub username: String,
    pub password: String,
    pub from_email: String,
    pub use_tls: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize, Default)]
#[serde(rename_all = "camelCase")]
pub struct Profile {
    pub full_name: String,
    pub first_name: String,
    pub email: String,
    pub phone: String,
    pub tagline: String,
    pub preferred_roles: Vec<String>,
    pub education: String,
    pub skills: Vec<String>,
    pub portfolio: String,
    pub github: String,
    pub linkedin: String,
    #[serde(default)]
    pub facebook: String,
    #[serde(default)]
    pub instagram: String,
    #[serde(default)]
    pub tiktok: String,
    pub location: String,
    pub smtp: SmtpConfig,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Resume {
    pub id: String,
    pub label: String,
    pub file_name: String,
    pub path: String,
    pub size: u64,
    pub created_at: String,
    pub tags: Vec<String>,
    pub active: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AiEndpoint {
    pub id: String,
    pub name: String,
    pub provider: String,
    pub base_url: String,
    pub api_key: String,
    pub default_model: String,
    pub models: Vec<String>,
    pub active: bool,
    pub last_tested_at: Option<String>,
    pub status: Option<String>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct CoverTemplate {
    pub id: String,
    pub name: String,
    pub description: String,
    pub body: String,
    pub built_in: bool,
    pub adaptive: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SignatureConfig {
    pub enabled: bool,
    pub accent_color: String,
    pub custom_html: String,
    pub use_custom_html: bool,
    pub show_phone: bool,
    pub show_portfolio: bool,
    pub show_email: bool,
    pub show_education: bool,
    pub show_github: bool,
    pub show_linkedin: bool,
    #[serde(default)]
    pub show_facebook: bool,
    #[serde(default)]
    pub show_instagram: bool,
    #[serde(default)]
    pub show_tiktok: bool,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct Application {
    pub id: String,
    pub company: String,
    pub position: String,
    pub location: String,
    pub email: String,
    pub subject: String,
    pub status: String,
    pub resume_id: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub notes: String,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AccessibilitySettings {
    pub font_family: String,
    pub ui_scale: f32,
    pub text_scale: f32,
}

impl Default for AccessibilitySettings {
    fn default() -> Self {
        Self {
            font_family: "system".into(),
            ui_scale: 1.0,
            text_scale: 1.0,
        }
    }
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct AppState {
    pub version: u32,
    pub profile: Profile,
    pub resumes: Vec<Resume>,
    pub endpoints: Vec<AiEndpoint>,
    pub templates: Vec<CoverTemplate>,
    pub signature: SignatureConfig,
    pub applications: Vec<Application>,
    pub selected_template_id: String,
    pub onboarding_complete: bool,
    pub theme: String,
    #[serde(default)]
    pub accessibility: AccessibilitySettings,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct JobReview {
    pub company: String,
    pub position: String,
    pub location: String,
    pub emails: Vec<String>,
    pub must_have_skills: Vec<String>,
    pub job_tone: String,
    pub confidence: f32,
}

#[derive(Clone, Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct SendPayload {
    pub recipient: String,
    pub subject: String,
    pub plain_body: String,
    pub profile: Profile,
    pub signature: SignatureConfig,
    pub resume_path: Option<String>,
    pub resume_name: Option<String>,
}

fn app_dir(app: &AppHandle) -> Result<PathBuf, String> {
    let path = app
        .path()
        .app_data_dir()
        .map_err(|error| error.to_string())?;
    fs::create_dir_all(&path).map_err(|error| error.to_string())?;
    Ok(path)
}

fn state_path(app: &AppHandle) -> Result<PathBuf, String> {
    Ok(app_dir(app)?.join("memory.json"))
}

fn secret_entry(account: &str) -> Result<keyring::Entry, String> {
    keyring::Entry::new("AgentJob", account).map_err(|error| error.to_string())
}

#[tauri::command]
fn load_state(app: AppHandle) -> Result<Option<AppState>, String> {
    let path = state_path(&app)?;
    if !path.exists() {
        return Ok(None);
    }
    let text = fs::read_to_string(path).map_err(|error| error.to_string())?;
    let mut state: AppState =
        serde_json::from_str(&text).map_err(|error| format!("Invalid memory.json: {error}"))?;
    for endpoint in &mut state.endpoints {
        if endpoint.api_key == "__keyring__" {
            endpoint.api_key = secret_entry(&format!("endpoint:{}", endpoint.id))
                .and_then(|entry| entry.get_password().map_err(|error| error.to_string()))
                .unwrap_or_default();
        }
    }
    if state.profile.smtp.password == "__keyring__" {
        state.profile.smtp.password = secret_entry("smtp-password")
            .and_then(|entry| entry.get_password().map_err(|error| error.to_string()))
            .unwrap_or_default();
    }
    Ok(Some(state))
}

#[tauri::command]
fn save_state(app: AppHandle, mut state: AppState) -> Result<(), String> {
    for endpoint in &mut state.endpoints {
        if !endpoint.api_key.is_empty() && endpoint.api_key != "__keyring__" {
            secret_entry(&format!("endpoint:{}", endpoint.id))?
                .set_password(&endpoint.api_key)
                .map_err(|error| error.to_string())?;
            endpoint.api_key = "__keyring__".into();
        }
    }
    if !state.profile.smtp.password.is_empty() && state.profile.smtp.password != "__keyring__" {
        secret_entry("smtp-password")?
            .set_password(&state.profile.smtp.password)
            .map_err(|error| error.to_string())?;
        state.profile.smtp.password = "__keyring__".into();
    }
    let text = serde_json::to_string_pretty(&state).map_err(|error| error.to_string())?;
    let path = state_path(&app)?;
    let temporary = path.with_extension("json.tmp");
    fs::write(&temporary, text).map_err(|error| error.to_string())?;
    fs::rename(temporary, path).map_err(|error| error.to_string())
}

#[tauri::command]
fn import_resume(app: AppHandle, source_path: String, label: String) -> Result<Resume, String> {
    let source = PathBuf::from(&source_path);
    if source
        .extension()
        .and_then(|value| value.to_str())
        .map(|value| value.eq_ignore_ascii_case("pdf"))
        != Some(true)
    {
        return Err("Only PDF resumes are supported.".into());
    }
    let metadata = fs::metadata(&source).map_err(|error| error.to_string())?;
    if metadata.len() > 10 * 1024 * 1024 {
        return Err("Resume must be smaller than 10 MB.".into());
    }
    let id = Uuid::new_v4().to_string();
    let resume_dir = app_dir(&app)?.join("resumes");
    fs::create_dir_all(&resume_dir).map_err(|error| error.to_string())?;
    let destination = resume_dir.join(format!("{id}.pdf"));
    fs::copy(&source, &destination).map_err(|error| error.to_string())?;
    Ok(Resume {
        id,
        label,
        file_name: source
            .file_name()
            .and_then(|value| value.to_str())
            .unwrap_or("resume.pdf")
            .to_string(),
        path: destination.to_string_lossy().to_string(),
        size: metadata.len(),
        created_at: Utc::now().to_rfc3339(),
        tags: vec![],
        active: true,
    })
}

fn endpoint_url(base: &str, suffix: &str) -> String {
    format!(
        "{}/{}",
        base.trim_end_matches('/'),
        suffix.trim_start_matches('/')
    )
}

fn auth(request: reqwest::RequestBuilder, endpoint: &AiEndpoint) -> reqwest::RequestBuilder {
    if endpoint.api_key.is_empty() {
        request
    } else {
        request.bearer_auth(&endpoint.api_key)
    }
}

#[tauri::command]
async fn discover_models(endpoint: AiEndpoint) -> Result<Vec<String>, String> {
    let client = reqwest::Client::new();
    let response = match endpoint.provider.as_str() {
        "gemini" => {
            client
                .get(endpoint_url(
                    &endpoint.base_url,
                    &format!("models?key={}", endpoint.api_key),
                ))
                .send()
                .await
        }
        "anthropic" => {
            client
                .get(endpoint_url(
                    &endpoint.base_url.trim_end_matches("/v1"),
                    "v1/models",
                ))
                .header("x-api-key", &endpoint.api_key)
                .header("anthropic-version", "2023-06-01")
                .send()
                .await
        }
        _ => {
            auth(
                client.get(endpoint_url(&endpoint.base_url, "models")),
                &endpoint,
            )
            .send()
            .await
        }
    }
    .map_err(|error| error.to_string())?;
    let status = response.status();
    let body: Value = response.json().await.map_err(|error| error.to_string())?;
    if !status.is_success() {
        return Err(format!(
            "Model discovery failed ({status}): {}",
            api_error(&body)
        ));
    }
    let items = body
        .get("data")
        .and_then(Value::as_array)
        .or_else(|| body.get("models").and_then(Value::as_array))
        .cloned()
        .unwrap_or_default();
    let mut models: Vec<String> = items
        .iter()
        .filter_map(|item| {
            item.get("id")
                .or_else(|| item.get("name"))
                .and_then(Value::as_str)
        })
        .map(|name| name.trim_start_matches("models/").to_string())
        .collect();
    models.sort();
    models.dedup();
    Ok(models)
}

#[tauri::command]
async fn test_endpoint(endpoint: AiEndpoint) -> Result<String, String> {
    let models = discover_models(endpoint.clone()).await?;
    Ok(format!(
        "Connected to {}. {} model{} available.",
        endpoint.name,
        models.len(),
        if models.len() == 1 { "" } else { "s" }
    ))
}

fn clean_text_field(raw: &str) -> String {
    raw.trim_start_matches(|c: char| c == '-' || c == ':' || c == '•' || c == '*' || c == '–' || c == '—' || c.is_whitespace())
        .trim_end_matches(|c: char| c == '?' || c == ':' || c == '-' || c.is_whitespace())
        .trim()
        .to_string()
}

fn local_review(description: &str) -> JobReview {
    let email_regex = Regex::new(r"(?i)[\w.+-]+@[\w.-]+\.[a-z]{2,}").expect("valid email regex");
    let emails: Vec<String> = email_regex
        .find_iter(description)
        .map(|value| value.as_str().to_string())
        .collect();

    let lines: Vec<&str> = description
        .lines()
        .map(str::trim)
        .filter(|line| !line.is_empty())
        .collect();

    let role_prefix_regex = Regex::new(r"(?i)^(position|role|job title|title|we are|now hiring|hiring|urgently hiring|looking for)\s*[:-]?\s*(.*)").expect("valid role prefix regex");
    let role_keywords_regex = Regex::new(r"(?i)(developer|engineer|support|network|system|analyst|designer|manager|administrator|specialist|assistant|technician|intern|associate|officer|lead|consultant|programmer|architect|coordinator|operator|representative|supervisor|director|executive|clerk|helpdesk|desk)").expect("valid role regex");

    let mut position = String::new();
    for (i, line) in lines.iter().enumerate() {
        if let Some(captures) = role_prefix_regex.captures(line) {
            let after = captures.get(2).map(|m| m.as_str().trim()).unwrap_or("");
            if !after.is_empty() {
                position = clean_text_field(after);
                break;
            } else if i + 1 < lines.len() {
                position = clean_text_field(lines[i + 1]);
                break;
            }
        }
    }

    if position.is_empty() {
        if let Some(matched) = lines.iter().find(|line| {
            role_keywords_regex.is_match(line)
                && !line.to_lowercase().contains("qualification")
                && !line.to_lowercase().contains("requirement")
                && !line.to_lowercase().contains("graduate")
                && !line.to_lowercase().contains("experience")
                && !line.to_lowercase().contains("knowledgeable")
        }) {
            position = clean_text_field(matched);
        }
    }

    let mut company = String::new();
    let company_prefix_regex = Regex::new(r"(?i)^(company|about us|employer|organization)\s*[:-]\s*(.*)").expect("valid company prefix regex");
    for line in &lines {
        if let Some(captures) = company_prefix_regex.captures(line) {
            company = clean_text_field(captures.get(2).map(|m| m.as_str()).unwrap_or(""));
            break;
        }
    }

    if company.is_empty() && !lines.is_empty() {
        let first = lines[0];
        if !role_keywords_regex.is_match(first) && first.len() < 60 && !first.to_lowercase().contains("qualification") {
            let mut candidate = clean_text_field(first);
            if lines.len() > 1 && Regex::new(r"(?i)services|group|company|corp|inc|ltd|agency|hr|human resource|enterprises|solutions|technologies|systems").unwrap().is_match(lines[1]) {
                candidate = format!("{} {}", candidate, lines[1].trim());
            }
            company = candidate;
        }
    }

    let location_regex = Regex::new(r"(?i)remote|hybrid|on-site|location|building|brgy|street|st\.|ave|city|province|laguna|manila|state|country").expect("valid location regex");
    let ignore_location_regex = Regex::new(r"(?i)send your resume|apply now|bring your|email").expect("valid ignore regex");
    let location = lines
        .iter()
        .find(|line| location_regex.is_match(line) && !ignore_location_regex.is_match(line))
        .map(|line| clean_text_field(line.split_once(':').map(|(_, v)| v).unwrap_or(line)))
        .unwrap_or_default();

    let known = [
        "Network support",
        "Networking",
        "Technical support",
        "Customer support",
        "Basic configuration",
        "Internet functionality",
        "Troubleshooting",
        "React",
        "TypeScript",
        "JavaScript",
        "Python",
        "Rust",
        "SQL",
        "AWS",
        "Azure",
        "Docker",
        "Linux",
        "Windows Server",
        "Figma",
        "Active Directory",
    ];
    let lower = description.to_lowercase();
    let must_have_skills: Vec<String> = known
        .iter()
        .filter(|skill| lower.contains(&skill.to_lowercase()))
        .take(6)
        .map(|skill| skill.to_string())
        .collect();

    JobReview {
        company: if company.is_empty() { "Company".into() } else { company },
        position: if position.is_empty() { "Technical Support".into() } else { position },
        location,
        emails,
        must_have_skills,
        job_tone: "professional".into(),
        confidence: 0.85,
    }
}

#[tauri::command]
async fn review_job(
    description: String,
    endpoint: Option<AiEndpoint>,
) -> Result<JobReview, String> {
    let local = local_review(&description);
    let Some(endpoint) = endpoint.filter(|value| !value.default_model.is_empty()) else {
        return Ok(local);
    };

    let prompt = format!("You are an accurate structured job parser. Extract facts from the job text below.\nReturn strict JSON matching this schema:\n{{\n  \"company\": \"string\",\n  \"position\": \"string (job title/role)\",\n  \"location\": \"string\",\n  \"emails\": [\"string\"],\n  \"mustHaveSkills\": [\"string\"],\n  \"jobTone\": \"professional\",\n  \"confidence\": 0.9\n}}\n\nImportant: Identify the job position/title accurately even if formatted as 'We Are <TITLE>', 'Hiring <TITLE>', or in headlines.\n\nJOB LISTING:\n{description}");
    
    let output = match call_ai(
        &endpoint,
        "You are AgentJob Reviewer, an accurate structured-data extractor for job postings.",
        &prompt,
    )
    .await {
        Ok(res) => res,
        Err(_) => return Ok(local),
    };

    let clean = strip_json_fence(&output);
    let parsed: Result<JobReview, _> = serde_json::from_str(clean);

    match parsed {
        Ok(mut ai_review) => {
            if ai_review.position.trim().is_empty() || ai_review.position == "Not found" {
                ai_review.position = local.position;
            }
            if ai_review.company.trim().is_empty() || ai_review.company == "Not found" {
                ai_review.company = local.company;
            }
            if ai_review.emails.is_empty() {
                ai_review.emails = local.emails;
            }
            if ai_review.must_have_skills.is_empty() {
                ai_review.must_have_skills = local.must_have_skills;
            }
            if ai_review.location.trim().is_empty() {
                ai_review.location = local.location;
            }
            Ok(ai_review)
        }
        Err(_) => Ok(local),
    }
}

fn fill_template(template: &str, profile: &Profile, review: &JobReview) -> String {
    let first_name = if profile.first_name.is_empty() {
        profile.full_name.split_whitespace().next().unwrap_or("").to_string()
    } else {
        profile.first_name.clone()
    };
    let skills: Vec<String> = if review.must_have_skills.is_empty() {
        if profile.skills.is_empty() {
            vec![
                "Technical troubleshooting".into(),
                "Systems configuration".into(),
                "Customer support".into(),
            ]
        } else {
            profile.skills.iter().take(3).cloned().collect()
        }
    } else {
        review.must_have_skills.iter().take(3).cloned().collect()
    };

    let skill_1 = skills.get(0).cloned().unwrap_or_else(|| "Technical troubleshooting & problem-solving".into());
    let skill_2 = skills.get(1).cloned().unwrap_or_else(|| "Systems configuration & support".into());
    let skill_3 = skills.get(2).cloned().unwrap_or_else(|| "Process optimization & workflow documentation".into());

    let portfolio = if profile.portfolio.is_empty() {
        "Available upon request".into()
    } else {
        profile.portfolio.clone()
    };

    let custom_reason = if !skills.is_empty() {
        format!(
            "The role's focus on {} is especially compelling and aligns with my hands-on background.",
            skills.iter().take(2).cloned().collect::<Vec<_>>().join(" and ")
        )
    } else {
        "I am drawn to this opportunity because of the meaningful impact and practical challenges of the role.".into()
    };

    let mut values = HashMap::new();
    values.insert("applicant_name".to_string(), profile.full_name.clone());
    values.insert("applicant_firstname".to_string(), first_name.clone());
    values.insert("full_name".to_string(), profile.full_name.clone());
    values.insert("fullName".to_string(), profile.full_name.clone());
    values.insert("name".to_string(), profile.full_name.clone());
    values.insert("profile.name".to_string(), profile.full_name.clone());
    values.insert("profile.fullName".to_string(), profile.full_name.clone());
    values.insert("first_name".to_string(), first_name.clone());
    values.insert("firstName".to_string(), first_name.clone());
    values.insert("profile.firstName".to_string(), first_name.clone());
    values.insert("profile.firstname".to_string(), first_name.clone());
    values.insert("profile.name.split(' ')[0]".to_string(), first_name.clone());
    values.insert("profile.fullName.split(' ')[0]".to_string(), first_name);
    values.insert("company".to_string(), if review.company.is_empty() { "the company".into() } else { review.company.clone() });
    values.insert("position".to_string(), if review.position.is_empty() { "the open position".into() } else { review.position.clone() });
    values.insert("location".to_string(), review.location.clone());
    values.insert("portfolio".to_string(), portfolio.clone());
    values.insert("profile.portfolio".to_string(), portfolio);
    values.insert("email".to_string(), profile.email.clone());
    values.insert("profile.email".to_string(), profile.email.clone());
    values.insert("phone".to_string(), profile.phone.clone());
    values.insert("profile.phone".to_string(), profile.phone.clone());
    values.insert("tagline".to_string(), profile.tagline.clone());
    values.insert("profile.tagline".to_string(), profile.tagline.clone());
    values.insert("top_skills".to_string(), skills.join(", "));
    values.insert("skills".to_string(), skills.join(", "));
    values.insert("skill_1".to_string(), skill_1);
    values.insert("skill_2".to_string(), skill_2);
    values.insert("skill_3".to_string(), skill_3);
    values.insert("education".to_string(), profile.education.clone());
    values.insert("profile.education".to_string(), profile.education.clone());
    values.insert("custom_reason".to_string(), custom_reason);

    let replaced_curly = Regex::new(r"\{\{([^}]+)\}\}")
        .expect("valid template regex")
        .replace_all(template, |captures: &regex::Captures| {
            values.get(captures[1].trim()).cloned().unwrap_or_default()
        })
        .to_string();

    Regex::new(r"\$\{([^}]+)\}")
        .expect("valid template regex")
        .replace_all(&replaced_curly, |captures: &regex::Captures| {
            values.get(captures[1].trim()).cloned().unwrap_or_default()
        })
        .to_string()
}

#[tauri::command]
async fn generate_letter(
    description: String,
    review: JobReview,
    profile: Profile,
    template: String,
    adaptive: bool,
    endpoint: Option<AiEndpoint>,
) -> Result<String, String> {
    let base = fill_template(&template, &profile, &review);
    let Some(endpoint) = endpoint.filter(|_| adaptive) else {
        return Ok(base);
    };
    let prompt = format!(
        r#"You are AgentJob Cover Letter Writer. Fill in the cover letter template below for the specific job posting.

HOW TO FILL THE TEMPLATE:
- Replace every [AI_WRITE: instruction] marker with the actual content described in the instruction.
- PRESERVE everything else in the template EXACTLY as written — fixed paragraphs, portfolio lines, closing, sign-off, etc.
- For [AI_WRITE] zones: use the candidate's profile, their actual skills/experience, and what this specific role ACTUALLY INVOLVES day-to-day to write natural, human-sounding content.
- ROLE CONTEXT: Before filling bullets, think about what this job title actually involves (e.g. Inventory Staff → stock tracking, goods receiving, record accuracy, warehouse documentation). Bridge the candidate's existing skills to those real tasks.
- NEVER copy-paste job requirements verbatim as bullet contributions. Requirements say what they WANT — bullets say what YOU BRING.
- The "particularly in..." zone should list 2-3 real competency areas (not raw requirement text like "Graduate of BS" or "6 months experience").
- Output PLAIN TEXT ONLY. No markdown. No [url](url) links — write plain URLs. No code fences. No commentary outside the letter itself.

CANDIDATE PROFILE:
{}

JOB REVIEW:
{}

JOB DESCRIPTION:
{}

TEMPLATE TO FILL (replace [AI_WRITE: ...] markers, preserve everything else verbatim):
{}"#,
        serde_json::to_string(&profile).unwrap_or_default(),
        serde_json::to_string(&review).unwrap_or_default(),
        description,
        base
    );
    let raw = call_ai(
        &endpoint,
        "You are AgentJob Creator, an expert professional cover-letter writer.",
        &prompt,
    )
    .await?;

    // Post-process: strip any markdown links [text](url) → url
    let clean = Regex::new(r"\[([^\]]*)\]\((https?://[^\)]+)\)")
        .expect("valid markdown link regex")
        .replace_all(&raw, |caps: &regex::Captures| {
            caps[2].to_string()
        })
        .to_string();

    // Also remove any remaining bare markdown artifacts like **bold** or `code`
    let clean = Regex::new(r"\*\*([^*]+)\*\*")
        .expect("valid bold regex")
        .replace_all(&clean, |caps: &regex::Captures| caps[1].to_string())
        .to_string();

    Ok(clean)
}

async fn call_ai(endpoint: &AiEndpoint, system: &str, user: &str) -> Result<String, String> {
    let client = reqwest::Client::new();
    let (request, provider) = match endpoint.provider.as_str() {
        "anthropic" => {
            let url = if endpoint.base_url.ends_with("/v1/messages") {
                endpoint.base_url.clone()
            } else {
                endpoint_url(&endpoint.base_url.trim_end_matches("/v1"), "v1/messages")
            };
            (client.post(url).header("x-api-key", &endpoint.api_key).header("anthropic-version", "2023-06-01").json(&json!({"model": endpoint.default_model, "max_tokens": 1800, "system": system, "messages": [{"role":"user","content":user}]})), "anthropic")
        }
        "gemini" => {
            let url = endpoint_url(
                &endpoint.base_url,
                &format!(
                    "models/{}:generateContent?key={}",
                    endpoint.default_model, endpoint.api_key
                ),
            );
            (client.post(url).json(&json!({"systemInstruction":{"parts":[{"text":system}]},"contents":[{"role":"user","parts":[{"text":user}]}],"generationConfig":{"temperature":0.2,"maxOutputTokens":1800}})), "gemini")
        }
        _ => {
            let url = if endpoint.base_url.ends_with("/chat/completions") {
                endpoint.base_url.clone()
            } else {
                endpoint_url(&endpoint.base_url, "chat/completions")
            };
            (auth(client.post(url), endpoint).json(&json!({"model":endpoint.default_model,"temperature":0.2,"messages":[{"role":"system","content":system},{"role":"user","content":user}]})), "openai")
        }
    };
    let response = request.send().await.map_err(|error| error.to_string())?;
    let status = response.status();
    let body: Value = response.json().await.map_err(|error| error.to_string())?;
    if !status.is_success() {
        return Err(format!(
            "AI request failed ({status}): {}",
            api_error(&body)
        ));
    }
    let text = match provider {
        "anthropic" => body.pointer("/content/0/text"),
        "gemini" => body.pointer("/candidates/0/content/parts/0/text"),
        _ => body.pointer("/choices/0/message/content"),
    }
    .and_then(Value::as_str)
    .ok_or_else(|| "AI provider returned no text.".to_string())?;
    Ok(text.trim().to_string())
}

fn api_error(value: &Value) -> String {
    value
        .pointer("/error/message")
        .and_then(Value::as_str)
        .or_else(|| value.get("message").and_then(Value::as_str))
        .unwrap_or("Unknown provider error")
        .to_string()
}

fn strip_json_fence(value: &str) -> &str {
    value
        .trim()
        .strip_prefix("```json")
        .or_else(|| value.trim().strip_prefix("```"))
        .unwrap_or(value.trim())
        .strip_suffix("```")
        .unwrap_or(value.trim())
        .trim()
}

fn interpolate_signature_html(template: &str, profile: &Profile, signature: &SignatureConfig) -> String {
    let esc = |value: &str| html_escape::encode_text(value).to_string();
    let accent = if signature.accent_color.is_empty() {
        "#c84e89"
    } else {
        &signature.accent_color
    };
    let portfolio_clean = profile
        .portfolio
        .trim_start_matches("https://")
        .trim_start_matches("http://");
    let portfolio_url = if profile.portfolio.is_empty() {
        "".to_string()
    } else if profile.portfolio.starts_with("http") {
        profile.portfolio.clone()
    } else {
        format!("https://{}", profile.portfolio)
    };

    let mut map: HashMap<String, String> = HashMap::new();
    map.insert("profile.fullName".into(), esc(&profile.full_name));
    map.insert("fullName".into(), esc(&profile.full_name));
    map.insert("full_name".into(), esc(&profile.full_name));
    map.insert("profile.firstName".into(), esc(&profile.first_name));
    map.insert("firstName".into(), esc(&profile.first_name));
    map.insert("profile.tagline".into(), esc(&profile.tagline));
    map.insert("tagline".into(), esc(&profile.tagline));
    map.insert("profile.phone".into(), esc(&profile.phone));
    map.insert("phone".into(), esc(&profile.phone));
    map.insert("profile.email".into(), esc(&profile.email));
    map.insert("email".into(), esc(&profile.email));
    map.insert("profile.portfolio".into(), esc(&portfolio_url));
    map.insert("portfolio".into(), esc(&portfolio_url));
    map.insert("portfolio_clean".into(), esc(portfolio_clean));
    map.insert("profile.education".into(), esc(&profile.education));
    map.insert("education".into(), esc(&profile.education));
    map.insert("profile.github".into(), esc(&profile.github));
    map.insert("github".into(), esc(&profile.github));
    map.insert("profile.linkedin".into(), esc(&profile.linkedin));
    map.insert("linkedin".into(), esc(&profile.linkedin));
    map.insert("profile.facebook".into(), esc(&profile.facebook));
    map.insert("facebook".into(), esc(&profile.facebook));
    map.insert("profile.instagram".into(), esc(&profile.instagram));
    map.insert("instagram".into(), esc(&profile.instagram));
    map.insert("profile.tiktok".into(), esc(&profile.tiktok));
    map.insert("tiktok".into(), esc(&profile.tiktok));
    map.insert("signature.accentColor".into(), esc(accent));
    map.insert("accentColor".into(), esc(accent));

    let step1 = Regex::new(r"\{\{([^}]+)\}\}")
        .expect("regex")
        .replace_all(template, |c: &regex::Captures| {
            map.get(c[1].trim()).cloned().unwrap_or_else(|| c[0].to_string())
        })
        .to_string();

    Regex::new(r"\$\{([^}]+)\}")
        .expect("regex")
        .replace_all(&step1, |c: &regex::Captures| {
            map.get(c[1].trim()).cloned().unwrap_or_else(|| c[0].to_string())
        })
        .to_string()
}

fn signature_html(profile: &Profile, signature: &SignatureConfig) -> String {
    if !signature.enabled {
        return String::new();
    }
    if signature.use_custom_html && !signature.custom_html.is_empty() {
        return interpolate_signature_html(&signature.custom_html, profile, signature);
    }
    let esc = |value: &str| html_escape::encode_text(value).to_string();

    let accent = if signature.accent_color.is_empty() {
        "#00c92b"
    } else {
        &signature.accent_color
    };

    let mut contact_rows = Vec::new();

    if signature.show_email && !profile.email.is_empty() {
        contact_rows.push(format!(
            r##"<tr><td width="26" valign="middle" style="width:26px; padding:4px 0;"><img src="https://img.icons8.com/ios/50/00c92b/new-post--v1.png" width="18" height="18" alt="Email" style="width:18px; height:18px; display:block; border:0;" /></td><td width="90" valign="middle" style="width:90px; padding:4px 8px; font-size:11px; line-height:18px; font-weight:700; letter-spacing:0.5px; color:#777777;">EMAIL</td><td width="1" style="width:1px; background:#e2e2e2; background:rgba(128,128,128,0.25);"></td><td valign="middle" style="padding:4px 0 4px 14px; font-size:13px; line-height:19px; font-weight:500;"><a href="mailto:{}" style="color:#111111; text-decoration:none; word-break:break-word;">{}</a></td></tr>"##,
            esc(&profile.email),
            esc(&profile.email)
        ));
    }

    if signature.show_phone && !profile.phone.is_empty() {
        contact_rows.push(format!(
            r##"<tr><td width="26" valign="middle" style="width:26px; padding:4px 0;"><img src="https://img.icons8.com/ios/50/00c92b/phone.png" width="18" height="18" alt="Phone" style="width:18px; height:18px; display:block; border:0;" /></td><td width="90" valign="middle" style="width:90px; padding:4px 8px; font-size:11px; line-height:18px; font-weight:700; letter-spacing:0.5px; color:#777777;">PHONE</td><td width="1" style="width:1px; background:#e2e2e2; background:rgba(128,128,128,0.25);"></td><td valign="middle" style="padding:4px 0 4px 14px; font-size:13px; line-height:19px; font-weight:500;"><a href="tel:{}" style="color:#111111; text-decoration:none; word-break:break-word;">{}</a></td></tr>"##,
            esc(&profile.phone),
            esc(&profile.phone)
        ));
    }

    if signature.show_portfolio && !profile.portfolio.is_empty() {
        let url = if profile.portfolio.starts_with("http") {
            profile.portfolio.clone()
        } else {
            format!("https://{}", profile.portfolio)
        };
        contact_rows.push(format!(
            r##"<tr><td width="26" valign="middle" style="width:26px; padding:4px 0;"><img src="https://img.icons8.com/ios/50/00c92b/domain.png" width="18" height="18" alt="Portfolio" style="width:18px; height:18px; display:block; border:0;" /></td><td width="90" valign="middle" style="width:90px; padding:4px 8px; font-size:11px; line-height:18px; font-weight:700; letter-spacing:0.5px; color:#777777;">PORTFOLIO</td><td width="1" style="width:1px; background:#e2e2e2; background:rgba(128,128,128,0.25);"></td><td valign="middle" style="padding:4px 0 4px 14px; font-size:13px; line-height:19px; font-weight:500;"><a href="{}" target="_blank" style="color:#111111; text-decoration:none; word-break:break-word;">{}</a></td></tr>"##,
            esc(&url),
            esc(&profile.portfolio)
        ));
    }

    if signature.show_education && !profile.education.is_empty() {
        contact_rows.push(format!(
            r##"<tr><td width="26" valign="middle" style="width:26px; padding:4px 0;"><img src="https://img.icons8.com/ios/50/00c92b/graduation-cap.png" width="18" height="18" alt="Education" style="width:18px; height:18px; display:block; border:0;" /></td><td width="90" valign="middle" style="width:90px; padding:4px 8px; font-size:11px; line-height:18px; font-weight:700; letter-spacing:0.5px; color:#777777;">EDUCATION</td><td width="1" style="width:1px; background:#e2e2e2; background:rgba(128,128,128,0.25);"></td><td valign="middle" style="padding:4px 0 4px 14px; font-size:13px; line-height:19px; font-weight:500; color:#111111; word-break:break-word;">{}</td></tr>"##,
            esc(&profile.education)
        ));
    }

    let mut social_icons = Vec::new();
    if signature.show_linkedin {
        let url = if profile.linkedin.is_empty() { "https://linkedin.com/".to_string() } else if profile.linkedin.starts_with("http") { profile.linkedin.clone() } else { format!("https://{}", profile.linkedin) };
        social_icons.push(format!(
            r#"<td style="padding-right:10px; vertical-align:middle;"><a href="{}" target="_blank" style="display:block; text-decoration:none; line-height:0;"><img src="https://img.icons8.com/color/48/linkedin-circled--v1.png" width="22" height="22" alt="LinkedIn" style="display:block; width:22px; height:22px; border:0;" /></a></td>"#,
            esc(&url)
        ));
    }
    if signature.show_github {
        let url = if profile.github.is_empty() { "https://github.com/".to_string() } else if profile.github.starts_with("http") { profile.github.clone() } else { format!("https://{}", profile.github) };
        social_icons.push(format!(
            r#"<td style="padding-right:10px; vertical-align:middle;"><a href="{}" target="_blank" style="display:block; text-decoration:none; line-height:0;"><img src="https://img.icons8.com/ios-filled/50/github.png" width="22" height="22" alt="GitHub" style="display:block; width:22px; height:22px; border:0;" /></a></td>"#,
            esc(&url)
        ));
    }
    if signature.show_facebook {
        let url = if profile.facebook.is_empty() { "https://facebook.com/".to_string() } else if profile.facebook.starts_with("http") { profile.facebook.clone() } else { format!("https://{}", profile.facebook) };
        social_icons.push(format!(
            r#"<td style="padding-right:10px; vertical-align:middle;"><a href="{}" target="_blank" style="display:block; text-decoration:none; line-height:0;"><img src="https://img.icons8.com/color/48/facebook-new.png" width="22" height="22" alt="Facebook" style="display:block; width:22px; height:22px; border:0;" /></a></td>"#,
            esc(&url)
        ));
    }
    if signature.show_instagram {
        let url = if profile.instagram.is_empty() { "https://instagram.com/".to_string() } else if profile.instagram.starts_with("http") { profile.instagram.clone() } else { format!("https://{}", profile.instagram) };
        social_icons.push(format!(
            r#"<td style="padding-right:10px; vertical-align:middle;"><a href="{}" target="_blank" style="display:block; text-decoration:none; line-height:0;"><img src="https://img.icons8.com/fluency/48/instagram-new.png" width="22" height="22" alt="Instagram" style="display:block; width:22px; height:22px; border:0;" /></a></td>"#,
            esc(&url)
        ));
    }
    if signature.show_tiktok {
        let url = if profile.tiktok.is_empty() { "https://tiktok.com/".to_string() } else if profile.tiktok.starts_with("http") { profile.tiktok.clone() } else { format!("https://{}", profile.tiktok) };
        social_icons.push(format!(
            r#"<td style="padding-right:0; vertical-align:middle;"><a href="{}" target="_blank" style="display:block; text-decoration:none; line-height:0;"><img src="https://img.icons8.com/color/48/tiktok--v1.png" width="22" height="22" alt="TikTok" style="display:block; width:22px; height:22px; border:0;" /></a></td>"#,
            esc(&url)
        ));
    }

    let contact_table = if !contact_rows.is_empty() {
        format!(
            r##"<table cellpadding="0" cellspacing="0" border="0" style="width:100%; font-family:'Poppins', -apple-system, BlinkMacSystemFont, sans-serif;">{}</table>"##,
            contact_rows.join(r#"<tr><td colspan="4" height="3"></td></tr>"#)
        )
    } else {
        String::new()
    };

    let social_table = if !social_icons.is_empty() {
        format!(
            r##"<table width="100%" cellpadding="0" cellspacing="0" border="0" style="margin-top:14px; margin-bottom:12px;"><tr><td style="border-top:1px solid #e5e5e5; border-top:1px solid rgba(128,128,128,0.25); height:1px; line-height:1px; font-size:1px;">&nbsp;</td></tr></table><table cellpadding="0" cellspacing="0" border="0" style="margin:0; padding:0;"><tr>{}</tr></table>"##,
            social_icons.join("")
        )
    } else {
        String::new()
    };

    format!(
        r##"<table cellpadding="0" cellspacing="0" border="0" style="width:100%; max-width:580px; font-family:'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; margin-top:20px;"><tr><td width="4" valign="top" style="width:4px; background:{}; border-radius:4px;"></td><td width="18" style="width:18px;"></td><td valign="top" style="padding:2px 0 4px 0;"><div style="font-family:'Poppins', -apple-system, BlinkMacSystemFont, sans-serif; font-size:21px; line-height:28px; font-weight:700; letter-spacing:-0.4px; color:#111111; margin:0; padding:0;">{}</div><div style="font-family:'Poppins', -apple-system, BlinkMacSystemFont, sans-serif; font-size:13px; line-height:19px; font-weight:400; color:{}; margin-top:2px;">{}</div><div style="height:14px; line-height:14px;">&nbsp;</div>{}{}</td></tr></table>"##,
        esc(accent),
        esc(&profile.full_name),
        esc(accent),
        esc(&profile.tagline),
        contact_table,
        social_table
    )
}

fn format_email_html(plain_body: &str, profile: &Profile, signature: &SignatureConfig) -> (String, String) {
    // Convert plain text body to HTML paragraphs
    // Split on blank lines → paragraphs; single newlines within a paragraph → <br>
    let paragraphs: Vec<&str> = plain_body
        .split("\n\n")
        .map(str::trim)
        .filter(|p| !p.is_empty())
        .collect();

    let mut body_html = String::new();
    for p in &paragraphs {
        let mut para_html = String::new();
        for line in p.lines() {
            let trimmed = line.trim();
            if trimmed.is_empty() { continue; }

            // Linkify Portfolio: lines
            let html_line = if trimmed.to_ascii_lowercase().starts_with("portfolio:") {
                let rest = trimmed["portfolio:".len()..].trim();
                let href = if rest.starts_with("http") {
                    rest.to_string()
                } else {
                    format!("https://{rest}")
                };
                format!(
                    "Portfolio: <a href=\"{href}\" target=\"_blank\" style=\"color:#1a73e8; text-decoration:underline;\">{}</a>",
                    html_escape::encode_text(rest)
                )
            } else {
                html_escape::encode_text(trimmed).to_string()
            };

            if !para_html.is_empty() {
                para_html.push_str("<br>");
            }
            para_html.push_str(&html_line);
        }

        if !para_html.is_empty() {
            body_html.push_str(&format!(
                "<p style=\"margin:0 0 1em 0; padding:0; font-family:Arial,Helvetica,sans-serif; font-size:14px; line-height:1.6; color:#222222;\">{para_html}</p>\n"
            ));
        }
    }

    let sig = signature_html(profile, signature);

    let html = format!(
        "<!DOCTYPE html><html><head><meta charset=\"utf-8\"></head><body style=\"margin:0;padding:0;background:#ffffff;\"><div style=\"font-family:Arial,Helvetica,sans-serif;font-size:14px;line-height:1.6;color:#222222;\">{body_html}{}</div></body></html>",
        if sig.is_empty() { String::new() } else { format!("<div style=\"margin-top:24px;border-top:1px solid #e0e0e0;padding-top:16px;\">{sig}</div>") }
    );

    // Plain text: preserve original with proper line breaks
    let plain = plain_body.to_string();

    (html, plain)
}

#[tauri::command]
fn send_application_email(payload: SendPayload) -> Result<String, String> {
    let smtp = &payload.profile.smtp;
    if smtp.host.is_empty() || smtp.from_email.is_empty() {
        return Err("Configure SMTP host and from address in Profile settings.".into());
    }
    let from_name = if !payload.profile.full_name.trim().is_empty() {
        Some(payload.profile.full_name.trim().to_string())
    } else {
        None
    };
    let from_address = smtp
        .from_email
        .parse::<lettre::Address>()
        .map_err(|error| format!("Invalid from address: {error}"))?;
    let from = Mailbox::new(from_name, from_address);
    let recipients: Vec<Mailbox> = payload
        .recipient
        .split([',', ';'])
        .map(str::trim)
        .filter(|value| !value.is_empty())
        .map(|value| {
            value
                .parse()
                .map_err(|error| format!("Invalid recipient '{value}': {error}"))
        })
        .collect::<Result<_, _>>()?;
    if recipients.is_empty() {
        return Err("Add at least one recipient email address.".into());
    }
    let (html, plain_text) = format_email_html(&payload.plain_body, &payload.profile, &payload.signature);
    let alternative = MultiPart::alternative()
        .singlepart(
            SinglePart::builder()
                .header(ContentType::TEXT_PLAIN)
                .body(plain_text),
        )
        .singlepart(
            SinglePart::builder()
                .header(ContentType::TEXT_HTML)
                .body(html),
        );
    let body = if let Some(path) = payload.resume_path.filter(|value| !value.is_empty()) {
        let bytes = fs::read(&path).map_err(|error| format!("Unable to read resume: {error}"))?;
        let mut file_name = payload.resume_name.unwrap_or_default().trim().to_string();
        if file_name.is_empty() {
            file_name = Path::new(&path)
                .file_name()
                .and_then(|value| value.to_str())
                .unwrap_or("resume.pdf")
                .to_string();
        }
        if !file_name.to_lowercase().ends_with(".pdf") {
            file_name.push_str(".pdf");
        }
        MultiPart::mixed()
            .multipart(alternative)
            .singlepart(Attachment::new(file_name).body(
                bytes,
                ContentType::parse("application/pdf").map_err(|error| error.to_string())?,
            ))
    } else {
        MultiPart::mixed().multipart(alternative)
    };
    let mut message_builder = Message::builder()
        .from(from)
        .subject(payload.subject)
        .message_id(Some(format!("<{}.{}@agentjob.app>", Uuid::new_v4(), Utc::now().timestamp_nanos_opt().unwrap_or(0))))
        .date(Utc::now().into());
    for recipient in recipients {
        message_builder = message_builder.to(recipient);
    }
    let message = message_builder
        .multipart(body)
        .map_err(|error| error.to_string())?;
    let credentials = Credentials::new(smtp.username.clone(), smtp.password.clone());
    let mailer = if smtp.use_tls {
        let builder = if smtp.port == 465 {
            SmtpTransport::relay(&smtp.host)
        } else {
            SmtpTransport::starttls_relay(&smtp.host)
        };
        builder
            .map_err(|error| error.to_string())?
            .port(smtp.port)
            .credentials(credentials)
            .build()
    } else {
        SmtpTransport::builder_dangerous(&smtp.host)
            .port(smtp.port)
            .credentials(credentials)
            .build()
    };
    mailer
        .send(&message)
        .map_err(|error| format!("SMTP delivery failed: {error}"))?;
    Ok("Email delivered successfully.".into())
}

#[tauri::command]
fn export_tracker_csv(
    applications: Vec<Application>,
    destination: String,
) -> Result<String, String> {
    let mut writer = csv::Writer::from_path(&destination).map_err(|error| error.to_string())?;
    writer
        .write_record([
            "Company",
            "Position",
            "Location",
            "Recipient",
            "Subject",
            "Status",
            "Created",
            "Updated",
            "Notes",
        ])
        .map_err(|error| error.to_string())?;
    for item in applications {
        writer
            .write_record([
                item.company,
                item.position,
                item.location,
                item.email,
                item.subject,
                item.status,
                item.created_at,
                item.updated_at,
                item.notes,
            ])
            .map_err(|error| error.to_string())?;
    }
    writer.flush().map_err(|error| error.to_string())?;
    Ok(destination)
}

#[cfg(target_os = "windows")]
fn run_native_ocr(image_bytes: &[u8]) -> Result<String, String> {
    use windows::{
        Graphics::Imaging::BitmapDecoder,
        Media::Ocr::OcrEngine,
        Storage::Streams::{DataWriter, InMemoryRandomAccessStream},
    };

    let stream = InMemoryRandomAccessStream::new().map_err(|error| error.to_string())?;
    let writer = DataWriter::CreateDataWriter(&stream).map_err(|error| error.to_string())?;
    writer.WriteBytes(image_bytes).map_err(|error| error.to_string())?;
    writer.StoreAsync().map_err(|error| error.to_string())?.get().map_err(|error| error.to_string())?;
    writer.FlushAsync().map_err(|error| error.to_string())?.get().map_err(|error| error.to_string())?;
    stream.Seek(0).map_err(|error| error.to_string())?;

    let decoder = BitmapDecoder::CreateAsync(&stream)
        .map_err(|error| error.to_string())?
        .get()
        .map_err(|error| error.to_string())?;
    let bitmap = decoder
        .GetSoftwareBitmapAsync()
        .map_err(|error| error.to_string())?
        .get()
        .map_err(|error| error.to_string())?;

    let engine = OcrEngine::TryCreateFromUserProfileLanguages()
        .map_err(|error| error.to_string())?;

    let result = engine
        .RecognizeAsync(&bitmap)
        .map_err(|error| error.to_string())?
        .get()
        .map_err(|error| error.to_string())?;

    let mut lines = Vec::new();
    let ocr_lines = result.Lines().map_err(|error| error.to_string())?;
    for line in ocr_lines {
        if let Ok(text) = line.Text() {
            let line_str = text.to_string().trim().to_string();
            if !line_str.is_empty() {
                lines.push(line_str);
            }
        }
    }
    if lines.is_empty() {
        return Err("No text detected in the image.".into());
    }
    Ok(lines.join("\n"))
}

#[cfg(not(target_os = "windows"))]
fn run_native_ocr(_image_bytes: &[u8]) -> Result<String, String> {
    Err("Native OCR is currently supported on Windows.".into())
}

#[tauri::command]
fn ocr_image(image_base64: String) -> Result<String, String> {
    use base64::prelude::*;
    let clean = if let Some(pos) = image_base64.find("base64,") {
        &image_base64[pos + 7..]
    } else {
        image_base64.trim()
    };
    let bytes = BASE64_STANDARD
        .decode(clean.trim().as_bytes())
        .map_err(|error| format!("Invalid base64 image data: {error}"))?;
    if bytes.is_empty() {
        return Err("Empty image data provided.".into());
    }
    run_native_ocr(&bytes)
}

#[tauri::command]
fn open_browser(url: String) -> Result<(), String> {
    #[cfg(target_os = "windows")]
    {
        use std::process::Command;
        use std::os::windows::process::CommandExt;
        const CREATE_NO_WINDOW: u32 = 0x08000000;
        Command::new("cmd")
            .args(["/C", "start", "", &url])
            .creation_flags(CREATE_NO_WINDOW)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
    #[cfg(not(target_os = "windows"))]
    {
        use std::process::Command;
        Command::new("xdg-open")
            .arg(&url)
            .spawn()
            .map_err(|e| e.to_string())?;
        Ok(())
    }
}

pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_opener::init())
        .plugin(tauri_plugin_updater::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            load_state,
            save_state,
            import_resume,
            test_endpoint,
            discover_models,
            review_job,
            generate_letter,
            send_application_email,
            export_tracker_csv,
            ocr_image,
            open_browser
        ])
        .run(tauri::generate_context!())
        .expect("error while running AgentJob");
}

#[cfg(test)]
mod tests {
    use super::*;
    #[test]
    fn deterministic_template_replaces_smart_tags() {
        let profile = Profile {
            full_name: "Ada Lovelace".into(),
            first_name: "Ada".into(),
            skills: vec!["Rust".into()],
            ..Default::default()
        };
        let review = JobReview {
            company: "Analytical Engines".into(),
            position: "Engineer".into(),
            location: String::new(),
            emails: vec![],
            must_have_skills: vec!["Rust".into()],
            job_tone: "professional".into(),
            confidence: 1.0,
        };
        let output = fill_template(
            "{{applicant_name}} — {{position}} at {{company}}: {{top_skills}}",
            &profile,
            &review,
        );
        assert_eq!(
            output,
            "Ada Lovelace — Engineer at Analytical Engines: Rust"
        );
    }
    #[test]
    fn local_reviewer_extracts_email_and_role() {
        let review =
            local_review("Company: Acme\nSenior React Developer\nRemote\nApply: jobs@acme.test");
        assert_eq!(review.company, "Acme");
        assert!(review.position.contains("Developer"));
        assert_eq!(review.emails, vec!["jobs@acme.test"]);
    }
    #[test]
    fn ocr_image_rejects_empty_payload() {
        let result = ocr_image("".into());
        assert!(result.is_err());
    }
    #[test]
    fn local_reviewer_extracts_network_support_from_screenshot_text() {
        let text = "DBR?\nHUMAN RESOURCE AND SERVICES\nWe Are\nNETWORK SUPPORT\nQUALIFICA TIONS :\n• College graduate (BSIT)\n• Knowledgeable in basic configuration & understanding in internet functionality\nKINDLY BRING YOUR UPDATED RESUME AT:\n9\n• 2F Morales Building, Brgy. San Antonio, City of Bifian, Laguna\nor you can send your resume at: sinsa045@gmail.com\nand kindly indicate the position you are applying for.\nAPPLY NOW-";
        let review = local_review(text);
        assert_eq!(review.position, "NETWORK SUPPORT");
        assert_eq!(review.company, "DBR HUMAN RESOURCE AND SERVICES");
        assert_eq!(review.emails, vec!["sinsa045@gmail.com"]);
    }
}
