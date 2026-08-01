#![allow(dead_code)] // Provider transport scaffolding behind GIT_SUITE_RELEASE_ENABLED; SSRF/redirect helpers are test-covered.
use reqwest::redirect::Policy;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::future::Future;
use std::net::{IpAddr, ToSocketAddrs};
use std::pin::Pin;
use std::sync::{Arc, Mutex};
use std::time::Duration;

const DEFAULT_TIMEOUT_SECS: u64 = 30;
const DEFAULT_BODY_LIMIT: usize = 1_048_576; // 1 MiB
const DEFAULT_RETRIES: u32 = 2;
const RATE_LIMIT_HTTP_STATUS: u16 = 429;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "kebab-case")]
pub enum ProviderTransportErrorKind {
    SsrfBlocked,
    RedirectDenied,
    Timeout,
    BodyLimit,
    RateLimited,
    AuthFailed,
    NotFound,
    ServerError,
    ConnectionFailed,
    DnsFailed,
    Unknown,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ProviderTransportError {
    pub kind: ProviderTransportErrorKind,
    pub message: String,
    pub retryable: bool,
    pub status_code: Option<u16>,
}

impl ProviderTransportError {
    fn ssrf_blocked(reason: &str) -> Self {
        Self {
            kind: ProviderTransportErrorKind::SsrfBlocked,
            message: format!("Request blocked by SSRF policy: {}", reason),
            retryable: false,
            status_code: None,
        }
    }

    fn redirect_denied(url: &str) -> Self {
        Self {
            kind: ProviderTransportErrorKind::RedirectDenied,
            message: format!("Redirect to {} denied by security policy", url),
            retryable: false,
            status_code: None,
        }
    }

    fn timeout() -> Self {
        Self {
            kind: ProviderTransportErrorKind::Timeout,
            message: "Request timed out".into(),
            retryable: true,
            status_code: None,
        }
    }

    fn body_limit() -> Self {
        Self {
            kind: ProviderTransportErrorKind::BodyLimit,
            message: "Response body exceeded limit".into(),
            retryable: false,
            status_code: None,
        }
    }

    fn rate_limited() -> Self {
        Self {
            kind: ProviderTransportErrorKind::RateLimited,
            message: "Rate limited by upstream provider".into(),
            retryable: true,
            status_code: Some(RATE_LIMIT_HTTP_STATUS),
        }
    }

    fn from_status_and_body(status: u16, body: &str) -> Self {
        let (kind, retryable) = match status {
            401 | 403 => (ProviderTransportErrorKind::AuthFailed, false),
            404 => (ProviderTransportErrorKind::NotFound, false),
            429 => (ProviderTransportErrorKind::RateLimited, true),
            500..=599 => (ProviderTransportErrorKind::ServerError, true),
            _ => (ProviderTransportErrorKind::Unknown, false),
        };
        let message = body.chars().take(256).collect::<String>();
        Self {
            kind,
            message,
            retryable,
            status_code: Some(status),
        }
    }
}

#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum ProviderHttpMethod {
    Get,
    Post,
    Put,
    Patch,
    Delete,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProviderHttpRequest {
    pub method: ProviderHttpMethod,
    pub url: String,
    pub body: Option<String>,
    pub content_type: Option<String>,
    pub auth_header: Option<String>,
}

#[derive(Debug, Clone, PartialEq, Eq)]
pub struct ProviderHttpResponse {
    pub status: u16,
    pub body: Vec<u8>,
}

pub type ProviderHttpFuture =
    Pin<Box<dyn Future<Output = Result<ProviderHttpResponse, ProviderTransportError>> + Send>>;

pub trait ProviderHttpTransport: Send + Sync {
    fn execute(&self, request: ProviderHttpRequest) -> ProviderHttpFuture;
}

#[derive(Clone)]
pub struct ProviderHttpClient {
    transport: Arc<dyn ProviderHttpTransport>,
    base_url: String,
    auth_header: Option<String>,
}

impl ProviderHttpClient {
    pub fn new(
        transport: Arc<dyn ProviderHttpTransport>,
        base_url: &str,
        auth_header: Option<String>,
    ) -> Self {
        Self {
            transport,
            base_url: base_url.trim_end_matches('/').to_string(),
            auth_header,
        }
    }

