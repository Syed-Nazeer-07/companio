$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

# Generate matching, high-DPI Windows icon assets from one vector-like
# drawing. Never depend on a developer's personal C:\Users path.
$outDir = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\build'))
[System.IO.Directory]::CreateDirectory($outDir) | Out-Null

function New-CompanioImage([int]$size) {
  $bitmap = New-Object System.Drawing.Bitmap($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.ScaleTransform(($size / 128.0), ($size / 128.0))

    $rect = New-Object System.Drawing.Rectangle(6, 6, 116, 116)
    $blue = [System.Drawing.Color]::FromArgb(14, 165, 233)
    $indigo = [System.Drawing.Color]::FromArgb(79, 70, 229)
    $brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush($rect, $blue, $indigo, 45)
    $shape = New-Object System.Drawing.Drawing2D.GraphicsPath
    try {
      $shape.AddArc(6, 6, 64, 64, 180, 90)
      $shape.AddArc(58, 6, 64, 64, 270, 90)
      $shape.AddArc(58, 58, 64, 64, 0, 90)
      $shape.AddArc(6, 58, 64, 64, 90, 90)
      $shape.CloseFigure()
      $graphics.FillPath($brush, $shape)
    } finally {
      $shape.Dispose()
      $brush.Dispose()
    }

    $stroke = New-Object System.Drawing.Pen([System.Drawing.Color]::White, 17)
    try {
      $stroke.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
      $stroke.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
      $graphics.DrawArc($stroke, 26, 29, 72, 70, 45, 270)
    } finally {
      $stroke.Dispose()
    }

    $yellow = New-Object System.Drawing.SolidBrush([System.Drawing.Color]::FromArgb(254, 240, 138))
    try { $graphics.FillEllipse($yellow, 94, 24, 16, 16) }
    finally { $yellow.Dispose() }
  } finally {
    $graphics.Dispose()
  }
  return $bitmap
}

$pngPath = Join-Path $outDir 'icon.png'
$icoPath = Join-Path $outDir 'icon.ico'
$master = New-CompanioImage 256
try { $master.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png) }
finally { $master.Dispose() }

# ICO format: 6-byte header, 16-byte entry per resolution, then PNG bytes.
# PNG-backed ICO entries are supported by Windows 10/11 and look sharp at
# 16px taskbar/tray scale as well as 256px Explorer icon scale.
$sizes = @(16, 24, 32, 48, 64, 128, 256)
$payloads = @()
foreach ($size in $sizes) {
  $frame = New-CompanioImage $size
  $buffer = New-Object System.IO.MemoryStream
  try {
    $frame.Save($buffer, [System.Drawing.Imaging.ImageFormat]::Png)
    $payloads += ,$buffer.ToArray()
  } finally {
    $frame.Dispose()
    $buffer.Dispose()
  }
}

$file = New-Object System.IO.FileStream($icoPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
$writer = New-Object System.IO.BinaryWriter($file)
try {
  $writer.Write([UInt16]0)
  $writer.Write([UInt16]1)
  $writer.Write([UInt16]$sizes.Count)
  $offset = 6 + 16 * $sizes.Count
  for ($i = 0; $i -lt $sizes.Count; $i++) {
    $size = $sizes[$i]
    $dimension = if ($size -eq 256) { [byte]0 } else { [byte]$size }
    $writer.Write($dimension)
    $writer.Write($dimension)
    $writer.Write([byte]0)
    $writer.Write([byte]0)
    $writer.Write([UInt16]1)
    $writer.Write([UInt16]32)
    $writer.Write([UInt32]$payloads[$i].Length)
    $writer.Write([UInt32]$offset)
    $offset += $payloads[$i].Length
  }
  foreach ($payload in $payloads) { $writer.Write([byte[]]$payload) }
} finally {
  $writer.Dispose()
}
if ((Get-Item $pngPath).Length -lt 1000 -or (Get-Item $icoPath).Length -lt 1000) {
  throw 'Companio icon generation produced unexpectedly small files.'
}
Write-Output "Generated Companio icons in $outDir"
