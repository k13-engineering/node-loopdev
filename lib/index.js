import deviceFactory from "./device.js";
import fs from "fs";

const LO_FLAGS_READ_ONLY = 1;
const LO_FLAGS_AUTOCLEAR = 4;
const LO_FLAGS_PARTSCAN = 8;

const generateFlags = ({ readOnly, partscan, autoclear }) => {
  let flags = 0;
  if (readOnly) {
    flags |= LO_FLAGS_READ_ONLY;
  }
  if (partscan) {
    flags |= LO_FLAGS_PARTSCAN;
  }
  if (autoclear) {
    flags |= LO_FLAGS_AUTOCLEAR;
  }
  return flags;
};

const create = async ({
  fd,
  offset = undefined,
  sizelimit = undefined,
  readOnly = false,
  partscan = false,
  autoclear = true,
  useDirectIo = false,
  blockSize = undefined,
  ...unknown
}) => {
  Object.keys(unknown).forEach((key) => {
    throw new Error(`unknown argument "${key}" found`);
  });

  const flags = generateFlags({ readOnly, partscan, autoclear });

  const deviceHandle = await deviceFactory.findOrAllocate();
  const { devicePath } = deviceHandle;

  try {
    await deviceHandle.setup({
      fd,
      flags,
      "offset": offset === undefined ? 0 : offset,
      "sizelimit": sizelimit === undefined ? 0 : sizelimit,
      blockSize,
      useDirectIo
    });
  } catch (ex) {
    await deviceHandle.destroy();
    throw ex;
  }

  const destroy = () => {
    return deviceHandle.destroy();
  };

  const close = () => {
    return deviceHandle.close();
  };

  return {
    devicePath,
    destroy,
    close
  };
};

const createFromPath = async ({ path, ...opts }) => {
  if (opts.fd !== undefined) {
    throw new Error("fd argument not supported in createFromPath");
  }

  const fileHandle = await fs.promises.open(path, "r+");
  try {
    return await create({ "fd": fileHandle.fd, ...opts });
  } finally {
    await fileHandle.close();
  }
};

export default {
  create,
  createFromPath
};

export {
  create,
  createFromPath
};
