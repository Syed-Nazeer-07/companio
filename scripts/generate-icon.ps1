Add-Type -AssemblyName System.Drawing

$width = 256
$height = 256
$bmp = New-Object System.Drawing.Bitmap $width, $height
$g = [System.Drawing.Graphics]::FromImage($bmp)
$g.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::AntiAlias

# Background glowing gradient circle
$p1 = New-Object System.Drawing.Point 0, 0
$p2 = New-Object System.Drawing.Point 256, 256
$c1 = [System.Drawing.Color]::FromArgb(14, 165, 233)  # Sky blue
$c2 = [System.Drawing.Color]::FromArgb(99, 102, 241) # Indigo
$brush = New-Object System.Drawing.Drawing2D.LinearGradientBrush $p1, $p2, $c1, $c2

$g.FillEllipse($brush, 12, 12, 232, 232)

# Bold modern letter "C"
$font = New-Object System.Drawing.Font "Segoe UI", 100, "Bold", "Pixel"
$textBrush = New-Object System.Drawing.SolidBrush ([System.Drawing.Color]::White)
$format = New-Object System.Drawing.StringFormat
$format.Alignment = [System.Drawing.StringAlignment]::Center
$format.LineAlignment = [System.Drawing.StringAlignment]::Center
$rect = New-Object System.Drawing.RectangleF 0, 0, 256, 256

$g.DrawString("C", $font, $textBrush, $rect, $format)

$outDir = "C:\Users\Nazeer\aura\build"
if (-not (Test-Path $outDir)) {
    New-Item -ItemType Directory -Path $outDir -Force | Out-Null
}

$pngPath = Join-Path $outDir "icon.png"
$bmp.Save($pngPath, [System.Drawing.Imaging.ImageFormat]::Png)

$icoPath = Join-Path $outDir "icon.ico"
$hIcon = $bmp.GetHicon()
$icon = [System.Drawing.Icon]::FromHandle($hIcon)
$fs = New-Object System.IO.FileStream $icoPath, "Create"
$icon.Save($fs)
$fs.Close()

Write-Output "Successfully generated $pngPath and $icoPath"
