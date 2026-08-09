// Proof-of-work difficulty: the client must find a nonce so that this many
// leading bytes of sha256(deviceId:messageId:nonce) are zero. Each byte is
// ~256x harder; 2 bytes costs a few dozen ms on a phone — invisible to humans,
// enough to stop naive scripted flooding.
export const POW_ZERO_BYTES = 2;