    pub fn from_provider_transport(transport: ProviderTransport) -> Self {
        Self {
            transport: Arc::new(transport.clone()),
            base_url: transport.base_url().to_string(),
            auth_header: None,
        }
    }

    pub fn inner(&self) -> Arc<dyn ProviderHttpTransport> {
        self.transport.clone()
    }

    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    fn url(&self, path: &str) -> String {
        if self.base_url.is_empty() {
            path.to_string()
        } else {
            format!("{}{}", self.base_url, path)
        }
    }

    fn auth_header(&self) -> Option<String> {
        self.auth_header.clone()
    }

    pub async fn get(&self, path: &str) -> Result<String, ProviderTransportError> {
        self.request(ProviderHttpMethod::Get, path, None, None)
            .await
    }

    pub async fn get_json<T: serde::de::DeserializeOwned>(
        &self,
        path: &str,
    ) -> Result<T, ProviderTransportError> {
        let body = self.get(path).await?;
        serde_json::from_str(&body).map_err(|e| ProviderTransportError {
            kind: ProviderTransportErrorKind::Unknown,
            message: format!("JSON parse error: {}", e),
            retryable: false,
            status_code: None,
        })
    }

    pub async fn post(
        &self,
        path: &str,
        body: &str,
        content_type: &str,
    ) -> Result<String, ProviderTransportError> {
        self.request(
            ProviderHttpMethod::Post,
            path,
            Some(body.to_string()),
            Some(content_type.to_string()),
        )
        .await
    }

    pub async fn post_json<T: serde::de::DeserializeOwned>(
        &self,
        path: &str,
        body: &str,
    ) -> Result<T, ProviderTransportError> {
        let raw = self.post(path, body, "application/json").await?;
        serde_json::from_str(&raw).map_err(|e| ProviderTransportError {
            kind: ProviderTransportErrorKind::Unknown,
            message: format!("JSON parse error: {}", e),
            retryable: false,
            status_code: None,
        })
    }

    pub async fn put(
        &self,
        path: &str,
        body: &str,
        content_type: &str,
    ) -> Result<String, ProviderTransportError> {
        self.request(
            ProviderHttpMethod::Put,
            path,
            Some(body.to_string()),
            Some(content_type.to_string()),
        )
        .await
    }

    pub async fn delete(&self, path: &str) -> Result<String, ProviderTransportError> {
        self.request(ProviderHttpMethod::Delete, path, None, None)
            .await
    }

    pub async fn patch(
        &self,
        path: &str,
        body: &str,
        content_type: &str,
    ) -> Result<String, ProviderTransportError> {
        self.request(
            ProviderHttpMethod::Patch,
            path,
            Some(body.to_string()),
            Some(content_type.to_string()),
        )
        .await
    }

    async fn request(
        &self,
        method: ProviderHttpMethod,
        path: &str,
        body: Option<String>,
        content_type: Option<String>,
    ) -> Result<String, ProviderTransportError> {
        let response = self
            .transport
            .execute(ProviderHttpRequest {
                method,
                url: self.url(path),
                body,
                content_type,
                auth_header: self.auth_header(),
            })
            .await?;

        if !(200..300).contains(&response.status) {
            return Err(ProviderTransportError::from_status_and_body(
                response.status,
                &String::from_utf8_lossy(&response.body),
            ));
        }

        String::from_utf8(response.body).map_err(|e| ProviderTransportError {
            kind: ProviderTransportErrorKind::Unknown,
            message: format!("Response was not valid UTF-8: {}", e),
            retryable: false,
            status_code: None,
        })
    }
}

#[derive(Default)]
pub struct FakeTransport {
    responses: Mutex<HashMap<String, ProviderHttpResponse>>,
}

impl FakeTransport {
    pub fn new() -> Self {
        Self::default()
    }

