/* global describe */
/* global it */

import loopdev from "../lib/index.js";
import tmp from "tmp-promise";
import fs from "fs";
import assert from "assert";
import { performance } from "perf_hooks";

const testImageContent = Buffer.alloc(1 * 1024 * 1024);
const testString = "Hello, World!";
Buffer.from(testString).copy(testImageContent);

const maybeTest = (test) => {
  if (test) {
    return it;
  } else {
    return it.skip.bind(it);
  }
};

const withTestImage = (fn) => {
  return tmp.withFile(async ({ path, fd }) => {
    await new Promise((resolve, reject) => {
      fs.write(fd, testImageContent, (err) => {
        if (err) {
          reject(err);
        } else {
          resolve();
        }
      });
    });
    await fn({ path, fd });
  });
};

const readSizeOfBlockDevice = async ({ path }) => {
  const m = path.match(/\/dev\/(\S+)/);
  if (!m) {
    throw new Error(`unsupported block device path ${path}`);
  }

  const blockDeviceName = m[1];

  const sizeAsStr = await fs.promises.readFile(`/sys/block/${blockDeviceName}/size`, "utf8");
  return parseInt(sizeAsStr, 10) * 512;
};

const waitUntil = async (fn, { timeout = 30000 } = {}) => {
  const start = performance.now();
  const end = start + timeout;

  let now;
  do {
    const result = await fn();
    if (result === true) {
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 50));

    now = performance.now();
  } while (now < end);

  throw new Error("timeout");
};

const basicLoopDeviceCheck = ({ dev }) => {
  assert.equal(typeof dev.deviceName, "string");
  assert(dev.deviceName.startsWith("loop"));

  assert.equal(typeof dev.deviceNode, "object");
  assert.equal(typeof dev.deviceNode.major, "number");
  assert.equal(typeof dev.deviceNode.minor, "number");

  assert.equal(typeof dev.devicePath, "string");
  assert(dev.devicePath.startsWith("/dev/loop"));
};

const loopDeviceContentCheck = async ({ dev, offset = 0 }) => {
  const sizeOfDev = await readSizeOfBlockDevice({ "path": dev.devicePath });
  const contentOfDev = await fs.promises.readFile(dev.devicePath, "utf8");

  const expectedSize = parseInt((testImageContent.length - offset) / 512, 10) * 512;

  assert.equal(sizeOfDev, expectedSize);
  assert.equal(contentOfDev.substr(0, testString.length - offset), testString.substr(offset));
};

const waitForLoopDeviceDissapear = async ({ dev }) => {
  // unfortunately there seems to be a bit of delay when using autoclear
  // altough we closed all file descriptors it still is open
  // maybe node's file descriptors are not really closed or the kernel
  // does cleanup asynchronously

  await waitUntil(async () => {
    const sizeOfDevAfter = await readSizeOfBlockDevice({ "path": dev.devicePath });
    return sizeOfDevAfter === 0;
  });
};

