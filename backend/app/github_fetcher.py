"""
Fetches a public GitHub repository and assembles its full content into
a context string stored server-side. On each chat turn, only the most
relevant file sections are extracted and sent to the LLM (smart RAG),
keeping every request within the model's token budget.
"""

import re
import asyncio
import httpx
from pathlib import PurePosixPath

# ── Hard limits ───────────────────────────────────────────────────────────────
MAX_FILE_CHARS  = 40_000   # truncate single file beyond this
MAX_TOTAL_CHARS = 400_000  # stop adding files — full fetch, trimmed at send time
MAX_FILES       = 200      # hard cap on file count

# Tokens sent to Gemini = chars / 4 roughly.
# We budget 100K tokens for repo context → 400K chars stored, 400K chars sent.
# The remaining tokens cover system prompt + conversation history.
MAX_CONCURRENCY = 20       # parallel HTTP fetches

# ── Directories to always skip (generated/binary/tool noise) ─────────────────
SKIP_DIRS = {
    'node_modules', '.git', '.pnpm', '.yarn',
    'dist', 'build', 'out', '.next', '.nuxt', '.output', '.svelte-kit',
    '__pycache__', '.mypy_cache', '.ruff_cache', '.pytest_cache',
    'target',            # Rust/Java build
    '.gradle',           # Gradle cache
    'vendor',            # Go vendor (large, generated)
    'coverage', '.nyc_output',
}

# ── Extensions that are always binary / generated noise ──────────────────────
SKIP_EXTS = {
    # images
    '.png', '.jpg', '.jpeg', '.gif', '.webp', '.bmp', '.tiff', '.ico',
    '.woff', '.woff2', '.ttf', '.eot', '.otf',
    # binary
    '.pdf', '.zip', '.tar', '.gz', '.bz2', '.7z', '.rar',
    '.jar', '.war', '.ear', '.class',
    '.exe', '.dll', '.so', '.dylib', '.a', '.lib',
    '.pyc', '.pyo', '.pyd',
    # generated
    '.map',              # source maps
    '.sum',              # Go checksums
    # lock files (very long, no signal)
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
    'composer.lock', 'gemfile.lock', 'poetry.lock', 'cargo.lock',
    'packages.lock.json', 'project.assets.json',
}

# ── File extensions we actively want ─────────────────────────────────────────
INCLUDE_EXTS = {
    # backend
    '.py', '.pyi', '.rb', '.go', '.rs', '.java', '.kt', '.scala',
    '.cs', '.fs', '.php', '.cpp', '.cc', '.cxx', '.c', '.h', '.hpp',
    '.swift', '.m', '.mm', '.r', '.jl',
    # frontend
    '.ts', '.tsx', '.js', '.jsx', '.mjs', '.cjs',
    '.vue', '.svelte', '.astro',
    '.html', '.htm', '.css', '.scss', '.sass', '.less',
    # data / config
    '.json', '.jsonc', '.yaml', '.yml', '.toml', '.ini', '.cfg',
    '.conf', '.config', '.env', '.properties',
    '.xml', '.xsd', '.wsdl',
    # infra / ops
    '.sh', '.bash', '.zsh', '.fish', '.ps1', '.bat', '.cmd',
    '.tf', '.tfvars', '.hcl',
    '.dockerfile',
    # query / schema
    '.sql', '.graphql', '.gql', '.prisma', '.proto',
    # docs
    '.md', '.mdx', '.rst', '.txt', '.adoc', '.org',
    # notebooks
    '.ipynb',
}

# Exact filenames always included regardless of extension
INCLUDE_NAMES = {
    'dockerfile', 'makefile', 'justfile', 'procfile', 'caddyfile',
    '.gitignore', '.gitattributes',
    '.env.example', '.env.sample', '.env.template',
    '.eslintrc', '.prettierrc', '.babelrc', '.browserslistrc',
    'tsconfig.json', 'jsconfig.json',
    'vite.config.ts', 'vite.config.js',
    'webpack.config.js', 'webpack.config.ts',
    'rollup.config.js',
    'jest.config.js', 'jest.config.ts', 'vitest.config.ts',
    'tailwind.config.js', 'tailwind.config.ts',
    'next.config.js', 'next.config.ts',
    'nuxt.config.ts',
    'svelte.config.js',
    'astro.config.mjs',
    'docker-compose.yml', 'docker-compose.yaml',
    '.github/workflows',   # prefix match handled below
    'package.json', 'pyproject.toml', 'setup.py', 'setup.cfg',
    'requirements.txt', 'requirements-dev.txt',
    'go.mod', 'cargo.toml', 'pom.xml',
    'build.gradle', 'build.gradle.kts', 'settings.gradle',
    'gemfile',
}


