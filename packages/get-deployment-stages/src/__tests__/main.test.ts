import * as core from '@actions/core';
import * as github from '@actions/github';
import { promises as fs } from 'fs';
import nock from 'nock';

import run from '..';

const mockCoreGetInput = core.getInput as jest.Mock;
const mockReadFile = fs.readFile as jest.Mock;

jest.mock('@actions/core');
jest.mock('fs', () => ({
  ...(jest.requireActual('fs') as typeof fs),
  promises: { ...jest.requireActual('fs').promises, readFile: jest.fn() },
}));

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

    it('sets output to empty array when ref is not master', async () => {
      const event = {};
      mockReadFile.mockResolvedValue(JSON.stringify(event));
      github.context.eventName = 'push';
      github.context.ref = 'refs/heads/develop';

      await expect(run()).resolves.not.toThrow();

      const { setFailed, setOutput } = core as jest.Mocked<typeof core>;
      expect(setFailed).toHaveBeenCalledTimes(0);
      expect(setOutput).toHaveBeenCalledTimes(1);
      expect(setOutput.mock.calls[0][0]).toBe(`stages`);
      expect(setOutput.mock.calls[0][1]).toMatchInlineSnapshot(`"[]"`);
    });
  });

  describe('pull_request', () => {
    describe('closed', () => {
      it('sets output to all active transient environments', async () => {
        const event = {
          action: 'closed',
          pull_request: { head: { ref: 'feature/test' }, labels: [] },
        };

        process.env.GITHUB_REPOSITORY = 'owner/repo';
        mockCoreGetInput.mockReturnValueOnce('token');
        mockReadFile.mockResolvedValue(JSON.stringify(event));
        github.context.eventName = 'pull_request';
        github.context.ref = 'refs/heads/feature/test';

        nock(/api\.github\.com/)
          .get('/repos/owner/repo/deployments?ref=feature%2Ftest')
          .reply(200, [
            { id: 123, environment: 'feature-test', transient_environment: true },
            { id: 234, environment: 'test-1', transient_environment: false },
          ]);

        nock(/api\.github\.com/)
          .get('/repos/owner/repo/deployments/123/statuses?ref=feature%2Ftest')
          .reply(200, [
            { id: 345, state: 'success' },
            { id: 456, state: 'inactive' },
          ]);

        await expect(run()).resolves.not.toThrow();

        const { setFailed, setOutput } = core as jest.Mocked<typeof core>;
        expect(setFailed).toHaveBeenCalledTimes(0);
        expect(setOutput).toHaveBeenCalledTimes(1);
        expect(setOutput.mock.calls[0][0]).toBe(`stages`);
        expect(setOutput.mock.calls[0][1]).toMatchInlineSnapshot(
          `"[{\\"name\\":\\"feature-test\\",\\"transient_environment\\":false,\\"production_environment\\":false}]"`,
        );
      });

      it('sets output to empty array when no active transient environments exist', async () => {
        const event = {
          action: 'closed',
          pull_request: { head: { ref: 'feature/test' }, labels: [] },
        };

        process.env.GITHUB_REPOSITORY = 'owner/repo';
        mockCoreGetInput.mockReturnValueOnce('token');
        mockReadFile.mockResolvedValue(JSON.stringify(event));
        github.context.eventName = 'pull_request';
        github.context.ref = 'refs/heads/feature/test';

        nock(/api\.github\.com/)
          .get('/repos/owner/repo/deployments?ref=feature%2Ftest')
          .reply(200, [{ id: 123, environment: 'feature-test', transient_environment: true }]);

        nock(/api\.github\.com/)
          .get('/repos/owner/repo/deployments/123/statuses?ref=feature%2Ftest')
          .reply(200, [{ id: 456, state: 'inactive' }]);

        await expect(run()).resolves.not.toThrow();

        const { setFailed, setOutput } = core as jest.Mocked<typeof core>;
        expect(setFailed).toHaveBeenCalledTimes(0);
        expect(setOutput).toHaveBeenCalledTimes(1);
        expect(setOutput.mock.calls[0][0]).toBe(`stages`);
        expect(setOutput.mock.calls[0][1]).toMatchInlineSnapshot(`"[]"`);
      });
    });

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

    it('sets output to empty array when transient are disabled', async () => {
      const event = {
        pull_request: { head: { ref: 'feature/test' }, labels: [] },
      };

      mockCoreGetInput.mockReturnValueOnce('false');
      mockReadFile.mockResolvedValue(JSON.stringify(event));
      github.context.eventName = 'pull_request';
      github.context.ref = 'refs/heads/feature/test';

      await expect(run()).resolves.not.toThrow();

      const { setFailed, setOutput } = core as jest.Mocked<typeof core>;
      expect(setFailed).toHaveBeenCalledTimes(0);
      expect(setOutput).toHaveBeenCalledTimes(1);
      expect(setOutput.mock.calls[0][0]).toBe(`stages`);
      expect(setOutput.mock.calls[0][1]).toMatchInlineSnapshot(`"[]"`);
    });

    it('sets output to branch name when env is not provided', async () => {
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

  describe('repository_dispatch', () => {
    it('sets failed when env is production and actor is not osome-bot', async () => {
      const event = { client_payload: { environment: 'production' } };
      mockReadFile.mockResolvedValue(JSON.stringify(event));
      github.context.actor = 'octocat';
      github.context.eventName = 'repository_dispatch';

      await expect(run()).resolves.not.toThrow();

      const { setFailed, setOutput } = core as jest.Mocked<typeof core>;
      expect(setFailed).toHaveBeenCalledTimes(1);
      expect(setOutput).toHaveBeenCalledTimes(0);
      expect(setFailed.mock.calls[0][0]).toMatchInlineSnapshot(`"Only osome-bot can deploy to production"`);
    });

    it('sets failed when env is not production', async () => {
      const event = { client_payload: { environment: 'stage' } };
      mockReadFile.mockResolvedValue(JSON.stringify(event));
      github.context.actor = 'osome-bot';
      github.context.eventName = 'repository_dispatch';

      await expect(run()).resolves.not.toThrow();

      const { setFailed, setOutput } = core as jest.Mocked<typeof core>;
      expect(setFailed).toHaveBeenCalledTimes(1);
      expect(setOutput).toHaveBeenCalledTimes(0);
      expect(setFailed.mock.calls[0][0]).toMatchInlineSnapshot(
        `"Can use repository_dispatch only to deploy to production"`,
      );
    });

    it('sets output when actor is osome-bot and env is production', async () => {
      const event = { client_payload: { environment: 'production' } };
      mockReadFile.mockResolvedValue(JSON.stringify(event));
      github.context.actor = 'osome-bot';
      github.context.eventName = 'repository_dispatch';

      await expect(run()).resolves.not.toThrow();

      const { setFailed, setOutput } = core as jest.Mocked<typeof core>;
      expect(setFailed).toHaveBeenCalledTimes(0);
      expect(setOutput).toHaveBeenCalledTimes(1);
      expect(setOutput.mock.calls[0][0]).toMatchInlineSnapshot(`"stages"`);
      expect(setOutput.mock.calls[0][1]).toMatchInlineSnapshot(
        `"[{\\"name\\":\\"production\\",\\"transient_environment\\":true,\\"production_environment\\":true}]"`,
      );
    });
  });

  describe('workflow_dispatch', () => {
    it('sets failed when env is production and actor is not osome-bot', async () => {
      const event = { inputs: { environment: 'production' } };
      mockReadFile.mockResolvedValue(JSON.stringify(event));
      github.context.actor = 'octocat';
      github.context.eventName = 'workflow_dispatch';
      github.context.ref = 'refs/heads/feature/test';

      await expect(run()).resolves.not.toThrow();

      const { setFailed, setOutput } = core as jest.Mocked<typeof core>;
      expect(setFailed).toHaveBeenCalledTimes(1);
      expect(setOutput).toHaveBeenCalledTimes(0);
      expect(setFailed.mock.calls[0][0]).toMatchInlineSnapshot(`"Only osome-bot can deploy to production"`);
    });

    it('sets failed when env is production and ref is not master', async () => {
      const event = { inputs: { environment: 'production' } };
      mockReadFile.mockResolvedValue(JSON.stringify(event));
      github.context.actor = 'osome-bot';
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
      github.context.actor = 'osome-bot';
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

    it('sets output to empty array when no valid stages are supplied', async () => {
      const event = { inputs: { environment: 'invalid' } };
      mockReadFile.mockResolvedValue(JSON.stringify(event));
      github.context.eventName = 'workflow_dispatch';
      github.context.ref = 'refs/heads/feature/test';

      await expect(run()).resolves.not.toThrow();

      const { setFailed, setOutput } = core as jest.Mocked<typeof core>;
      expect(setFailed).toHaveBeenCalledTimes(0);
      expect(setOutput).toHaveBeenCalledTimes(1);
      expect(setOutput.mock.calls[0][0]).toBe(`stages`);
      expect(setOutput.mock.calls[0][1]).toMatchInlineSnapshot(`"[]"`);
    });
  });

  it('sets failed when eventName is unknown', async () => {
    const event = {};
    mockReadFile.mockResolvedValue(JSON.stringify(event));
    github.context.eventName = 'unknown';

    await expect(run()).resolves.not.toThrow();

    const { setFailed, setOutput } = core as jest.Mocked<typeof core>;
    expect(setFailed).toHaveBeenCalledTimes(1);
    expect(setOutput).toHaveBeenCalledTimes(0);
    expect(setFailed.mock.calls[0][0]).toMatchInlineSnapshot(`"Unsupported event type"`);
  });
});
