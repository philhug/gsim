var EventEmitter = require('events').EventEmitter,
    util = require('util'),
    async = require('async'),
    net = require('net'),
    binary = require('binary'),
    process = require('process'),
    hexdump = require('hexdump-nodejs'),
    GSIM = require('./gsim_lib');
    GSIMClient = require('./gsim_client');

var GSIMServer = function(config) {
  var self = this;
  GSIM.call(this, config);
};

util.inherits(GSIMServer, GSIM);

function pad(number, length) { 
    var str = '' + number; 
    while (str.length < length) { 
        str = '0' + str; 
    } 
    return str; 
}

GSIMServer.prototype.powerListener = function(state) {
  var self = this;
  console.log("PWR broadcast");
  for (var i in self.clientbynum) {
	console.log("send PWR to:" + self.clientbynum[i].listen_port);
        var client = self.clientbynum[i].client;
	if (!client)
		console.log("error. no client found");
	client.state = 0;
  	client.queue_command("PWR", ":" + pad(state, 2) + ":", null, function() {});
  }
}

GSIMServer.prototype.wrbListener = function(channel_id, payload) {
  var self = this;
  var channel = self.channels[channel_id];

  if (!channel) {
	console.log("unknown channel: " + channel_id);
	return;
  }
  for (var i in self.config.routing) {
	var r = self.config.routing[i];
	if (r.from_name == channel.name && r.from_port == channel.port && r.from_protocol == channel.proto) {
		// find corresponding outputs
  		for (var x in self.channels) {
			var c = self.channels[x];
			if (r.to_name == c.name && r.to_port == c.port && c.direction == 1 && r.to_protocol == c.proto ) {
				//console.log("found: TO: " + r.to_name + ":" + r.to_port + " proto:" + r.to_protocol);
				// yay, match
				var gsim = c.client.client;
				if (!gsim)
					console.log("error. no client found");
				gsim.state = 0;
				gsim.queue_command("WRB", ":" + pad(c.channel_id.toString(16),8) + ":", payload, function() {gsim.state = 0; gsim.connectstate=1; });
			}
		}
	}
  }
}

GSIMServer.prototype.opnListener = function(client_num, listen_port, client_name) {
  var self = this;
  console.log("OPN connection to:"+client_name);
  var gsim = new GSIMClient({ port: { gsim: listen_port } });
  gsim.listen_port = listen_port;
  gsim.run_queue_commands(listen_port);
  self.clientbynum[client_num].client = gsim;
}

GSIMServer.prototype.server_listen = function(port) {
  var self = this;
  self.addListener('power', self.powerListener);
  self.addListener('wrb', self.wrbListener);
  self.addListener('opn', self.opnListener);
  self.listen(self.config.gsim.port);
}

module.exports = GSIMServer;
