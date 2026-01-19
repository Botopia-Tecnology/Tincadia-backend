$url = "https://alphacephei.com/vosk/models/vosk-model-small-es-0.42.zip"
$destDir = "models"
$zipFile = "model.zip"

Write-Host "Checking for models directory..."
if (!(Test-Path -Path $destDir)) {
    Write-Host "Creating $destDir..."
    New-Item -ItemType Directory -Path $destDir
}

$modelPath = Join-Path $destDir "vosk-model-small-es-0.42"
if (Test-Path -Path $modelPath) {
    Write-Host "Model already exists at $modelPath"
    exit
}

Write-Host "Downloading Vosk model..."
Invoke-WebRequest -Uri $url -OutFile $zipFile

Write-Host "Extracting model..."
Expand-Archive -Path $zipFile -DestinationPath $destDir

Write-Host "Cleaning up..."
Remove-Item $zipFile

Write-Host "Done! Model is ready."
