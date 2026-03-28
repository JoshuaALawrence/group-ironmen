const fs = require('fs');
const path = require('path');
const { spawn } = require('child_process');
const dotenv = require('dotenv');

const rootDir = path.resolve(__dirname, '..');
dotenv.config({ path: path.join(rootDir, '.env') });

const siteDir = path.join(rootDir, 'src', 'site');
const tscCli = path.join(rootDir, 'node_modules', 'typescript', 'bin', 'tsc');
const backendEntry = path.join(rootDir, 'dist', 'server', 'index.js');
const frontendPort = process.env.FRONTEND_PORT || '4000';
const backendPort = process.env.BACKEND_PORT || '5000';
const externalBackendUrl = process.env.DEV_BACKEND_URL || '';
const backendUrl = externalBackendUrl || `http://localhost:${backendPort}`;
const shouldStartLocalBackend = externalBackendUrl.length === 0 && process.env.SKIP_LOCAL_BACKEND !== '1';

const children = new Set();
let shuttingDown = false;
let backendStarted = false;
let backendPollTimer = null;

function spawnProcess(name, command, args, options = {}) {
  const child = spawn(command, args, {
    cwd: options.cwd || rootDir,
    env: { ...process.env, ...(options.env || {}) },
    stdio: 'inherit',
  });

  children.add(child);

  child.on('exit', (code, signal) => {
    children.delete(child);

    if (shuttingDown) {
      return;
    }

    if (signal) {
      console.error(`[dev] ${name} exited from signal ${signal}`);
      shutdown(1);
      return;
    }

    if (typeof code === 'number' && code !== 0) {
      if (name === 'backend') {
        backendStarted = false;
        console.error('[dev] backend exited; frontend will stay up but API requests will fail until the backend is fixed or DEV_BACKEND_URL is set.');
        return;
      }

      console.error(`[dev] ${name} exited with code ${code}`);
      shutdown(code);
    }
  });

  return child;
}

function shutdown(exitCode = 0) {
  if (shuttingDown) {
    return;
  }

  shuttingDown = true;

  if (backendPollTimer) {
    clearInterval(backendPollTimer);
    backendPollTimer = null;
  }

  for (const child of children) {
    child.kill('SIGTERM');
  }

  setTimeout(() => process.exit(exitCode), 100);
}

function startBackendWhenReady() {
  if (!shouldStartLocalBackend || backendStarted || !fs.existsSync(backendEntry)) {
    return false;
  }

  backendStarted = true;
  spawnProcess('backend', process.execPath, ['--watch', backendEntry], {
    env: {
      PORT: backendPort,
    },
  });
  return true;
}

process.on('SIGINT', () => shutdown(0));
process.on('SIGTERM', () => shutdown(0));

if (!fs.existsSync(tscCli)) {
  console.error('[dev] TypeScript CLI not found. Run npm install first.');
  process.exit(1);
}

console.log(`[dev] frontend: http://localhost:${frontendPort}`);
console.log(`[dev] backend: ${backendUrl}`);
if (!shouldStartLocalBackend) {
  console.log('[dev] local backend startup skipped');
}

spawnProcess('site-build', process.execPath, ['build.js', '--watch'], {
  cwd: siteDir,
});

spawnProcess('site-server', process.execPath, ['scripts/server.js', '--backend', backendUrl], {
  cwd: siteDir,
  env: {
    PORT: frontendPort,
  },
});

if (shouldStartLocalBackend) {
  spawnProcess('tsc-watch', process.execPath, [tscCli, '--watch', '--preserveWatchOutput']);
}

if (shouldStartLocalBackend && !startBackendWhenReady()) {
  backendPollTimer = setInterval(() => {
    if (startBackendWhenReady() && backendPollTimer) {
      clearInterval(backendPollTimer);
      backendPollTimer = null;
    }
  }, 500);
}