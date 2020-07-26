import * as core from '@actions/core';
import * as github from '@actions/github';
import { promises as fs } from "fs";

import run from '../';

const refMaster = 'refs/heads/master';

describe('get-deployment-stages', () => {
  it('should return the stage for the master branch', async () => {
    process.env['GITHUB_EVENT_PATH'] = 'test';
    fs.readFile = jest.fn().mockResolvedValue(JSON.stringify({ test: 'data' }));
    const setFailedMock = jest.spyOn(core, 'setFailed');

    github.context.ref = refMaster;

    jest.spyOn(core, 'setOutput').mockImplementation((key: string, value: string) => {
      expect(key).toEqual('stages');
      expect(value).toEqual("[\"stage\"]");
    });

    await expect(run()).resolves.not.toThrow();

    expect(fs.readFile).toBeCalledTimes(1);
    expect(setFailedMock).toBeCalledTimes(0);
  });
});
