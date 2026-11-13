import os
import shutil
import zipfile
from pathlib import Path

REPO_ROOT = Path(r"d:\InfyProject")
CONTEXT_DIR = REPO_ROOT / "project-context"
ZIP_PATH = REPO_ROOT / "project-context.zip"

EXCLUDE_DIRS = {
    "node_modules", ".git", "__pycache__", "venv", ".venv",
    "dist", "build", ".next", ".user_uploaded", ".system_generated",
    "scratch", ".idea", ".vscode", "brain", ".gemini"
}

EXCLUDE_EXTS = {
    ".db", ".sqlite", ".sqlite3", ".png", ".jpg", ".jpeg",
    ".gif", ".ico", ".svg", ".zip", ".tar", ".gz", ".pyc"
}

def generate_tree(dir_path: Path, prefix: str = "") -> list[str]:
    lines = []
    try:
        entries = sorted(list(dir_path.iterdir()), key=lambda x: (x.is_file(), x.name.lower()))
    except Exception:
        return lines

    entries = [e for e in entries if e.name not in EXCLUDE_DIRS and not e.name.startswith(".env") and e.suffix not in EXCLUDE_EXTS]
    count = len(entries)

    for i, entry in enumerate(entries):
        connector = "└── " if i == count - 1 else "├── "
        lines.append(f"{prefix}{connector}{entry.name}")
        if entry.is_dir():
            sub_prefix = prefix + ("    " if i == count - 1 else "│   ")
            lines.extend(generate_tree(entry, sub_prefix))
    return lines

def build_context():
    # 1. Clear or create project-context directory
    if CONTEXT_DIR.exists():
        shutil.rmtree(CONTEXT_DIR)
    CONTEXT_DIR.mkdir(parents=True, exist_ok=True)

    print(f"Creating project context in: {CONTEXT_DIR}")

    # 2. Generate tree.txt
    tree_lines = [f"{REPO_ROOT.name}/"] + generate_tree(REPO_ROOT)
    tree_path = CONTEXT_DIR / "tree.txt"
    tree_path.write_text("\n".join(tree_lines), encoding="utf-8")
    print("Generated tree.txt")

    # 3. Copy Backend Source (backend/app, requirements.txt, .env.example, MIGRATIONS.md, etc.)
    backend_src = REPO_ROOT / "backend"
    backend_dest = CONTEXT_DIR / "backend"
    
    if backend_src.exists():
        app_dir = backend_src / "app"
        if app_dir.exists():
            for root, dirs, files in os.walk(app_dir):
                dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
                rel_path = Path(root).relative_to(backend_src)
                target_root = backend_dest / rel_path
                target_root.mkdir(parents=True, exist_ok=True)

                for f in files:
                    file_path = Path(root) / f
                    if file_path.suffix not in EXCLUDE_EXTS and not f.startswith(".env"):
                        shutil.copy2(file_path, target_root / f)

        # Copy backend configs
        for config_name in ["requirements.txt", "pyproject.toml", ".env.example", "MIGRATIONS.md", "README.md"]:
            cfg_file = backend_src / config_name
            if cfg_file.exists():
                backend_dest.mkdir(parents=True, exist_ok=True)
                shutil.copy2(cfg_file, backend_dest / config_name)

    # 4. Copy Frontend Source (frontend/src, package.json, etc.)
    frontend_src = REPO_ROOT / "frontend"
    frontend_dest = CONTEXT_DIR / "frontend"

    if frontend_src.exists():
        src_dir = frontend_src / "src"
        if src_dir.exists():
            for root, dirs, files in os.walk(src_dir):
                dirs[:] = [d for d in dirs if d not in EXCLUDE_DIRS]
                rel_path = Path(root).relative_to(frontend_src)
                target_root = frontend_dest / rel_path
                target_root.mkdir(parents=True, exist_ok=True)

                for f in files:
                    file_path = Path(root) / f
                    if file_path.suffix not in EXCLUDE_EXTS:
                        shutil.copy2(file_path, target_root / f)

        # Copy frontend configs
        for config_name in ["package.json", "tsconfig.json", "vite.config.ts", "README.md", "index.html"]:
            cfg_file = frontend_src / config_name
            if cfg_file.exists():
                frontend_dest.mkdir(parents=True, exist_ok=True)
                shutil.copy2(cfg_file, frontend_dest / config_name)

    # Copy Root configs
    for root_config in ["package.json", "requirements.txt", ".env.example", "README.md"]:
        r_file = REPO_ROOT / root_config
        if r_file.exists():
            shutil.copy2(r_file, CONTEXT_DIR / root_config)

    # 5. Create project-context.zip
    if ZIP_PATH.exists():
        ZIP_PATH.unlink()

    with zipfile.ZipFile(ZIP_PATH, 'w', zipfile.ZIP_DEFLATED) as zip_file:
        for root, dirs, files in os.walk(CONTEXT_DIR):
            for file in files:
                file_path = Path(root) / file
                arcname = file_path.relative_to(CONTEXT_DIR)
                zip_file.write(file_path, arcname)

    # 6. Output Statistics
    size_bytes = ZIP_PATH.stat().st_size
    size_mb = size_bytes / (1024 * 1024)
    print("\n" + "=" * 60)
    print("PROJECT CONTEXT ZIP CREATION COMPLETED")
    print("=" * 60)
    print(f"Zip Location : {ZIP_PATH}")
    print(f"Zip Size     : {size_bytes} bytes ({size_mb:.2f} MB)")
    print(f"Under 10MB?  : {'YES' if size_mb < 10 else 'NO'}")
    print("=" * 60)

if __name__ == "__main__":
    build_context()
