"""Run the unchanged production Kotlin detector with desktop pixel adapters.
Uses Kotlin compiler jars already cached by Gradle; no Android device required.
Run: python3 tools/helmet-detector-test/run.py
"""
from pathlib import Path
import argparse
import os
import subprocess
import tempfile

root = Path(__file__).resolve().parents[2]
parser = argparse.ArgumentParser()
parser.add_argument('--image', type=Path, default=root / 'public/helmet-logo-MOTO-01D44-green.png')
parser.add_argument('--output', type=Path, default=root / 'build/helmet-detector-test')
parser.add_argument('--fixture-only', action='store_true', help='Test the supplied pixels without painting alternate payloads')
parser.add_argument('--expected', default='MOTO-01D44')
options = parser.parse_args()
cache = Path.home() / '.gradle/caches/modules-2/files-2.1'
def jar(group, artifact, version=None):
    paths = sorted((cache / group / artifact).glob(f'{version or "*"}/*/*.jar'))
    paths = [p for p in paths if not p.name.endswith(('-sources.jar', '-javadoc.jar'))]
    if not paths:
        raise RuntimeError(f'Missing cached dependency: {artifact}')
    return paths[-1]
compiler = jar('org.jetbrains.kotlin', 'kotlin-compiler-embeddable')
version = compiler.parents[1].name
stdlib = jar('org.jetbrains.kotlin', 'kotlin-stdlib', version)
annotations = jar('org.jetbrains', 'annotations')
jars = [compiler, stdlib, annotations,
        jar('org.jetbrains.kotlin', 'kotlin-script-runtime'),
        jar('org.jetbrains.kotlin', 'kotlin-reflect', '2.2.0'),
        jar('org.jetbrains.kotlinx', 'kotlinx-coroutines-core-jvm')]
jars += list((cache / 'org.jetbrains.intellij.deps/trove4j').glob('*/*/*.jar'))
source = root / 'MotoLock_Native/app/src/main/java/com/example/motolock/data/LogoIdentityDetector.kt'
with tempfile.TemporaryDirectory(prefix='motolock-detector-') as temp:
    fixture = Path(temp) / 'marker.svg'
    subprocess.run(['node', str(root / 'tools/helmet-marker.cjs'), 'MOTO-01D44', str(fixture)], check=True)
    compiled = str(Path(temp) / 'classes')
    subprocess.run(['java', '-cp', os.pathsep.join(map(str, jars)),
        'org.jetbrains.kotlin.cli.jvm.K2JVMCompiler', '-no-stdlib', '-no-reflect',
        '-classpath', os.pathsep.join(map(str, [stdlib, annotations])), '-d', compiled,
        str(source), str(Path(__file__).with_name('Graphics.kt')),
        str(Path(__file__).with_name('Main.kt'))], check=True)
    subprocess.run(['java', '-Djava.awt.headless=true', '-cp',
        os.pathsep.join([compiled, str(stdlib)]), 'MainKt',
        str(options.image.resolve()),
        str(options.output.resolve()),
        str(fixture), str(options.fixture_only).lower(), options.expected], check=True)
