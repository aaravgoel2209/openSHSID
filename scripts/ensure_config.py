#!/usr/bin/env python3
"""
自动补齐 config.json — 从 config.example.json 合并缺失键（幂等，只增不改）。

适用场景：
- config.json 不存在        → 用模板原样生成（$env / $default 占位符保留，
                              运行时由 OpenSHSID_backend/config_loader.py 解析）
- config.json 缺新配置键    → 只补模板中有、当前文件缺失的键；已有值一律不动
                              （例如模板新增了 django.database.mysql 段，
                               老 config.json 会自动长出该段，密码占位符保留）
- config.json 已是最新      → 什么都不做，退出码 0

用法：
    python scripts/ensure_config.py              # 补齐（幂等）
    python scripts/ensure_config.py --dry-run    # 只预览会补什么，不写文件
    python scripts/ensure_config.py --config 路径 # 指定要补齐的配置文件

设计约定：
- 只增不改：已有键（哪怕值为 null）永远不会被模板覆盖，
  本地改过的 host / 密码 / 端口等不会被脚本冲掉。
- 占位符不物化：{"$env": "VAR", "$default": X} 原样保留，不展开成字面值 ——
  否则 config_loader 的"环境变量优先覆盖 JSON 默认值"契约会失效。
- 不生成密钥：结束时仅提示"只有 $env、无默认值且环境变量未设置"的项
  （fail closed 点），由部署方决定注入方式（环境变量 / .env.local）。
"""
import argparse
import json
import os
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
DEFAULT_TEMPLATE = ROOT / 'config.example.json'
DEFAULT_CONFIG = ROOT / 'config.json'


def load_json(path: Path):
    with open(path, encoding='utf-8') as f:
        return json.load(f)


def missing_entries(template, current, path='config'):
    """返回模板中有、当前文件缺失的 (路径, 值) 列表（深度优先）。"""
    missing = []
    for key, value in template.items():
        child = f'{path}.{key}'
        if key not in current:
            missing.append((child, value))
        elif isinstance(value, dict) and isinstance(current[key], dict):
            missing.extend(missing_entries(value, current[key], child))
    return missing


def apply_missing(current, template):
    """把模板中缺失的键深合并进 current（原地修改，返回新增的 (路径, 值)）。"""
    added = []
    for key, value in template.items():
        if key not in current:
            current[key] = value
            added.append((f'config.{key}', value))
        elif isinstance(value, dict) and isinstance(current[key], dict):
            added.extend(apply_missing(current[key], value))
    return added


def walk_placeholder_envs(node, path='config'):
    """找出形如 {"$env": VAR}（无 $default）的叶子及其配置路径。"""
    found = []
    if isinstance(node, dict):
        if '$env' in node and '$default' not in node:
            found.append((path, node['$env']))
        else:
            for key, value in node.items():
                if key.startswith('$'):
                    continue
                found.extend(walk_placeholder_envs(value, f'{path}.{key}'))
    elif isinstance(node, list):
        for i, value in enumerate(node):
            found.extend(walk_placeholder_envs(value, f'{path}[{i}]'))
    return found


def report_unset_envs(config):
    """提示只有 $env、无默认值且当前未设置环境变量的项（fail closed 点）。"""
    unset = [(path, var) for path, var in walk_placeholder_envs(config)
             if not os.environ.get(var)]
    if unset:
        print('[config] 提示：以下占位符只有 $env、无默认值，且环境变量当前未设置'
              '（运行时可能 fail closed，部署前请注入）:')
        for path, var in unset:
            print(f'  - {var}  ← {path}')
    return unset


def main():
    parser = argparse.ArgumentParser(
        description='自动补齐 config.json（从模板合并缺失键，幂等、只增不改）')
    parser.add_argument('--dry-run', action='store_true',
                        help='只预览会补齐的键，不写文件')
    parser.add_argument('--template', default=str(DEFAULT_TEMPLATE),
                        help=f'模板文件路径（默认 {DEFAULT_TEMPLATE.name}）')
    parser.add_argument('--config', default=str(DEFAULT_CONFIG),
                        help=f'要补齐的配置文件路径（默认 {DEFAULT_CONFIG.name}）')
    args = parser.parse_args()

    template_path = Path(args.template)
    if not template_path.is_file():
        print(f'[config] 错误：找不到模板 {template_path}', file=sys.stderr)
        return 1
    try:
        template = load_json(template_path)
    except json.JSONDecodeError as exc:
        print(f'[config] 错误：模板 JSON 解析失败：{exc}', file=sys.stderr)
        return 1

    config_path = Path(args.config)

    if not config_path.exists():
        if args.dry_run:
            print(f'[config] (dry-run) {config_path} 不存在 → 将用模板原样生成'
                  '（占位符保留，运行时解析）')
            return 0
        config_path.write_text(
            json.dumps(template, ensure_ascii=False, indent=2) + '\n',
            encoding='utf-8')
        print(f'[config] 已生成 {config_path}（来源：{template_path.name}，'
              '占位符由运行时解析）')
        report_unset_envs(template)
        return 0

    try:
        current = load_json(config_path)
    except json.JSONDecodeError as exc:
        print(f'[config] 错误：{config_path} JSON 解析失败：{exc}', file=sys.stderr)
        return 1

    missing = missing_entries(template, current)
    if not missing:
        print(f'[config] {config_path} 已是最新，无需补齐')
        report_unset_envs(current)
        return 0

    if args.dry_run:
        print(f'[config] (dry-run) 将补齐 {len(missing)} 个缺失键'
              '（已有值不会被覆盖）:')
        for path, value in missing:
            print(f'  + {path} = {json.dumps(value, ensure_ascii=False)}')
        report_unset_envs(template)
        return 0

    added = apply_missing(current, template)
    config_path.write_text(
        json.dumps(current, ensure_ascii=False, indent=2) + '\n',
        encoding='utf-8')
    print(f'[config] 已补齐 {len(added)} 个缺失键（来源：{template_path.name}，'
          '已有值未改动）:')
    for path, value in added:
        print(f'  + {path} = {json.dumps(value, ensure_ascii=False)}')
    report_unset_envs(current)
    return 0


if __name__ == '__main__':
    sys.exit(main())
