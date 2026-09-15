$ErrorActionPreference = 'Continue'
[Net.ServicePointManager]::SecurityProtocol = [Net.SecurityProtocolType]::Tls12

$ua = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36'

function Probe([string]$label, [string]$url, [hashtable]$headers) {
  try {
    $r = Invoke-WebRequest -Uri $url -Headers $headers -TimeoutSec 30 -UseBasicParsing -ErrorAction Stop
    $len = $r.RawContentLength
    $ct = $r.Headers['Content-Type']
    $x = ''
    if ($r.Headers['X-Cache']) { $x = ' X-Cache=' + $r.Headers['X-Cache'] }
    Write-Output ("{0} => HTTP {1} | {2} | bytes={3}{4}" -f $label, $r.StatusCode, $ct, $len, $x)
  } catch {
    $resp = $_.Exception.Response
    if ($resp) {
      $code = [int]$resp.StatusCode
      $body = ''
      try {
        $sr = New-Object IO.StreamReader($resp.GetResponseStream())
        $body = $sr.ReadToEnd()
        $sr.Close()
      } catch {}
      if ($body.Length -gt 400) { $body = $body.Substring(0,400) }
      $body = $body -replace '\s+', ' '
      Write-Output ("{0} => HTTP {1} | BODY: {2}" -f $label, $code, $body)
    } else {
      Write-Output ("{0} => ERROR {1}" -f $label, $_.Exception.Message)
    }
  }
}

$browser = @{ 'User-Agent' = $ua; 'Accept' = 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'; 'Accept-Language' = 'en-US,en;q=0.9' }
$withRef = @{ 'User-Agent' = $ua; 'Accept' = 'image/avif,image/webp,image/apng,image/*,*/*;q=0.8'; 'Accept-Language' = 'en-US,en;q=0.9'; 'Referer' = 'http://127.0.0.1:5000/'; 'Origin' = 'http://127.0.0.1:5000' }
$plain   = @{ 'User-Agent' = $ua }

Write-Output '=== OSM tile.openstreetmap.org (the CURRENT working-copy provider) ==='
Probe 'OSM a.tile, bare UA            ' 'https://a.tile.openstreetmap.org/11/1451/1009.png' $plain
Probe 'OSM a.tile, full browser hdrs  ' 'https://a.tile.openstreetmap.org/11/1451/1009.png' $withRef
Probe 'OSM tile. (no subdomain) ref   ' 'https://tile.openstreetmap.org/11/1451/1009.png' $withRef

Write-Output ''
Write-Output '=== CARTO basemaps.cartocdn.com (the COMMITTED provider) ==='
Probe 'CARTO a.basemaps light_all     ' 'https://a.basemaps.cartocdn.com/light_all/11/1451/1009.png' $withRef
Probe 'CARTO basemaps light_all       ' 'https://basemaps.cartocdn.com/light_all/11/1451/1009.png' $withRef
Probe 'CARTO a.basemaps light_nolabels' 'https://a.basemaps.cartocdn.com/light_nolabels/11/1451/1009.png' $withRef
Probe 'CARTO a.basemaps dark_all      ' 'https://a.basemaps.cartocdn.com/dark_all/11/1451/1009.png' $withRef

Write-Output ''
Write-Output '=== Other key-free providers ==='
Probe 'Esri World_Street_Map          ' 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/11/1009/1451' $withRef
Probe 'Esri World_Imagery             ' 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/11/1009/1451' $withRef
Probe 'Esri Ocean/Base (NatGeo)       ' 'https://server.arcgisonline.com/ArcGIS/rest/services/NatGeo_World_Map/MapServer/tile/11/1009/1451' $withRef
Probe 'OSM DE tile.openstreetmap.de   ' 'https://tile.openstreetmap.de/11/1451/1009.png' $withRef
Probe 'Wikimedia maps                 ' 'https://maps.wikimedia.org/osm-intl/11/1451/1009.png' $withRef
Probe 'OpenTopoMap                    ' 'https://a.tile.opentopomap.org/11/1451/1009.png' $withRef

Write-Output ''
Write-Output '=== Are the CDNs themselves reachable? (leaflet js/css) ==='
Probe 'jsdelivr leaflet.js            ' 'https://cdn.jsdelivr.net/npm/leaflet@1.9.4/dist/leaflet.js' $browser

Write-Output ''
Write-Output '=== Open-Meteo (ML input provider) ==='
Probe 'open-meteo forecast            ' 'https://api.open-meteo.com/v1/forecast?latitude=8.4855&longitude=76.9492&hourly=temperature_2m&forecast_days=1&timezone=UTC' $browser
