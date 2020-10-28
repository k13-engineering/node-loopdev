import Struct from "struct";
import os from "os";

const LO_NAME_SIZE = 64;
const LO_KEY_SIZE = 32;

let loop_info64;

/* c8 ignore next 31 */
if (os.endianness() === "LE") {
  loop_info64 = Struct()
    .word64Ule("lo_device")
    .word64Ule("lo_inode")
    .word64Ule("lo_rdevice")
    .word64Ule("lo_offset")
    .word64Ule("lo_size_limit")
    .word32Ule("lo_number")
    .word32Ule("lo_encrypt_type")
    .word32Ule("lo_encrypt_key_size")
    .word32Ule("lo_flags")
    .chars("lo_file_name", LO_NAME_SIZE)
    .chars("lo_crypt_name", LO_NAME_SIZE)
    .chars("lo_encrypt_key", LO_KEY_SIZE)
    .array("lo_init", 2, "word64Ule");
} else {
  loop_info64 = Struct()
    .word64Ube("lo_device")
    .word64Ube("lo_inode")
    .word64Ube("lo_rdevice")
    .word64Ube("lo_offset")
    .word64Ube("lo_size_limit")
    .word32Ube("lo_number")
    .word32Ube("lo_encrypt_type")
    .word32Ube("lo_encrypt_key_size")
    .word32Ube("lo_flags")
    .chars("lo_file_name", LO_NAME_SIZE)
    .chars("lo_crypt_name", LO_NAME_SIZE)
    .chars("lo_encrypt_key", LO_KEY_SIZE)
    .array("lo_init", 2, "word64Ube");
}

export default {
  loop_info64
};
