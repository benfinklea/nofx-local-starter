import type { Application } from 'express';
import { IncomingMessage, ServerResponse } from 'node:http';
import { PassThrough } from 'node:stream';

type Headers = Record<string, string>;

type ExpectationFn = (res: MockResponse) => void | Promise<void>;

type MockResponse = {
  status: number;
  body: any;
  text: string;
  headers: Record<string, number | string | readonly string[]>;
};

function normalizeHeaders(raw: Headers = {}): Headers {
  const next: Headers = {};
  for (const [key, value] of Object.entries(raw)) {
    next[key.toLowerCase()] = value;
  }
  return next;
}

function bufferFromBody(body: any): Buffer | undefined {
  if (body === undefined || body === null) return undefined;
  if (Buffer.isBuffer(body)) return body;
  if (typeof body === 'string') return Buffer.from(body);
  return Buffer.from(JSON.stringify(body));
}

class RequestChain {
  private readonly app: Application;
  private readonly method: string;
  private readonly path: string;
  private headers: Headers = { host: '127.0.0.1' };
  private body: any;
  private expectations: ExpectationFn[] = [];

  constructor(app: Application, method: string, path: string) {
    this.app = app;
    this.method = method;
    this.path = path;
  }

  set(name: string, value: string) {
    this.headers[name.toLowerCase()] = value;
    return this;
  }

  send(payload: any) {
    this.body = payload;
    if (payload !== undefined && payload !== null && !this.headers['content-type']) {
      if (typeof payload === 'object' && !Buffer.isBuffer(payload)) {
        this.headers['content-type'] = 'application/json';
      }
    }
    return this;
  }

  expect(arg: number | ExpectationFn) {
    if (typeof arg === 'number') {
      this.expectations.push((res) => {
        if (res.status !== arg) {
          throw new Error(`Expected status ${arg} but received ${res.status}`);
        }
      });
    } else {
      this.expectations.push(arg);
    }
    return this;
  }

  then<TResult1 = MockResponse, TResult2 = never>(
    onfulfilled?: ((value: MockResponse) => TResult1 | PromiseLike<TResult1>) | null,
    onrejected?: ((reason: any) => TResult2 | PromiseLike<TResult2>) | null
  ) {
    return this.execute().then(onfulfilled as any, onrejected as any);
  }

  catch<TResult = never>(
    onrejected?: ((reason: any) => TResult | PromiseLike<TResult>) | null
  ) {
    return this.execute().catch(onrejected as any);
  }

  finally(onfinally?: (() => void) | null) {
    return this.execute().finally(onfinally ?? undefined);
  }

  private execute(): Promise<MockResponse> {
    return new Promise<MockResponse>((resolve, reject) => {
      const socket = new PassThrough();
      const req = new IncomingMessage(socket as any);
      req.url = this.path;
      req.method = this.method;
      req.headers = normalizeHeaders(this.headers);

      const payloadBuffer = bufferFromBody(this.body);
      if (payloadBuffer) {
        socket.end(payloadBuffer);
      } else {
        socket.end();
      }

      const resSocket = new PassThrough();
      const res = new ServerResponse(req);
      const chunks: Buffer[] = [];

      resSocket.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
      resSocket.on('error', (err) => reject(err));

      // @ts-expect-error assignSocket exists on ServerResponse
      res.assignSocket(resSocket);

      res.on('finish', async () => {
        const text = Buffer.concat(chunks).toString('utf8');
        const headers = res.getHeaders();
        let parsed: any = text;
        const contentType = headers['content-type'];
        if (typeof contentType === 'string' && contentType.includes('application/json')) {
          try {
            parsed = text ? JSON.parse(text) : undefined;
          } catch {
            /* keep raw text */
          }
        }

        const response: MockResponse = {
          status: res.statusCode,
          body: parsed,
          text,
          headers
        };

        try {
          for (const fn of this.expectations) {
            await fn(response);
          }
          resolve(response);
        } catch (err) {
          reject(err);
        } finally {
          const maybeDetach = (res as any).detachSocket;
          if (typeof maybeDetach === 'function') maybeDetach.call(res, resSocket);
        }
      });

      const next = (err?: any) => {
        if (err) {
          reject(err);
        }
      };

      try {
        this.app(req as any, res as any, next);
      } catch (err) {
        reject(err);
      }
    });
  }
}

class RequestBuilder {
  private readonly app: Application;

  constructor(app: Application) {
    this.app = app;
  }

  get(path: string) {
    return new RequestChain(this.app, 'GET', path);
  }

  post(path: string) {
    return new RequestChain(this.app, 'POST', path);
  }

  put(path: string) {
    return new RequestChain(this.app, 'PUT', path);
  }

  delete(path: string) {
    return new RequestChain(this.app, 'DELETE', path);
  }
}

function createRequest(app: Application) {
  return new RequestBuilder(app);
}

export default createRequest;
export const agent = createRequest;