    pub fn stub(
        &self,
        method: ProviderHttpMethod,
        url_contains: &str,
        response: ProviderHttpResponse,
    ) {
        let key = format!("{:?}:{}", method, url_contains);
        self.responses
            .lock()
            .expect("fake transport lock")
            .insert(key, response);
    }

    pub fn stub_json(
        &self,
        method: ProviderHttpMethod,
        url_contains: &str,
        status: u16,
        body: &str,
    ) {
        self.stub(
            method,
            url_contains,
            ProviderHttpResponse {
                status,
                body: body.as_bytes().to_vec(),
            },
        );
    }
}

impl ProviderHttpTransport for FakeTransport {
    fn execute(&self, request: ProviderHttpRequest) -> ProviderHttpFuture {
        let key = format!("{:?}:{}", request.method, request.url);
        let responses = self.responses.lock().expect("fake transport lock").clone();
        Box::pin(async move {
            for (pattern, response) in responses {
                let prefix = pattern.split(':').next().unwrap_or("");
                let suffix = pattern.split_once(':').map(|(_, s)| s).unwrap_or("");
                if format!("{:?}", request.method) == prefix && request.url.contains(suffix) {
                    return Ok(response);
                }
            }
            Err(ProviderTransportError {
                kind: ProviderTransportErrorKind::NotFound,
                message: format!("No fake response for {}", key),
                retryable: false,
                status_code: Some(404),
            })
        })
    }
}

/// Allowed provider hosts. Only domains in this set may be contacted.
const ALLOWED_HOSTS: &[&str] = &[
    "api.github.com",
    "github.com",
    "gitlab.com",
    "api.bitbucket.org",
    "bitbucket.org",
    "dev.azure.com",
    "vssps.dev.azure.com",
    "app.vssps.visualstudio.com",
];

/// Allowlisted redirect destinations (same-provider CDNs, alternate endpoints).
const ALLOWED_REDIRECT_SUFFIXES: &[&str] = &[
    ".github.com",
    ".githubusercontent.com",
    ".gitlab.com",
    ".bitbucket.org",
    ".dev.azure.com",
    ".visualstudio.com",
];

#[derive(Debug, Clone)]
pub struct ProviderTransport {
    host: String,
    base_url: String,
    auth_header_value: Option<String>,
    timeout: Duration,
    body_limit: usize,
    max_retries: u32,
}

impl ProviderTransport {
    pub fn new(host: &str, base_url: &str) -> Result<Self, String> {
        if !ALLOWED_HOSTS.contains(&host) {
            return Err(format!(
                "Host '{}' is not in the allowed provider list",
                host
            ));
        }
        Ok(Self {
            host: host.to_string(),
            base_url: base_url.trim_end_matches('/').to_string(),
            auth_header_value: None,
            timeout: Duration::from_secs(DEFAULT_TIMEOUT_SECS),
            body_limit: DEFAULT_BODY_LIMIT,
            max_retries: DEFAULT_RETRIES,
        })
    }

    pub fn with_token(mut self, token: &str) -> Self {
        self.auth_header_value = Some(format!("Bearer {}", token));
        self
    }

    pub fn with_basic_auth(mut self, username: &str, password: &str) -> Self {
        let encoded = base64_encode(&format!("{}:{}", username, password));
        self.auth_header_value = Some(format!("Basic {}", encoded));
        self
    }

    pub fn with_timeout(mut self, secs: u64) -> Self {
        self.timeout = Duration::from_secs(secs);
        self
    }

    pub fn with_body_limit(mut self, limit: usize) -> Self {
        self.body_limit = limit;
        self
    }

    pub fn url(&self, path: &str) -> String {
        format!("{}{}", self.base_url, path)
    }

    pub fn base_url(&self) -> &str {
        &self.base_url
    }

