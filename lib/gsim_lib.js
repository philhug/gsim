var EventEmitter = require('events').EventEmitter,
    util = require('util'),
    async = require('async'),
    net = require('net'),
    binary = require('binary'),
    process = require('process'),
    hexdump = require('hexdump-nodejs'),
    GCMDs = require('./gcmds');

function define(name, value) {
    Object.defineProperty(exports, name, {
        value:      value,
        enumerable: true
    });
}

var GSIM = function(config) {
  var self = this;

  this.config = config;
};

util.inherits(GSIM, EventEmitter);

function hex2bin(hex)
{
    var bytes = [], str;

    for(var i=0; i< hex.length-1; i+=2)
        bytes.push(parseInt(hex.substr(i, 2), 16));

    return String.fromCharCode.apply(String, bytes);    
}

function pad(number, length) {
    var str = '' + number;
    while (str.length < length) {
        str = '0' + str;
    }
    return str;
}

function reverse_byte(x) {
    x = ((x & 0x55) << 1) | ((x & 0xAA) >> 1)
    x = ((x & 0x33) << 2) | ((x & 0xCC) >> 2)
    x = ((x & 0x0F) << 4) | ((x & 0xF0) >> 4)
    return x
}

function parseBCD(word) {
	return parseInt((word & 0x1FFFFC00) >>> 10, 16);
}


// return num bits from position start, ARINC counts from 1..
function getBits(word, start, num) {
	var mask = (1 << num)-1;
 	return (word >>> (start - 1)) & mask;
}

GSIM.prototype.parseArincRecord = function(record) {
  var self = this;
  //console.log(hexdump(record));

  var x = reverse_byte(record.readUInt8(0));
  var label = parseInt(x, 10).toString(8);

  var word = record.readUInt32LE(0);
  var v = parseInt(word, 10).toString(2);
  var bits = parseInt(word >>> 8, 10).toString(2);

  var ssm = getBits(word, 30, 2);
  var sign= getBits(word, 29, 1);

  if (ssm == 0x03 || ssm == 0x00) {
	  //console.log("LABEL=" + label);
	  //console.log("BIT=" + v);
	  //console.log("BITs=" + bits);
	  //console.log("BCD=" + parseBCD(word));
	  //console.log("P=" + getBits(word, 32, 1));
	  //console.log("SIGN=" + getBits(word, 29, 1));
	  //console.log("SDI=" + getBits(word, 9, 2));
  	  //console.log("SSM=" + ssm);

	if (label == 310) {
		console.log ("lat: " + (getBits(word, 9, 20) * 180/1048576 - (sign*180)));
	} else if (label == 311) {
		console.log ("lon: " + (getBits(word, 9, 20) * 180/1048576 - (sign*180)));
	} else if (label == 312) {
		console.log ("GS: " + (getBits(word, 14, 15) * 4096/32768));
	} else if (label == 313) {
		console.log ("TRK: " + ((getBits(word, 17, 12) * 180/4096) + (sign*180)));
	}

  }
}

GSIM.prototype.parseArincRecords = function(records) {
  var self = this;
  for (i = 0; i < records.length/4; i++) {
	var record = new Buffer(4);
	records.copy(record, 0, i*4);
	self.parseArincRecord(record);
  }
}

GSIM.prototype.sendCmd = function(sock, cmd, args, payload) {
  var self = this;
  var len = cmd.length;
  if (args != null)
    len += args.length;
  if (payload != null)
    len += payload.length;

  var send = new Buffer(len);
  send.write(cmd);

  if (args != null)
    send.write(args, 3);
  if (payload != null)
    payload.copy(send, len-payload.length);

//  if (cmd != 'ACK')
//  	console.log("sendCmd:\n" + hexdump(send));
  sock.write(send);
};

GSIM.prototype.handleReply = function(sock, data) {
  var self = this;
  var cmd = self.lastcmd;
  var state = self.state;
  var cmd_meta = GCMDs[cmd];

  if (cmd_meta) {
	var cmd_response = cmd_meta.response;
	var res = cmd_response[state-1];
	if (res) {
		console.log("response: "+util.inspect(res));
		var v = data;
		if (res.type == "uint32") {
			v = data.readUInt32LE(0);
		} else {
			v = data.toString('ascii');
		}
		self.result[res.name] = v;
		console.log("Xresponse: "+res.name + "=" + v);
	}
	if (cmd_response && state >= cmd_response.length) { // complete
		var result = self.result;
		self.emit('response', cmd, result);
  		if (cmd_response.reuse_connection)
			self.connstate = 1;
		else
			self.sock.end(); //disconnect
		//if (self.next)
		//	self.next();
	} else { // not finished, send ACK
        	self.sendCmd(sock, "ACK", "");
	}
	self.state += 1;
  } else {
       	self.sendCmd(sock, "ACK", "");
  	console.log("unknown cmd: "+cmd + " state:" + state);
  }
  console.log("handleReply lastcmd: "+cmd + " state:" + state);
};

