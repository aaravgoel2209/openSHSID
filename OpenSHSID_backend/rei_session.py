"""
会话令牌签名 / 校验（Django 侧）

聊天历史按 session_id 隔离，而 session_id 是可枚举的（chat-user-<用户ID>）。
若不校验，任何人都能用别人的 session_id 读取、甚至写入他人的私聊记录。

做法：Django 与模型服务共享一个密钥。只有 Django 在确认登录身份后才会为
「该用户自己的」session_id 签发令牌；模型服务只接受签名有效且未过期的令牌。

⚠ 本文件在模型服务侧有一份完全相同的副本：model/session_auth.py
  两边必须保持一致（改动请同步）。
"""
import hashlib
import hmac
import time

from OpenSHSID_backend.config_loader import cfg

# 令牌有效期（秒），默认 7 天；配置在 config.json session_auth.ttl_seconds（可用 REI_SESSION_TTL 覆盖）
DEFAULT_TTL = int(cfg['session_auth']['ttl_seconds'])


class SecretMissing(RuntimeError):
    """未配置 REI_SESSION_SECRET。

    这里刻意不提供默认值：写死的默认密钥等于没有密钥——任何读过源码的人
    都能伪造出任意用户的令牌。宁可启动失败，也不要静默地退化成不设防。
    """


def get_secret():
    secret = (cfg['session_auth']['secret'] or '').strip()
    if not secret:
        raise SecretMissing(
            '未设置环境变量 REI_SESSION_SECRET；Django 与模型服务必须配置相同的随机密钥。'
            '生成方式：python -c "import secrets; print(secrets.token_urlsafe(48))"'
        )
    return secret.encode('utf-8')


def _mac(session_id, exp):
    return hmac.new(get_secret(), f'{session_id}.{exp}'.encode('utf-8'), hashlib.sha256).hexdigest()


def sign(session_id, ttl=None):
    """签发 '<过期时间戳>.<签名>' 形式的令牌。"""
    exp = int(time.time()) + int(DEFAULT_TTL if ttl is None else ttl)
    return f'{exp}.{_mac(session_id, exp)}'


def verify(session_id, token):
    """校验令牌确为该 session_id 签发且未过期。任何异常一律判失败（fail closed）。"""
    if not session_id or not token:
        return False
    try:
        exp_str, sig = str(token).split('.', 1)
        exp = int(exp_str)
    except (ValueError, AttributeError):
        return False
    if exp < time.time():
        return False
    try:
        expected = _mac(session_id, exp)
    except SecretMissing:
        return False  # 未配置密钥 → 拒绝一切请求，而不是放行
    return hmac.compare_digest(sig, expected)
