import { iam } from './security.serverless';
import { IamRole } from 'serverless/aws';

const yaml = require('js-yaml');
const fs = require('fs');

const project: any = process.env.PROJECT;
const prjExceptionList: string[] = ['core', 'shiva'];
const prjWithServerlessYml: string[] = ['previewer', 'lilith'];

async function main() {
  console.log('Going to check asterisks in iam policy ...');
  const data: any = getIam();
  checkAsterisks(data);
}

function checkAsterisks(data: any) {
  let actions: string[] = [];
  data.forEach((element: any) => {
    if (element.Resource.includes('*') && !matchAction(element.Action)) {
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

function matchAction(line: string) {
  if (prjExceptionList.includes(project)) {
    const re = /^(.*PutMetricData|lambda.*)/gi;
    const result = re.test(line);
    return result;
  } else {
    const re = /^(.*PutMetricData)/gi;
    const result = re.test(line);
    return result;
  }
}

function getIam() {
  if (prjWithServerlessYml.includes(project)) {
    const yamlFile = fs.readFileSync('./serverless.yml', 'utf8');
    const loadedYaml = yaml.load(yamlFile);
    const data: any = loadedYaml.provider.iamRoleStatements;
    return data;
  } else {
    const data: any = (iam.role as IamRole).statements;
    return data;
  }
}

main().catch((err: any) => {
  console.error(err);
  process.exit(1);
});
