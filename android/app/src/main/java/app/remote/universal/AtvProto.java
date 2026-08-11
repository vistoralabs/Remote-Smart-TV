package app.remote.universal;

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.io.InputStream;

final class AtvProto {
    private AtvProto() {}

    static byte[] varint(long value) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        while ((value & ~0x7fL) != 0) {
            out.write((int) ((value & 0x7f) | 0x80));
            value >>>= 7;
        }
        out.write((int) value);
        return out.toByteArray();
    }

    static byte[] field(int number, long value) {
        return join(varint((long) number << 3), varint(value));
    }

    static byte[] bytes(int number, byte[] value) {
        return join(varint(((long) number << 3) | 2), varint(value.length), value);
    }

    static byte[] string(int number, String value) {
        return bytes(number, value.getBytes(java.nio.charset.StandardCharsets.UTF_8));
    }

    static byte[] frame(byte[] payload) { return join(varint(payload.length), payload); }

    static byte[] readFrame(InputStream input) throws IOException {
        int length = (int) readVarint(input);
        byte[] payload = new byte[length];
        int offset = 0;
        while (offset < length) {
            int count = input.read(payload, offset, length - offset);
            if (count < 0) throw new IOException("TV closed the connection");
            offset += count;
        }
        return payload;
    }

    static long readVarint(InputStream input) throws IOException {
        long result = 0;
        int shift = 0;
        while (shift < 64) {
            int next = input.read();
            if (next < 0) throw new IOException("TV closed the connection");
            result |= (long) (next & 0x7f) << shift;
            if ((next & 0x80) == 0) return result;
            shift += 7;
        }
        throw new IOException("Invalid response from TV");
    }

    static int firstField(byte[] payload) {
        int[] position = {0};
        long tag = readVarint(payload, position);
        return (int) (tag >>> 3);
    }

    static boolean hasField(byte[] payload, int wanted) {
        int[] position = {0};
        while (position[0] < payload.length) {
            long tag = readVarint(payload, position);
            int field = (int) (tag >>> 3);
            int wire = (int) (tag & 7);
            if (field == wanted) return true;
            if (wire == 0) readVarint(payload, position);
            else if (wire == 2) {
                int length = (int) readVarint(payload, position);
                position[0] = Math.min(payload.length, position[0] + length);
            } else if (wire == 1) position[0] = Math.min(payload.length, position[0] + 8);
            else if (wire == 5) position[0] = Math.min(payload.length, position[0] + 4);
            else return false;
        }
        return false;
    }

    static long firstVarint(byte[] payload, int wanted) {
        int[] position = {0};
        while (position[0] < payload.length) {
            long tag = readVarint(payload, position);
            int field = (int) (tag >>> 3);
            int wire = (int) (tag & 7);
            if (wire == 0) {
                long value = readVarint(payload, position);
                if (field == wanted) return value;
            } else if (wire == 2) {
                int length = (int) readVarint(payload, position);
                position[0] = Math.min(payload.length, position[0] + length);
            } else if (wire == 1) position[0] += 8;
            else if (wire == 5) position[0] += 4;
            else break;
        }
        return -1;
    }

    static byte[] nested(byte[] payload, int wanted) {
        int[] position = {0};
        while (position[0] < payload.length) {
            long tag = readVarint(payload, position);
            int field = (int) (tag >>> 3);
            int wire = (int) (tag & 7);
            if (wire == 0) readVarint(payload, position);
            else if (wire == 2) {
                int length = (int) readVarint(payload, position);
                int start = position[0];
                position[0] = Math.min(payload.length, start + length);
                if (field == wanted) return java.util.Arrays.copyOfRange(payload, start, position[0]);
            } else if (wire == 1) position[0] += 8;
            else if (wire == 5) position[0] += 4;
            else break;
        }
        return new byte[0];
    }

    private static long readVarint(byte[] data, int[] position) {
        long result = 0;
        int shift = 0;
        while (position[0] < data.length && shift < 64) {
            int next = data[position[0]++] & 0xff;
            result |= (long) (next & 0x7f) << shift;
            if ((next & 0x80) == 0) return result;
            shift += 7;
        }
        return result;
    }

    static byte[] join(byte[]... values) {
        ByteArrayOutputStream out = new ByteArrayOutputStream();
        for (byte[] value : values) out.write(value, 0, value.length);
        return out.toByteArray();
    }
}