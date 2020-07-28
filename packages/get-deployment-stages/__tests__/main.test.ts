import * as core from '@actions/core';
import * as github from '@actions/github';
import { promises as fs } from 'fs';

import run from '../';

jest.mock('@actions/core');
jest.mock('@actions/github');
jest.mock('fs', () => ({ promises: { readFile: jest.fn() } }));
const mockReadFile = fs.readFile as jest.Mock;

describe('get-deployment-stages', () => {
  beforeEach(() => {
    jest.resetAllMocks();
  });

  describe('push', () => {
    it('sets output to stage when ref is master', async () => {
      const event = {};
      mockReadFile.mockResolvedValue(JSON.stringify(event));
      github.context.eventName = 'push';
      github.context.ref = 'refs/heads/master';

      await expect(run()).resolves.not.toThrow();

      const { setFailed, setOutput } = core as jest.Mocked<typeof core>;
      expect(setFailed).toHaveBeenCalledTimes(0);
      expect(setOutput).toHaveBeenCalledTimes(1);
      expect(setOutput.mock.calls[0][0]).toBe(`stages`);
      expect(setOutput.mock.calls[0][1]).toMatchInlineSnapshot(
        `"[{\\"name\\":\\"stage\\",\\"transient_environment\\":true,\\"production_environment\\":false}]"`,
      );
    });
  });

  describe('pull_request', () => {
    it('sets output to branch name when env is not provided', async () => {
      const event = {
        pull_request: { head: { ref: 'feature/test' }, labels: [] },
      };

      mockReadFile.mockResolvedValue(JSON.stringify(event));
      github.context.eventName = 'pull_request';
      github.context.ref = 'refs/heads/feature/test';

      await expect(run()).resolves.not.toThrow();

      const { setFailed, setOutput } = core as jest.Mocked<typeof core>;
      expect(setFailed).toHaveBeenCalledTimes(0);
      expect(setOutput).toHaveBeenCalledTimes(1);
      expect(setOutput.mock.calls[0][0]).toBe(`stages`);
      expect(setOutput.mock.calls[0][1]).toMatchInlineSnapshot(
        `"[{\\"name\\":\\"feature-test\\",\\"transient_environment\\":false,\\"production_environment\\":false}]"`,
      );
    });

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
      expect(setOutput.mock.calls[0][1]).toMatchInlineSnapshot(
        `"[{\\"name\\":\\"feature-test\\",\\"transient_environment\\":false,\\"production_environment\\":false}]"`,
      );
    });

    it('sets output when multiple envs are provided', async () => {
      const event = {
        pull_request: {
          head: { ref: 'feature/test' },
          labels: [{ name: 'deployed to test-1' }, { name: 'deployed to test-2' }],
        },
      };

      mockReadFile.mockResolvedValue(JSON.stringify(event));
      github.context.eventName = 'pull_request';
      github.context.ref = 'refs/heads/feature/test';

      await expect(run()).resolves.not.toThrow();

      const { setFailed, setOutput } = core as jest.Mocked<typeof core>;
      expect(setFailed).toHaveBeenCalledTimes(0);
      expect(setOutput).toHaveBeenCalledTimes(1);
      expect(setOutput.mock.calls[0][0]).toBe(`stages`);
      expect(setOutput.mock.calls[0][1]).toMatchInlineSnapshot(
        `"[{\\"name\\":\\"test-1\\",\\"transient_environment\\":true,\\"production_environment\\":false},{\\"name\\":\\"test-2\\",\\"transient_environment\\":true,\\"production_environment\\":false}]"`,
      );
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
      expect(setOutput.mock.calls[0][1]).toMatchInlineSnapshot(
        `"[{\\"name\\":\\"production\\",\\"transient_environment\\":true,\\"production_environment\\":true}]"`,
      );
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
      expect(setOutput.mock.calls[0][1]).toMatchInlineSnapshot(
        `"[{\\"name\\":\\"stage\\",\\"transient_environment\\":true,\\"production_environment\\":false}]"`,
      );
    });
  });
});
