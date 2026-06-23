fn main() {
    let result = std::panic::catch_unwind(|| {
        tauri_build::build()
    });
    if let Err(e) = result {
        let msg = if let Some(s) = e.downcast_ref::<String>() {
            s.clone()
        } else if let Some(s) = e.downcast_ref::<&str>() {
            s.to_string()
        } else {
            "unknown panic".to_string()
        };
        eprintln!("warning: tauri_build panicked (likely windows resource compiler issue): {}", msg);
    }
}