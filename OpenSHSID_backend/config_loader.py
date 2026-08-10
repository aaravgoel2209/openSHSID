"""
中央配置加载器 — Django 与 Flask 模型服务共用的唯一配置源。

所有 Python 侧的可调配置集中在项目根 config.json。本模块负责加载，并解析
环境变量占位（密钥类配置绝不写入 JSON）：

- {"$env": "VAR"}                         → 从 os.environ 读取；未设置时返回 None
- {"$env": "VAR", "$default": 值}         → 环境变量优先，缺省回退 JSON 默认值
                                            （值类型跟随 $default：int/float/bool/str；
                                             bool 接受 1/true/yes/on 等常见写法）
- 其它字面值（字符串 / 数字 / 布尔 / 数组 / 嵌套对象）原样返回

规则：
- 密钥一律用 {"$env": "VAR"} 占位，让调用方自行决定缺省时的行为
  （例如 session_auth 缺密钥时 fail closed）；部署时从环境变量注入。
- 部署时仍可用同名环境变量覆盖 JSON 默认值，与旧 REI_* 行为一致，迁移期零破坏。

用法（Django 侧）：
    from OpenSHSID_backend.config_loader import cfg, ROOT
    cfg['services']['model_service_url']

用法（model/ Flask 侧，独立进程）：
    from config_loader import cfg, ROOT
"""
import json
import os
from functools import lru_cache
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
CONFIG_PATH = ROOT / 'config.json'


class ConfigError(RuntimeError):
    """config.json 缺失 / 结构非法 / 必需环境变量未设置。"""


def _coerce(env_value, default):
    """按 $default 的类型把环境变量字符串转成对应类型；无 $default 时返回原字符串。"""
    if isinstance(default, bool):
        return env_value.lower() in ('1', 'true', 'yes', 'on')
    if isinstance(default, int):
        return int(env_value)
    if isinstance(default, float):
        return float(env_value)
    return env_value


def _resolve(node, path='config'):
    if isinstance(node, dict):
        if '$env' in node:
            var = node['$env']
            value = os.environ.get(var)
            if value is None or value == '':
                return node.get('$default')
            return _coerce(value, node.get('$default'))
        return {k: _resolve(v, f'{path}.{k}') for k, v in node.items()}
    if isinstance(node, list):
        return [_resolve(v, f'{path}[{i}]') for i, v in enumerate(node)]
    return node


@lru_cache(maxsize=1)
def load():
    """加载并解析 config.json（结果按模块级 `cfg` 引用，进程内只解析一次）。"""
    if not CONFIG_PATH.exists():
        raise ConfigError(f'找不到配置文件: {CONFIG_PATH}（应位于项目根目录）')
    with open(CONFIG_PATH, encoding='utf-8') as f:
        raw = json.load(f)
    return _resolve(raw)


cfg = load()
