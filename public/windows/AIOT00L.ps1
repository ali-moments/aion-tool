# AIOT00L Network Command Center
# Created by TheYoqaizo
# Same protocol as the original .bat — without the slow typewriter delays.
$ErrorActionPreference = "Continue"

function Test-IsAdmin {
    $id = [Security.Principal.WindowsIdentity]::GetCurrent()
    $p = New-Object Security.Principal.WindowsPrincipal($id)
    return $p.IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
}

if (-not (Test-IsAdmin)) {
    $arg = "-NoProfile -ExecutionPolicy Bypass -File `"$PSCommandPath`""
    Start-Process -FilePath "powershell.exe" -Verb RunAs -ArgumentList $arg | Out-Null
    exit
}

Add-Type -AssemblyName PresentationFramework, PresentationCore, WindowsBase

$providers = @(
    @{ Name = "403"; A = "185.55.226.26"; B = "185.55.225.25" }
    @{ Name = "Shecan"; A = "178.22.122.100"; B = "185.51.200.2" }
    @{ Name = "Electro"; A = "78.157.42.100"; B = "78.157.42.101" }
    @{ Name = "Google DNS"; A = "8.8.8.8"; B = "8.8.4.4" }
    @{ Name = "Cloudflare"; A = "1.1.1.1"; B = "1.0.0.1" }
    @{ Name = "OpenDNS"; A = "208.67.222.222"; B = "208.67.220.220" }
    @{ Name = "Quad9"; A = "9.9.9.9"; B = "149.112.112.112" }
    @{ Name = "Comodo"; A = "8.26.56.26"; B = "8.20.247.20" }
    @{ Name = "CleanBrowsing"; A = "185.228.168.9"; B = "185.228.169.9" }
    @{ Name = "AdGuard"; A = "94.140.14.14"; B = "94.140.15.15" }
    @{ Name = "Yandex"; A = "77.88.8.8"; B = "77.88.8.1" }
    @{ Name = "403 Online"; A = "10.202.10.202"; B = "10.202.10.102" }
    @{ Name = "Radar Game"; A = "10.202.10.10"; B = "10.202.10.11" }
    @{ Name = "Shelter"; A = "185.86.136.241"; B = "185.86.136.242" }
    @{ Name = "Level3"; A = "4.2.2.4"; B = "4.2.2.1" }
)

function Get-AdapterNames {
    $names = @()
    try {
        $names = @(Get-NetAdapter | Select-Object -ExpandProperty Name)
    } catch { }
    if ($names.Count -eq 0) {
        $raw = netsh interface show interface
        foreach ($line in $raw) {
            if ($line -match "\s{2,}(.+)$" -and $line -notmatch "Admin State" -and $line -notmatch "^---") {
                $n = $Matches[1].Trim()
                if ($n -and $n -ne "Interface Name") { $names += $n }
            }
        }
    }
    return @($names | Where-Object { $_ })
}

$script:LogBox = $null
$script:IfaceBox = $null
$script:Status = $null

function Log-Line([string]$text) {
    $stamp = (Get-Date).ToString("HH:mm:ss")
    $line = "[$stamp] $text"
    if ($script:LogBox) {
        $script:LogBox.AppendText($line + "`r`n")
        $script:LogBox.ScrollToEnd()
    }
}

function Invoke-Tool([string]$cmd) {
    Log-Line "> $cmd"
    $psi = New-Object System.Diagnostics.ProcessStartInfo
    $psi.FileName = "cmd.exe"
    $psi.Arguments = "/c $cmd"
    $psi.RedirectStandardOutput = $true
    $psi.RedirectStandardError = $true
    $psi.UseShellExecute = $false
    $psi.CreateNoWindow = $true
    $p = [System.Diagnostics.Process]::Start($psi)
    $out = $p.StandardOutput.ReadToEnd()
    $err = $p.StandardError.ReadToEnd()
    $p.WaitForExit()
    $blob = ($out + $err).Trim()
    if ($p.ExitCode -ne 0) {
        Log-Line "FAILED ($($p.ExitCode))"
        if ($blob) { Log-Line $blob }
        return $false
    }
    Log-Line "OK"
    if ($blob) { Log-Line $blob }
    return $true
}

function Get-Iface {
    if ($script:IfaceBox -and $script:IfaceBox.SelectedItem) {
        return [string]$script:IfaceBox.SelectedItem
    }
    if ($script:IfaceBox) { return [string]$script:IfaceBox.Text }
    return "Ethernet"
}

function Set-Status([string]$text) {
    if ($script:Status) { $script:Status.Text = $text }
}

function Inject-Dns([string]$a, [string]$b) {
    $iface = Get-Iface
    Set-Status "Injecting DNS..."
    Invoke-Tool "netsh interface ip set dns `"$iface`" static $a" | Out-Null
    Invoke-Tool "netsh interface ip add dns `"$iface`" $b index=2" | Out-Null
    Log-Line "DNS injection complete: $a, $b"
    Set-Status "Ready"
}

function Reset-Adapter {
    $iface = Get-Iface
    Set-Status "Resetting adapter..."
    Invoke-Tool "ipconfig /flushdns" | Out-Null
    Invoke-Tool "netsh int ip reset" | Out-Null
    Invoke-Tool "netsh interface set interface `"$iface`" disable" | Out-Null
    Start-Sleep -Milliseconds 400
    Invoke-Tool "netsh interface set interface `"$iface`" enable" | Out-Null
    Invoke-Tool "ipconfig /release" | Out-Null
    Invoke-Tool "ipconfig /renew" | Out-Null
    Invoke-Tool "ipconfig /registerdns" | Out-Null
    Log-Line "Adapter and DNS reset executed."
    Set-Status "Ready"
}

function Reset-DnsDhcp {
    $iface = Get-Iface
    Set-Status "Resetting DNS..."
    Invoke-Tool "netsh interface ip set dnsservers `"$iface`" source=dhcp" | Out-Null
    Invoke-Tool "ipconfig /flushdns" | Out-Null
    Invoke-Tool "ipconfig /registerdns" | Out-Null
    Invoke-Tool "ipconfig /release" | Out-Null
    Invoke-Tool "ipconfig /renew" | Out-Null
    Invoke-Tool "netsh interface ip show config `"$iface`"" | Out-Null
    Log-Line "DNS reset complete."
    Set-Status "Ready"
}

function Show-CurrentDns {
    $iface = Get-Iface
    Invoke-Tool "netsh interface ip show dns `"$iface`"" | Out-Null
}

