$ErrorActionPreference = "Stop"

function Test-PortAvailable([int]$Port) {
    $listener = $null
    try {
        $listener = [System.Net.Sockets.TcpListener]::new([System.Net.IPAddress]::Loopback, $Port)
        $listener.Start()
        return $true
    }
    catch {
        return $false
    }
    finally {
        if ($null -ne $listener) {
            try { $listener.Stop() } catch {}
        }
    }
}

function Find-FreePort([int]$Start, [int]$End) {
    for ($p = $Start; $p -le $End; $p++) {
        if (Test-PortAvailable $p) { return $p }
    }
    throw "Khong tim thay cong trong tu $Start den $End"
}

$backendPort = Find-FreePort 8010 8099
$frontendPort = Find-FreePort 5174 5299
$postgresPort = Find-FreePort 5433 5499

$envContent = @"
BACKEND_PORT=$backendPort
FRONTEND_PORT=$frontendPort
POSTGRES_PORT=$postgresPort
VITE_API_URL=http://localhost:$backendPort
DATABASE_URL=postgresql+psycopg2://lib_user:lib_password@db:5432/libmanager_db
ADMIN_USERNAME=admin
ADMIN_PASSWORD=Admin@123
RESET_ADMIN_PASSWORD=false
"@
Set-Content -Path ".env" -Value $envContent -Encoding ASCII

Write-Host "===============================================" -ForegroundColor Cyan
Write-Host "Da tu dong chon cong trong:" -ForegroundColor Green
Write-Host "Frontend : http://localhost:$frontendPort"
Write-Host "Backend  : http://localhost:$backendPort"
Write-Host "Swagger  : http://localhost:$backendPort/docs"
Write-Host "Postgres : localhost:$postgresPort"
Write-Host "ADMIN    : admin / Admin@123"
Write-Host "===============================================" -ForegroundColor Cyan

& docker compose up --build
