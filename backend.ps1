C:\ProgramData\miniconda3\shell\condabin\conda-hook.ps1
conda activate graphics
# AI 会话签名密钥（与模型服务共享），由 start.bat 生成到 .env.local
if (Test-Path .env.local) {
    Get-Content .env.local | Where-Object { $_ -match '=' } | ForEach-Object {
        $k, $v = $_ -split '=', 2
        Set-Item -Path "env:$($k.Trim())" -Value $v.Trim()
    }
}
python manage.py runserver