$ErrorActionPreference = 'Continue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
$out = 'C:\College\SIH2\.ohmyagent\tiles'
New-Item -ItemType Directory -Force -Path $out | Out-Null

function Grab([string]$name, [string]$url, [hashtable]$h) {
  $file = Join-Path $out ($name + '.bin')
  try {
    Invoke-WebRequest -Uri $url -Headers $h -TimeoutSec 30 -UseBasicParsing -OutFile $file -ErrorAction Stop
    $b = [IO.File]::ReadAllBytes($file)
    $sig = ($b[0..7] | ForEach-Object { $_.ToString('x2') }) -join ' '
    $dim = ''
    if ($b.Length -gt 33 -and $b[0] -eq 0x89 -and $b[1] -eq 0x50) {
      $w = [int]$b[16]*16777216 + [int]$b[17]*65536 + [int]$b[18]*256 + [int]$b[19]
      $hh = [int]$b[20]*16777216 + [int]$b[21]*65536 + [int]$b[22]*256 + [int]$b[23]
      $dim = " png=${w}x${hh}"
    }
    Write-Output ("{0}: bytes={1}{2} sig={3}" -f $name, $b.Length, $dim, $sig)
  } catch {
    Write-Output ("{0}: FAILED {1}" -f $name, $_.Exception.Message)
  }
}

$base = @{ 'User-Agent' = $ua }
$chrome = @{
  'User-Agent' = $ua
  'Accept' = 'image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8'
  'Accept-Language' = 'en-US,en;q=0.9'
  'Referer' = 'http://127.0.0.1:5000/'
  'Sec-Fetch-Dest' = 'image'
  'Sec-Fetch-Mode' = 'no-cors'
  'Sec-Fetch-Site' = 'cross-site'
  'sec-ch-ua' = '"Chromium";v="128", "Not;A=Brand";v="24"'
  'sec-ch-ua-mobile' = '?0'
  'sec-ch-ua-platform' = '"Windows"'
}

Write-Output '--- OSM, no referer ---'
Grab 'osm_noref' 'https://a.tile.openstreetmap.org/11/1451/1009.png' $base
Write-Output '--- OSM, Chrome-like (referer from localhost) ---'
Grab 'osm_chrome' 'https://a.tile.openstreetmap.org/11/1451/1009.png' $chrome
Write-Output '--- CARTO, Chrome-like ---'
Grab 'carto_chrome' 'https://a.basemaps.cartocdn.com/light_all/11/1451/1009.png' $chrome
Write-Output '--- Esri, Chrome-like ---'
Grab 'esri_chrome' 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/11/1009/1451' $chrome

Write-Output ''
Write-Output '=== Proxy configuration ==='
$p = Get-ItemProperty -Path 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Internet Settings' -ErrorAction SilentlyContinue
Write-Output ("ProxyEnable = {0}" -f $p.ProxyEnable)
Write-Output ("ProxyServer = {0}" -f $p.ProxyServer)
Write-Output ("AutoConfigURL = {0}" -f $p.AutoConfigURL)
Write-Output ("Env HTTP_PROXY = {0} / HTTPS_PROXY = {1}" -f $env:HTTP_PROXY, $env:HTTPS_PROXY)
$ie = netsh winhttp show proxy 2>&1
Write-Output ($ie -join ' ')
Write-Output ''
Write-Output '=== DNS resolution for tile hosts ==='
foreach ($h in @('a.tile.openstreetmap.org','a.basemaps.cartocdn.com','server.arcgisonline.com','cdn.jsdelivr.net')) {
  try {
    $a = [System.Net.Dns]::GetHostAddresses($h) | ForEach-Object { $_.IPAddressToString }
    Write-Output ("{0} -> {1}" -f $h, ($a -join ', '))
  } catch { Write-Output ("{0} -> DNS FAIL {1}" -f $h, $_.Exception.Message) }
}
