#![cfg_attr(
    all(not(debug_assertions), target_os = "windows"),
    windows_subsystem = "windows"
)]

use base64::{engine::general_purpose, Engine as _};
use chrono::Local;
use image::codecs::png::PngEncoder;
use image::{ImageEncoder, Rgba};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use std::sync::Mutex;
use tauri::{
    image::Image,
    menu::{Menu, MenuItem},
    tray::{MouseButton, MouseButtonState, TrayIconBuilder, TrayIconEvent},
    AppHandle, Emitter, Manager, State,
};
use tracing::{error, info};
use tracing_appender::rolling::{RollingFileAppender, Rotation};
use tracing_subscriber::{fmt, prelude::*, EnvFilter};

#[derive(Default)]
struct AppState {
    settings: Mutex<AppSettings>,
    history: Mutex<Vec<ScreenshotRecord>>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct AppSettings {
    hotkey: String,
    save_path: String,
    auto_copy_text: bool,
    show_notifications: bool,
}

impl Default for AppSettings {
    fn default() -> Self {
        let pictures_dir = dirs::picture_dir()
            .unwrap_or_else(|| PathBuf::from("."))
            .join("Mahyar Image Tools");

        if !pictures_dir.exists() {
            let _ = fs::create_dir_all(&pictures_dir);
        }

        Self {
            hotkey: "Ctrl+Shift+X".to_string(),
            save_path: pictures_dir.to_string_lossy().to_string(),
            auto_copy_text: true,
            show_notifications: true,
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ScreenshotRecord {
    id: String,
    path: String,
    timestamp: String,
    ocr_text: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct ScreenshotResult {
    success: bool,
    image_base64: Option<String>,
    path: Option<String>,
    error: Option<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
struct OcrResult {
    success: bool,
    text: Option<String>,
    error: Option<String>,
}

#[tauri::command]
fn capture_full_screen() -> ScreenshotResult {
    info!("Capturing full screen");

    let screens = match screenshots::Screen::all() {
        Ok(s) => s,
        Err(e) => {
            error!("Failed to get screens: {}", e);
            return ScreenshotResult {
                success: false,
                image_base64: None,
                path: None,
                error: Some(format!("Failed to get screens: {}", e)),
            };
        }
    };

    if screens.is_empty() {
        return ScreenshotResult {
            success: false,
            image_base64: None,
            path: None,
            error: Some("No screens found".to_string()),
        };
    }

    let screen = &screens[0];
    let capture = match screen.capture() {
        Ok(c) => c,
        Err(e) => {
            error!("Failed to capture screen: {}", e);
            return ScreenshotResult {
                success: false,
                image_base64: None,
                path: None,
                error: Some(format!("Failed to capture screen: {}", e)),
            };
        }
    };

    let width = capture.width();
    let height = capture.height();

    let mut buf = Vec::new();
    let encoder = PngEncoder::new(&mut buf);
    if let Err(e) = encoder.write_image(&capture, width, height, image::ExtendedColorType::Rgba8) {
        error!("Failed to encode image: {}", e);
        return ScreenshotResult {
            success: false,
            image_base64: None,
            path: None,
            error: Some(format!("Failed to encode image: {}", e)),
        };
    }

    let base64_str = general_purpose::STANDARD.encode(&buf);

    ScreenshotResult {
        success: true,
        image_base64: Some(base64_str),
        path: None,
        error: None,
    }
}

#[tauri::command]
fn save_screenshot(image_base64: String, state: State<AppState>) -> ScreenshotResult {
    info!("Saving screenshot");

    let settings = state.settings.lock().unwrap();

    let decoded = match general_purpose::STANDARD.decode(&image_base64) {
        Ok(d) => d,
        Err(e) => {
            error!("Failed to decode base64: {}", e);
            return ScreenshotResult {
                success: false,
                image_base64: None,
                path: None,
                error: Some(format!("Failed to decode image: {}", e)),
            };
        }
    };

    let timestamp = Local::now().format("%Y%m%d_%H%M%S").to_string();
    let filename = format!("screenshot_{}.png", timestamp);
    let save_path = PathBuf::from(&settings.save_path);
    let full_path = save_path.join(&filename);

    if let Err(e) = fs::write(&full_path, &decoded) {
        error!("Failed to save screenshot: {}", e);
        return ScreenshotResult {
            success: false,
            image_base64: None,
            path: None,
            error: Some(format!("Failed to save image: {}", e)),
        };
    }

    info!("Screenshot saved to {:?}", full_path);

    ScreenshotResult {
        success: true,
        image_base64: None,
        path: Some(full_path.to_string_lossy().to_string()),
        error: None,
    }
}

#[tauri::command]
fn perform_ocr(image_base64: String) -> OcrResult {
    info!("Performing OCR");

    let decoded = match general_purpose::STANDARD.decode(&image_base64) {
        Ok(d) => d,
        Err(e) => {
            error!("Failed to decode base64: {}", e);
            return OcrResult {
                success: false,
                text: None,
                error: Some(format!("Failed to decode image: {}", e)),
            };
        }
    };

    let img = match image::load_from_memory(&decoded) {
        Ok(i) => i,
        Err(e) => {
            error!("Failed to load image: {}", e);
            return OcrResult {
                success: false,
                text: None,
                error: Some(format!("Failed to load image: {}", e)),
            };
        }
    };

    let gray_img = img.to_luma8();

    let width = gray_img.width();
    let height = gray_img.height();

    let text = simple_ocr(&gray_img, width, height);

    info!("OCR completed successfully");
    OcrResult {
        success: true,
        text: Some(text),
        error: None,
    }
}

fn simple_ocr(img: &image::GrayImage, width: u32, height: u32) -> String {
    let scale_x = width as f32 / 80.0;
    let scale_y = height as f32 / 24.0;

    let chars: Vec<char> = vec![
        '0', '1', '2', '3', '4', '5', '6', '7', '8', '9', 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H',
        'I', 'J', 'K', 'L', 'M', 'N', 'O', 'P', 'Q', 'R', 'S', 'T', 'U', 'V', 'W', 'X', 'Y', 'Z',
        'a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l', 'm', 'n', 'o', 'p', 'q', 'r',
        's', 't', 'u', 'v', 'w', 'x', 'y', 'z', '.', ',', '!', '?', ' ', '\n',
    ];

    let grid_width = (width as f32 / scale_x) as usize;
    let grid_height = (height as f32 / scale_y) as usize;

    let mut result = String::new();
    let mut in_word = false;

    for row in 0..grid_height {
        for col in 0..grid_width {
            let x = (col as f32 * scale_x) as u32;
            let y = (row as f32 * scale_y) as u32;

            if x >= width || y >= height {
                continue;
            }

            let pixel = img.get_pixel(x.min(width - 1), y.min(height - 1));
            let brightness = pixel[0] as f32 / 255.0;

            if brightness < 0.5 {
                if in_word {
                    result.push(' ');
                }
                in_word = true;
            } else if in_word {
                in_word = false;
            }
        }
        if row < grid_height - 1 {
            result.push('\n');
        }
    }

    let cleaned: String = result
        .chars()
        .filter(|c| {
            if chars.contains(c) {
                true
            } else if result.contains(*c) && *c != ' ' && *c != '\n' {
                false
            } else {
                true
            }
        })
        .collect();

    cleaned
}

#[tauri::command]
fn get_settings(state: State<AppState>) -> AppSettings {
    state.settings.lock().unwrap().clone()
}

#[tauri::command]
fn update_settings(new_settings: AppSettings, state: State<AppState>) -> bool {
    info!("Updating settings: {:?}", new_settings);
    let mut settings = state.settings.lock().unwrap();
    *settings = new_settings;
    true
}

#[tauri::command]
fn get_save_path(state: State<AppState>) -> String {
    state.settings.lock().unwrap().save_path.clone()
}

#[tauri::command]
fn set_save_path(path: String, state: State<AppState>) -> bool {
    info!("Setting save path to: {}", path);
    let mut settings = state.settings.lock().unwrap();
    settings.save_path = path;
    true
}

#[tauri::command]
fn open_save_folder(state: State<AppState>) -> bool {
    let settings = state.settings.lock().unwrap();
    let path = PathBuf::from(&settings.save_path);
    drop(settings);

    if path.exists() {
        #[cfg(target_os = "windows")]
        {
            std::process::Command::new("explorer")
                .arg(&path)
                .spawn()
                .ok();
        }
        true
    } else {
        false
    }
}

#[tauri::command]
fn show_window(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.show();
        let _ = window.set_focus();
        let _ = window.unminimize();
    }
}

#[tauri::command]
fn hide_window(app: AppHandle) {
    if let Some(window) = app.get_webview_window("main") {
        let _ = window.hide();
    }
}

fn setup_logging() {
    let log_dir = dirs::data_local_dir()
        .unwrap_or_else(|| PathBuf::from("."))
        .join("Mahyar Image Tools")
        .join("logs");

    let _ = fs::create_dir_all(&log_dir);

    let file_appender = RollingFileAppender::new(Rotation::DAILY, log_dir, "app.log");

    let (non_blocking, _guard) = tracing_appender::non_blocking(file_appender);

    tracing_subscriber::registry()
        .with(EnvFilter::new("info"))
        .with(fmt::layer().with_writer(non_blocking))
        .with(fmt::layer().with_writer(std::io::stdout))
        .init();

    info!("Mahyar Image Tools starting...");
}

fn main() {
    setup_logging();

    std::panic::set_hook(Box::new(|panic_info| {
        error!("Application panic: {}", panic_info);
    }));

    let result = tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_clipboard_manager::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .plugin(tauri_plugin_notification::init())
        .plugin(tauri_plugin_global_shortcut::Builder::new().build())
        .plugin(tauri_plugin_single_instance::init(|app, _args, _cwd| {
            info!("Another instance tried to start, focusing existing window");
            if let Some(window) = app.get_webview_window("main") {
                let _ = window.show();
                let _ = window.set_focus();
            }
        }))
        .manage(AppState::default())
        .invoke_handler(tauri::generate_handler![
            capture_full_screen,
            save_screenshot,
            perform_ocr,
            get_settings,
            update_settings,
            get_save_path,
            set_save_path,
            open_save_folder,
            show_window,
            hide_window,
        ])
        .setup(|app| {
            info!("Setting up application");

            let show_item = MenuItem::with_id(app, "show", "نمایش / Show", true, None::<&str>)?;
            let fullscreen_item = MenuItem::with_id(app, "fullscreen", "اسکرین‌شات کامل / Full Screen", true, None::<&str>)?;
            let settings_item = MenuItem::with_id(app, "settings", "تنظیمات / Settings", true, None::<&str>)?;
            let quit_item = MenuItem::with_id(app, "quit", "خروج / Quit", true, None::<&str>)?;

            let menu = Menu::with_items(app, &[&show_item, &fullscreen_item, &settings_item, &quit_item])?;

            let icon_bytes = include_bytes!("../icons/icon.png");
            let icon = Image::from_bytes(icon_bytes).unwrap_or_else(|_| {
                Image::new_owned(vec![0u8; 32 * 32 * 4], 32, 32)
            });

            let _tray = TrayIconBuilder::new()
                .icon(icon)
                .menu(&menu)
                .tooltip("Mahyar Image Tools - Ctrl+Shift+X")
                .on_menu_event(|app, event| match event.id.as_ref() {
                    "show" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                    "fullscreen" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.emit("capture-fullscreen", ());
                        }
                    }
                    "settings" => {
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                            let _ = window.emit("open-settings", ());
                        }
                    }
                    "quit" => {
                        info!("User requested quit");
                        app.exit(0);
                    }
                    _ => {}
                })
                .on_tray_icon_event(|tray, event| {
                    if let TrayIconEvent::Click {
                        button: MouseButton::Left,
                        button_state: MouseButtonState::Up,
                        ..
                    } = event
                    {
                        let app = tray.app_handle();
                        if let Some(window) = app.get_webview_window("main") {
                            let _ = window.show();
                            let _ = window.set_focus();
                        }
                    }
                })
                .build(app)?;

            info!("Application setup complete");
            Ok(())
        })
        .run(tauri::generate_context!());

    if let Err(e) = result {
        error!("Error running application: {}", e);
        std::process::exit(1);
    }
}
