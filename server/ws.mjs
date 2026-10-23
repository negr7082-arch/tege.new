// Minimal RFC 6455 WebSocket server (text frames only) – no dependencies.
import crypto from 'node:crypto';

const GUID = '258EAFA5-E914-47DA-95CA-C5AB0DC85B11';
const MAX_PAYLOAD = 32 * 1024 * 1024; // photos/voice are sent as data URIs

export function attachWebSocket(server, onConnection, { path = '/ws' } = {}) {
  server.on('upgrade', (req, socket) => {
    const url = new URL(req.url, 'http://x');
    if (url.pathname !== path || (req.headers.upgrade || '').toLowerCase() !== 'websocket') {
      socket.destroy();
      return;
    }
    const key = req.headers['sec-websocket-key'];
    if (!key) return socket.destroy();
    const accept = crypto.createHash('sha1').update(key + GUID).digest('base64');
    socket.write(
      'HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\n' +
        `Sec-WebSocket-Accept: ${accept}\r\n\r\n`
    );
    socket.setNoDelay(true);
    onConnection(new Conn(socket), url, req);
  });
}

class Conn {
  constructor(socket) {
    this.socket = socket;
    this.buf = Buffer.alloc(0);
    this.frags = [];
    this.fragBytes = 0;
    this.open = true;
    this.onmessage = () => {};
    this.onclose = () => {};
    this.alive = true;
    socket.on('data', (d) => this._data(d));
    socket.on('close', () => this._closed());
    socket.on('error', () => this._closed());
  }

  _closed() {
    if (!this.open) return;
    this.open = false;
    this.onclose();
  }

  send(obj) {
    if (!this.open) return;
    this._frame(0x1, Buffer.from(typeof obj === 'string' ? obj : JSON.stringify(obj)));
  }

  ping() {
    if (this.open) this._frame(0x9, Buffer.alloc(0));
  }

  close(code = 1000) {
    if (!this.open) return;
    const b = Buffer.alloc(2);
    b.writeUInt16BE(code);
    this._frame(0x8, b);
    this.socket.end();
  }

  _frame(opcode, payload) {
    const len = payload.length;
    let head;
    if (len < 126) head = Buffer.from([0x80 | opcode, len]);
    else if (len < 65536) {
      head = Buffer.alloc(4);
      head[0] = 0x80 | opcode;
      head[1] = 126;
      head.writeUInt16BE(len, 2);
    } else {
      head = Buffer.alloc(10);
      head[0] = 0x80 | opcode;
      head[1] = 127;
      head.writeBigUInt64BE(BigInt(len), 2);
    }
    this.socket.write(Buffer.concat([head, payload]));
  }

  _data(chunk) {
    this.buf = Buffer.concat([this.buf, chunk]);
    for (;;) {
      if (this.buf.length < 2) return;
      const b0 = this.buf[0];
      const b1 = this.buf[1];
      const fin = (b0 & 0x80) !== 0;
      const opcode = b0 & 0x0f;
      const masked = (b1 & 0x80) !== 0;
      let len = b1 & 0x7f;
      let off = 2;
      if (len === 126) {
        if (this.buf.length < 4) return;
        len = this.buf.readUInt16BE(2);
        off = 4;
      } else if (len === 127) {
        if (this.buf.length < 10) return;
        const big = this.buf.readBigUInt64BE(2);
        if (big > BigInt(MAX_PAYLOAD)) return this.close(1009);
        len = Number(big);
        off = 10;
      }
      if (len > MAX_PAYLOAD) return this.close(1009);
      if (!masked) return this.close(1002); // clients must mask
      if (this.buf.length < off + 4 + len) return;
      const mask = this.buf.subarray(off, off + 4);
      const data = Buffer.from(this.buf.subarray(off + 4, off + 4 + len));
      for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
      this.buf = this.buf.subarray(off + 4 + len);

      if (opcode === 0x8) return this.close(1000);
      if (opcode === 0x9) { this._frame(0xa, data); continue; }
      if (opcode === 0xa) { this.alive = true; continue; }
      if (opcode === 0x1 || opcode === 0x2 || opcode === 0x0) {
        this.fragBytes += data.length;
        if (this.fragBytes > MAX_PAYLOAD) return this.close(1009);
        this.frags.push(data);
        if (fin) {
          const msg = Buffer.concat(this.frags).toString('utf8');
          this.frags = [];
          this.fragBytes = 0;
          try { this.onmessage(msg); } catch (e) { console.error('ws handler error', e); }
        }
      }
    }
  }
}