GSIM.prototype.cmdListener = function(client, cmd, args, payload) {
  var self = this;
  //console.log("cmdListener CMD: " + cmd + " args: " + util.inspect(args));
  if (cmd == "KIL") {
	console.log("terminating...");
	self.sendCmd(client.sock, "ACK");
	process.exit(0);
  } else if (cmd == "PWR") {
	console.log("powering up...");
	self.emit("power", args.state);
  } else if (cmd == "WRB") {
	var records = new Buffer(payload);
	//console.log("WRB: " + hexdump(payload));
	self.emit("wrb", args.channel_id, records);
	var channel = self.channels[args.channel_id];
	if (channel.proto == 2) { //ARINC429
		self.parseArincRecords(records);
	} else {
		//console.log("SERIAL:" + records);
	}
	self.sendCmd(client.sock, "ACK");
  } else if (cmd == "OPN") {
	if (self.clientbyname[args.client_name]) {
		var newclient = self.clientbyname[args.client_name];
		newclient.sock = client.sock;
		client.sock.info = newclient;
		client = newclient;
		console.log("OPN reuse!" + args.client_name);
	} else {
		client.client_num = self.client_num_start++;
		client.listen_port = self.port_start++;
		client.client_id = args.client_id;
		client.client_name = args.client_name;
		client.next_channel_id = 1;
		self.clientbynum[client.client_num] = client;
		self.clientbyname[client.client_name] = client;
	}
	client.state = "OPN1";
	var buf = new Buffer(4);
	buf.writeUInt32LE(client.client_num, 0); // client_num
        client.sock.write(buf);
	console.log("OPN with num:" + client.client_num);
	self.emit("opn", client.client_num, client.listen_port, client.client_name);
  } else if (cmd == "ACK") {
	if (client.lastcmd = "OPN") {
		if (client.state == "OPN1") {
			var buf = new Buffer(4);
			buf.writeUInt32LE(client.listen_port, 0); //listen port
			//client.sock.write(buf);
			client.state = null;
			(function(socket) {
				var sock = socket;
				sock.write(buf, "utf-8", function() {sock.end();});
			})(client.sock);
		}
	}
  } else if (cmd == "ALL") {
	if (self.clientbynum[args.client_num]) {
		var newclient = self.clientbynum[args.client_num];
		newclient.sock = client.sock;
		client.sock.info = newclient;
		client = newclient;

		var channel = {};
		channel.channel_id = args.client_num << 16 | client.next_channel_id++;
		channel.name = client.client_name;
		channel.proto = args.proto;
		channel.port = args.port;
		channel.direction = args.direction;
		channel.client = client;

		console.log("new channel " + channel.channel_id);
		self.channels[channel.channel_id] = channel;

		client.state = "ALL1";
		var buf = new Buffer(4);
		buf.writeUInt32LE(channel.channel_id, 0); // channel_id
		client.sock.write(buf);
	} else {
		console.log("unknown client:" +args.client_num + " DUMP:" +util.inspect(self.clientbynum));

	}
  }
}

GSIM.prototype.onData = function(sock, data) {
  var self = this;
  var cmd = data.toString('ascii', 0, 3);
  var buf = data.slice(3); // payload of CMD, typically starts with :XX:XX:binary
  var args = {};
  var payload;
  var client = sock.info;

  var cmd_meta = GCMDs[cmd];

  if (cmd_meta) {
	var cmd_args = cmd_meta.args;

	var p = buf.toString('ascii', 1).split(':');
	for (var i in cmd_args) {
		var v = p[i];
		if (cmd_args[i].type == "padint") {
			v = parseInt(v,10);
		} else if (cmd_args[i].type == "padhexint") {
			v = parseInt(v,16);
		}
		args[cmd_args[i].name] = v;
		//console.log("ARG: "+ cmd_args[i].name + "=" + p[i] + "=" + v);
	}
	if (cmd_meta.payload) {
		payload = buf.slice(cmd_meta.payload);
		//console.log("payload: " + hexdump(buf));
	}
	if (cmd != "ACK")
		client.lastcmd = cmd;
  } else { // unknown CMD
	console.log("Unknown CMD: " + cmd);
	self.sendCmd(sock, "NAK");
  }
  self.emit('cmd', sock.info, cmd, args, payload);
}

