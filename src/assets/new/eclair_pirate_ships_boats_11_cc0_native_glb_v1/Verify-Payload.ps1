# CC0 1.0 - Eclair Assets. AI-assisted verification code. Read-only, no network.
[CmdletBinding()]
param([Parameter(Mandatory=$true)][string]$PayloadRoot)
Set-StrictMode -Version Latest
$ErrorActionPreference = 'Stop'
try {
    $manifestPath = Join-Path $PSScriptRoot 'MODEL_MANIFEST.json'
    $expectedManifestHash = '7503C8EAFB94078F44B4E428EBEC0647DD2514CD6485AD7B2E13F6591A1EE5DD'
    if ((Get-FileHash -LiteralPath $manifestPath -Algorithm SHA256).Hash -ne $expectedManifestHash) { throw 'Manifest bytes differ from the pinned customer manifest.' }
    $manifest = Get-Content -LiteralPath $manifestPath -Raw -Encoding UTF8 | ConvertFrom-Json
    $rootItem = Get-Item -LiteralPath $PayloadRoot
    if (-not $rootItem.PSIsContainer) { throw 'PayloadRoot must be a directory.' }
    $root = $rootItem.FullName.TrimEnd('\', '/')
    $ancestor = $rootItem
    while ($null -ne $ancestor) {
        if ($ancestor.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Linked/reparse payload ancestors are not accepted.' }
        $ancestor = $ancestor.Parent
    }
    if ($manifest.files.Count -ne 13 -or $manifest.modelCount -ne 11) { throw 'Unexpected manifest count.' }
    $checked = @()
    $expectedModelFiles = @()
    foreach ($file in $manifest.files) {
        $relative = [string]$file.path
        if ($relative -match '(^/|\\|:|(^|/)\.\.(/|$))') { throw 'Unsafe manifest path.' }
        $path = [IO.Path]::GetFullPath((Join-Path $root $relative))
        if (-not $path.StartsWith($root + [IO.Path]::DirectorySeparatorChar, [StringComparison]::OrdinalIgnoreCase)) { throw 'Payload path escaped root.' }
        $item = Get-Item -LiteralPath $path
        if ($item.PSIsContainer -or ($item.Attributes -band [IO.FileAttributes]::ReparsePoint)) { throw "Not a regular payload file: $relative" }
        $parent = $item.Directory
        while ($null -ne $parent -and $parent.FullName.Length -ge $root.Length) {
            if ($parent.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw "Linked parent for: $relative" }
            $parent = $parent.Parent
        }
        if ($item.Length -ne [long]$file.bytes) { throw "Size mismatch: $relative" }
        $hash = (Get-FileHash -LiteralPath $path -Algorithm SHA256).Hash
        if ($hash -ne $file.sha256) { throw "SHA-256 mismatch: $relative" }
        if ($relative.StartsWith('Models/')) { $expectedModelFiles += $path }
        $checked += [pscustomobject]@{path=$relative; bytes=$item.Length; sha256=$hash; passed=$true}
    }
    # Enumerate without traversing reparse points, and reject unexpected model-folder contents.
    $pending = New-Object 'System.Collections.Generic.Queue[string]'
    $pending.Enqueue((Join-Path $root 'Models'))
    $actualModelFiles = @()
    while ($pending.Count -gt 0) {
        $directory = $pending.Dequeue()
        foreach ($entry in Get-ChildItem -LiteralPath $directory -Force) {
            if ($entry.Attributes -band [IO.FileAttributes]::ReparsePoint) { throw 'Linked content in Models is not accepted.' }
            if ($entry.PSIsContainer) { $pending.Enqueue($entry.FullName) }
            else { $actualModelFiles += $entry.FullName }
        }
    }
    $differences = @(Compare-Object ($expectedModelFiles | Sort-Object) ($actualModelFiles | Sort-Object))
    if ($differences.Count -gt 0) { throw 'Missing or extra files inside Models.' }
    [pscustomobject]@{
        passed=$true
        checkedAtUtc=[DateTimeOffset]::UtcNow.ToString('o')
        payloadRoot=$root
        modelCount=11
        payloadFiles=$checked.Count
        payloadBytes=($checked | Measure-Object bytes -Sum).Sum
        sharedPalette='Models/GLB format/Textures/colormap.png'
        selfContainedGlb=$false
        scope='Payload byte integrity and exact Models file list; not a signature, ZIP or visual/application certification.'
        networkRequests=0
        fileWrites=0
        files=$checked
    } | ConvertTo-Json -Depth 5
    exit 0
}
catch {
    [pscustomobject]@{passed=$false; error=$_.Exception.Message; networkRequests=0; fileWrites=0} | ConvertTo-Json
    exit 1
}
