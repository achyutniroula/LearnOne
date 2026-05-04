# Generates a 256-bit base64-encoded JWT secret and prints it
$bytes = New-Object byte[] 32
[System.Security.Cryptography.RandomNumberGenerator]::Create().GetBytes($bytes)
$secret = [Convert]::ToBase64String($bytes)
Write-Output "JWT_SECRET=$secret"
