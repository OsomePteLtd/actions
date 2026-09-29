export type Changelog = {
  title: string;
  items: ChangelogItem[];
};

export type ChangelogAuthor = { email: string; login?: string; name?: string };

type ChangelogItem = {
  author: ChangelogAuthor;
  coauthors: ChangelogAuthor[];
  commit: { link: string; message: string; shortSha: string };
  issue: ChangelogIssue | null;
  type: string;
};

type ChangelogIssue = {
  key: string;
  link: string;
  text: string;
};
