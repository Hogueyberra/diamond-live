param([string]$ClickName, [string]$OutName, [int]$Width = 0, [int]$Height = 921)
$prototypePage = '0b38470d-4919-459e-8ef3-6d36a5a2d0ef'
if ($Width -gt 0) { orca exec --page $prototypePage --command "set viewport $Width $Height" --json | Out-Null }
if ($ClickName) {
  $before = orca snapshot --page $prototypePage --json | ConvertFrom-Json
  $target = $before.result.refs.PSObject.Properties | Where-Object { $_.Value.name -eq $ClickName -and $_.Value.role -eq 'button' } | Select-Object -First 1 -ExpandProperty Name
  if (-not $target) { throw "No button named $ClickName in the current snapshot" }
  $clickResult = orca click --page $prototypePage --element "@$target" --json | ConvertFrom-Json
  if (-not $clickResult.ok) { throw $clickResult.error.message }
}
$snapshot = orca snapshot --page $prototypePage --json
$snapshot | Set-Content "docs/research/kestrel/prototype-qa/$OutName.json"
$shot = orca screenshot --page $prototypePage --json | ConvertFrom-Json
if (-not $shot.ok) { throw $shot.error.message }
[IO.File]::WriteAllBytes((Join-Path (Get-Location) "docs/research/kestrel/prototype-qa/$OutName.png"), [Convert]::FromBase64String($shot.result.data))
($snapshot | ConvertFrom-Json).result.snapshot.Split([char]10) | Where-Object { $_ -match 'heading|textbox|dialog|Approve|Record demo|Review development' } | Select-Object -First 18
