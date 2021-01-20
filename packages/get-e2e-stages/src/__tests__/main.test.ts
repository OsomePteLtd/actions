import * as core from '@actions/core';
import * as github from '@actions/github';
import { promises as fs } from 'fs';
import nock from 'nock';

import run, { testEnvs } from '..';

jest.mock('@actions/core');
jest.mock('fs', () => ({
  ...(jest.requireActual('fs') as typeof fs),
  promises: { ...jest.requireActual('fs').promises, readFile: jest.fn() },
}));

describe('get-e2e-stages', () => {
  beforeEach(() => {
    jest.resetAllMocks();
    jest.spyOn(core, 'info').mockImplementation(jest.fn());
  });

  describe('websome', () => {
    beforeEach(() => {
      jest.spyOn(github.context, 'repo', 'get').mockImplementation(() => ({ repo: 'websome', owner: 'OsomePteLtd' }));
    });

    it.each(testEnvs)('sets output for %s environment', async (environment) => {
      jest.spyOn(core, 'getInput').mockImplementation(() => environment);
      github.context.ref = 'refs/heads/some-ref';

      await expect(run()).resolves.not.toThrow();
      const { setFailed, setOutput } = core as jest.Mocked<typeof core>;
      expect(setFailed).toHaveBeenCalledTimes(0);
      expect(setOutput).toHaveBeenCalledTimes(1);
      expect(setOutput.mock.calls[0][0]).toBe('e2e');
      expect(setOutput.mock.calls[0][1]).toMatchObject({
        ADMIN_URL: `https://${environment}.agent.osome.club`,
        WEBSOME_URL: `https://${environment}.my.osome.club`,
        API_AGENT_URL: `https://${environment}.agent.osome.club/api/v2`,
      });
    });

    it('sets output for feature-branch environment', async () => {
      jest.spyOn(core, 'getInput').mockImplementation(() => 'feature-ec-111');
      github.context.ref = 'refs/heads/some-ref';

      await expect(run()).resolves.not.toThrow();
      const { setFailed, setOutput } = core as jest.Mocked<typeof core>;
      expect(setFailed).toHaveBeenCalledTimes(0);
      expect(setOutput).toHaveBeenCalledTimes(1);
      expect(setOutput.mock.calls[0][0]).toBe('e2e');
      expect(setOutput.mock.calls[0][1]).toMatchObject({
        ADMIN_URL: `https://stage.agent.osome.club`,
        WEBSOME_URL: `https://feature-ec-111.my.osome.club`,
        API_AGENT_URL: `https://stage.agent.osome.club/api/v2`,
      });
    });

    it('sets default output if deployment list is empty', async () => {
      jest.spyOn(core, 'getInput').mockImplementation(jest.fn());
      github.context.ref = 'refs/heads/some-ref';

      await expect(run()).resolves.not.toThrow();
      const { setFailed, setOutput } = core as jest.Mocked<typeof core>;
      expect(setFailed).toHaveBeenCalledTimes(0);
      expect(setOutput).toHaveBeenCalledTimes(1);
      expect(setOutput.mock.calls[0][0]).toBe('e2e');
      expect(setOutput.mock.calls[0][1]).toMatchObject({
        ADMIN_URL: `https://stage.agent.osome.club`,
        WEBSOME_URL: `https://stage.my.osome.club`,
        API_AGENT_URL: `https://stage.agent.osome.club/api/v2`,
      });
    });
  });

  describe('agent', () => {
    beforeEach(() => {
      jest.spyOn(github.context, 'repo', 'get').mockImplementation(() => ({ repo: 'agent', owner: 'OsomePteLtd' }));
    });

    it.each(testEnvs)('sets output for %s environment', async (environment) => {
      jest.spyOn(core, 'getInput').mockImplementation(() => environment);
      github.context.ref = 'refs/heads/some-ref';

      await expect(run()).resolves.not.toThrow();
      const { setFailed, setOutput } = core as jest.Mocked<typeof core>;
      expect(setFailed).toHaveBeenCalledTimes(0);
      expect(setOutput).toHaveBeenCalledTimes(1);
      expect(setOutput.mock.calls[0][0]).toBe('e2e');
      expect(setOutput.mock.calls[0][1]).toMatchObject({
        ADMIN_URL: `https://${environment}.agent.osome.club`,
        WEBSOME_URL: `https://${environment}.my.osome.club`,
        API_AGENT_URL: `https://${environment}.agent.osome.club/api/v2`,
      });
    });

    it('sets output for feature-branch environment', async () => {
      jest.spyOn(core, 'getInput').mockImplementation(() => 'feature-ec-111');
      github.context.ref = 'refs/heads/some-ref';

      await expect(run()).resolves.not.toThrow();
      const { setFailed, setOutput } = core as jest.Mocked<typeof core>;
      expect(setFailed).toHaveBeenCalledTimes(0);
      expect(setOutput).toHaveBeenCalledTimes(1);
      expect(setOutput.mock.calls[0][0]).toBe('e2e');
      expect(setOutput.mock.calls[0][1]).toMatchObject({
        ADMIN_URL: `https://feature-ec-111.agent.osome.club`,
        WEBSOME_URL: `https://stage.my.osome.club`,
        API_AGENT_URL: `https://stage.agent.osome.club/api/v2`,
      });
    });

    it('sets default output if deployment list is empty', async () => {
      jest.spyOn(core, 'getInput').mockImplementation(jest.fn());
      github.context.ref = 'refs/heads/some-ref';

      await expect(run()).resolves.not.toThrow();
      const { setFailed, setOutput } = core as jest.Mocked<typeof core>;
      expect(setFailed).toHaveBeenCalledTimes(0);
      expect(setOutput).toHaveBeenCalledTimes(1);
      expect(setOutput.mock.calls[0][0]).toBe('e2e');
      expect(setOutput.mock.calls[0][1]).toMatchObject({
        ADMIN_URL: `https://stage.agent.osome.club`,
        WEBSOME_URL: `https://stage.my.osome.club`,
        API_AGENT_URL: `https://stage.agent.osome.club/api/v2`,
      });
    });
  });

  describe('backend', () => {
    beforeEach(() => {
      jest.spyOn(github.context, 'repo', 'get').mockImplementation(() => ({ repo: 'backend', owner: 'OsomePteLtd' }));
    });

    it.each(testEnvs)('sets output for %s environment', async (environment) => {
      jest.spyOn(core, 'getInput').mockImplementation(() => environment);
      github.context.ref = 'refs/heads/some-ref';

      await expect(run()).resolves.not.toThrow();
      const { setFailed, setOutput } = core as jest.Mocked<typeof core>;
      expect(setFailed).toHaveBeenCalledTimes(0);
      expect(setOutput).toHaveBeenCalledTimes(1);
      expect(setOutput.mock.calls[0][0]).toBe('e2e');
      expect(setOutput.mock.calls[0][1]).toMatchObject({
        ADMIN_URL: `https://${environment}.agent.osome.club`,
        WEBSOME_URL: `https://${environment}.my.osome.club`,
        API_AGENT_URL: `https://${environment}.agent.osome.club/api/v2`,
      });
    });

    it('sets output for feature-branch environment', async () => {
      jest.spyOn(core, 'getInput').mockImplementation(() => 'feature-ec-111');
      github.context.ref = 'refs/heads/some-ref';

      await expect(run()).resolves.not.toThrow();
      const { setFailed, setOutput } = core as jest.Mocked<typeof core>;
      expect(setFailed).toHaveBeenCalledTimes(0);
      expect(setOutput).toHaveBeenCalledTimes(1);
      expect(setOutput.mock.calls[0][0]).toBe('e2e');
      expect(setOutput.mock.calls[0][1]).toMatchObject({
        ADMIN_URL: `https://stage.agent.osome.club`,
        WEBSOME_URL: `https://stage.my.osome.club`,
        API_AGENT_URL: `https://stage.agent.osome.club/api/v2`,
      });
    });

    it('sets default output if deployment list is empty', async () => {
      jest.spyOn(core, 'getInput').mockImplementation(jest.fn());
      github.context.ref = 'refs/heads/some-ref';

      nock(/api\.github\.com/)
        .get('/repos/OsomePteLtd/backend/deployments?ref=some-ref')
        .reply(200, []);

      await expect(run()).resolves.not.toThrow();
      const { setFailed, setOutput } = core as jest.Mocked<typeof core>;
      expect(setFailed).toHaveBeenCalledTimes(0);
      expect(setOutput).toHaveBeenCalledTimes(1);
      expect(setOutput.mock.calls[0][0]).toBe('e2e');
      expect(setOutput.mock.calls[0][1]).toMatchObject({
        ADMIN_URL: `https://stage.agent.osome.club`,
        WEBSOME_URL: `https://stage.my.osome.club`,
        API_AGENT_URL: `https://stage.agent.osome.club/api/v2`,
      });
    });
  });
});
