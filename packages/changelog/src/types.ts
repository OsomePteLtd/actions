export type Changelog = {
  title: string;
  items: ChangelogItem[];
};

type ChangelogItem = {
  author: { email: string; login?: string };
  coauthors: { email: string }[];
  commit: { link: string; message: string; shortSha: string };
  issue: ChangelogIssue | null;
  type: string;
};

type ChangelogIssue = {
  key: string;
  link: string;
  text: string;
};