GSIM.prototype.queue_command = function(cmd, args, payload, next) {
  var self = this;
  //console.log("queue_command: "+cmd);
  self.emit('sendcmd', cmd, args, payload, next);
}


GSIM.prototype.sendCmdHandler = function(cmd, args, payload, next) {
  var self = this;
  //console.log("sendCmdHandler: sending: "+cmd);
  if (self.connstate == 1) {
	self.connstate = 2;
	self.result = {};
	self.state = 1;
	self.lastcmd = cmd;
	self.next = next;
	self.sendCmd(self.sock, cmd, args, payload);
	if (cmd =='WRB') 
		self.connstate = 1;
	if (next)
		next();
  } else {
	console.log("Retrying..");
	setTimeout(function(){
		self.sendCmdHandler(cmd, args, payload, next);
	}, 1000);
  }
}

GSIM.prototype.run_queue_commands = function(port) {
  var self = this;
  var socket = new net.Socket();
  self.sock = socket;
  self.connstate = 0;
  //self.emit('sendcmd', 'PNG');
  self.addListener('sendcmd', self.sendCmdHandler);

  socket.connect(port, '127.0.0.1');
  socket.on('connect', function() {
    	socket.name = socket.remoteAddress + ":" + socket.remotePort;
	console.log('CONNECTEDASYNC ' + socket.name);
    	socket.info = {"sock": socket};
  	self.connstate = 1;
  });
  socket.on('data', function(data) {
	console.log("DATA:\n" + hexdump(data));
	self.handleReply(socket, data);
  });
  socket.on('close', function() {
	console.log('Connection closed to ' + port + ', reconnecting after 1s...');
	setTimeout(function(){
		socket.connect(port, '127.0.0.1');
	}, 100);
  });
  socket.on('error', function () {
	console.log('Connection error, reconnecting after 1s...');
	setTimeout(function(){
		socket.connect(port, '127.0.0.1');
	}, 1000);
  });

};

GSIM.prototype.send_commands = function(port, cmd, args, payload, next) {
  var self = this;
  var socket = new net.Socket();

  socket.connect(port, '127.0.0.1');
  socket.on('connect', function() {
	console.log('CONNECTED');
    	socket.name = socket.remoteAddress + ":" + socket.remotePort;
    	socket.info = {"sock": socket};
	self.result = {};
	self.state = 1;
	self.lastcmd = cmd;
	self.sendCmd(socket, cmd, args, payload);
  });
  socket.on('data', function(data) {
	console.log("DATA:\n" + hexdump(data));
	self.handleReply(socket, data);
  });
  socket.on('close', function() {
	console.log('Connection closed');
	if (next)
		next();
  });
  socket.on('error', function () {
	console.log('Connection error, skipping');
	//self.send_commands(port, cmd, args, payload, next);
  });

};

GSIM.prototype.listen = function(port) {
  var self = this;
  self.port_start = 6400;
  self.channel_id_start = 0x00010001;
  self.client_num_start = 1;
  self.clientbynum = [];
  self.clientbyname = [];
  self.sockets = [];
  self.channels = [];

  self.addListener('cmd', self.cmdListener);

  console.log("listen on port "+ port);
  this.listensocket = net.createServer(function(sock) {
    self.sockets.push(sock);

    sock.name = sock.remoteAddress + ":" + sock.remotePort;
    sock.info = {"sock": sock};

    // We have a connection - a socket object is assigned to the connection automatically
    console.log('CONNECTED: ' + sock.name);
    
    // Add a 'data' event handler to this instance of socket
    sock.on('data', function(data) {
        //console.log('DATA from ' + sock.name);
        self.onData(sock, data);
    });
    
    // Add a 'close' event handler to this instance of socket
    sock.on('end', function(data) {
    	var idx = self.sockets.indexOf(sock);
	delete self.sockets[idx];
        console.log('CLOSED CLIENT ' + sock.name);
    });
  }).listen(port, '0.0.0.0');
};

module.exports = GSIM;
