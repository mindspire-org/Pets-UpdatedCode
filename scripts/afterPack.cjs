// Ensures server dependencies are present in the packaged app
// Runs after packaging, installs production deps into resources/server
const path = require('path');
const { execFile } = require('child_process');

module.exports = async function afterPack(context) {
  const serverDir = path.join(context.appOutDir, 'resources', 'server');
  const npmCmd = process.platform === 'win32' ? 'npm.cmd' : 'npm';
  return new Promise((resolve, reject) => {
    const env = {
      ...process.env,
      // Avoid downloading Chromium for puppeteer in build pipeline
      PUPPETEER_SKIP_DOWNLOAD: '1',
      // keep logs terse
      npm_config_loglevel: 'error',
    };
    execFile(
      npmCmd,
      ['install', '--omit=dev', '--no-audit', '--no-fund'],
      { cwd: serverDir, env },
      (err, stdout, stderr) => {
        if (stdout) console.log(stdout.toString());
        if (err) {
          console.error('afterPack: npm install failed in', serverDir);
          if (stderr) console.error(stderr.toString());
          return reject(err);
        }
        console.log('afterPack: server dependencies installed in', serverDir);
        resolve();
      }
    );
  });
};
