# AION TOOL

**Network Command Center** — DNS Management, Adapter Control & Network Utilities

A powerful Electron-based desktop application for managing DNS settings, network adapters, and running network diagnostics on Windows.

![AION TOOL](https://img.shields.io/badge/version-1.0.0-3eea8a?style=flat-square)
![Platform](https://img.shields.io/badge/platform-Windows-blue?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)

---

## ✨ Features

### 🌐 DNS Management
- **Quick DNS Switching** - Switch between 15+ pre-configured DNS providers (Cloudflare, Google, Shecan, 403, Electro, etc.)
- **Custom DNS** - Set your own primary and secondary DNS servers
- **DNS Profiles** - Filter by category: Iran, Global, Gaming, Privacy, Ad-blocking, Family-safe
- **One-Click Apply** - Instant DNS configuration with visual feedback

### ⚙️ Network Operations
- **Adapter Reset** - Full network adapter reset (flush, IP reset, disable/enable, renew)
- **DNS Reset** - Restore DHCP and re-register DNS
- **Flush DNS** - Quick DNS cache flush
- **Adapter Control** - Enable/disable network adapters
- **Current DNS Display** - View active DNS configuration

### 🏓 Network Diagnostics
- **Ping Tool** - Test connectivity with customizable ping count (1-100)
- **DNS Race** - Compare response times across all DNS providers
- **Real-time Results** - Live updates as tests run
- **Statistics** - View sent, received, loss percentage, and average latency

### 🎨 Modern UI
- Cyberpunk-inspired dark theme
- Bilingual interface (فارسی / English)
- Responsive design for all screen sizes
- Custom minimal scrollbars
- Real-time status indicators

---

## 📦 Installation

### For Users

Download the latest installer from the [Releases](https://github.com/TheYoqaizo/aion-tool/releases) page:

- **Windows**: `AION-TOOL-Setup-x.x.x.exe`

Run the installer and follow the on-screen instructions.

> **Note**: The application requires administrator privileges to modify network settings.

---

## 🛠️ Development Setup

### Prerequisites

- **Node.js** v18 or higher
- **pnpm** v8 or higher (required)
- **Windows OS** (for full functionality)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/TheYoqaizo/aion-tool.git
   cd aion-tool
   ```

2. **Install pnpm** (if not already installed)
   ```bash
   npm install -g pnpm
   ```

3. **Install dependencies**
   ```bash
   pnpm install
   ```

### Development

#### Run in Browser (Dev Mode)
```bash
pnpm dev
```
This starts the Vite dev server at `http://localhost:8080`

> **Note**: Network commands will not execute in browser mode - use Electron for full functionality.

#### Run in Electron (Dev Mode)
```bash
pnpm electron:dev
```
This builds the app and launches it in Electron with full network capabilities.

#### Type Checking
```bash
pnpm typecheck
```

#### Linting
```bash
pnpm lint
```

#### Format Code
```bash
pnpm format
```

### Building

#### Build for Windows
```bash
pnpm electron:build
```
Creates installer in `release/` directory:
- `AION TOOL Setup x.x.x.exe` - Installer
- `win-unpacked/AION TOOL x.x.x.exe` - Portable executable

#### Build for All Platforms
```bash
pnpm electron:build:all
```
Creates builds for Windows, macOS, and Linux.

> **Note**: Building for macOS/Linux requires appropriate OS or CI/CD setup.

---

## 🏗️ Project Structure

```
aion-tool/
├── electron/           # Electron main process
│   ├── main.js        # Main entry point
│   ├── preload.js     # Preload script (IPC bridge)
│   └── server.js      # Dev server for Electron
├── src/
│   ├── components/    # React components
│   │   ├── dns-panel.tsx
│   │   ├── ops-panel.tsx
│   │   ├── ping-panel.tsx
│   │   ├── race-panel.tsx
│   │   └── ui/        # Reusable UI components
│   ├── lib/
│   │   ├── protocols.ts    # Network command protocols
│   │   ├── runner.ts       # Command execution
│   │   ├── store.ts        # Zustand state management
│   │   ├── dns-providers.ts # DNS provider configs
│   │   └── i18n.ts         # Internationalization
│   ├── routes/        # TanStack Router routes
│   ├── styles.css     # Global styles (Tailwind)
│   └── main.tsx       # App entry point
├── public/            # Static assets
└── package.json
```

---

## 🔧 Technology Stack

- **Frontend**: React 19, TanStack Router
- **Styling**: Tailwind CSS 4
- **Desktop**: Electron 33
- **State**: Zustand with persistence
- **Build**: Vite, electron-builder
- **Language**: TypeScript

---

## 🚀 Key Scripts

| Command | Description |
|---------|-------------|
| `pnpm dev` | Start Vite dev server |
| `pnpm build` | Build for production |
| `pnpm electron:dev` | Build and run in Electron |
| `pnpm electron:build` | Create Windows installer |
| `pnpm typecheck` | Run TypeScript checks |
| `pnpm lint` | Lint code with ESLint |
| `pnpm format` | Format with Prettier |

---

## 🔐 Security

- Command validation whitelist (only `netsh`, `ipconfig`, `ping`)
- Context isolation enabled in Electron
- No direct Node.js access from renderer
- Secure IPC communication via preload script

---

## 🤝 Contributing

Contributions are welcome! Please follow these steps:

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

### Development Guidelines

- Use **pnpm** for package management
- Follow existing code style
- Run `pnpm typecheck` and `pnpm lint` before committing
- Test changes in both browser and Electron modes
- Update documentation for new features

---

## 📝 License

This project is licensed under the MIT License - see the LICENSE file for details.

---

## 👤 Author

**TheYoqaizo**

- GitHub: [@TheYoqaizo](https://github.com/TheYoqaizo)

---

## 🙏 Acknowledgments

- DNS providers (Cloudflare, Google, Shecan, 403, Electro, and others)
- Community feedback and testing
- Open source libraries used in this project

---

## 📸 Screenshots

### DNS Management
Switch between DNS providers with a single click.

### Network Operations
Full control over network adapters and DNS settings.

### Ping & Diagnostics
Test connectivity and compare DNS provider performance.

---

## ⚠️ Disclaimer

This tool modifies system network settings. Use at your own risk. Always ensure you have a backup of your current network configuration.

---

## 🐛 Bug Reports & Feature Requests

Found a bug or have a feature request? Please open an issue on the [GitHub Issues](https://github.com/TheYoqaizo/aion-tool/issues) page.

---

**Made with ❤️ by TheYoqaizo**
