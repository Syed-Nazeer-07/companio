$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing

# Generate matching, high-DPI Windows icon assets from one vector-like
# drawing. Never depend on a developer's personal C:\Users path.
$outDir = [System.IO.Path]::GetFullPath((Join-Path $PSScriptRoot '..\build'))
[System.IO.Directory]::CreateDirectory($outDir) | Out-Null

function New-CompanioImage([int]$size) {
  $bitmap = [System.Drawing.Bitmap]::new($size, $size, [System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
  $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
  try {
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.Clear([System.Drawing.Color]::Transparent)
    $graphics.ScaleTransform(($size / 128.0), ($size / 128.0))

    $bg = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(217, 241, 142))
    $shape = [System.Drawing.Drawing2D.GraphicsPath]::new()
    try {
      $shape.AddArc(3, 3, 66, 66, 180, 90)
      $shape.AddArc(59, 3, 66, 66, 270, 90)
      $shape.AddArc(59, 59, 66, 66, 0, 90)
      $shape.AddArc(3, 59, 66, 66, 90, 90)
      $shape.CloseFigure()
      $graphics.FillPath($bg, $shape)
    } finally {
      $shape.Dispose()
      $bg.Dispose()
    }

    $ink = [System.Drawing.Color]::FromArgb(22, 32, 28)
    $stroke = [System.Drawing.Pen]::new($ink, [float]16.5)
    try {
      $stroke.StartCap = [System.Drawing.Drawing2D.LineCap]::Round
      $stroke.EndCap = [System.Drawing.Drawing2D.LineCap]::Round
      $graphics.DrawArc($stroke, 24, 29, 73, 70, 40, 280)
    } finally {
      $stroke.Dispose()
    }

    $dot = [System.Drawing.SolidBrush]::new($ink)
    try { $graphics.FillEllipse($dot, [float]84.5, [float]27.0, [float]18.0, [float]18.0) }
    finally { $dot.Dispose() }

    $highlight = [System.Drawing.SolidBrush]::new([System.Drawing.Color]::FromArgb(217, 241, 142))
    try { $graphics.FillEllipse($highlight, [float]92.4, [float]31.4, [float]4.2, [float]4.2) }
    finally { $highlight.Dispose() }
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
  $buffer = [System.IO.MemoryStream]::new()
  try {
    $frame.Save($buffer, [System.Drawing.Imaging.ImageFormat]::Png)
    $payloads += ,$buffer.ToArray()
  } finally {
    $frame.Dispose()
    $buffer.Dispose()
  }
}

$file = [System.IO.FileStream]::new($icoPath, [System.IO.FileMode]::Create, [System.IO.FileAccess]::Write)
$writer = [System.IO.BinaryWriter]::new($file)
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
