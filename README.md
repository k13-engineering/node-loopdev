# node-loopdev
Loopdevice library for Node.js

This library will help you to create loop devices in Linux without invoking shell commands like losetup. Managing existing loop devices is not part of this library, as the main use-case is creating loop devices for mounting filesystems.

## API

### `loopdev.create(options)` => Promise(`LoopDevice`)

Creates a loop device instance.

- `options.fd`: fd of backing file
- `options.offset`: offset in backing file (optional, default = 0)
- `options.sizelimit`: size limit of backing file (optional, default = unlimited)
- `options.readOnly`: whether loop device should be read-only (optional, default = false)
- `options.autoclear`: remove loop device after last file descriptor closed (optional, default = true)
  - Requires Linux >= 2.6.25

- `options.partscan`: scan for partitions after loop device is created (optional, default = false)

- `options.useDirectIo`: use direct I/O, requires Linux 4.10 (optional, default = false)
  - Requires Linux >= 4.10

- `options.blockSize`: use block size of loop devices (optional)
  - Requires Linux >= 4.14

### `loopdev.createFromPath(options)` => Promise(`LoopDevice`)

Convenience method for `loopdev.create()`;

- `options.path`: path of backing file

For all other options see `loopdev.create()`. A file descriptor `options.fd` may not be given, as it is created internally from `options.path`.

### `LoopDevice`

#### `LoopDevice.devicePath` => String

Exposes loop device path (e.g. "/dev/loop0").

#### `LoopDevice.deviceName` => String

Exposes loop device name (e.g. "loop0").

#### `LoopDevice.deviceNode.major` => Number

Exposes device node major number

#### `LoopDevice.deviceNode.minor` => Number

Exposes device node minor number

#### `LoopDevice.destroy()` => Promise

Destroys the loop device. This causes the loop device to detach the backing file. Also closes the handle to the loop device. After this call the `LoopDevice` is unusable.

#### `LoopDevice.close()` => Promise

Closes the handle to the loop device. If the `autoclear` option has been used, and no other peer has open file descriptors to loop device (or mounts), then it will destroy itself. Closing the handle is required in any case, except when `LoopDevice.destroy()` is called, even if you want the loop device to stay available in the system longer than your node app. After this call the `LoopDevice` is unusable.
