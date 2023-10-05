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
});
