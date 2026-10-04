export interface ProtocolStep {
  id: string;
  message: string;
  messageFa: string;
  cmd: string;
  waitMs?: number;
  waitAfterMs?: number;
}

// Security: Sanitization functions to prevent command injection
function sanitizeInterface(iface: string): string {
  // Only allow alphanumeric characters, spaces, hyphens, underscores, and parentheses
  // This covers most legitimate Windows network interface names
  return iface.replace(/[^a-zA-Z0-9 \-_()]/g, "").trim().substring(0, 100);
}

function sanitizeDnsIp(ip: string): string {
  // Only allow valid IPv4 format: digits and dots
  return ip.replace(/[^0-9.]/g, "").trim();
}

export function sanitizeHost(host: string): string {
  // Allow valid hostname/IP characters: alphanumeric, dots, hyphens, colons (IPv6)
  return host.replace(/[^a-zA-Z0-9.\-:]/g, "").trim().substring(0, 253);
}

export function setDnsSteps(iface: string, dns1: string, dns2: string): ProtocolStep[] {
  const safeIface = sanitizeInterface(iface);
  const safeDns1 = sanitizeDnsIp(dns1);
  const safeDns2 = sanitizeDnsIp(dns2);
  
  return [
    {
      id: "primary",
      message: `Injecting Primary DNS: ${dns1}...`,
      messageFa: `تزریق DNS اصلی: ${dns1}...`,
      cmd: `netsh interface ip set dns "${safeIface}" static ${safeDns1}`,
      waitAfterMs: 50, // Reduced from 200ms for fast mode
    },
    {
      id: "secondary",
      message: `Injecting Secondary DNS: ${dns2}...`,
      messageFa: `تزریق DNS فرعی: ${dns2}...`,
      cmd: `netsh interface ip add dns "${safeIface}" ${safeDns2} index=2`,
      waitAfterMs: 25, // Minimal delay for command completion
    },
  ];
}

export function setDnsOptimizedSteps(iface: string, dns1: string, dns2: string): ProtocolStep[] {
  const safeIface = sanitizeInterface(iface);
  const safeDns1 = sanitizeDnsIp(dns1);
  const safeDns2 = sanitizeDnsIp(dns2);
  
  return [
    {
      id: "primary",
      message: `Injecting Primary DNS: ${dns1}...`,
      messageFa: `تزریق DNS اصلی: ${dns1}...`,
      cmd: `netsh interface ip set dns "${safeIface}" static ${safeDns1}`,
      waitAfterMs: 500,
    },
    {
      id: "secondary",
      message: `Injecting Secondary DNS: ${dns2}...`,
      messageFa: `تزریق DNS فرعی: ${dns2}...`,
      cmd: `netsh interface ip add dns "${safeIface}" ${safeDns2} index=2`,
      waitAfterMs: 300,
    },
    {
      id: "flush",
      message: "Flushing DNS cache...",
      messageFa: "پاک‌سازی کش DNS...",
      cmd: "ipconfig /flushdns",
      waitAfterMs: 200,
    },
    {
      id: "release",
      message: "Releasing IP configuration...",
      messageFa: "آزادسازی IP...",
      cmd: "ipconfig /release",
      waitAfterMs: 500,
    },
    {
      id: "renew",
      message: "Renewing IP configuration...",
      messageFa: "تجدید IP...",
      cmd: "ipconfig /renew",
      waitAfterMs: 500,
    },
    {
      id: "register",
      message: "Registering DNS...",
      messageFa: "ثبت مجدد DNS...",
      cmd: "ipconfig /registerdns",
    },
  ];
}

export function adapterResetSteps(iface: string): ProtocolStep[] {
  const safeIface = sanitizeInterface(iface);
  
  return [
    {
      id: "flush",
      message: "Wiping DNS cache...",
      messageFa: "پاک‌سازی کش DNS...",
      cmd: "ipconfig /flushdns",
      waitAfterMs: 200,
    },
    {
      id: "ipreset",
      message: "Resetting IP configuration...",
      messageFa: "ریست پیکربندی IP...",
      cmd: "netsh int ip reset",
      waitAfterMs: 500,
    },
    {
      id: "disable",
      message: "Disabling network adapter...",
      messageFa: "خاموش کردن آداپتور...",
      cmd: `netsh interface set interface "${safeIface}" disable`,
      waitAfterMs: 1000,
    },
    {
      id: "enable",
      message: "Enabling network adapter...",
      messageFa: "روشن کردن آداپتور...",
      cmd: `netsh interface set interface "${safeIface}" enable`,
      waitAfterMs: 2000,
    },
    {
      id: "release",
      message: "Releasing IP...",
      messageFa: "رهاسازی IP...",
      cmd: "ipconfig /release",
      waitAfterMs: 500,
    },
    {
      id: "renew",
      message: "Renewing IP...",
      messageFa: "دریافت IP جدید...",
      cmd: "ipconfig /renew",
      waitAfterMs: 500,
    },
    {
      id: "register",
      message: "Registering DNS...",
      messageFa: "ثبت مجدد DNS...",
      cmd: "ipconfig /registerdns",
    },
  ];
}

