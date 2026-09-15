$ErrorActionPreference = 'Continue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12
$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'
$url = 'https://a.tile.openstreetmap.org/11/1451/1009.png'

function Size([string]$label, [hashtable]$h) {
  $tmp = Join-Path $env:TEMP 't.png'
  try {
    Invoke-WebRequest -Uri $url -Headers $h -TimeoutSec 30 -UseBasicParsing -OutFile $tmp -ErrorAction Stop
    $b = [IO.File]::ReadAllBytes($tmp)
    $dim = ''
    if ($b.Length -gt 33) {
      $w = [int]$b[16]*16777216 + [int]$b[17]*65536 + [int]$b[18]*256 + [int]$b[19]
      $hh = [int]$b[20]*16777216 + [int]$b[21]*65536 + [int]$b[22]*256 + [int]$b[23]
      $dim = " ${w}x${hh}"
    }
    $status = if ($b.Length -gt 500) { 'REAL TILE' } else { 'BLANK/BLOCKED' }
    Write-Output ("{0,-46} len={1,-7} {2}{3}" -f $label, $b.Length, $status, $dim)
  } catch {
    Write-Output ("{0,-46} FAILED {1}" -f $label, $_.Exception.Message)
  }
}

$base = @{ 'User-Agent' = $ua }
Size 'UA only' $base
Size 'UA + Accept' (@{ 'User-Agent'=$ua; 'Accept'='image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8' })
Size 'UA + Accept-Language' (@{ 'User-Agent'=$ua; 'Accept-Language'='en-US,en;q=0.9' })
Size 'UA + Referer localhost' (@{ 'User-Agent'=$ua; 'Referer'='http://127.0.0.1:5000/' })
Size 'UA + Referer localhost:port' (@{ 'User-Agent'=$ua; 'Referer'='http://localhost:5000/' })
Size 'UA + Referer https://example.com' (@{ 'User-Agent'=$ua; 'Referer'='https://example.com/' })
Size 'UA + Sec-Fetch-Site cross-site' (@{ 'User-Agent'=$ua; 'Sec-Fetch-Site'='cross-site'; 'Sec-Fetch-Dest'='image'; 'Sec-Fetch-Mode'='no-cors' })
Size 'UA + Origin localhost' (@{ 'User-Agent'=$ua; 'Origin'='http://127.0.0.1:5000' })
Size 'UA + sec-ch-ua' (@{ 'User-Agent'=$ua; 'sec-ch-ua'='"Chromium";v="128", "Not;A=Brand";v="24"'; 'sec-ch-ua-mobile'='?0'; 'sec-ch-ua-platform'='"Windows"' })
Size 'UA + Accept-Encoding gzip' (@{ 'User-Agent'=$ua; 'Accept-Encoding'='gzip, deflate, br, zstd' })

Write-Output ''
Write-Output '--- different tile coords, UA only vs referer ---'
foreach ($c in @('11/1451/1009','11/1452/1009','10/725/504','12/2902/2019')) {
  $u = "https://a.tile.openstreetmap.org/$c.png"
  $url = $u
  Size "coord $c UA-only" $base
  Size "coord $c referer" (@{ 'User-Agent'=$ua; 'Referer'='http://127.0.0.1:5000/' })
}

Write-Output ''
Write-Output '--- CARTO + Esri same isolation (referer present) ---'
$url = 'https://a.basemaps.cartocdn.com/light_all/11/1451/1009.png'
Size 'CARTO UA only' $base
Size 'CARTO UA + referer' (@{ 'User-Agent'=$ua; 'Referer'='http://127.0.0.1:5000/' })
$url = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/11/1009/1451'
Size 'Esri UA only' $base
Size 'Esri UA + referer' (@{ 'User-Agent'=$ua; 'Referer'='http://127.0.0.1:5000/' })
$url = 'https://a.tile.openstreetmap.org/11/1451/1009.png'
