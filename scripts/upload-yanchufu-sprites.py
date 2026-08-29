#!/usr/bin/env python3
"""上传本地演出服立绘到 HF Larimar/天青立绘/"""

from __future__ import annotations

import os
import re
import shutil
import sys
import tempfile
from pathlib import Path

LOCAL_DIR = Path(r"C:\Users\Zeppelin\Downloads\天青演出服立绘")
REPO_ID = "think-denim-frisk/Larimar"
REPO_TYPE = "model"
REMOTE_PREFIX = "天青立绘"


def local_to_remote(filename: str) -> str:
    name = filename
    if name.startswith("天青"):
        name = name[2:]
    # Windows 重复导出: 演出服得意 (1).png -> 演出服得意2.png
    m = re.match(r"^(.+) \((\d+)\)(\.[^.]+)$", name)
    if m:
        base, num, ext = m.group(1), m.group(2), m.group(3)
        name = f"{base}{num}{ext}"
    return f"{REMOTE_PREFIX}/{name}"


def main() -> int:
    token = os.environ.get("HF_TOKEN") or os.environ.get("UPLOAD_HF_TOKEN")
    if not token:
        cache = Path.home() / ".cache" / "huggingface" / "token"
        if cache.is_file():
            token = cache.read_text(encoding="utf-8").strip()

    if not token:
        raise SystemExit("需要 HF_TOKEN")

    try:
        import httpx
        from huggingface_hub import HfApi
        from huggingface_hub.utils._http import close_session, set_client_factory
    except ImportError:
        raise SystemExit("pip install huggingface_hub httpx")

    proxy = os.environ.get("HTTPS_PROXY") or os.environ.get("HTTP_PROXY") or "http://127.0.0.1:7890"
    os.environ.pop("HF_ENDPOINT", None)

    def _client_factory():
        return httpx.Client(proxy=proxy, timeout=httpx.Timeout(300.0), follow_redirects=True)

    set_client_factory(_client_factory)
    close_session()

    api = HfApi(endpoint="https://huggingface.co", token=token)
    who = api.whoami(token=token)
    print(f"已登录: {who.get('name', who)}")

    if not LOCAL_DIR.is_dir():
        raise SystemExit(f"目录不存在: {LOCAL_DIR}")

    files = sorted(f for f in LOCAL_DIR.iterdir() if f.is_file())
    print(f"待上传 {len(files)} 个文件 -> {REPO_ID}/{REMOTE_PREFIX}/\n")

    with tempfile.TemporaryDirectory(prefix="yanchufu-upload-") as tmp:
        staging = Path(tmp) / REMOTE_PREFIX
        staging.mkdir(parents=True)
        for path in files:
            remote = local_to_remote(path.name)
            dest_name = remote.split("/", 1)[1]
            print(f"  {path.name}  ->  {remote}")
            shutil.copy2(path, staging / dest_name)

        api.upload_folder(
            folder_path=str(staging.parent),
            path_in_repo=".",
            repo_id=REPO_ID,
            repo_type=REPO_TYPE,
            commit_message="add: 演出服立绘 batch upload",
        )

    print(f"\n完成: https://huggingface.co/{REPO_ID}/tree/main/{REMOTE_PREFIX}")
    return 0


if __name__ == "__main__":
    sys.exit(main())
