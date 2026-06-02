export type MediaInfo = {
  duration?: number;
  width?: number;
  height?: number;
  fps?: number;
  videoCodec?: string;
  audioCodec?: string;
  raw: unknown;
};

export type CommandResult = {
  command: string;
  args: string[];
  stdout: string;
  stderr: string;
};
