var GSIMClient = require('./lib/gsim_client');

//var hexdump = require('hexdump-nodejs');

var gsim = new GSIMClient({
  port: {
    gsim: 4469,
  },
  client: {
    name: "GTN",
    id: "00010001",
    port: "02",
    proto: "02", // 02 = ARINC
    direction: "1",
  },
});

gsim.on('raw', function(buffer) {
  // raw data
  console.log("raw:\n" + hexdump(buffer));
});

console.log("before connect\n");
gsim.connect();
