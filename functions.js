var fs = require("fs");
var crypto = require("crypto");
var fObj = {};
module.exports = fObj;
fObj.cloneObj = function(obj){
	var clone = {};
	for(prop in obj){
		clone[prop] = obj[prop];
	}
	return clone;
}

fObj.sendCbGenerationRequest = function(socket, chan){
	global.io.sockets.to(socket.id).emit("generateCbs", {
		clients: fObj.serializeClients(chan.clients),
		chanName: chan.name,
		chanDisplayName: chan.displayName,
		yourId: fObj.sanitizeIdForJquery(socket.id)
	});
}

fObj.sendClientJoinRequest = function(socket, chan){
	socket.to(chan.name).emit("clientJoin", {
		client: chan.clients[socket.id].serialize()
	});
}

fObj.sendClientPartRequest = function(client, chan){
	global.io.sockets.to(chan.name).emit("clientPart", {
		client: client.serialize()
	});
}

fObj.serializeClients = function(clients){
	var serializedClients = {};

	if(typeof clients === "object"){
		for(id in clients){
			serializedClients[fObj.sanitizeIdForJquery(id)] = clients[id].serialize();
		}
		return serializedClients;
	}
}

fObj.sendPullInit = function(socketId, chan){
	global.io.sockets.to(chan).emit("startPull", {
		socketId: fObj.sanitizeIdForJquery(socketId)
	});
}

fObj.sendCbSync = function(forSocketId, toSocketId, chan){
	var forClient = global.chans[chan].clients[forSocketId];
	var chan = global.chans[chan];
	if(chan.clientExists(forSocketId) && chan.clientExists(toSocketId)){
		fObj.requestText(chan.clients[forSocketId].socket, function(text){
			global.io.sockets.to(toSocketId).emit("cbSync", {
				socketId: fObj.sanitizeIdForJquery(forSocketId),
				text: text,
				isPulling: forClient.isPulling,
				pullStartTime: forClient.pullStartTime
			});
		});
	}
}

fObj.sendCompletePullRequest = function(forSocketId, toSocketId){
	global.io.sockets.to(toSocketId).emit("completePull", {
		socketId: fObj.sanitizeIdForJquery(forSocketId)
	});
}

fObj.createRandomString = function(length){
	var str = (Math.random() * Math.pow(10, length)).toString(36);
}

fObj.generateGuestName = function(){
	var name;
	do{
		name = "guest" + Math.floor(Math.random() * 19000 + 1000);
	} while(fObj.socketExists(name))
	return name;
}

fObj.socketExists = function(name){
	name = name.toLowerCase();
	for(socketId in global.socketClients){
		if(global.socketClients[socketId].displayName.toLowerCase() == name){
			return true;
		}
	}
	return false;
}

fObj.sanitizeIdForJquery = function(socketId){
	return socketId.replace(/[!"#$%&'()*+,.\/:;<=>?@[\\\]^`{|}~]/g, sanitizeChar);
	function sanitizeChar(char){
		return "\\" + char;
	}
}

fObj.updateRegUsersFile = function(){
	var serialRegUsers = global.registeredUsers;
	var user;
	for(name in global.registeredUsers){
		user = global.registeredUsers[name];
		if(user.socket){
			serialRegUsers[user.displayName] = user.regSerialize();
		}
	}
	fs.writeFile("registeredUsers.json", JSON.stringify(serialRegUsers), function(err){
		if(err){
			throw err;
		}
	});
}

fObj.updateRegUsers = function(){
	var client;
	var names = Object.keys(global.registeredUsers);
	for(id in global.socketClients){
		client = global.socketClients[id];
		 if(names.indexOf(client.displayName) > -1){
		 	global.registeredUsers[client.displayName] = client;
		 }
	}
}

fObj.encrypt = function(string, salt) {
	var hash = crypto.createHash("sha1");
	if(salt) string += salt;
	hash.update(string);
	return hash.digest("hex");
}

fObj.verifyPassword = function(hashedPassword, password) {
	password = fObj.encrypt(password, global.passwordSalt);
	return hashedPassword == password;
}

fObj.setRegUsers = function(callback){
	callback = (callback) ? callback : false;
	fs.readFile("registeredUsers.json", function(err, data){
		if(err){
			throw err;
		}
		if(data.length){
			global.registeredUsers = JSON.parse(data);
			fObj.updateRegUsers();
		} else {
			global.registeredUsers = {};
		}
		if(callback) callback();
	});
}

fObj.requestText = function(forSocket, callback){
	callback = (callback) ? callback : false;
	global.io.sockets.to(forSocket.id).emit("textRequest");
	forSocket.once("curText", callback);
}

fObj.doOnChanSwitchConfirm = function(socket, callback){
	socket.once("chanSwitchConfirmed", function(){
		callback();
	});
}
