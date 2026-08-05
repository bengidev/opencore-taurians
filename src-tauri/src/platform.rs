/// Returns a stable, lowercase platform tag used by the frontend to decide
/// whether to render custom window controls and how to pad the chrome row.
pub fn platform_tag() -> &'static str {
    if cfg!(target_os = "macos") {
        "macos"
    } else if cfg!(target_os = "windows") {
        "windows"
    } else if cfg!(target_os = "linux") {
        "linux"
    } else {
        std::env::consts::OS
    }
}

#[tauri::command]
pub fn app_platform() -> String {
    platform_tag().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn platform_tag_is_stable_and_lowercase() {
        let tag = platform_tag();
        assert!(
            ["macos", "windows", "linux"].contains(&tag) || tag == std::env::consts::OS,
            "unexpected platform tag: {tag}"
        );
        assert_eq!(tag.to_lowercase(), tag);
    }
}
