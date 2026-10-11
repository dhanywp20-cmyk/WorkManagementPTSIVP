<#
  Kunci rilis APK Work Management - dibuat SEKALI seumur aplikasi, lalu dipakai CI
  (.github/workflows/android.yml) untuk menandatangani setiap APK rilis.

  Yang dilakukan:
    1. membuat kunci (keystore) di Documents\Kunci-APK-WorkManagement\ptsivp-rilis.jks
       - di LUAR folder repo (repo publik). Bila sudah ada, dipakai ulang.
    2. mengisi secret GitHub ANDROID_KEYSTORE_BASE64 & ANDROID_KEYSTORE_PASSWORD
    3. menjalankan workflow "Android APK" di main -> APK rilis bertanda tangan

  Kata sandi diketik sendiri (tidak tampil di layar, tidak disimpan di berkas mana pun).
  SIMPAN berkas .jks + kata sandinya di tempat aman (mis. Google Drive pribadi / password
  manager). Bila hilang, update APK berikutnya tidak bisa dipasang menimpa versi lama -
  semua pengguna harus uninstall dulu.

  Jalankan dari folder repo:
    powershell -ExecutionPolicy Bypass -File scripts\buat-kunci-android.ps1
#>
# 'Continue': di PowerShell 5.1 keluaran stderr program (keytool/gh) dengan 'Stop' dianggap galat.
# Kegagalan diperiksa lewat $LASTEXITCODE lalu throw.
$ErrorActionPreference = 'Continue'
# Teks yang dipipa ke gh dikirim UTF-8 (bawaan PowerShell 5.1 = ASCII, huruf non-ASCII jadi '?').
$OutputEncoding = New-Object System.Text.UTF8Encoding $false
$repo  = 'dhanywp20-cmyk/WorkManagementPTSIVP'
$pemilik = 'dhanywp20-cmyk'
$folder = Join-Path ([Environment]::GetFolderPath('MyDocuments')) 'Kunci-APK-WorkManagement'
$jks    = Join-Path $folder 'ptsivp-rilis.jks'

$calon = @()
if ($env:JAVA_HOME) { $calon += (Join-Path $env:JAVA_HOME 'bin\keytool.exe') }
$calon += @(Get-ChildItem 'C:\Program Files\Java\*\bin\keytool.exe' -ErrorAction SilentlyContinue | ForEach-Object { $_.FullName })
$calon += 'C:\Program Files\Android\Android Studio\jbr\bin\keytool.exe'
$keytool = $calon | Where-Object { $_ -and (Test-Path $_) } | Select-Object -First 1
if (-not $keytool) { throw 'keytool tidak ditemukan - pasang JDK 17 dulu.' }
if (-not (Get-Command gh -ErrorAction SilentlyContinue)) { throw 'GitHub CLI (gh) tidak ditemukan.' }
# Laptop bisa login ke beberapa akun gh & akun AKTIF bisa berganti: secret hanya boleh diisi akun
# pemilik repo, jadi tokennya diambil eksplisit (hanya untuk proses ini, tidak ditampilkan).
$tokenPemilik = (gh auth token --user $pemilik 2>$null)
if (-not $tokenPemilik) { throw "Akun GitHub $pemilik belum login di gh. Jalankan: gh auth login" }

function Baca-Sandi([string]$judul) {
  $s = Read-Host -AsSecureString $judul
  $p = [Runtime.InteropServices.Marshal]::SecureStringToBSTR($s)
  try { return [Runtime.InteropServices.Marshal]::PtrToStringBSTR($p) } finally { [Runtime.InteropServices.Marshal]::ZeroFreeBSTR($p) }
}

$baru = -not (Test-Path $jks)
if ($baru) {
  Write-Host ''
  Write-Host 'Membuat kunci rilis BARU. Buat kata sandi (min. 6 karakter) dan CATAT di tempat aman.' -ForegroundColor Cyan
  $sandi = Baca-Sandi 'Kata sandi kunci'
  if ($sandi.Length -lt 6) { throw 'Kata sandi minimal 6 karakter.' }
  if ($sandi -ne (Baca-Sandi 'Ulangi kata sandi')) { throw 'Kata sandi tidak sama - jalankan ulang skrip.' }
} else {
  Write-Host "Kunci sudah ada: $jks - dipakai ulang (tidak dibuat baru)." -ForegroundColor Yellow
  $sandi = Baca-Sandi 'Kata sandi kunci yang sudah ada'
}

$env:WM_KUNCI_SANDI = $sandi
$env:GH_TOKEN = $tokenPemilik
try {
  if ($baru) {
    New-Item -ItemType Directory -Force $folder -ErrorAction Stop | Out-Null
    & $keytool -genkeypair -keystore $jks -storetype PKCS12 -alias ptsivp -keyalg RSA -keysize 2048 -validity 10000 `
      -dname 'CN=Work Management PTS IVP, O=PTS IVP, C=ID' -storepass:env WM_KUNCI_SANDI -keypass:env WM_KUNCI_SANDI 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0 -or -not (Test-Path $jks)) { throw 'Gagal membuat kunci.' }
  }
  # Pastikan kata sandi benar-benar membuka kunci sebelum dikirim ke GitHub.
  & $keytool -list -keystore $jks -storepass:env WM_KUNCI_SANDI -alias ptsivp 2>&1 | Out-Null
  if ($LASTEXITCODE -ne 0) { throw 'Kata sandi salah untuk kunci ini.' }

  gh secret set ANDROID_KEYSTORE_BASE64 --repo $repo --body ([Convert]::ToBase64String([IO.File]::ReadAllBytes($jks)))
  if ($LASTEXITCODE -ne 0) { throw 'Gagal mengisi secret ANDROID_KEYSTORE_BASE64.' }
  $env:WM_KUNCI_SANDI | gh secret set ANDROID_KEYSTORE_PASSWORD --repo $repo
  if ($LASTEXITCODE -ne 0) { throw 'Gagal mengisi secret ANDROID_KEYSTORE_PASSWORD.' }
} finally {
  Remove-Item Env:WM_KUNCI_SANDI -ErrorAction SilentlyContinue
  $sandi = $null
}

Write-Host ''
Write-Host "Secret terisi. Kunci tersimpan di: $jks" -ForegroundColor Green
Write-Host 'BACKUP berkas .jks itu + kata sandinya sekarang juga.' -ForegroundColor Yellow
gh workflow run android.yml --repo $repo --ref main
$hasil = $LASTEXITCODE
Remove-Item Env:GH_TOKEN -ErrorAction SilentlyContinue
$tokenPemilik = $null
if ($hasil -eq 0) { Write-Host 'Build APK rilis dimulai di GitHub Actions (+/- 2 menit).' -ForegroundColor Green }