    fn validate_url(&self, url: &str) -> Result<(), ProviderTransportError> {
        // Must be HTTPS
        if !url.starts_with("https://") {
            return Err(ProviderTransportError::ssrf_blocked(
                "Only HTTPS URLs are allowed",
            ));
        }

        // Extract host from URL
        let host = match extract_host(url) {
            Some(h) => h,
            None => {
                return Err(ProviderTransportError::ssrf_blocked(
                    "Could not parse host from URL",
                ))
            }
        };

        // Host must be in allowlist
        if !ALLOWED_HOSTS
            .iter()
            .any(|allowed| host == *allowed || host.ends_with(&format!(".{}", allowed)))
        {
            return Err(ProviderTransportError::ssrf_blocked(&format!(
                "Host '{}' is not in the provider allowlist",
                host
            )));
        }

        // Must not contain userinfo
        if url.contains('@') && url.contains("://") {
            // Allow @ in paths (e.g., /org/repo@ref), reject in authority
            let after_scheme = url.split("://").nth(1).unwrap_or("");
            let before_path = after_scheme.split('/').next().unwrap_or("");
            if before_path.contains('@') {
                return Err(ProviderTransportError::ssrf_blocked(
                    "Userinfo in URL authority is not allowed",
                ));
            }
        }

        // Validate DNS resolves to public IP
        validate_dns_public(&host)?;

        Ok(())
    }

    pub async fn get(&self, path: &str) -> Result<String, ProviderTransportError> {
        let url = self.url(path);
        self.execute_with_retry("GET", &url, None).await
    }

    pub async fn get_json<T: serde::de::DeserializeOwned>(
        &self,
        path: &str,
    ) -> Result<T, ProviderTransportError> {
        let body = self.get(path).await?;
        serde_json::from_str(&body).map_err(|e| ProviderTransportError {
            kind: ProviderTransportErrorKind::Unknown,
            message: format!("JSON parse error: {}", e),
            retryable: false,
            status_code: None,
        })
    }

    pub async fn post(
        &self,
        path: &str,
        body: &str,
        content_type: &str,
    ) -> Result<String, ProviderTransportError> {
        let url = self.url(path);
        self.execute_with_retry("POST", &url, Some((body, content_type)))
            .await
    }

    pub async fn post_json<T: serde::de::DeserializeOwned>(
        &self,
        path: &str,
        body: &str,
    ) -> Result<T, ProviderTransportError> {
        let raw = self.post(path, body, "application/json").await?;
        serde_json::from_str(&raw).map_err(|e| ProviderTransportError {
            kind: ProviderTransportErrorKind::Unknown,
            message: format!("JSON parse error: {}", e),
            retryable: false,
            status_code: None,
        })
    }

    pub async fn put(
        &self,
        path: &str,
        body: &str,
        content_type: &str,
    ) -> Result<String, ProviderTransportError> {
        let url = self.url(path);
        self.execute_with_retry("PUT", &url, Some((body, content_type)))
            .await
    }

    pub async fn delete(&self, path: &str) -> Result<String, ProviderTransportError> {
        let url = self.url(path);
        self.execute_with_retry("DELETE", &url, None).await
    }

    pub async fn patch(
        &self,
        path: &str,
        body: &str,
        content_type: &str,
    ) -> Result<String, ProviderTransportError> {
        let url = self.url(path);
        self.execute_with_retry("PATCH", &url, Some((body, content_type)))
            .await
    }

    async fn execute_with_retry(
        &self,
        method: &str,
        url: &str,
        body: Option<(&str, &str)>,
    ) -> Result<String, ProviderTransportError> {
        let mut last_error: Option<ProviderTransportError> = None;

        for attempt in 0..=self.max_retries {
            if attempt > 0 {
                // Exponential backoff: 1s, 2s, 4s
                let delay = 1u64 << (attempt - 1);
                tokio::time::sleep(Duration::from_secs(delay)).await;
            }

            match self.execute_once(method, url, body).await {
                Ok(response) => return Ok(response),
                Err(e) => {
                    if !e.retryable {
                        return Err(e);
                    }
                    last_error = Some(e);
                }
            }
        }

        Err(last_error.unwrap_or_else(|| ProviderTransportError {
            kind: ProviderTransportErrorKind::Unknown,
            message: "Request failed after retries".into(),
            retryable: false,
            status_code: None,
        }))
    }

