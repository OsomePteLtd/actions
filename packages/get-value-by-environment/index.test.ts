import * as core from '@actions/core';
import run from '.';

jest.mock('@actions/core');
const mockCoreGetInput = core.getInput as jest.Mock;
const mockCoreExportVariable = core.exportVariable as jest.Mock;

describe('get-value-by-environment', () => {
  it('returns matching value for production environment', async () => {
    mockCoreGetInput
      .mockReturnValueOnce('ENV_VARIABLE')
      .mockReturnValueOnce('production')
      .mockReturnValueOnce('dev')
      .mockReturnValueOnce('staging')
      .mockReturnValueOnce('production');

    await expect(run()).resolves.not.toThrow();
    expect(mockCoreExportVariable.mock.calls[0][0]).toMatchInlineSnapshot(`"ENV_VARIABLE"`);
    expect(mockCoreExportVariable.mock.calls[0][1]).toMatchInlineSnapshot(`"production"`);
  });

  it('returns matching value for staging environment', async () => {
    mockCoreGetInput
      .mockReturnValueOnce('ENV_VARIABLE')
      .mockReturnValueOnce('stage')
      .mockReturnValueOnce('dev')
      .mockReturnValueOnce('staging')
      .mockReturnValueOnce('production');

    await expect(run()).resolves.not.toThrow();
    expect(mockCoreExportVariable.mock.calls[0][0]).toMatchInlineSnapshot(`"ENV_VARIABLE"`);
    expect(mockCoreExportVariable.mock.calls[0][1]).toMatchInlineSnapshot(`"staging"`);
  });

  it('returns matching value for development environment', async () => {
    mockCoreGetInput
      .mockReturnValueOnce('ENV_VARIABLE')
      .mockReturnValueOnce('test-1')
      .mockReturnValueOnce('dev')
      .mockReturnValueOnce('staging')
      .mockReturnValueOnce('production');

    await expect(run()).resolves.not.toThrow();
    expect(mockCoreExportVariable.mock.calls[0][0]).toMatchInlineSnapshot(`"ENV_VARIABLE"`);
    expect(mockCoreExportVariable.mock.calls[0][1]).toMatchInlineSnapshot(`"dev"`);
  });

  it('returns staging value for development environment when no matching value is present', async () => {
    mockCoreGetInput
      .mockReturnValueOnce('ENV_VARIABLE')
      .mockReturnValueOnce('test-1')
      .mockReturnValueOnce(undefined)
      .mockReturnValueOnce('staging')
      .mockReturnValueOnce('production');

    await expect(run()).resolves.not.toThrow();
    expect(mockCoreExportVariable.mock.calls[0][0]).toMatchInlineSnapshot(`"ENV_VARIABLE"`);
    expect(mockCoreExportVariable.mock.calls[0][1]).toMatchInlineSnapshot(`"staging"`);
  });
});