function Ping-Target([string]$hostName, [int]$count) {
    Set-Status "Pinging $hostName..."
    Invoke-Tool "ping $hostName -n $count" | Out-Null
    Set-Status "Ready"
}

function Race-Dns {
    Set-Status "Racing DNS..."
    Log-Line "DNS race (ICMP, 2 echoes)..."
    $rows = @()
    foreach ($p in $providers) {
        $sw = [Diagnostics.Stopwatch]::StartNew()
        $ok = Test-Connection -ComputerName $p.A -Count 2 -Quiet -ErrorAction SilentlyContinue
        $sw.Stop()
        $ms = [int]$sw.Elapsed.TotalMilliseconds
        $mark = if ($ok) { "$ms ms" } else { "timeout" }
        Log-Line ("{0,-16} {1,-16} {2}" -f $p.Name, $p.A, $mark)
        $rows += [pscustomobject]@{ Name = $p.Name; Ms = $(if ($ok) { $ms } else { 99999 }) }
    }
    $best = $rows | Sort-Object Ms | Select-Object -First 1
    if ($best.Ms -lt 99999) { Log-Line "Fastest: $($best.Name)" }
    Set-Status "Ready"
}

$bg = [Windows.Media.BrushConverter]::new().ConvertFrom("#FF070A09")
$surface = [Windows.Media.BrushConverter]::new().ConvertFrom("#FF0C1210")
$elev = [Windows.Media.BrushConverter]::new().ConvertFrom("#FF121A16")
$fg = [Windows.Media.BrushConverter]::new().ConvertFrom("#FFD4EDE0")
$muted = [Windows.Media.BrushConverter]::new().ConvertFrom("#FF7C9A8A")
$accent = [Windows.Media.BrushConverter]::new().ConvertFrom("#FF3EEA8A")
$border = [Windows.Media.BrushConverter]::new().ConvertFrom("#FF1A2A22")
$danger = [Windows.Media.BrushConverter]::new().ConvertFrom("#FFE85D5D")

