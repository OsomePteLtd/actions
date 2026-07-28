const write = jest.fn<Promise<void>, []>().mockResolvedValue(undefined);
const addRaw = jest.fn((_raw: string) => ({ write }));
const addHeading = jest.fn((_heading: string) => ({ addRaw }));
const warning = jest.fn((_message: string) => undefined);
const info = jest.fn((_message: string) => undefined);

jest.mock('@actions/core', () => ({
  summary: {
    addHeading: (heading: string) => addHeading(heading),
    addRaw: (raw: string) => addRaw(raw),
    write: () => write(),
  },
  warning: (message: string) => warning(message),
  info: (message: string) => info(message),
  getInput: jest.fn(() => ''),
  notice: jest.fn(),
  setFailed: jest.fn(),
}));

import { emitSkip, loadTemplateContext } from './lib';

describe('emitSkip', () => {
  beforeEach(() => jest.clearAllMocks());

  it('writes the summary card and raises a warning', async () => {
    await emitSkip('SKIPPED heading', 'detail body', 'warning text');
    expect(addHeading).toHaveBeenCalledWith('SKIPPED heading');
    expect(addRaw).toHaveBeenCalledWith('\ndetail body\n');
    expect(write).toHaveBeenCalledTimes(1);
    expect(warning).toHaveBeenCalledWith('warning text');
  });

  it('resolves only after the summary write completes', async () => {
    const order: string[] = [];
    write.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) =>
          setTimeout(() => {
            order.push('write');
            resolve();
          }, 10),
        ),
    );
    await emitSkip('h', 'd', 'w');
    order.push('returned');
    expect(order).toEqual(['write', 'returned']);
  });
});

describe('loadTemplateContext — no-template skip path', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    process.env.GITHUB_WORKSPACE = '/nonexistent-workspace-for-pr-lint-tests';
  });

  it('awaits the summary card before returning skip=true', async () => {
    const order: string[] = [];
    write.mockImplementationOnce(
      () =>
        new Promise<void>((resolve) =>
          setTimeout(() => {
            order.push('write');
            resolve();
          }, 10),
        ),
    );
    const ctx = await loadTemplateContext('.github/pull_request_template.md', true);
    order.push('returned');
    expect(ctx).toEqual({ headings: [], skip: true });
    expect(order).toEqual(['write', 'returned']);
    expect(addHeading).toHaveBeenCalledWith('pr-lint SKIPPED — no PR template');
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('pr-lint SKIPPED'));
  });

  it('does not skip when skip-if-no-template is off, and still warns', async () => {
    const ctx = await loadTemplateContext('.github/pull_request_template.md', false);
    expect(ctx).toEqual({ headings: [], skip: false });
    expect(write).not.toHaveBeenCalled();
    expect(warning).toHaveBeenCalledWith(expect.stringContaining('No template found'));
  });
});
