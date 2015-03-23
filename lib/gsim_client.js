var EventEmitter = require('events').EventEmitter,
    util = require('util'),
    async = require('async'),
    net = require('net'),
    binary = require('binary'),
    process = require('process'),
    hexdump = require('hexdump-nodejs'),
    GSIM = require('./gsim_lib');

var GSIMClient = function(config) {
  var self = this;
  GSIM.call(this, config);
};

util.inherits(GSIMClient, GSIM);

function pad(number, length) {
    var str = '' + number;
    while (str.length < length) {
        str = '0' + str;
    }
    return str;
}

GSIMClient.prototype.responseListener = function(cmd, response) {
  var self = this;
  console.log("response: "+util.inspect(response));
  if (cmd == "OPN") {
	self.client_num = response.client_num;
	self.listen_port= response.listen_port;
	console.log("client_num: " + self.client_num);
	console.log("listen_port: " + self.listen_port);
	self.listen(self.listen_port);
	self.queue_command("ALL", ":" + pad(self.client_num,8) + ":" + self.config.client.proto + ":" + self.config.client.port + ":" + self.config.client.direction, null);
  } else if (cmd == "ALL") {
	self.channel_id = response.channel_id;
	console.log("channel_id: " + self.channel_id);
	self.queue_command("PWR", ":02:");
  }
}

GSIMClient.prototype.connect = function() {
  var self = this;
  self.state = 1;
  self.addListener('response', self.responseListener);
  self.run_queue_commands(self.config.port.gsim);

  if (1) {
	  self.queue_command("OPN", ":" + self.config.client.id + ":"+self.config.client.name, null, function() {
			return true;
	});
  } else {
	  self.send_commands(self.config.port.gsim, "OPN", ":" + self.config.client.id + ":"+self.config.client.name, null, function() {
		self.send_commands(self.config.port.gsim, "ALL", ":" + pad(self.client_num,8) + ":" + self.config.client.proto + ":" + self.config.client.port + ":" + self.config.client.direction, null, function() {
			return true;
		});
	 });
  }
};


module.exports = GSIMClient;
