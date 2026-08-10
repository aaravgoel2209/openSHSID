"""
model/（Flask 模型服务）侧的中央配置 shim。

model 服务以独立进程运行（CWD 可能是 model/ 或项目根），且不在 Django 包内。
这里把项目根插入 sys.path 后复用 OpenSHSID_backend.config_loader 的实现，
保证 Django 与模型服务读的是同一份 config.json（单一事实来源）。

用法：
    from config_loader import cfg, ROOT
"""
import sys
from pathlib import Path

_REPO_ROOT = Path(__file__).resolve().parent.parent
if str(_REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(_REPO_ROOT))

from OpenSHSID_backend.config_loader import *  # noqa: F401,F403  (re-export cfg / ROOT / CONFIG_PATH / load)
from OpenSHSID_backend.config_loader import ROOT  # noqa: F401  (显式重导出，供 from config_loader import ROOT 使用)