def _parse_github_url(url: str) -> tuple[str, str]:
    url = url.strip().rstrip('/')
    m = re.search(r'github\.com/([^/]+)/([^/?\s#]+)', url)
    if not m:
        raise ValueError("Not a valid GitHub repository URL")
    return m.group(1), m.group(2)


def _should_include(path: str) -> bool:
    parts = path.split('/')

    # Check each directory segment
    for part in parts[:-1]:
        if part.lower() in SKIP_DIRS:
            return False

    name_lower = parts[-1].lower()
    ext = PurePosixPath(path).suffix.lower()

    # Always include by name
    if name_lower in INCLUDE_NAMES:
        return True

    # GitHub Actions workflows
    if path.startswith('.github/'):
        return True

    # Skip by extension (exact match on full filename for lock files)
    if name_lower in SKIP_EXTS or ext in SKIP_EXTS:
        return False

    # Include by extension
    if ext in INCLUDE_EXTS:
        return True

    # Files with no extension at root (Makefile, Dockerfile, Procfile…)
    if '/' not in path and not ext:
        return True

    return False


def _priority_score(path: str) -> tuple[int, int]:
    """Sort key: (tier, depth). Lower = higher priority."""
    depth = path.count('/')
    name  = PurePosixPath(path).name.lower()
    ext   = PurePosixPath(path).suffix.lower()

    # Tier 0 — root config/docs
    if depth == 0:
        return (0, 0)
    # Tier 1 — READMEs and docs anywhere
    if ext in {'.md', '.mdx', '.rst', '.txt'} or 'readme' in name:
        return (1, depth)
    # Tier 2 — CI/CD, Dockerfile, compose
    if path.startswith('.github/') or 'docker' in name or name in {'makefile', 'justfile'}:
        return (2, depth)
    # Tier 3 — source code
    if ext in {'.py', '.ts', '.tsx', '.js', '.jsx', '.go', '.rs', '.java', '.kt', '.cs', '.rb', '.php', '.cpp', '.c'}:
        return (3, depth)
    # Tier 4 — tests (useful but after main source)
    if 'test' in path.lower() or 'spec' in path.lower():
        return (5, depth)
    # Tier 5 — everything else
    return (4, depth)


async def fetch_repo_context(url: str) -> dict:
    owner, repo = _parse_github_url(url)
    headers = {
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'LEON-AI/1.0',
    }

    limits = httpx.Limits(max_connections=MAX_CONCURRENCY, max_keepalive_connections=MAX_CONCURRENCY)

    async with httpx.AsyncClient(timeout=30, headers=headers, limits=limits) as client:

        # ── 1. Repo metadata ─────────────────────────────────────────────
        meta_r = await client.get(f'https://api.github.com/repos/{owner}/{repo}')
        if meta_r.status_code == 404:
            raise ValueError(f"Repository '{owner}/{repo}' not found or is private")
        if meta_r.status_code == 403:
            raise ValueError("GitHub rate limit reached — try again in a minute")
        meta_r.raise_for_status()
        meta = meta_r.json()
        default_branch = meta.get('default_branch', 'main')

        # ── 2. Recursive file tree ────────────────────────────────────────
        tree_r = await client.get(
            f'https://api.github.com/repos/{owner}/{repo}/git/trees/{default_branch}?recursive=1'
        )
        tree_r.raise_for_status()
        tree_data = tree_r.json()
        was_truncated_by_github = tree_data.get('truncated', False)

        blobs = [
            item['path'] for item in tree_data.get('tree', [])
            if item['type'] == 'blob' and _should_include(item['path'])
        ]

        # If GitHub truncated the tree (>100k objects), also fetch top-level dirs
        if was_truncated_by_github:
            top_dirs_r = await client.get(
                f'https://api.github.com/repos/{owner}/{repo}/git/trees/{default_branch}'
            )
            if top_dirs_r.status_code == 200:
                for item in top_dirs_r.json().get('tree', []):
                    if item['type'] == 'tree' and item['path'].lower() not in SKIP_DIRS:
                        sub_r = await client.get(
                            f'https://api.github.com/repos/{owner}/{repo}/git/trees/{item["sha"]}?recursive=1'
                        )
                        if sub_r.status_code == 200:
                            for sub in sub_r.json().get('tree', []):
                                full = f"{item['path']}/{sub['path']}"
                                if sub['type'] == 'blob' and _should_include(full) and full not in blobs:
                                    blobs.append(full)

        blobs.sort(key=_priority_score)
        blobs = blobs[:MAX_FILES]

        # ── 3. Fetch raw content concurrently ─────────────────────────────
        raw_base = f'https://raw.githubusercontent.com/{owner}/{repo}/{default_branch}'
        sem = asyncio.Semaphore(MAX_CONCURRENCY)

        async def fetch_file(path: str) -> tuple[str, str]:
            async with sem:
                try:
                    r = await client.get(f'{raw_base}/{path}')
                    if r.status_code == 200:
                        text = r.text
                        if len(text) > MAX_FILE_CHARS:
                            text = text[:MAX_FILE_CHARS] + f'\n\n... [file truncated — {len(r.text):,} chars total]'
                        return path, text
                except Exception:
                    pass
            return path, ''

        results = await asyncio.gather(*[fetch_file(p) for p in blobs])

    # ── 4. Assemble context ───────────────────────────────────────────────
    header = '\n'.join([
        f"# Repository: {meta['full_name']}",
        f"URL: {meta['html_url']}",
        f"Description: {meta.get('description') or 'No description'}",
        f"Primary language: {meta.get('language') or 'Unknown'}",
        f"Stars: {meta.get('stargazers_count', 0):,}  |  Forks: {meta.get('forks_count', 0):,}",
        f"Default branch: {default_branch}",
        f"Topics: {', '.join(meta.get('topics', [])) or 'none'}",
        '',
    ])

    sections = []
    total_chars = len(header)
    files_added = 0
    context_truncated = False

    for path, content in results:
        if not content.strip():
            continue
        block = f'### {path}\n```\n{content}\n```\n\n'
        if total_chars + len(block) > MAX_TOTAL_CHARS:
            context_truncated = True
            break
        sections.append(block)
        total_chars += len(block)
        files_added += 1

    return {
        'name':        meta['name'],
        'full_name':   meta['full_name'],
        'description': meta.get('description') or '',
        'stars':       meta.get('stargazers_count', 0),
        'language':    meta.get('language') or '',
        'url':         meta['html_url'],
        'context':     header + '\n'.join(sections),
        'file_count':  files_added,
        'truncated':   context_truncated,
    }


