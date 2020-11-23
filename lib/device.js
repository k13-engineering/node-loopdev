import structures from "./structures.js";
import blockdev from "linux-blockdev";
import ioctl from "ioctl";
import fs from "fs";

const { loop_info64 } = structures;

const LOOP_SET_FD = 0x4C00;
const LOOP_CLR_FD = 0x4C01;
const LOOP_SET_STATUS64 = 0x4C04;
const LOOP_CTL_GET_FREE = 0x4C82;
const LOOP_SET_BLOCK_SIZE = 0x4C09;
const LOOP_SET_DIRECT_IO = 0x4C08;

const loopdevIoctl = async (fd, num, arg) => {
  const maxNumTries = 10;
  let numTriesLeft = maxNumTries;

  do {
    try {
      return ioctl(fd, num, arg);
    } catch (ex) {
      // Since Linux kernel commit 5db470e229e22b7eda6e23b5566e532c96fb5bc3
      // Loop Device ioctls may return EAGAIN, in that case we need to retry
      if (ex.code !== "EAGAIN") {
        throw ex;
      }
    }

    await new Promise((resolve) => setTimeout(resolve, 50));

    numTriesLeft -= 1;
  } while (numTriesLeft > 0);

  throw new Error(`got EAGAIN ${maxNumTries} times on ioctl`);
};

const findOrAllocateLoopDevice = async () => {
  const loopControlHandle = await fs.promises.open("/dev/loop-control", "r+");
  try {
    const deviceNumber = await loopdevIoctl(loopControlHandle.fd, LOOP_CTL_GET_FREE);
    return `loop${deviceNumber}`;
  } finally {
    await loopControlHandle.close();
  }
};

const findOrAllocate = async () => {
  const deviceName = await findOrAllocateLoopDevice();
  const blockDevice = await blockdev.findByName({ deviceName });

  const { deviceNode } = blockDevice;
  const devicePath = `/dev/${deviceName}`;

  const loopDeviceHandle = await blockDevice.open({ "flags": "r+" });

  const setup = async ({ fd, flags, offset, sizelimit, blockSize = undefined, useDirectIo }) => {
    await loopdevIoctl(loopDeviceHandle.fd, LOOP_SET_FD, fd);

    const info64 = loop_info64.allocate();
    info64.set("lo_flags", flags);
    info64.set("lo_offset", offset);
    info64.set("lo_size_limit", sizelimit);
    await loopdevIoctl(loopDeviceHandle.fd, LOOP_SET_STATUS64, info64.buffer());

    if (blockSize !== undefined) {
      await loopdevIoctl(loopDeviceHandle.fd, LOOP_SET_BLOCK_SIZE, blockSize);
    }

    if (useDirectIo) {
      await loopdevIoctl(loopDeviceHandle.fd, LOOP_SET_DIRECT_IO, 1);
    }
  };

  const destroy = async () => {
    await loopdevIoctl(loopDeviceHandle.fd, LOOP_CLR_FD);
    await loopDeviceHandle.close();
  };

  const close = async () => {
    await loopDeviceHandle.close();
  };

  return {
    deviceName,
    deviceNode,
    devicePath,
    setup,
    destroy,
    close
  };
};

export default {
  findOrAllocate
};
