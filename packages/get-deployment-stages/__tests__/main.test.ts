import * as core from '@actions/core';
import * as github from '@actions/github';
import { promises as fs } from 'fs';

import run from '../';

const refMaster = 'refs/heads/master';

jest.mock('@actions/core');
jest.mock('@actions/github');
jest.mock('fs', () => ({ promises: { readFile: jest.fn() } }));
const mockReadFile = fs.readFile as jest.Mock;

describe('get-deployment-stages', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  it('should return the stage for the master branch', async () => {
    process.env['GITHUB_EVENT_PATH'] = 'test';
    mockReadFile.mockResolvedValue(JSON.stringify({ test: 'data' }));

    github.context.ref = refMaster;

    jest.spyOn(core, 'setOutput').mockImplementation((key: string, value: string) => {
      expect(key).toEqual('stages');
      expect(value).toEqual('["stage"]');
    });

    await expect(run()).resolves.not.toThrow();

    expect(fs.readFile).toBeCalledTimes(1);
    expect(core.setFailed).toBeCalledTimes(0);
  });

  it('should return a branch name as default way', async () => {
    process.env['GITHUB_EVENT_PATH'] = 'test';
    const event = {
      pull_request: {
        head: {
          ref: 'feature/branch-name',
        },
        labels: [],
      },
    };
    mockReadFile.mockResolvedValue(JSON.stringify(event));

    github.context.ref = 'test';
    github.context.eventName = 'pull_request';

    jest.spyOn(core, 'setOutput').mockImplementation((key: string, value: string) => {
      expect(key).toEqual('stages');
      expect(value).toEqual('["feature-branch-name"]');
    });

    await expect(run()).resolves.not.toThrow();

    expect(fs.readFile).toBeCalledTimes(1);
    expect(core.setFailed).toBeCalledTimes(0);
  });

  describe('pull_request', () => {
    it('sets output to branch name when env is production', async () => {
      const event = {
        pull_request: { head: { ref: 'feature/test' }, labels: [{ name: '' }] },
      };

      mockReadFile.mockResolvedValue(JSON.stringify(event));
      github.context.eventName = 'pull_request';
      github.context.ref = 'refs/heads/feature/test';

      await expect(run()).resolves.not.toThrow();

      const { setFailed, setOutput } = core as jest.Mocked<typeof core>;
      expect(setFailed).toHaveBeenCalledTimes(0);
      expect(setOutput).toHaveBeenCalledTimes(1);
      expect(setOutput.mock.calls[0][0]).toBe(`stages`);
      expect(setOutput.mock.calls[0][1]).toMatchInlineSnapshot(`"[\\"feature-test\\"]"`);
    });
  });

  describe('workflow_event', () => {
    it('sets failed when env is production and ref is not master', async () => {
      const event = { inputs: { environment: 'production' } };
      mockReadFile.mockResolvedValue(JSON.stringify(event));
      github.context.eventName = 'workflow_dispatch';
      github.context.ref = 'refs/heads/feature/test';

      await expect(run()).resolves.not.toThrow();

      const { setFailed, setOutput } = core as jest.Mocked<typeof core>;
      expect(setFailed).toHaveBeenCalledTimes(1);
      expect(setOutput).toHaveBeenCalledTimes(0);
      expect(setFailed.mock.calls[0][0]).toMatchInlineSnapshot(`"Can deploy to production from master branch only"`);
    });

    it('sets output when env is production and ref is master', async () => {
      const event = { inputs: { environment: 'production' } };
      mockReadFile.mockResolvedValue(JSON.stringify(event));
      github.context.eventName = 'workflow_dispatch';
      github.context.ref = 'refs/heads/master';

      await expect(run()).resolves.not.toThrow();

      const { setFailed, setOutput } = core as jest.Mocked<typeof core>;
      expect(setFailed).toHaveBeenCalledTimes(0);
      expect(setOutput).toHaveBeenCalledTimes(1);
      expect(setOutput.mock.calls[0][0]).toBe(`stages`);
      expect(setOutput.mock.calls[0][1]).toMatchInlineSnapshot(`"[\\"production\\"]"`);
    });

    it('sets output when env is stage and ref is not master', async () => {
      const event = { inputs: { environment: 'stage' } };
      mockReadFile.mockResolvedValue(JSON.stringify(event));
      github.context.eventName = 'workflow_dispatch';
      github.context.ref = 'refs/heads/feature/test';

      await expect(run()).resolves.not.toThrow();

      const { setFailed, setOutput } = core as jest.Mocked<typeof core>;
      expect(setFailed).toHaveBeenCalledTimes(0);
      expect(setOutput).toHaveBeenCalledTimes(1);
      expect(setOutput.mock.calls[0][0]).toBe(`stages`);
      expect(setOutput.mock.calls[0][1]).toMatchInlineSnapshot(`"[\\"stage\\"]"`);
    });
  });
});
