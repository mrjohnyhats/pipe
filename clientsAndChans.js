var functions = require("./functions.js");
String.prototype.copy = function(){
	return new String(this);
}

function Client(socket){
	this.socket = socket;
	this.chan = null;
	this.displayName = functions.generateGuestName();
	this.isPulling = false;
	this.pullStartTime = null;
	this.defaultChan = global.chans["main"];
	global.socketClients[this.socket.id] = this;
}

Client.prototype.serialize = function(){
	var serializedClient = {
		unSanitizedSocketId: this.socket.id,
		socketId: functions.sanitizeIdForJquery(this.socket.id),
		displayName: this.displayName
	};
	return serializedClient;
}

Client.prototype.regSerialize = function(){
	var serialized = {
		displayName: this.displayName,
		password: this.password,
		defaultChanName: this.defaultChan.name,
		chan: this.chan
	};
	return serialized;
}

Client.prototype.updateBasedOnRegData = function(regData){
	this.defaultChan = global.chans[regData.defaultChanName];
	this.displayName = regData.displayName;
	this.password = regData.password;
}

Client.prototype.switchChan = function(chan){
	if(this.chan){
		global.chans[this.chan].removeClient(this);
	}
	this.chan = chan.name;
	var that = this;
	functions.doOnChanSwitchConfirm(this.socket, function(){
		chan.addClient(that);
		if(that.password) functions.updateRegUsersFile();
	});
}

Client.prototype.pull = function(){
	functions.sendPullInit(this.socket.id, this.chan);
	this.pullStartTime = Date.now();
	if(this.password) functions.updateRegUsersFile();
}

Client.prototype.startPullInitTimeout = function(){
	this.pullInitTimeout = setTimeout(function(that){
		if(that.chan){
			that.isPulling = true;
			that.pull();
			that.pullInitTimeout = undefined;
			delete that.pullInitTimeout;
		} 
	}, 1000, this);
}

Client.prototype.register = function(username, password){
	this.displayName = username;
	this.password = functions.encrypt(password, global.passwordSalt);
	registeredUsers[username] = this;
	functions.updateRegUsersFile();
}

Client.prototype.changeUsername = function(username){
	var oldName = this.displayName;
	this.displayName = username;
	if(this.password){
		global.registeredUsers[username] = global.registeredUsers[oldName]
		global.registeredUsers[oldName] = undefined;
		delete global.registeredUsers[oldName];
		functions.updateRegUsers();
		functions.updateRegUsersFile();
	}
}

function Chan(name, displayName){
	this.name = name;
	this.displayName = displayName;
	this.clients = {};
	this.pullRooms = {};
	global.chans[this.name] = this;
}

Chan.prototype.addClient = function(client){
	console.log(this.name + " adding client");
	client.socket.join(this.name);
	this.clients[client.socket.id] = client;

	global.socketClients[client.socket.id] = client;
	if(client.passsword){
		//if client has password then client is registered
		global.registeredUsers[client.displayName] = client;
		functions.updateRegUsersFile();
	}

	functions.sendCbGenerationRequest(client.socket, this);
	functions.sendClientJoinRequest(client.socket, this);

}

Chan.prototype.removeClient = function(client){
	console.log(this.name + " removing client");
	client.socket.leave(this.name);

	this.clients[client.socket.id] = undefined;
	delete this.clients[client.socket.id];

	global.socketClients[client.socket.id] = undefined;
	delete global.socketClients[client.socket.id];

	client.chan = null;

	if(client.password){
		//if client has password then client is registered
		global.registeredUsers[client.socket.id] = undefined;
		delete global.registeredUsers[client.socket.id];
		functions.updateRegUsersFile();
	}

	functions.sendClientPartRequest(client, this);
}

Chan.prototype.clientExists = function(socketId){
	if(this.clients[socketId]){
		return true;
	}
	return false;
}

module.exports.Chan = Chan;
module.exports.Client = Client;
