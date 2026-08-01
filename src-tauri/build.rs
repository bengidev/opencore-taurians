fn main() {
    let mut attributes = tauri_build::Attributes::new();
    #[cfg(windows)]
    {
        attributes = attributes.windows_attributes(
            tauri_build::WindowsAttributes::new_without_app_manifest(),
        );
        embed_windows_manifest();
    }
    tauri_build::try_build(attributes).expect("failed to run tauri-build");
}

/// Embed Common Controls v6 for bins *and* test binaries.
///
/// `tauri-winres` only links the default app manifest into `[[bin]]` targets, so
/// Windows `cargo test` executables load comctl32 v5 and abort with
/// `STATUS_ENTRYPOINT_NOT_FOUND` (0xc0000139). See tauri-apps/tauri#13419.
#[cfg(windows)]
fn embed_windows_manifest() {
    static WINDOWS_MANIFEST_FILE: &str = "windows-app-manifest.xml";

    let manifest = std::env::current_dir()
        .expect("current dir")
        .join(WINDOWS_MANIFEST_FILE);

    println!("cargo:rerun-if-changed={}", manifest.display());
    println!("cargo:rustc-link-arg=/MANIFEST:EMBED");
    println!(
        "cargo:rustc-link-arg=/MANIFESTINPUT:{}",
        manifest.to_str().expect("manifest path is valid UTF-8")
    );
    // Turn linker warnings about the manifest into errors so misconfiguration fails loudly.
    println!("cargo:rustc-link-arg=/WX");
}
