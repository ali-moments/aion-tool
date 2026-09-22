export interface ProtocolStep {
  id: string;
  message: string;
  messageFa: string;
  cmd: string;
  waitMs?: number;
  waitAfterMs?: number;
}

export function setDnsSteps(iface: string, dns1: string, dns2: string): ProtocolStep[] {
  return [
    {
      id: "primary",
      message: `Injecting Primary DNS: ${dns1}...`,
      messageFa: `تزریق DNS اصلی: ${dns1}...`,
      cmd: `netsh interface ip set dns "${iface}" static ${dns1}`,
      waitAfterMs: 500,
    },
    {
      id: "secondary",
      message: `Injecting Secondary DNS: ${dns2}...`,
      messageFa: `تزریق DNS فرعی: ${dns2}...`,
      cmd: `netsh interface ip add dns "${iface}" ${dns2} index=2`,
    },
  ];
}

export function adapterResetSteps(iface: string): ProtocolStep[] {
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
      cmd: `netsh interface set interface "${iface}" disable`,
      waitAfterMs: 1000,
    },
    {
      id: "enable",
      message: "Enabling network adapter...",
      messageFa: "روشن کردن آداپتور...",
      cmd: `netsh interface set interface "${iface}" enable`,
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
  return [
    {
      id: "dhcp",
      message: "Clearing DNS settings...",
      messageFa: "پاک کردن DNS ثابت...",
      cmd: `netsh interface ip set dnsservers "${iface}" source=dhcp`,
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
  const verb = enable ? "Enabling" : "Disabling";
  const verbFa = enable ? "روشن کردن" : "خاموش کردن";
  const flag = enable ? "enable" : "disable";
  return [
    {
      id: flag,
      message: `${verb} network adapter...`,
      messageFa: `${verbFa} آداپتور...`,
      cmd: `netsh interface set interface "${iface}" ${flag}`,
    },
  ];
}

export function currentDnsCmd(iface: string) {
  return `netsh interface ip show dns "${iface}"`;
}

export function applyScript(iface: string, dns1: string, dns2: string) {
  return [
    "# AIOT00L — apply DNS (run PowerShell as Administrator)",
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
