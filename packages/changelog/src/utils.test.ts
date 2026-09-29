import { matchSlackMember } from './utils';

const members = [
  { id: 'U_LOBURETS', profile: { email: 'dmitry.loburets@osome.com', real_name: 'Dmitry Loburets' } },
  { id: 'U_SHAHRUL', profile: { email: 'shahrul.aiman@osome.com', real_name: 'Shahrul Aiman' } },
  { id: 'U_FAJRI', profile: { email: 'muhammad.fajri@osome.com', real_name: 'Muhammad Naufal Fajri' } },
  { id: 'U_LEFT', deleted: true, profile: { email: 'old.developer@osome.com', real_name: 'Old Developer' } },
  { id: 'U_BOT', is_bot: true, profile: { email: 'release@osome.com', real_name: 'Release Reporter' } },
  { id: 'U_ANNA', profile: { email: 'anna.smith@osome.com', real_name: 'Anna Smith' } },
  { id: 'U_ANNIE', profile: { email: 'anna.smithson@osome.com', real_name: 'Anna Smithson' } },
];

describe('matchSlackMember', () => {
  it.each([
    ['the login sits inside the work email', 'loburets', 'Dmitriy Loburets', 'U_LOBURETS'],
    ['the git name sits inside the real name', 'Talos-git', 'Shah', 'U_SHAHRUL'],
    ['the git name is a shorter real name', 'naufalfajr', 'Naufal Fajri', 'U_FAJRI'],
    ['the member left the workspace', 'olddeveloper', 'Old Developer', null],
    ['the member is a bot', 'release', 'Release Reporter', null],
    ['two members look equally close', 'annasmith', 'Anna Smith', null],
    ['both probes are too short', 'ab', 'Al', null],
    ['there is nothing to match on', undefined, undefined, null],
  ])('handles the case where %s', (_case, login, name, expected) => {
    expect(matchSlackMember(members, [login, name])).toBe(expected);
  });
});
