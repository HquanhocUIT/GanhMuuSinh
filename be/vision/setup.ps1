$ErrorActionPreference = 'Stop'
$projectRoot = (Resolve-Path (Join-Path $PSScriptRoot '../..')).Path
$venvPath = Join-Path $projectRoot '.venv-vision'
$visionPython = Join-Path $venvPath 'Scripts/python.exe'
Push-Location $projectRoot
try {
    if (-not (Test-Path -LiteralPath $visionPython)) {
        python -m venv $venvPath
        if ($LASTEXITCODE -ne 0) { throw 'Could not create the Python environment.' }
    }
    & $visionPython -m pip install -r (Join-Path $PSScriptRoot 'requirements.txt')
    if ($LASTEXITCODE -ne 0) { throw 'Could not install vision dependencies.' }
    & $visionPython (Join-Path $PSScriptRoot 'extract_features.py') --download
    if ($LASTEXITCODE -ne 0) { throw 'Could not extract image features.' }
    & $visionPython (Join-Path $PSScriptRoot 'prepare_dataset.py')
    if ($LASTEXITCODE -ne 0) { throw 'Dataset audit/split failed.' }
    & $visionPython (Join-Path $PSScriptRoot 'build_index.py')
    if ($LASTEXITCODE -ne 0) { throw 'Could not build the reference index.' }
    Write-Host 'Local reference vision is ready. Restart the backend.'
} finally {
    Pop-Location
}
