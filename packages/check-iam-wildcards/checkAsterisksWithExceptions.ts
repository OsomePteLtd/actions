import { iam } from '../security.serverless';

async function main() {
  console.log('Going to check asterisks in iam policy ...');
  checkAsterisks(iam);
}

function checkAsterisks(iam: any) {
  let actions: string[] = [];
  iam.role.statements.forEach((element: any) => {
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
  const re = /^(.*PutMetricData|lambda.*)/gi;
  const result = re.test(line);
  return result;
}

main().catch((err: any) => {
  console.error(err);
  process.exit(1);
});
