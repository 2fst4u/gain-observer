#!/usr/bin/env python3
"""Verify pinned NEC source inputs and record future Wasm build provenance."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys


ROOT = Path(__file__).resolve().parent
SOURCE_DIR = ROOT / 'nec2c-src'
SOURCE_MANIFEST = ROOT / 'source-manifest.json'


def digest(path):
    return hashlib.sha256(path.read_bytes()).hexdigest()


def verify_sources():
    if SOURCE_DIR.is_symlink():
        raise ValueError('Source directory must not be a symlink.')
    if not SOURCE_DIR.is_dir():
        raise ValueError('Missing nec2-build/nec2c-src. See nec2-build/PROVENANCE.md; '
                         'the committed Wasm has no verified source pin.')
    if not SOURCE_MANIFEST.is_file():
        raise ValueError('Missing nec2-build/source-manifest.json. Record and independently '
                         'verify the exact source revision and file checksums before building.')
    manifest = json.loads(SOURCE_MANIFEST.read_text())
    source = manifest.get('source', {})
    files = manifest.get('files', {})
    if manifest.get('schema_version') != 1 or not isinstance(files, dict) or not files:
        raise ValueError('Source manifest must have schema_version 1 and a nonempty files map.')
    if not all(isinstance(source.get(key), str) and source[key].strip()
               for key in ('url', 'revision', 'version')):
        raise ValueError('Source manifest must record upstream url, immutable revision and version.')
    if not re.fullmatch(r'https?://\S+', source['url']):
        raise ValueError('Source URL must identify the independently verified upstream HTTP(S) source.')
    if not re.fullmatch(r'(?:[a-f0-9]{40}|[a-f0-9]{64})', source['revision']):
        raise ValueError('Source revision must be a full Git commit hash or release-archive SHA-256.')
    if not re.fullmatch(r'[A-Za-z0-9._+\-]+', source['version']):
        raise ValueError('Source version contains characters unsupported by C package metadata.')
    actual_files = {}
    for path in SOURCE_DIR.rglob('*'):
        if path.is_symlink():
            raise ValueError(f'Source tree contains a symlink: {path.relative_to(SOURCE_DIR)}')
        if path.is_file():
            actual_files[path.relative_to(SOURCE_DIR).as_posix()] = digest(path)
    if actual_files.keys() != files.keys():
        missing = sorted(files.keys() - actual_files.keys())
        unlisted = sorted(actual_files.keys() - files.keys())
        raise ValueError(f'Source file inventory differs: missing={missing}, unlisted={unlisted}')
    for name, expected in files.items():
        if not isinstance(expected, str) or not re.fullmatch(r'[a-f0-9]{64}', expected):
            raise ValueError(f'Invalid SHA-256 in source manifest: {name}')
        if actual_files[name] != expected:
            raise ValueError(f'Source checksum differs: {name}')
    return manifest


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('action', choices=('verify', 'record'))
    parser.add_argument('--compiler-version')
    parser.add_argument('--flag', action='append', default=[])
    args = parser.parse_args()
    manifest = verify_sources()
    if args.action == 'verify':
        print(manifest['source']['version'])
        return
    if not args.compiler_version:
        raise ValueError('Recording a build requires the actual compiler version.')
    outputs = ROOT.parent / 'public'
    record = {
        'schema_version': 1,
        'source_manifest_sha256': digest(SOURCE_MANIFEST),
        'source': manifest,
        'compiler_version': args.compiler_version,
        'compiler_flags': args.flag,
        'artifacts': {name: digest(outputs / name) for name in ('nec2.js', 'nec2.wasm')},
    }
    (ROOT / 'build-manifest.json').write_text(json.dumps(record, indent=2, sort_keys=True) + '\n')


if __name__ == '__main__':
    try:
        main()
    except (ValueError, OSError, json.JSONDecodeError) as error:
        print(f'ERROR: {error}', file=sys.stderr)
        sys.exit(1)
