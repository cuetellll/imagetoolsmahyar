// Mahyar Image Tools - Frontend JavaScript
const { invoke } = window.__TAURI__.core;
const { listen } = window.__TAURI__.event;

let currentImage = null;
let currentText = '';
let settings = {
    hotkey: 'Ctrl+Shift+X',
    savePath: '',
    autoCopyText: true,
    showNotifications: true
};

// Initialize app
document.addEventListener('DOMContentLoaded', async () => {
    await loadSettings();
    await setupEventListeners();
});

// Load settings from backend
async function loadSettings() {
    try {
        settings = await invoke('get_settings');
        document.getElementById('savePath').textContent = settings.savePath;
        document.getElementById('pathInput').value = settings.savePath;
        document.getElementById('hotkeyDisplay').textContent = settings.hotkey;
        document.getElementById('shortcutInput').value = settings.hotkey;

        updateToggle('autoCopyToggle', settings.autoCopyText);
        updateToggle('notifyToggle', settings.showNotifications);
    } catch (e) {
        console.error('Failed to load settings:', e);
    }
}

// Setup event listeners
async function setupEventListeners() {
    // Listen for capture fullscreen event from system tray
    await listen('capture-fullscreen', () => {
        captureFullScreen();
    });

    // Listen for open settings event
    await listen('open-settings', () => {
        openSettings();
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
        if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'x') {
            e.preventDefault();
            captureFullScreen();
        }
    });
}

// Update toggle state
function updateToggle(id, active) {
    const toggle = document.getElementById(id);
    if (active) {
        toggle.classList.add('active');
    } else {
        toggle.classList.remove('active');
    }
}

// Capture full screen
async function captureFullScreen() {
    showLoading(true);

    try {
        const result = await invoke('capture_full_screen');

        if (result.success && result.image_base64) {
            currentImage = result.image_base64;
            displayImage('data:image/png;base64,' + result.image_base64);
            showToast('اسکرین‌شات گرفته شد', 'success');

            // Auto perform OCR
            await performOCR();
        } else {
            showToast(result.error || 'خطا در گرفتن اسکرین‌شات', 'error');
        }
    } catch (e) {
        showToast('خطا: ' + e, 'error');
    } finally {
        showLoading(false);
    }
}

// Display image in preview
function displayImage(src) {
    const previewArea = document.getElementById('previewArea');
    const previewImage = document.getElementById('previewImage');
    const placeholder = document.getElementById('placeholder');

    previewImage.src = src;
    previewImage.classList.add('visible');
    placeholder.style.display = 'none';
    previewArea.classList.add('has-image');
}

// Save image
async function saveImage() {
    if (!currentImage) {
        showToast('ابتدا یک اسکرین‌شات بگیرید', 'error');
        return;
    }

    showLoading(true);

    try {
        const result = await invoke('save_screenshot', { imageBase64: currentImage });

        if (result.success && result.path) {
            showToast('تصویر ذخیره شد', 'success');
        } else {
            showToast(result.error || 'خطا در ذخیره تصویر', 'error');
        }
    } catch (e) {
        showToast('خطا: ' + e, 'error');
    } finally {
        showLoading(false);
    }
}

// Copy image to clipboard
async function copyImage() {
    if (!currentImage) {
        showToast('ابتدا یک اسکرین‌شات بگیرید', 'error');
        return;
    }

    try {
        const binaryString = atob(currentImage);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
            bytes[i] = binaryString.charCodeAt(i);
        }

        await navigator.clipboard.write([
            new ClipboardItem({
                'image/png': new Blob([bytes], { type: 'image/png' })
            })
        ]);

        showToast('تصویر کپی شد', 'success');
    } catch (e) {
        console.error('Copy failed:', e);
        showToast('خطا در کپی تصویر', 'error');
    }
}

// Perform OCR
async function performOCR() {
    if (!currentImage) {
        showToast('ابتدا یک اسکرین‌شات بگیرید', 'error');
        return;
    }

    showLoading(true);

    try {
        const result = await invoke('perform_ocr', { imageBase64: currentImage });

        if (result.success && result.text) {
            currentText = result.text;
            document.getElementById('ocrResult').textContent = currentText;

            if (settings.autoCopyText) {
                await copyTextToClipboard(currentText);
                showToast('متن استخراج و کپی شد', 'success');
            } else {
                showToast('متن استخراج شد', 'success');
            }
        } else {
            document.getElementById('ocrResult').textContent = 'متنی یافت نشد یا خطایی رخ داده است.';
            showToast(result.error || 'خطا در استخراج متن', 'error');
        }
    } catch (e) {
        showToast('خطا: ' + e, 'error');
    } finally {
        showLoading(false);
    }
}

// Copy text
async function copyText() {
    if (!currentText) {
        showToast('ابتدا متنی استخراج کنید', 'error');
        return;
    }

    await copyTextToClipboard(currentText);
    showToast('متن کپی شد', 'success');
}

// Copy text to clipboard helper
async function copyTextToClipboard(text) {
    try {
        await navigator.clipboard.writeText(text);
    } catch (e) {
        console.error('Failed to copy text:', e);
    }
}

// Open folder
async function openFolder() {
    try {
        await invoke('open_save_folder');
    } catch (e) {
        showToast('خطا در باز کردن پوشه', 'error');
    }
}

// Settings panel
function openSettings() {
    document.getElementById('settingsPanel').classList.add('open');
}

function closeSettings() {
    document.getElementById('settingsPanel').classList.remove('open');
}

// Browse folder
async function browseFolder() {
    // This would use Tauri's dialog plugin
    showToast('برای تغییر مسیر، پوشه را در تنظیمات وارد کنید', 'info');
}

// Toggle settings
async function toggleSetting(key) {
    const toggle = document.getElementById(
        key === 'autoCopy' ? 'autoCopyToggle' : 'notifyToggle'
    );

    if (key === 'autoCopy') {
        settings.autoCopyText = !settings.autoCopyText;
        toggle.classList.toggle('active', settings.autoCopyText);
    } else {
        settings.showNotifications = !settings.showNotifications;
        toggle.classList.toggle('active', settings.showNotifications);
    }

    try {
        await invoke('update_settings', { newSettings: settings });
    } catch (e) {
        console.error('Failed to save settings:', e);
    }
}

// Minimize window
async function minimizeWindow() {
    try {
        await invoke('hide_window');
    } catch (e) {
        console.error('Failed to minimize:', e);
    }
}

// Show loading
function showLoading(show) {
    const overlay = document.getElementById('loadingOverlay');
    if (show) {
        overlay.classList.add('show');
    } else {
        overlay.classList.remove('show');
    }
}

// Show toast notification
function showToast(message, type = 'success') {
    const toast = document.getElementById('toast');
    const icon = document.getElementById('toastIcon');
    const msg = document.getElementById('toastMessage');

    msg.textContent = message;

    if (type === 'success') {
        icon.textContent = '✓';
        toast.className = 'toast success';
    } else if (type === 'error') {
        icon.textContent = '✕';
        toast.className = 'toast error';
    } else {
        icon.textContent = 'ℹ';
        toast.className = 'toast';
    }

    toast.classList.add('show');

    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}

// Make functions available globally
window.captureFullScreen = captureFullScreen;
window.saveImage = saveImage;
window.copyImage = copyImage;
window.copyText = copyText;
window.performOCR = performOCR;
window.openFolder = openFolder;
window.openSettings = openSettings;
window.closeSettings = closeSettings;
window.browseFolder = browseFolder;
window.toggleSetting = toggleSetting;
window.minimizeWindow = minimizeWindow;
