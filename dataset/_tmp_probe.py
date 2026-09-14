import urllib.request

url = (
    "https://mesonet.agron.iastate.edu/cgi-bin/request/asos.py"
    "?station=VOTV&data=all&year1=2019&month1=6&day1=1"
    "&year2=2019&month2=6&day2=3&tz=UTC&format=onlycomma"
    "&latlon=yes&missing=M&trace=T&direct=no&report_type=3&report_type=4"
)
req = urllib.request.Request(url, headers={"User-Agent": "sih26072-research/1.0"})
with urllib.request.urlopen(req, timeout=60) as r:
    body = r.read().decode("utf-8", errors="replace")
lines = body.splitlines()
print("HTTP OK, lines:", len(lines))
for ln in lines[:8]:
    print(ln)
