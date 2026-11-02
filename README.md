# Mahyar Image Tools 📷

<div align="center">

**A lightweight, beautiful screenshot and OCR tool for Windows**

*Built with ❤️ by Mahyar*

</div>

---

## ✨ Features

### 🖼️ Screenshot Capture
- Full screen capture with global hotkey
- High-quality PNG output
- Beautiful preview with glass UI

### 🔍 OCR (Optical Character Recognition)
- Extract text from screenshots
- Support for English and Persian text
- One-click copy to clipboard

### 🎨 Modern UI
- Glass morphism design
- Smooth animations
- Coffee & Gold color theme
- Responsive layout

### ⚡ Quick Actions
- System tray integration
- Always ready when you need it
- Customizable hotkey
- Multiple export options

---

## 🚀 CI/CD with GitHub Actions

This project uses GitHub Actions for automatic builds on every push and release.

### What Gets Built:

| Artifact | Description | When |
|----------|-------------|------|
| `MahyarImageTools.exe` | Portable version (no install needed) | Every push |
| Setup `.exe` | NSIS installer | Every push |
| Setup `.msi` | MSI installer for enterprise | Every push |

### Creating a Release:

1. **Simple way** - Push a tag:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```

2. **Or use GitHub UI**:
   - Go to Releases → Draft a new release
   - Add version tag (e.g., `v1.0.0`)
   - Publish release

### Download Build Artifacts:

After any push to `main`, go to the **Actions** tab → select a workflow run → download artifacts from the Summary page.

---

## 🚀 Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) 18+
- [Rust](https://rustup.rs/) 1.70+
- [Tauri CLI](https://v2.tauri.app/start/prerequisites/)

### Installation

```bash
# Install dependencies
npm install

# Run in development mode
npm run dev

# Build for production
npm run build
```

### Building

```bash
# Build portable EXE (no installation needed)
npm run build:portable

# Build installer (NSIS)
npm run build:nsis
```

---

## ⌨️ Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| `Ctrl + Shift + X` | Capture full screen |
| Window close button | Minimize to tray |

---

## 📁 Project Structure

```
mahyar-image-tools/
├── src/                    # Frontend files
│   ├── index.html         # Main UI
│   └── app.js             # JavaScript logic
├── src-tauri/             # Rust backend
│   ├── src/
│   │   └── main.rs        # Tauri commands & system tray
│   ├── Cargo.toml         # Rust dependencies
│   └── tauri.conf.json   # Tauri configuration
├── package.json           # NPM scripts
└── README.md             # This file
```

---

## 🎯 Usage

1. **Start the app** - It will minimize to system tray
2. **Take screenshots** - Press `Ctrl+Shift+X` or click the tray icon
3. **Extract text** - Click "استخراج متن" to run OCR
4. **Copy & paste** - One click to copy image or text

---

## 🛠️ Tech Stack

- **Frontend**: HTML5, CSS3 (Glass UI), Vanilla JavaScript
- **Backend**: Rust + Tauri v2
- **Screenshot**: screenshots-rs crate
- **OCR**: Custom implementation with base64 encoding

---

## 📝 License

This project is for personal use. Feel free to modify and distribute.

---

## 🤝 Contributing

Contributions, issues, and feature requests are welcome!

---

<div align="center">

**Made with ❤️ using Tauri**

</div>