describe("loopdev", function () {
  this.timeout(60 * 1000);

  it("should create loop device correctly", async () => {
    await withTestImage(async ({ fd }) => {
      const dev = await loopdev.create({ fd });
      try {
        basicLoopDeviceCheck({ dev });
        await loopDeviceContentCheck({ dev });

        const sizeOfDev = await readSizeOfBlockDevice({ "path": dev.devicePath });
        assert.equal(sizeOfDev, testImageContent.length);
      } finally {
        await dev.destroy();
      }
    });
  });

  it("should create loop device from path correctly", async () => {
    await withTestImage(async ({ path }) => {
      const dev = await loopdev.createFromPath({ path });
      try {
        basicLoopDeviceCheck({ dev });
        await loopDeviceContentCheck({ dev });

        const sizeOfDev = await readSizeOfBlockDevice({ "path": dev.devicePath });
        assert.equal(sizeOfDev, testImageContent.length);
      } finally {
        await dev.destroy();
      }
    });
  });

  it("should give an error when path and fd are given to createFromPath", async () => {
    await withTestImage(async ({ fd, path }) => {
      await assert.rejects(async () => {
        await loopdev.createFromPath({ fd, path });
      });
    });
  });

  it("should give an error when unknown arguments are given", async () => {
    await withTestImage(async ({ fd }) => {
      await assert.rejects(async () => {
        await loopdev.createFromPath({ fd, "myArg": false });
      });
    });
  });

  it("should destroy loop device correctly", async () => {
    await withTestImage(async ({ fd }) => {
      const dev = await loopdev.create({ fd });
      basicLoopDeviceCheck({ dev });

      const sizeOfDevBefore = await readSizeOfBlockDevice({ "path": dev.devicePath });
      assert.equal(sizeOfDevBefore, testImageContent.length);
      await dev.destroy();

      await waitForLoopDeviceDissapear({ dev });
    });
  });

  it("should destroy loop device with autoclear correctly", async () => {
    await withTestImage(async ({ fd }) => {
      const dev = await loopdev.create({ fd, "autoclear": true });
      basicLoopDeviceCheck({ dev });
      const sizeOfDevBefore = await readSizeOfBlockDevice({ "path": dev.devicePath });
      assert.equal(sizeOfDevBefore, testImageContent.length);
      await dev.close();

      await waitForLoopDeviceDissapear({ dev });
    });
  });

  it("should fail on invalid block size", async () => {
    await withTestImage(async ({ fd }) => {
      let dev;

      await assert.rejects(async () => {
        dev = await loopdev.create({ fd, "blockSize": 513 });
        await dev.destroy();
      });
    });
  });

  [
    512,
    1024,
    2048,
    4096
  ].forEach((blockSize) => {
    const skipTest = process.env.NODE_LOOPDEV_TEST_SKIP_BLOCK_SIZE;
    maybeTest(!skipTest)(`should create loop device with blockSize=${blockSize} correctly`, async () => {
      await withTestImage(async ({ fd }) => {
        const dev = await loopdev.create({ fd, blockSize });
        try {
          basicLoopDeviceCheck({ dev });
          await loopDeviceContentCheck({ dev });
        } finally {
          await dev.destroy();
        }
      });
    });
  });

  [
    1,
    2,
    3,
    4
  ].forEach((offset) => {
    it(`should create loop device with offset=${offset} correctly`, async () => {
      await withTestImage(async ({ fd }) => {
        const dev = await loopdev.create({ fd, offset });
        try {
          basicLoopDeviceCheck({ dev });
          await loopDeviceContentCheck({ dev, offset });
        } finally {
          await dev.destroy();
        }
      });
    });
  });

  [
    512,
    1024,
    2048,
    4096
  ].forEach((sizelimit) => {
    it(`should create loop device with sizelimit=${sizelimit} correctly`, async () => {
      await withTestImage(async ({ fd }) => {
        const dev = await loopdev.create({ fd, sizelimit });
        try {
          basicLoopDeviceCheck({ dev });

          const sizeOfDev = await readSizeOfBlockDevice({ "path": dev.devicePath });
          const contentOfDev = await fs.promises.readFile(dev.devicePath, "utf8");

          assert.equal(sizeOfDev, sizelimit);
          assert.equal(contentOfDev.substr(0, testString.length), testString);
        } finally {
          await dev.destroy();
        }
      });
    });
  });

  it("should create loop device with partscan=true correctly", async () => {
    await withTestImage(async ({ fd }) => {
      const dev = await loopdev.create({ fd, "partscan": true });
      try {
        basicLoopDeviceCheck({ dev });
        await loopDeviceContentCheck({ dev });
      } finally {
        await dev.destroy();
      }
    });
  });

  maybeTest(!process.env.NODE_LOOPDEV_TEST_SKIP_DIRECT_IO)("should create loop device with useDirectIo=true correctly", async () => {
    await withTestImage(async ({ fd }) => {
      const dev = await loopdev.create({ fd, "useDirectIo": true });
      try {
        basicLoopDeviceCheck({ dev });
        await loopDeviceContentCheck({ dev });
      } finally {
        await dev.destroy();
      }
    });
  });

  it("should be writable when readOnly=false", async () => {
    await withTestImage(async ({ fd }) => {
      const dev = await loopdev.create({ fd, "readOnly": false });
      try {
        basicLoopDeviceCheck({ dev });
        await loopDeviceContentCheck({ dev });

        const writeContent = "test!";

        await fs.promises.writeFile(dev.devicePath, writeContent);

        const contentOfDev = await fs.promises.readFile(dev.devicePath, "utf8");
        assert.equal(contentOfDev.substr(0, writeContent.length), writeContent);
      } finally {
        await dev.destroy();
      }
    });
  });

  // not working, I would expect an error when trying to write to loop device
  it.skip("should not be writable when readOnly=true", async () => {
    await withTestImage(async ({ fd }) => {
      const dev = await loopdev.create({ fd, "readOnly": true });
      try {
        basicLoopDeviceCheck({ dev });
        await loopDeviceContentCheck({ dev });

        const writeContent = "test!";

        await assert.rejects(async () => {
          await fs.promises.writeFile(dev.devicePath, writeContent);
        });
      } finally {
        await dev.destroy();
      }
    });
  });
});