function New-BrushButton([string]$label, $bgBrush, $fgBrush, [scriptblock]$click) {
    $b = New-Object Windows.Controls.Button
    $b.Content = $label
    $b.Background = $bgBrush
    $b.Foreground = $fgBrush
    $b.BorderBrush = $border
    $b.BorderThickness = 1
    $b.Padding = "12,8"
    $b.Margin = "0,0,8,8"
    $b.MinHeight = 36
    $b.Cursor = [Windows.Input.Cursors]::Hand
    $b.FontFamily = "Segoe UI"
    $b.FontSize = 13
    [void]$b.Add_Click($click)
    return $b
}

$win = New-Object Windows.Window
$win.Title = "AIOT00L  —  Network Command Center"
$win.Width = 980
$win.Height = 720
$win.MinWidth = 720
$win.MinHeight = 560
$win.WindowStartupLocation = "CenterScreen"
$win.Background = $bg
$win.Foreground = $fg
$win.FontFamily = "Segoe UI"

$root = New-Object Windows.Controls.DockPanel
$root.LastChildFill = $true
$root.Margin = 16

$header = New-Object Windows.Controls.StackPanel
$header.Margin = "0,0,0,12"
[Windows.Controls.DockPanel]::SetDock($header, "Top")

$title = New-Object Windows.Controls.TextBlock
$title.Text = "A I O T 0 0 L"
$title.FontFamily = "Consolas"
$title.FontSize = 28
$title.Foreground = $accent
$title.Margin = "0,0,0,2"

$sub = New-Object Windows.Controls.TextBlock
$sub.Text = "Network Command Center    ·    Created by TheYoqaizo    ·    Admin session"
$sub.Foreground = $muted
$sub.FontSize = 12

$row = New-Object Windows.Controls.StackPanel
$row.Orientation = "Horizontal"
$row.Margin = "0,10,0,0"

$lbl = New-Object Windows.Controls.TextBlock
$lbl.Text = "Interface"
$lbl.Foreground = $muted
$lbl.VerticalAlignment = "Center"
$lbl.Margin = "0,0,10,0"

$script:IfaceBox = New-Object Windows.Controls.ComboBox
$script:IfaceBox.MinWidth = 260
$script:IfaceBox.IsEditable = $true
$script:IfaceBox.Background = $elev
$script:IfaceBox.Foreground = $fg
$script:IfaceBox.BorderBrush = $border
$script:IfaceBox.Height = 32
Get-AdapterNames | ForEach-Object { [void]$script:IfaceBox.Items.Add($_) }
if ($script:IfaceBox.Items.Count -gt 0) { $script:IfaceBox.SelectedIndex = 0 }

$script:Status = New-Object Windows.Controls.TextBlock
$script:Status.Text = "Ready"
$script:Status.Foreground = $accent
$script:Status.VerticalAlignment = "Center"
$script:Status.Margin = "16,0,0,0"
$script:Status.FontFamily = "Consolas"

[void]$row.Children.Add($lbl)
[void]$row.Children.Add($script:IfaceBox)
[void]$row.Children.Add($script:Status)
[void]$header.Children.Add($title)
[void]$header.Children.Add($sub)
[void]$header.Children.Add($row)

$ops = New-Object Windows.Controls.WrapPanel
$ops.Margin = "0,0,0,8"
[Windows.Controls.DockPanel]::SetDock($ops, "Top")

