Add-Type -AssemblyName System.Drawing
$source = 'C:\Users\Antonio\.codex\generated_images\01a0829e-8a10-7842-a7e5-a9cf1fc58bac'
$dest = Join-Path $PSScriptRoot '../assets/ui/modular/milestones'
New-Item -ItemType Directory -Force -Path $dest | Out-Null
$tiers = @(
  @('exec-46d6e385-2141-4e1f-976f-fe47d225c015','milestone-100'),
  @('exec-1baa8688-4ba3-402f-9bc8-f9540d046de0','milestone-200'),
  @('exec-a3d8edbe-3cc6-4082-862b-7aa50203b800','milestone-300'),
  @('exec-4cc8cce3-7330-42a1-a303-705bdb66aafb','milestone-400'),
  @('exec-3143e678-b69f-4428-bea9-fd778aa09204','milestone-500'),
  @('exec-14416ec4-37a6-4ccb-91cd-fefe13350132','milestone-600'),
  @('exec-4d9d01a8-1abe-469e-b27b-6411d23552a9','milestone-700'),
  @('exec-fa44081d-b982-45ba-9810-a66481724a34','milestone-800'),
  @('exec-7be767be-008d-40a2-906d-cd64685a079f','milestone-900'),
  @('exec-c0fbbcd9-75bd-4cc4-83dd-e872f69b6bbf','milestone-1000')
)
foreach ($tier in $tiers) {
  $inputImage = [System.Drawing.Bitmap]::FromFile((Join-Path $source ($tier[0] + '.png')))
  $outputImage = New-Object System.Drawing.Bitmap(640, 214)
  $graphics = [System.Drawing.Graphics]::FromImage($outputImage)
  $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $graphics.DrawImage($inputImage,0,0,640,214)
  $outputImage.Save((Join-Path $dest ($tier[1] + '.png')),[System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose(); $outputImage.Dispose(); $inputImage.Dispose()
}
Get-ChildItem $dest | Select-Object Name,Length
