const { spawn } = require('child_process');

const relativePathToPackageJson = `${process.env.GITHUB_WORKSPACE}/package.json`;
const { dependencies } = require(relativePathToPackageJson);
const sdkDependencies = Object.keys(dependencies)
  .filter(filterSdkDepCallBack)
  .map((dep) => `${dep}@latest`);
console.log('sdkDependencies : ', sdkDependencies);

const installCmd = spawn('npm', ['i', ...sdkDependencies, '--ignore-scripts']);

installCmd.stdout.on('data', (data) => {
  console.log(`stdout: ${data}`);
});

installCmd.stderr.on('data', (data) => {
  console.log(`stderr: ${data}`);
});

installCmd.on('error', (error) => {
  console.log(`error: ${error.message}`);
  process.exit(1);
});

function filterSdkDepCallBack(dep) {
  return dep.startsWith('@osomepteltd/') && dep.endsWith('-sdk');
}