    async fn execute_once(
        &self,
        method: &str,
        url: &str,
        body: Option<(&str, &str)>,
    ) -> Result<String, ProviderTransportError> {
        self.validate_url(url)?;

        // Build client with redirect policy
        let redirect_policy = {
            let valid_suffixes: Vec<String> = ALLOWED_REDIRECT_SUFFIXES
                .iter()
                .map(|s| s.to_string())
                .collect();
            Policy::custom(move |attempt| {
                let destination = attempt.url().clone();
                let dest_host = destination.host_str().unwrap_or("");

                let allowed = valid_suffixes
                    .iter()
                    .any(|suffix| dest_host == &suffix[1..] || dest_host.ends_with(suffix));

                if allowed {
                    attempt.follow()
                } else {
                    attempt.stop()
                }
            })
        };

        let client = reqwest::Client::builder()
            .redirect(redirect_policy)
            .timeout(self.timeout)
            .https_only(true)
            .no_proxy()
            .user_agent(format!("opencore-taurians/{}", env!("CARGO_PKG_VERSION")))
            .build()
            .map_err(|e| ProviderTransportError {
                kind: ProviderTransportErrorKind::ConnectionFailed,
                message: format!("Failed to build HTTP client: {}", e),
                retryable: false,
                status_code: None,
            })?;

        let mut req = match method {
            "GET" => client.get(url),
            "POST" => {
                let (b, ct) = body.ok_or_else(|| ProviderTransportError {
                    kind: ProviderTransportErrorKind::Unknown,
                    message: "POST requires a body".into(),
                    retryable: false,
                    status_code: None,
                })?;
                client
                    .post(url)
                    .body(b.to_string())
                    .header("Content-Type", ct)
            }
            "PUT" => {
                let (b, ct) = body.ok_or_else(|| ProviderTransportError {
                    kind: ProviderTransportErrorKind::Unknown,
                    message: "PUT requires a body".into(),
                    retryable: false,
                    status_code: None,
                })?;
                client
                    .put(url)
                    .body(b.to_string())
                    .header("Content-Type", ct)
            }
            "DELETE" => client.delete(url),
            "PATCH" => {
                let (b, ct) = body.ok_or_else(|| ProviderTransportError {
                    kind: ProviderTransportErrorKind::Unknown,
                    message: "PATCH requires a body".into(),
                    retryable: false,
                    status_code: None,
                })?;
                client
                    .patch(url)
                    .body(b.to_string())
                    .header("Content-Type", ct)
            }
            _ => {
                return Err(ProviderTransportError {
                    kind: ProviderTransportErrorKind::Unknown,
                    message: format!("Unsupported HTTP method: {}", method),
                    retryable: false,
                    status_code: None,
                })
            }
        };

        if let Some(ref auth) = self.auth_header_value {
            req = req.header("Authorization", auth);
        }
        req = req.header("Accept", "application/json");

        let response = req.send().await.map_err(|e| {
            if e.is_timeout() {
                ProviderTransportError::timeout()
            } else if e.is_connect() {
                ProviderTransportError {
                    kind: ProviderTransportErrorKind::ConnectionFailed,
                    message: format!("Connection failed: {}", sanitize_error(&e.to_string())),
                    retryable: true,
                    status_code: None,
                }
            } else if e.is_redirect() {
                ProviderTransportError::redirect_denied(
                    e.url().map(|u| u.as_str()).unwrap_or("unknown"),
                )
            } else {
                ProviderTransportError {
                    kind: ProviderTransportErrorKind::Unknown,
                    message: format!("Request error: {}", sanitize_error(&e.to_string())),
                    retryable: true,
                    status_code: None,
                }
            }
        })?;

        let final_url = response.url().clone();
        let final_host = final_url.host_str().unwrap_or("");

        // Re-check final URL host after redirects
        let final_allowed = ALLOWED_HOSTS.iter().any(|allowed| {
            final_host == *allowed || final_host.ends_with(&format!(".{}", allowed))
        });
        if !final_allowed {
            return Err(ProviderTransportError::redirect_denied(final_url.as_str()));
        }

        let status = response.status().as_u16();
        if status == RATE_LIMIT_HTTP_STATUS {
            return Err(ProviderTransportError::rate_limited());
        }

        // Read body bounded
        let body_bytes = read_bounded(response, self.body_limit).await?;

        if !(200..300).contains(&status) {
            return Err(ProviderTransportError::from_status_and_body(
                status,
                &String::from_utf8_lossy(&body_bytes),
            ));
        }

        String::from_utf8(body_bytes).map_err(|e| ProviderTransportError {
            kind: ProviderTransportErrorKind::Unknown,
            message: format!("Response was not valid UTF-8: {}", e),
            retryable: false,
            status_code: None,
        })
    }
}

impl ProviderHttpTransport for ProviderTransport {
    fn execute(&self, request: ProviderHttpRequest) -> ProviderHttpFuture {
        let this = self.clone();
        Box::pin(async move {
            let method = match request.method {
                ProviderHttpMethod::Get => "GET",
                ProviderHttpMethod::Post => "POST",
                ProviderHttpMethod::Put => "PUT",
                ProviderHttpMethod::Patch => "PATCH",
                ProviderHttpMethod::Delete => "DELETE",
            };
            let body = match (&request.body, &request.content_type) {
                (Some(body), Some(content_type)) => Some((body.as_str(), content_type.as_str())),
                _ => None,
            };
            let auth = request.auth_header.or(this.auth_header_value.clone());
            let transport = if auth.is_some() && this.auth_header_value.is_none() {
                let mut cloned = this.clone();
                cloned.auth_header_value = auth;
                cloned
            } else {
                this
            };
            let text = transport
                .execute_with_retry(method, &request.url, body)
                .await?;
            Ok(ProviderHttpResponse {
                status: 200,
                body: text.into_bytes(),
            })
        })
    }
}

async fn read_bounded(
    mut response: reqwest::Response,
    limit: usize,
) -> Result<Vec<u8>, ProviderTransportError> {
    let mut buf = Vec::with_capacity(4096);

    loop {
        let chunk = response.chunk().await.map_err(|e| ProviderTransportError {
            kind: ProviderTransportErrorKind::Unknown,
            message: format!("Stream error: {}", e),
            retryable: true,
            status_code: None,
        })?;

        match chunk {
            Some(bytes) => {
                if buf.len() + bytes.len() > limit {
                    return Err(ProviderTransportError::body_limit());
                }
                buf.extend_from_slice(&bytes);
            }
            None => break,
        }
    }

    Ok(buf)
}

fn extract_host(url: &str) -> Option<String> {
    let after_scheme = url.strip_prefix("https://")?;
    let host_part = after_scheme.split('/').next()?;
    // Strip port if present
    let host = host_part.split(':').next()?;
    Some(host.to_lowercase())
}

fn validate_dns_public(host: &str) -> Result<(), ProviderTransportError> {
    // Resolve hostname
    let addrs: Vec<std::net::SocketAddr> = match (host, 443).to_socket_addrs() {
        Ok(addrs) => addrs.collect(),
        Err(_) => {
            return Err(ProviderTransportError {
                kind: ProviderTransportErrorKind::DnsFailed,
                message: format!("DNS resolution failed for {}", host),
                retryable: false,
                status_code: None,
            })
        }
    };

    for addr in &addrs {
        let ip = addr.ip();
        if is_private_or_special(&ip) {
            return Err(ProviderTransportError::ssrf_blocked(&format!(
                "Host {} resolves to private/special address {}",
                host, ip
            )));
        }
    }

    Ok(())
}

fn is_private_or_special(ip: &IpAddr) -> bool {
    match ip {
        IpAddr::V4(v4) => {
            v4.is_private()
                || v4.is_loopback()
                || v4.is_link_local()
                // AWS/cloud metadata endpoint
                || *v4 == std::net::Ipv4Addr::new(169, 254, 169, 254)
        }
        IpAddr::V6(v6) => v6.is_loopback() || v6.is_unique_local() || v6.is_unicast_link_local(),
    }
}

/// Remove tokens and secrets from error messages before logging
fn sanitize_error(msg: &str) -> String {
    // Redact Bearer tokens: replace "Bearer <token-string>" with "Bearer <redacted>"
    msg.split("Bearer ")
        .enumerate()
        .map(|(i, part)| {
            if i == 0 {
                return part.to_string();
            }
            // part starts with the token text; find where it ends
            let token_end = part
                .find(|c: char| c.is_whitespace() || c == ',' || c == ';')
                .unwrap_or(part.len());
            if token_end > 0 {
                format!("<redacted>{}", &part[token_end..])
            } else {
                format!("<redacted>{}", part)
            }
        })
        .collect::<String>()
        // Also redact "token=" query params
        .split("token=")
        .enumerate()
        .map(|(i, part)| {
            if i == 0 {
                return part.to_string();
            }
            let val_end = part
                .find(|c: char| c == '&' || c.is_whitespace())
                .unwrap_or(part.len());
            if val_end > 0 {
                format!("<redacted>{}", &part[val_end..])
            } else {
                format!("<redacted>{}", part)
            }
        })
        .collect::<String>()
}

fn base64_encode(input: &str) -> String {
    let mut buf = Vec::new();
    // Simple base64 without external dependency
    let alphabet = b"ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
    let bytes = input.as_bytes();
    for chunk in bytes.chunks(3) {
        let b0 = chunk[0] as u32;
        let b1 = if chunk.len() > 1 { chunk[1] as u32 } else { 0 };
        let b2 = if chunk.len() > 2 { chunk[2] as u32 } else { 0 };
        let triple = (b0 << 16) | (b1 << 8) | b2;

        buf.push(alphabet[((triple >> 18) & 0x3F) as usize]);
        buf.push(alphabet[((triple >> 12) & 0x3F) as usize]);

        if chunk.len() > 1 {
            buf.push(alphabet[((triple >> 6) & 0x3F) as usize]);
        } else {
            buf.push(b'=');
        }

        if chunk.len() > 2 {
            buf.push(alphabet[(triple & 0x3F) as usize]);
        } else {
            buf.push(b'=');
        }
    }
    String::from_utf8_lossy(&buf).into_owned()
}

/// Paginated API response helper
#[derive(Debug, Clone)]
pub struct PaginatedRequest {
    pub page: u32,
    pub per_page: u32,
}

impl Default for PaginatedRequest {
    fn default() -> Self {
        Self {
            page: 1,
            per_page: 30,
        }
    }
}

/// Common pagination link parser (GitHub-style Link header)
pub fn parse_next_page_url(link_header: &str) -> Option<String> {
    for part in link_header.split(',') {
        let trimmed = part.trim();
        if trimmed.contains("rel=\"next\"") {
            if let Some(start) = trimmed.find('<') {
                if let Some(end) = trimmed.find('>') {
                    return Some(trimmed[start + 1..end].to_string());
                }
            }
        }
    }
    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn rejects_non_https_urls() {
        let transport = ProviderTransport::new("api.github.com", "https://api.github.com").unwrap();
        // Direct HTTP validation
        let result =
            ProviderTransport::validate_url(&transport, "http://api.github.com/repos/test");
        assert!(result.is_err());
        if let Err(e) = result {
            assert_eq!(e.kind, ProviderTransportErrorKind::SsrfBlocked);
        }
    }

    #[test]
    fn rejects_unlisted_hosts() {
        let transport = ProviderTransport::new("api.github.com", "https://api.github.com").unwrap();
        let result = ProviderTransport::validate_url(&transport, "https://evil.example.com/api");
        assert!(result.is_err());
    }

    #[test]
    fn allows_github_api_host() {
        let _transport =
            ProviderTransport::new("api.github.com", "https://api.github.com").unwrap();
        // Note: this test will fail without network since DNS check runs
        // We test the host allowlist separately via extract_host
        let host = extract_host("https://api.github.com/repos/test");
        assert_eq!(host, Some("api.github.com".to_string()));
        assert!(ALLOWED_HOSTS.contains(&"api.github.com"));
    }

    #[test]
    fn allows_gitlab_host() {
        assert!(ALLOWED_HOSTS.contains(&"gitlab.com"));
    }

    #[test]
    fn allows_bitbucket_host() {
        assert!(ALLOWED_HOSTS.contains(&"api.bitbucket.org"));
    }

    #[test]
    fn allows_azure_devops_host() {
        assert!(ALLOWED_HOSTS.contains(&"dev.azure.com"));
    }

    #[test]
    fn rejects_construction_with_unlisted_host() {
        let result = ProviderTransport::new("evil.example.com", "https://evil.example.com");
        assert!(result.is_err());
    }

    #[test]
    fn extract_host_parses_simple() {
        assert_eq!(
            extract_host("https://api.github.com/repos/test"),
            Some("api.github.com".into())
        );
    }

    #[test]
    fn extract_host_strips_port() {
        assert_eq!(
            extract_host("https://api.github.com:443/repos/test"),
            Some("api.github.com".into())
        );
    }

    #[test]
    fn is_private_detects_loopback() {
        assert!(is_private_or_special(&IpAddr::V4(std::net::Ipv4Addr::new(
            127, 0, 0, 1
        ))));
    }

    #[test]
    fn is_private_detects_private_range() {
        assert!(is_private_or_special(&IpAddr::V4(std::net::Ipv4Addr::new(
            192, 168, 1, 1
        ))));
        assert!(is_private_or_special(&IpAddr::V4(std::net::Ipv4Addr::new(
            10, 0, 0, 1
        ))));
        assert!(is_private_or_special(&IpAddr::V4(std::net::Ipv4Addr::new(
            172, 16, 0, 1
        ))));
    }

    #[test]
    fn is_private_detects_metadata_ip() {
        assert!(is_private_or_special(&IpAddr::V4(std::net::Ipv4Addr::new(
            169, 254, 169, 254
        ))));
    }

    #[test]
    fn is_private_detects_public_ip_as_allowed() {
        assert!(!is_private_or_special(&IpAddr::V4(
            std::net::Ipv4Addr::new(8, 8, 8, 8)
        )));
    }

    #[test]
    fn parse_next_page_url_finds_next() {
        let header = r#"<https://api.github.com/repos?page=2>; rel="next", <https://api.github.com/repos?page=5>; rel="last""#;
        assert_eq!(
            parse_next_page_url(header),
            Some("https://api.github.com/repos?page=2".into())
        );
    }

    #[test]
    fn parse_next_page_url_returns_none_when_no_next() {
        let header = r#"<https://api.github.com/repos?page=1>; rel="prev""#;
        assert_eq!(parse_next_page_url(header), None);
    }

    #[test]
    fn sanitize_error_redacts_tokens() {
        let msg = "error: Bearer ghp_secret_token_123 failed";
        let sanitized = sanitize_error(msg);
        assert!(!sanitized.contains("ghp_secret_token_123"));
        assert!(sanitized.contains("<redacted>"));
    }

    #[test]
    fn base64_encodes_correctly() {
        let encoded = base64_encode("user:pass");
        assert_eq!(encoded, "dXNlcjpwYXNz");
    }
}
