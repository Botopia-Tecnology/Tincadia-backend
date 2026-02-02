
const base64Url = "eyJub25jZSI6ICJ0ZXN0X25vbmNlLXZhbHVlIn0"; // {"nonce": "test_nonce-value"} in Base64URL
// "test_nonce-value" contains - and _ if I crafted it right.
// Let's use a known base64url string with - and _
// {"sub":"123","nm":"a-b_c"} -> {"sub":"123","nm":"a-b_c"}
// eyJzdWIiOiIxMjMiLCJubV9uYW1lIjoiYS1iX2MifQ could be one.

// Let's construct one manually.
// payload: {"test":"a-b_c"}
// base64: eyJ0ZXN0IjoiYS1iX2MifQ==
// base64url: eyJ0ZXN0IjoiYS1iX2MifQ (no padding, but chars are same as b64 if no + or /)

// modifying to use chars that differ.
// + becomes -
// / becomes _

// Payload where base64 has + and /
// standard base64: ++//
// base64url: --__

// Let's try to decode "foo-bar_baz" using base64.
const input = "foo-bar_baz";
const buffer = Buffer.from(input, 'base64');
console.log(`Input: ${input}`);
console.log(`Buffer length: ${buffer.length}`);
console.log(`Buffer hex: ${buffer.toString('hex')}`);

// Comparison
const standard = "foo+bar/baz";
const bufferStd = Buffer.from(standard, 'base64');
console.log(`Standard: ${standard}`);
console.log(`BufferStd length: ${bufferStd.length}`);
console.log(`BufferStd hex: ${bufferStd.toString('hex')}`);

if (buffer.equals(bufferStd)) {
    console.log("Buffer.from handles Base64URL headers correctly (or treats -_ as +/)");
} else {
    console.log("Buffer.from DOES NOT handle Base64URL correctly");
}
