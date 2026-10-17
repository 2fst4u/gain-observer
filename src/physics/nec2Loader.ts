export interface EmscriptenFS {
  writeFile(path: string, data: string | Uint8Array): void;
  readFile(path: string): Uint8Array;
  readFile(path: string, opts: { encoding: 'utf8' }): string;
  unlink?(path: string): void;
}

export interface EmscriptenInstance {
  FS: EmscriptenFS;
  callMain(args: string[]): number;
  ccall: (...args: unknown[]) => unknown;
  HEAPF64: Float64Array;
}

export interface EmscriptenFactory {
  (opts?: {
    print?: (s: string) => void;
    printErr?: (s: string) => void;
    noInitialRun?: boolean;
    locateFile?: (path: string, prefix: string) => string;
  }): Promise<EmscriptenInstance>;
}

/**
 * The glue loader exposes `Nec2Module` as an ES module default export.
 *
 * We must use a *fully-qualified* URL for the dynamic import(). If we pass
 * a bare path like "/nec2.js" Vite's dev server tries to resolve it as a
 * source module and errors with "This file is in /public and should not be
 * imported from source code". Constructing the URL from `location.origin`
 * (or `self.location` inside a worker) defeats that static analysis.
 *
 * Keep this helper separate so tests can stub it out with a file:// URL.
 */

export function validateUrlOrigin(parsedUrl: URL): void {
  if (!['http:', 'https:', 'file:'].includes(parsedUrl.protocol)) {
    throw new Error(`Untrusted protocol: ${parsedUrl.protocol}`);
  }

  if (parsedUrl.protocol === 'file:') return;

  const currentOrigin =
    typeof self !== 'undefined' && typeof self.location !== 'undefined' && self.location.origin !== 'null'
      ? self.location.origin
      : 'http://localhost';

  const expectedOrigin = new URL(currentOrigin === 'http://localhost' ? 'http://localhost/' : currentOrigin).origin;

  if (parsedUrl.origin !== expectedOrigin && parsedUrl.hostname !== 'localhost' && parsedUrl.hostname !== '127.0.0.1') {
    throw new Error(`Untrusted origin: ${parsedUrl.origin}`);
  }
}

export async function loadNec2Factory(baseUrl: string): Promise<EmscriptenFactory> {
  let url: string;
  if (/^https?:|^file:/.test(baseUrl)) {
    // Already an absolute URL (e.g. test harness).
    url = `${baseUrl}nec2.js`;
  } else {
    // Relative to the current origin. Building the absolute URL at runtime
    // prevents Vite from treating the specifier as a source file.
    const origin =
      typeof self !== 'undefined' && typeof self.location !== 'undefined'
        ? self.location.origin
        : '';
    url = new URL(`${baseUrl}nec2.js`, origin || 'http://localhost/').href;
  }
  const parsedUrl = new URL(url, 'http://localhost/');
  validateUrlOrigin(parsedUrl);
  const mod = (await import(/* @vite-ignore */ parsedUrl.href)) as { default: EmscriptenFactory };
  return mod.default;
}