[void]$ops.Children.Add((New-BrushButton "Reset Adapter" $danger $fg { Reset-Adapter }))
[void]$ops.Children.Add((New-BrushButton "Reset DNS (DHCP)" $elev $fg { Reset-DnsDhcp }))
[void]$ops.Children.Add((New-BrushButton "Flush DNS" $elev $fg { Invoke-Tool "ipconfig /flushdns" | Out-Null; Set-Status "Ready" }))
[void]$ops.Children.Add((New-BrushButton "Current DNS" $elev $fg { Show-CurrentDns }))
[void]$ops.Children.Add((New-BrushButton "Ping 4.2.2.4 x4" $elev $fg { Ping-Target "4.2.2.4" 4 }))
[void]$ops.Children.Add((New-BrushButton "Ping x10" $elev $fg { Ping-Target "4.2.2.4" 10 }))
[void]$ops.Children.Add((New-BrushButton "DNS Race" $accent $bg { Race-Dns }))

$dnsLabel = New-Object Windows.Controls.TextBlock
$dnsLabel.Text = "INJECT DNS"
$dnsLabel.Foreground = $muted
$dnsLabel.FontSize = 11
$dnsLabel.Margin = "0,4,0,6"
[Windows.Controls.DockPanel]::SetDock($dnsLabel, "Top")

$dnsWrap = New-Object Windows.Controls.WrapPanel
$dnsWrap.Margin = "0,0,0,8"
[Windows.Controls.DockPanel]::SetDock($dnsWrap, "Top")

foreach ($p in $providers) {
    $caption = "$($p.Name)  $($p.A)"
    $sb = [scriptblock]::Create("Inject-Dns '$($p.A)' '$($p.B)'")
    $btn = New-BrushButton $caption $elev $fg $sb
    [void]$dnsWrap.Children.Add($btn)
}

$customRow = New-Object Windows.Controls.StackPanel
$customRow.Orientation = "Horizontal"
$customRow.Margin = "0,0,0,10"
[Windows.Controls.DockPanel]::SetDock($customRow, "Top")

$boxA = New-Object Windows.Controls.TextBox
$boxA.Width = 160
$boxA.Height = 32
$boxA.Margin = "0,0,8,0"
$boxA.Background = $elev
$boxA.Foreground = $fg
$boxA.BorderBrush = $border
$boxA.Text = "1.1.1.1"
$boxA.VerticalContentAlignment = "Center"

$boxB = New-Object Windows.Controls.TextBox
$boxB.Width = 160
$boxB.Height = 32
$boxB.Margin = "0,0,8,0"
$boxB.Background = $elev
$boxB.Foreground = $fg
$boxB.BorderBrush = $border
$boxB.Text = "1.0.0.1"
$boxB.VerticalContentAlignment = "Center"

$customBtn = New-BrushButton "Apply custom DNS" $accent $bg {
    Inject-Dns $boxA.Text.Trim() $boxB.Text.Trim()
}
[void]$customRow.Children.Add($boxA)
[void]$customRow.Children.Add($boxB)
[void]$customRow.Children.Add($customBtn)

$script:LogBox = New-Object Windows.Controls.TextBox
$script:LogBox.IsReadOnly = $true
$script:LogBox.TextWrapping = "Wrap"
$script:LogBox.AcceptsReturn = $true
$script:LogBox.VerticalScrollBarVisibility = "Auto"
$script:LogBox.Background = $elev
$script:LogBox.Foreground = $accent
$script:LogBox.BorderBrush = $border
$script:LogBox.FontFamily = "Consolas"
$script:LogBox.FontSize = 12
$script:LogBox.Padding = 10

[void]$root.Children.Add($header)
[void]$root.Children.Add($ops)
[void]$root.Children.Add($dnsLabel)
[void]$root.Children.Add($dnsWrap)
[void]$root.Children.Add($customRow)
[void]$root.Children.Add($script:LogBox)
$win.Content = $root

Log-Line "AIOT00L online. Interface list loaded."
Log-Line "Original protocol preserved. Cosmetic delays removed."

[void]$win.ShowDialog()