# ── Smart context extraction ──────────────────────────────────────────────────
# Gemini API: single request budget ≈ 4,500 input tokens ≈ 18,000 chars (safe & fast).
# We search the full stored context for files most relevant to the user's query.

_STOP_WORDS = {
    'the','and','for','how','what','does','where','which','this','that',
    'with','from','have','into','about','can','you','are','was','were',
    'will','would','should','could','may','might',
}

CONTEXT_BUDGET = 16_000   # chars sent per request (~4K tokens, safe under 6K TPM)
ALWAYS_INCLUDE = 3_000    # chars of repo header + key config always prepended


def get_relevant_sections(full_context: str, query: str) -> str:
    """
    Given the full stored repo context and the user's query, return only
    the file sections most relevant to the query, capped at CONTEXT_BUDGET chars.
    Always includes the repo header (metadata + README summary).
    """
    # Split on file section markers
    parts = re.split(r'(?=### )', full_context)
    header = parts[0] if parts and not parts[0].startswith('###') else ''
    file_sections = [p for p in parts if p.startswith('###')]

    if not file_sections:
        return full_context[:CONTEXT_BUDGET]

    # Extract query keywords (3+ chars, not stop words)
    keywords = {
        w for w in re.findall(r'\b[a-z][a-z0-9_]{2,}\b', query.lower())
        if w not in _STOP_WORDS
    }

    # Score each section by keyword frequency + path relevance
    scored: list[tuple[float, str]] = []
    for section in file_sections:
        first_line = section.split('\n', 1)[0].lower()  # "### path/to/file.py"
        body_lower = section.lower()

        # Path bonus: keywords in the filename score higher
        path_score = sum(10 for kw in keywords if kw in first_line)
        body_score = sum(body_lower.count(kw) for kw in keywords)

        # Always-include bonus for root-level docs/config
        depth = first_line.count('/')
        root_bonus = 5 if depth <= 1 else 0

        scored.append((path_score + body_score + root_bonus, section))

    scored.sort(key=lambda x: -x[0])

    # Build result: header first, then best-scoring sections
    header_trimmed = header[:ALWAYS_INCLUDE]
    result = header_trimmed
    budget = CONTEXT_BUDGET - len(header_trimmed)

    for _, section in scored:
        chunk = section if len(section) <= budget else section[:budget] + '\n... [truncated]\n'
        result += chunk
        budget -= len(chunk)
        if budget < 200:
            break

    return result
