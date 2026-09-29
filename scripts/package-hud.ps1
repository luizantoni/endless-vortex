Add-Type -AssemblyName System.Drawing
$source = 'C:\Users\Antonio\.codex\generated_images\01a0829e-8a10-7842-a7e5-a9cf1fc58bac'
$dest = Join-Path $PSScriptRoot '../assets/ui/modular'
New-Item -ItemType Directory -Force -Path $dest | Out-Null
function Pack($id, $name, $width, $height, $left=0, $top=0, $right=1, $bottom=1) {
  $inputImage = [System.Drawing.Bitmap]::FromFile((Join-Path $source ($id+'.png')))
  $outputImage = New-Object System.Drawing.Bitmap($width, $height)
  $graphics = [System.Drawing.Graphics]::FromImage($outputImage)
  $graphics.CompositingMode = [System.Drawing.Drawing2D.CompositingMode]::SourceCopy
  $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $rect = New-Object System.Drawing.Rectangle(0,0,$width,$height)
  $graphics.DrawImage($inputImage,$rect,[single]($left*$inputImage.Width),[single]($top*$inputImage.Height),[single](($right-$left)*$inputImage.Width),[single](($bottom-$top)*$inputImage.Height),[System.Drawing.GraphicsUnit]::Pixel)
  $outputImage.Save((Join-Path $dest ($name+'.png')),[System.Drawing.Imaging.ImageFormat]::Png)
  $graphics.Dispose(); $outputImage.Dispose(); $inputImage.Dispose()
}
Pack 'exec-949a8750-6f2c-487e-8179-e84921e4cf6f' 'panel' 512 342
Pack 'exec-29a50b55-04c2-4c70-9d36-ba8ee1022a15' 'streak' 640 214
Pack 'exec-f35a2b4b-1c20-4d13-be86-a5a4b03e07fa' 'row' 512 88 .04 .25 .96 .72
Pack 'exec-ff2d213e-eafb-4584-9c24-eefcfad47281' 'segment' 32 80 .30 .10 .70 .9
Pack 'exec-d58d5fae-62b0-488d-852c-81ca8619fdb6' 'digits' 768 256
Pack 'exec-2d34065a-7725-4b8c-946f-73687d3767a1' 'burst' 512 256
Pack 'exec-49b002be-55de-4226-8520-101faa57c63c' 'dial' 384 384
Pack 'exec-2e9646d0-1a71-4ef5-9cf3-906de5fd13cb' 'vortex' 256 256
Get-ChildItem $dest | Select-Object Name,Length
