#!/usr/bin/env python3
"""
天青 Larimar 资源：批量将文件名中的「演出服」改为「婚纱」

适用目录（Hugging Face 仓库 think-denim-frisk/Larimar）：
  - 天青立绘/
  - 小头像/
  - 天青cg/

用法（在任意目录执行均可）：

  # 1) 本地克隆目录重命名（先 git clone，改完再 push）
  python src/天青/scripts/rename-yanchufu-to-hunsha.py --local "D:/Larimar"

  # 2) 直接在 Hugging Face 远程重命名（需 Write Token）
  set HF_TOKEN=hf_xxxx
  python src/天青/scripts/rename-yanchufu-to-hunsha.py --remote

  # 仅预览，不实际修改
  python src/天青/scripts/rename-yanchufu-to-hunsha.py --local "D:/Larimar" --dry-run

环境变量：
  HF_TOKEN      远程模式必填（https://huggingface.co/settings/tokens）
  HTTPS_PROXY   可选，默认 http://127.0.0.1:7890
"""

from __future__ import annotations

import argparse
import os
import sys
from pathlib import Path

OLD = "演出服"
NEW = "婚纱"
REPO_ID = "think-denim-frisk/Larimar"
REPO_TYPE = "model"
TARGET_PREFIXES = ("天青立绘/", "小头像/", "天青cg/")


def pairs_from_names(names: list[str]) -> list[tuple[str, str]]:
    out: list[tuple[str, str]] = []
    for name in sorted(names):
        if OLD not in name:
            continue
        new_name = name.replace(OLD, NEW)
        if new_name == name:
            continue
        out.append((name, new_name))
    return out


def collect_local_pairs(root: Path) -> list[tuple[Path, Path]]:
    pairs: list[tuple[Path, Path]] = []
    if not root.is_dir():
        raise SystemExit(f"本地目录不存在: {root}")
    for dirpath, _, filenames in os.walk(root):
        for filename in filenames:
            if OLD not in filename:
                continue
            old_path = Path(dirpath) / filename
            new_path = old_path.with_name(filename.replace(OLD, NEW))
            pairs.append((old_path, new_path))
    return pairs


def collect_remote_pairs(api, repo_id: str) -> list[tuple[str, str]]:
    files = api.list_repo_files(repo_id=repo_id, repo_type=REPO_TYPE)
    matched = [f for f in files if any(f.startswith(p) for p in TARGET_PREFIXES) and OLD in f]
    return pairs_from_names(matched)


def run_local(root: Path, dry_run: bool) -> int:
    pairs = collect_local_pairs(root)
    if not pairs:
        print("未找到含「演出服」的文件。")
        return 0

    print(f"本地目录: {root}")
    print(f"待重命名 {len(pairs)} 个文件:\n")
    for old_path, new_path in pairs:
        rel_old = old_path.relative_to(root)
        rel_new = new_path.relative_to(root)
        print(f"  {rel_old}  ->  {rel_new}")
        if new_path.exists() and not dry_run:
            print(f"    跳过：目标已存在 {rel_new}")
            continue
        if not dry_run:
            new_path.parent.mkdir(parents=True, exist_ok=True)
            old_path.rename(new_path)

    if dry_run:
        print("\n[dry-run] 未修改任何文件。")
    else:
        print("\n完成。请在仓库目录执行 git status / commit / push。")
    return 0


def run_remote(dry_run: bool) -> int:
    token = os.environ.get("HF_TOKEN") or os.environ.get("UPLOAD_HF_TOKEN")
    if not token:
        raise SystemExit("远程模式需要环境变量 HF_TOKEN（Write Token）。")

    try:
        import httpx
        from huggingface_hub import CommitOperationCopy, CommitOperationDelete, HfApi, create_commit
        from huggingface_hub.utils._http import close_session, set_client_factory
    except ImportError:
        raise SystemExit("请先安装: pip install huggingface_hub httpx")

    proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY") or "http://127.0.0.1:7890"
    os.environ.pop("HF_ENDPOINT", None)

    def _client_factory():
        return httpx.Client(proxy=proxy, timeout=httpx.Timeout(300.0), follow_redirects=True)

    set_client_factory(_client_factory)
    close_session()

    api = HfApi(endpoint="https://huggingface.co", token=token)
    who = api.whoami(token=token)
    print(f"已登录 Hugging Face: {who.get('name', who)}")

    pairs = collect_remote_pairs(api, REPO_ID)
    if not pairs:
        print("远程仓库中未找到含「演出服」的目标文件（可能已重命名）。")
        return 0

    print(f"仓库: {REPO_ID}")
    print(f"待重命名 {len(pairs)} 个文件:\n")
    for old_path, new_path in pairs:
        print(f"  {old_path}  ->  {new_path}")

    if dry_run:
        print("\n[dry-run] 未修改远程仓库。")
        return 0

    operations = []
    for old_path, new_path in pairs:
        operations.append(CommitOperationCopy(src_path_in_repo=old_path, path_in_repo=new_path))
        operations.append(CommitOperationDelete(path_in_repo=old_path))

    commit = create_commit(
        repo_id=REPO_ID,
        repo_type=REPO_TYPE,
        operations=operations,
        commit_message=f"rename: {OLD} -> {NEW} in sprite/cg assets",
        token=token,
    )
    print(f"\n完成。commit: {commit.commit_url or commit.oid}")
    print(f"查看: https://huggingface.co/{REPO_ID}/tree/main")
    return 0


def main() -> int:
    parser = argparse.ArgumentParser(description=f"批量重命名 Larimar 资源：{OLD} -> {NEW}")
    mode = parser.add_mutually_exclusive_group(required=True)
    mode.add_argument("--local", metavar="DIR", help="本地 Larimar 克隆目录")
    mode.add_argument("--remote", action="store_true", help="直接在 Hugging Face 远程重命名")
    parser.add_argument("--dry-run", action="store_true", help="仅列出计划，不执行")
    args = parser.parse_args()

    if args.local:
        return run_local(Path(args.local).expanduser().resolve(), args.dry_run)
    return run_remote(args.dry_run)


if __name__ == "__main__":
    sys.exit(main())
