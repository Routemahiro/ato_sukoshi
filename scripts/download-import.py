"""Download the verified import source, then run the integrity-checking importer."""
import os
import subprocess
import tempfile
from urllib.request import Request, urlopen
from urllib.error import HTTPError
from pathlib import Path
url = os.environ['SOURCE_URL']
try:
    req = Request(url, headers={'User-Agent': 'ato-sukoshi-import/1.0'})
    with urlopen(req, timeout=45) as response:
        data = response.read(2_000_001)
except HTTPError as exc:
    print('Download status:', exc.code, 'storage code:', exc.headers.get('x-ms-error-code'))
    print(exc.read(1200).decode('utf-8', errors='replace').replace(url, '[source URL]'))
    raise SystemExit(1)
if len(data) > 2_000_000:
    raise RuntimeError('Unexpected download size')
with tempfile.TemporaryDirectory() as tmp:
    archive = Path(tmp) / 'v8.zip'
    archive.write_bytes(data)
    subprocess.run(['python3', 'scripts/import-confirmed-v8.py', '--archive', str(archive)], check=True)
