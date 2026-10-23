import * as core from '@actions/core';
import { resolve, join as joinPath } from 'path';
import { promises as fs } from 'fs';

import run from '..';
import * as process from 'process';

const mockCoreGetInput = core.getInput as jest.Mock;
const mockCoreSetFailed = core.setFailed as jest.Mock;
const mockReadFileAsync = fs.readFile as jest.Mock;
const mockReadDirAsync = fs.readdir as jest.Mock;
const mockPathResolve = resolve as jest.Mock;

jest.mock('@actions/core');
jest.mock('fs', () => ({
  ...(jest.requireActual('fs') as typeof fs),
  promises: { ...jest.requireActual('fs').promises, readFile: jest.fn(), readdir: jest.fn(), writeFile: jest.fn() },
}));

jest.mock('path', () => ({
  ...jest.requireActual('path'),
  resolve: jest.fn(),
}));

describe('jest-coverage', () => {
  beforeEach(() => {
    process.env.GITHUB_WORKSPACE = process.cwd();
    jest.resetAllMocks();

    const coveragePath = './coverage-directory/';
    mockReadDirAsync.mockImplementation((path) => {
      if (path === coveragePath) {
        return Promise.resolve(['1.json']);
      }
      throw new Error('Invalid path');
    });

    mockCoreGetInput.mockImplementation((inputName) => {
      if (inputName === 'coverage-file-pattern') {
        return `\\d+\\.json`;
      }
      if (inputName === 'coverage-directory') {
        return coveragePath;
      }
      if (inputName === 'jest-config-path') {
        return './jest.config.js';
      }
      return inputName;
    });

    mockPathResolve.mockImplementation((...paths) => joinPath(...paths));
  });

  it('success coverage', async () => {
    const successCoverage = require('./fixtures/success-coverage.json');
    mockReadFileAsync.mockResolvedValue(Promise.resolve(JSON.stringify(successCoverage)));
    await run();
    expect(mockCoreSetFailed).not.toBeCalled();
  });

  it('check jest.config absolute path', async () => {
    const coveragePath = './coverage-directory/';
    mockCoreGetInput.mockImplementation((inputName) => {
      if (inputName === 'coverage-file-pattern') {
        return `\\d+\\.json`;
      }
      if (inputName === 'coverage-directory') {
        return coveragePath;
      }
      if (inputName === 'jest-config-path') {
        return `${process.cwd()}/jest.config.js`;
      }
      return inputName;
    });
    mockReadFileAsync.mockResolvedValue(Promise.resolve('{}'));

    await run();
    expect(mockCoreSetFailed).not.toBeCalled();
  });

  it('failed coverage', async () => {
    const failedCoverage = require('./fixtures/failed-coverage.json');
    mockReadFileAsync.mockResolvedValue(Promise.resolve(JSON.stringify(failedCoverage)));

    await run();

    expect(mockCoreSetFailed).toBeCalled();
  });

  it('unexpected error', async () => {
    mockReadFileAsync.mockRejectedValue(new Error('Unexpected error'));

    await run();

    expect(mockCoreSetFailed).toBeCalled();
  });

  describe('global threshold with path-keyed thresholds', () => {
    const cwd = process.cwd();
    const abs = (file: string) => joinPath(cwd, file);
    const fileCoverage = (file: string, fnHits: number[]) => ({
      path: abs(file),
      statementMap: {},
      s: {},
      branchMap: {},
      b: {},
      fnMap: Object.fromEntries(
        fnHits.map((_, i) => [
          i,
          {
            name: `fn${i}`,
            decl: { start: { line: i + 1, column: 0 }, end: { line: i + 1, column: 1 } },
            loc: { start: { line: i + 1, column: 0 }, end: { line: i + 1, column: 1 } },
          },
        ]),
      ),
      f: Object.fromEntries(fnHits.map((hits, i) => [i, hits])),
    });
    const toCoverageJson = (files: Record<string, number[]>) =>
      Object.fromEntries(Object.entries(files).map(([file, hits]) => [abs(file), fileCoverage(file, hits)]));

    const defaultCoverage = {
      'src/services/a.ts': [1, 1],
      'src/controllers/b.ts': [0, 0],
      'src/controllers-extra/example.ts': [1],
      'src/jobs/c.handler.ts': [0],
    };
    const mockWriteFileAsync = fs.writeFile as jest.Mock;

    beforeEach(() => {
      mockPathResolve.mockImplementation(jest.requireActual('path').resolve);
    });

    const runWithConfig = async (configName: string, files: Record<string, number[]> = defaultCoverage) => {
      mockCoreGetInput.mockImplementation((inputName) => {
        if (inputName === 'coverage-file-pattern') return `\\d+\\.json`;
        if (inputName === 'coverage-directory') return './coverage-directory/';
        if (inputName === 'jest-config-path') return joinPath(__dirname, 'fixtures', configName);
        return inputName;
      });
      mockReadFileAsync.mockResolvedValue(JSON.stringify(toCoverageJson(files)));
      await run();
      return JSON.parse(mockWriteFileAsync.mock.calls[0][1]);
    };

    it('excludes files matched by path and glob keys from global, like Jest', async () => {
      const report = await runWithConfig('path-keys.config.cjs');
      // a.ts (2/2) + controllers-extra/example.ts (1/1) stay in global
      expect(report.total.functions).toMatchObject({ total: 3, covered: 3, pct: 100 });
      expect(report['./src/controllers/'].functions).toMatchObject({ total: 2, covered: 0 });
      expect(report['src/**/*.handler.ts'].functions).toMatchObject({ total: 1, covered: 0 });
      expect(mockCoreSetFailed).not.toBeCalled();
      expect(core.info).toBeCalledWith(expect.stringContaining('global: 2/4 files'));
    });

    it('keeps the trailing separator of a directory key', async () => {
      const report = await runWithConfig('path-keys.config.cjs');
      expect(report['./src/controllers/'].functions.total).toBe(2);
    });

    it('checks glob keys per matching file', async () => {
      await runWithConfig('glob-per-file.config.cjs', {
        'src/jobs/full.handler.ts': [1],
        'src/jobs/empty.handler.ts': [0],
      });
      // aggregate is 50%, but empty.handler.ts is 0% < 50%
      expect(core.error).toBeCalledWith(expect.stringContaining('empty.handler.ts'));
      expect(mockCoreSetFailed).toBeCalled();
    });

    it('keeps counting all files in global when there are no path keys', async () => {
      const report = await runWithConfig('global-only.config.cjs');
      expect(report.total.functions).toMatchObject({ total: 6, covered: 3, pct: 50 });
      expect(mockCoreSetFailed).not.toBeCalled();
    });
  });
});
