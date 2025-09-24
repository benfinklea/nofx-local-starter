import { log } from './logger';

interface Options {
  env?: NodeJS.ProcessEnv;
  isTTY?: boolean;
  logger?: Pick<typeof log, 'warn'>;
}

export function shouldEnableDevRestartWatch(options: Options = {}): boolean {
  const { env = process.env, isTTY = process.stdout.isTTY, logger = log } = options;

  if (env.DEV_RESTART_WATCH !== '1') return false;
  if (isTTY) return true;
  if (env.DEV_RESTART_ALLOW_HEADLESS === '1') return true;

  logger.warn(
    {
      env: "DEV_RESTART_WATCH",
    },
    "Dev restart watcher ignored: non-interactive environment detected. Set DEV_RESTART_ALLOW_HEADLESS=1 to force.",
  );
  return false;
}
