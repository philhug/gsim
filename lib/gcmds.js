var GCMDs = {
  'KIL': {
    name: 'Kill Process',
    args: [
    ],
    response: [
    ],
    close_connection: 1,
  },
  'ACK': {
    name: 'Acknowledged',
    args: [
    ],
    response: [
    ],
  },
  'NAK': {
    name: 'Not Acknowledged',
    args: [
    ],
    response: [
    ],
  },
  'PNG': {
    name: 'Ping',
    args: [
    ],
    response: [
    ],
  },
  'PWR': {
    name: 'Power',
    args: [
      { name: 'state', type: 'padint', width: 1 },
    ],
    response: [
    ],
    reuse_connection: 0,
  },
  'OPN': {
    name: 'Open',
    args: [
      { name: 'client_id', type: 'padint', width: 8 },
      { name: 'client_name', type: 'string', width: 8 },
    ],
    response: [
      { name: 'client_num', type: 'uint32' },
      { name: 'listen_port', type: 'uint32' },
    ],
    reuse_connection: 0,
  },
  'ALL': {
    name: 'ALL',
    args: [
      { name: 'client_num', type: 'padint', width: 8 },
      { name: 'proto', type: 'padint', width: 2 },
      { name: 'port', type: 'padint', width: 2 },
      { name: 'direction', type: 'padint', width: 1 },
    ],
    response: [
      { name: 'channel_id', type: 'uint32' },
    ],
    reuse_connection: 0,
  },
  'WRB': {
    name: 'Write Binary',
    args: [
      { name: 'channel_id', type: 'padhexint', width: 8 },
    ],
    response: [
    ],
    payload: 10,
    reuse_connection: 1,
    no_ack: 1,
  },
};

module.exports = GCMDs;
