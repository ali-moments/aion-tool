AIONT00L — Network Command Center
Created by TheYoqaizo

Windows (real DNS / adapter changes)
------------------------------------
1. Unzip.
2. Right-click AIOT00L.exe → Run as administrator
   or AIOT00L.bat → Run as administrator
   or (if you have Python) python AIOT00L.py

The .exe launches the graphical PowerShell console and self-elevates.
Same operations as the original .bat, without typewriter delay:

  • Reset Adapter (flush, ip reset, disable/enable, release/renew, registerdns)
  • Set DNS (original providers + extras + custom)
  • Current DNS
  • Ping (default 4 packets, not 1000)
  • Reset DNS back to DHCP
  • DNS race (ICMP)

The browser preview cannot change Windows DNS. Use this kit on the PC.
