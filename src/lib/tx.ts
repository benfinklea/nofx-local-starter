import { withTransaction } from './db';
import { store } from './store';

export async function runAtomically(fn: () => Promise<void>) {
  if (store.driver === 'db') {
    await withTransaction(fn);
  } else {
    await fn();
  }
}
