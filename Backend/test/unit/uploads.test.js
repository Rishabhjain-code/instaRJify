const { test } = require("node:test");
const assert = require("node:assert/strict");
const { EventEmitter } = require("node:events");
const { createUploadHandler } = require("../../middleware/uploadGate");

function request() {
  const req = new EventEmitter();
  req.is = () => true;
  return req;
}

test("upload admission bounds concurrent buffered/processing requests and restores capacity", async () => {
  const withUpload = createUploadHandler((_req, _res, next) => next());
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const handler = withUpload(async () => gate);
  const headers = {};
  const res = {
    set: (key, value) => {
      headers[key] = value;
    },
  };
  const first = handler(request(), res);
  const second = handler(request(), res);
  await assert.rejects(handler(request(), res), { status: 503, code: "UPLOAD_BUSY" });
  assert.equal(headers["Retry-After"], "1");
  release();
  await Promise.all([first, second]);
  await handler(request(), res);
});

test("an aborted parser and a failed handler release their upload slots", async () => {
  const withUpload = createUploadHandler((req, _res, next) => {
    if (!req.hold) next();
  });
  const req = request();
  req.hold = true;
  const res = { set: () => {} };
  const interrupted = withUpload(async () => {})(req, res);
  req.emit("aborted");
  await assert.rejects(interrupted, { code: "UPLOAD_ABORTED" });
  await assert.rejects(
    withUpload(async () => {
      throw new Error("Controlled handler failure");
    })(request(), res),
    /Controlled handler failure/,
  );
  let release;
  const gate = new Promise((resolve) => {
    release = resolve;
  });
  const handler = withUpload(async () => gate);
  const first = handler(request(), res);
  const second = handler(request(), res);
  release();
  await Promise.all([first, second]);
});
