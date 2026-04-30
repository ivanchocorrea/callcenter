# =====================================================================
#  generate-env.ps1
#  Genera un archivo .env con secretos aleatorios válidos para Windows.
#  Uso (en PowerShell, desde la raíz del proyecto):
#    .\scripts\generate-env.ps1
# =====================================================================

function New-Hex {
    param([int]$Bytes = 32)
    $b = New-Object byte[] $Bytes
    [System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($b)
    -join ($b | ForEach-Object { $_.ToString('x2') })
}

function New-Pass {
    param([int]$Length = 24)
    -join ((33..47) + (65..90) + (97..122) + (48..57) | Get-Random -Count $Length | ForEach-Object {[char]$_})
}

$envPath = Join-Path (Split-Path -Parent $PSScriptRoot) ".env"

if (Test-Path $envPath) {
    Write-Host "⚠ Ya existe $envPath. Sobrescribir? (S/N)" -ForegroundColor Yellow
    if ((Read-Host).ToUpper() -ne "S") { exit }
}

$mysqlRoot = New-Pass 24
$mysqlUser = New-Pass 24
$jwtAccess = New-Hex 32
$jwtRefresh = New-Hex 32
$encMaster = New-Hex 32       # 32 bytes = 64 hex chars (requerido)
$amiPass = New-Pass 16
$ariPass = New-Pass 16
$bootPass = "ChangeMeNow!" + (New-Pass 8)

$content = @"
# Generado automáticamente $(Get-Date -Format 'yyyy-MM-dd HH:mm:ss')

NODE_ENV=development
PUBLIC_APP_URL=http://localhost:3000
PUBLIC_API_URL=http://localhost:3001

BACKEND_PORT=3001
BACKEND_HOST=0.0.0.0
FRONTEND_PORT=3000

NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_WS_URL=http://localhost:3001
NEXT_PUBLIC_SIP_WSS_URL=wss://localhost:8089/ws

MYSQL_HOST=mysql
MYSQL_PORT=3306
MYSQL_DATABASE=callcenter
MYSQL_USER=callcenter
MYSQL_PASSWORD=$mysqlUser
MYSQL_ROOT_PASSWORD=$mysqlRoot

REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=

JWT_SECRET=$jwtAccess
JWT_REFRESH_SECRET=$jwtRefresh
JWT_ACCESS_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

ENCRYPTION_MASTER_KEY=$encMaster

ASTERISK_HOST=asterisk
ASTERISK_AMI_PORT=5038
ASTERISK_AMI_USER=admin
ASTERISK_AMI_PASSWORD=$amiPass
ASTERISK_ARI_HOST=asterisk
ASTERISK_ARI_PORT=8088
ASTERISK_ARI_USER=ariadmin
ASTERISK_ARI_PASSWORD=$ariPass
ASTERISK_ARI_APP=callcenter-app

STORAGE_DRIVER=local
LOCAL_RECORDINGS_PATH=/var/recordings

CORS_ORIGINS=http://localhost:3000

LOG_LEVEL=info
LOG_FORMAT=json
ENABLE_METRICS=true
ENABLE_TRACING=false

RATE_LIMIT_TTL=60
RATE_LIMIT_MAX=100

BOOTSTRAP_SUPERADMIN_EMAIL=admin@nodoe.test
BOOTSTRAP_SUPERADMIN_PASSWORD=$bootPass
BOOTSTRAP_SUPERADMIN_NAME=Super Admin
"@

Set-Content -Path $envPath -Value $content -Encoding UTF8

Write-Host ""
Write-Host "OK .env generado en: $envPath" -ForegroundColor Green
Write-Host ""
Write-Host "Credenciales del super-admin (guardalas):" -ForegroundColor Cyan
Write-Host "  Email:    admin@nodoe.test"
Write-Host "  Password: $bootPass"
Write-Host ""
Write-Host "Tambien se actualizo manager.conf y ari.conf de Asterisk:"
Write-Host "  AMI password: $amiPass"
Write-Host "  ARI password: $ariPass"
Write-Host ""
Write-Host "Siguiente paso: docker compose -f docker-compose.dev.yml up -d --build" -ForegroundColor Cyan

# Actualizar manager.conf y ari.conf para que coincidan
$mgrPath = Join-Path (Split-Path -Parent $PSScriptRoot) "asterisk\etc\manager.conf"
$ariPath = Join-Path (Split-Path -Parent $PSScriptRoot) "asterisk\etc\ari.conf"
if (Test-Path $mgrPath) {
    (Get-Content $mgrPath) -replace 'secret = .*', "secret = $amiPass" | Set-Content $mgrPath
}
if (Test-Path $ariPath) {
    (Get-Content $ariPath) -replace 'password = .*', "password = $ariPass" | Set-Content $ariPath
}
