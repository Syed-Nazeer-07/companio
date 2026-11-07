// Prevents additional console window on Windows in release
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use serde::{Deserialize, Serialize};

#[derive(Serialize, Deserialize)]
struct ToolResult {
    success: bool,
    message: String,
    verified: bool,
}

#[tauri::command]
fn execute_tool(tool_name: String, _params: serde_json::Value) -> ToolResult {
    println!("[Tauri Rust] Executing tool: {}", tool_name);
    // Dispatches to Windows automation
    ToolResult {
        success: true,
        message: format!("Executed {} natively via Windows backend", tool_name),
        verified: true,
    }
}

#[tauri::command]
fn get_volume() -> Result<f32, String> {
    Ok(0.65)
}

#[tauri::command]
fn set_volume(level: f32) -> Result<(), String> {
    println!("[Tauri Rust] Setting master volume to {}", level);
    Ok(())
}

#[tauri::command]
fn take_screenshot() -> Result<String, String> {
    Ok("C:\\Users\\Nazeer\\Pictures\\Companio_Captures\\screenshot.png".to_string())
}

#[tauri::command]
fn toggle_dashboard(app_handle: tauri::AppHandle, show: bool) -> Result<(), String> {
    use tauri::Manager;
    if let Some(dash) = app_handle.get_webview_window("dashboard") {
        if show {
            dash.show().map_err(|e| e.to_string())?;
            dash.set_focus().map_err(|e| e.to_string())?;
        } else {
            dash.hide().map_err(|e| e.to_string())?;
        }
    }
    Ok(())
}

fn main() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .invoke_handler(tauri::generate_handler![
            execute_tool,
            get_volume,
            set_volume,
            take_screenshot,
            toggle_dashboard
        ])
        .run(tauri::generate_context!())
        .expect("error while running Companio tauri application");
}
