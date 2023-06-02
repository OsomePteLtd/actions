const yaml = require('js-yaml');
const fs = require('fs');

async function main() {
  console.log('Going to check asterisks in iam policy ...');
  checkAsterisks();
}

function getIam() {
  const yamlFile = fs.readFileSync('./serverless.yml', 'utf8');
  const loadedYaml = yaml.load(yamlFile);
  const iam = loadedYaml.provider.iamRoleStatements;
  return iam;
}

function checkAsterisks() {
  const iam = getIam();
  let actions = [];
  iam.forEach((element) => {
    if (element.Resource.includes('*')) {
      actions.push(element.Action);
    }
  });
  if (actions.length === 0) {
    console.log('Everithing is ok');
    return;
  }
  console.log(
    `Action(s):\n${actions}\ncontain(s) asterisk in Resources field, please provide target resources for the action(s).`,
  );
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