export function resetDnsSteps(iface: string): ProtocolStep[] {
  const safeIface = sanitizeInterface(iface);
  
  return [
    {
      id: "dhcp",
      message: "Clearing DNS settings...",
      messageFa: "پاک کردن DNS ثابت...",
      cmd: `netsh interface ip set dnsservers "${safeIface}" source=dhcp`,
    },
    {
      id: "flush",
      message: "Resetting network protocols...",
      messageFa: "ریست پروتکل شبکه...",
      cmd: "ipconfig /flushdns",
    },
    {
      id: "register",
      message: "Registering DNS...",
      messageFa: "ثبت مجدد DNS...",
      cmd: "ipconfig /registerdns",
    },
    {
      id: "release",
      message: "Releasing IP...",
      messageFa: "قطع IP...",
      cmd: "ipconfig /release",
    },
    {
      id: "renew",
      message: "Renewing IP...",
      messageFa: "اتصال دوباره IP...",
      cmd: "ipconfig /renew",
    },
    {
      id: "show",
      message: `Displaying final config for ${iface}...`,
      messageFa: `نمایش کانفیگ نهایی ${iface}...`,
      cmd: `netsh interface ip show config "${iface}"`,
    },
  ];
}

export function flushOnlySteps(): ProtocolStep[] {
  return [
    {
      id: "flush",
      message: "Wiping DNS cache...",
      messageFa: "پاک‌سازی کش DNS...",
      cmd: "ipconfig /flushdns",
    },
  ];
}

export function toggleAdapterSteps(iface: string, enable: boolean): ProtocolStep[] {
  const safeIface = sanitizeInterface(iface);
  const verb = enable ? "Enabling" : "Disabling";
  const verbFa = enable ? "روشن کردن" : "خاموش کردن";
  const flag = enable ? "enable" : "disable";
  return [
    {
      id: flag,
      message: `${verb} network adapter...`,
      messageFa: `${verbFa} آداپتور...`,
      cmd: `netsh interface set interface "${safeIface}" ${flag}`,
    },
  ];
}

export function currentDnsCmd(iface: string) {
  const safeIface = sanitizeInterface(iface);
  return `netsh interface ip show dns "${safeIface}"`;
}

/**
 * Verify DNS configuration by reading actual system state
 * @param iface - Network interface name
 * @param expectedDns1 - Expected primary DNS
 * @param expectedDns2 - Expected secondary DNS
 * @returns Promise<{success: boolean, actualDns?: {primary?: string, secondary?: string}, error?: string}>
 */
export async function verifyDnsConfiguration(iface: string, expectedDns1?: string, expectedDns2?: string): Promise<{
  success: boolean;
  actualDns?: { primary?: string; secondary?: string };
  error?: string;
}> {
  try {
    if (typeof window === "undefined" || !window.electronAPI?.executeCommand) {
      return { success: false, error: "IPC not available for verification" };
    }

    const cmd = currentDnsCmd(iface);
    const result = await window.electronAPI.executeCommand(cmd);

    if (!result.success || !result.output) {
      return { success: false, error: result.error || "Failed to read DNS configuration" };
    }

    // Parse the netsh output to extract DNS servers
    const lines = result.output.split(/\r?\n/);
    const actualDns: { primary?: string; secondary?: string } = {};

    for (const line of lines) {
      const trimmed = line.trim();
      // Look for patterns like "Statically Configured DNS Servers: 1.1.1.1"
      if (trimmed.includes("DNS Servers") || trimmed.includes("dns")) {
        const ipMatch = trimmed.match(/(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})/);
        if (ipMatch) {
          if (!actualDns.primary) {
            actualDns.primary = ipMatch[1];
          } else if (!actualDns.secondary) {
            actualDns.secondary = ipMatch[1];
          }
        }
      }
      // Also check individual lines that might just be IP addresses
      else if (/^\s*\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\s*$/.test(trimmed)) {
        if (!actualDns.primary) {
          actualDns.primary = trimmed;
        } else if (!actualDns.secondary) {
          actualDns.secondary = trimmed;
        }
      }
    }

    // Verify expected values if provided
    let verificationPassed = true;
    if (expectedDns1 && actualDns.primary !== expectedDns1) {
      verificationPassed = false;
    }
    if (expectedDns2 && actualDns.secondary !== expectedDns2) {
      verificationPassed = false;
    }

    return {
      success: verificationPassed,
      actualDns,
      error: verificationPassed ? undefined : "DNS configuration does not match expected values"
    };

  } catch (error) {
    return {
      success: false,
      error: error instanceof Error ? error.message : "Unknown verification error"
    };
  }
}

export function applyScript(iface: string, dns1: string, dns2: string) {
  return [
    "# AION TOOL — apply DNS (run PowerShell as Administrator)",
    `$iface = ${JSON.stringify(iface)}`,
    `netsh interface ip set dns $iface static ${dns1}`,
    `netsh interface ip add dns $iface ${dns2} index=2`,
    "ipconfig /flushdns",
    `netsh interface ip show dns $iface`,
  ].join("\r\n");
}

const IPV4 =
  /^(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)$/;

export function isIpv4(value: string) {
  return IPV4.test(value.trim());
}
