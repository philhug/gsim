var GSIMServer = require('./lib/gsim_server');

//var hexdump = require('hexdump-nodejs');

var gsim = new GSIMServer({
  gsim: {
    port: 4469,
  },
  client: {
    name: "GDU620",
    id: "00010001",
    port: "00",
    proto: "02", // 02 = ARINC
    direction: "1",
  },
  routing: [
    //C:GDU620:A429:2:IN:GTN:A429:0:OUT
    {
      from_name: 'GTN',
      from_protocol: 2, //'A429',
      from_port: 0,
      from_direction: 'OUT',
      to_name: 'GDU620',
      to_protocol: 2, //'A429',
      to_port: 2,
      to_direction: 'IN',
    },
    //C:GDU620:A429:0:OUT:HSI400:A429:0:IN
    {
      from_name: 'GDU620',
      from_protocol: 2, //'A429',
      from_port: 0,
      from_direction: 'OUT',
      to_name: 'HSI400',
      to_protocol: 2, //'A429',
      to_port: 0,
      to_direction: 'IN',
    },
    //C:GDU620:A429:0:OUT:GTN:A429:0:IN
    {
      from_name: 'GDU620',
      from_protocol: 2, //'A429',
      from_port: 0,
      from_direction: 'OUT',
      to_name: 'GTN',
      to_protocol: 2, //'A429',
      to_port: 0,
      to_direction: 'IN',
    },
    //C:GDU620:RS232:2:IN:GTN:RS232:1:OUT
    {
      from_name: 'GTN',
      from_protocol: 1, //'RS232',
      from_port: 0,
      from_direction: 'OUT',
      to_name: 'GDU620',
      to_protocol: 1, //'RS232',
      to_port: 2,
      to_direction: 'IN',
    },
  ],
});

gsim.on('raw', function(buffer) {
  // raw data
  console.log("raw:\n" + hexdump(buffer));
});

console.log("before listen\n");
gsim.server_listen();
