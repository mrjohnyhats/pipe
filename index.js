var http = require("http");
var fs = require("fs");
var mime = require("mime");
var events = require("events");
var io = require("socket.io");
var Chan = require("./clientsAndChans.js").Chan;
var Client = require("./clientsAndChans.js").Client;
var functions = require("./functions.js");
global.chans = {};
global.socketClients = {};
global.passwordSalt = "potato"
var registeredUsers;
functions.setRegUsers(function(){
	registeredUsers = global.registeredUsers;
});
var socketClients = global.socketClients;
var chans = global.chans;
var registeredUsers = global.registeredUsers;
var passwordSalt = global.passwordSalt;

var server = http.createServer(function(req, res) {
	if (req.method === "GET" && fs.statSync("."+req.url).isFile() || req.url === "/") {
		if (req.url === "/") {
			serveFile("./index.html", res);
		} else if (!/\/socket\.io/.test(req.url)) {
			serveFile("." + req.url, res);
		}
	} else {
		throw404(res);
	}
});
global.io = io(server);
io = global.io;
server.listen(8000);
new Chan("main", "Main");
io.on("connect", function(socket){
	if(!chans["main"]){
		new Chan("main", "Main");
	}
	new Client(socket).switchChan(chans["main"]);

	socket.on("disconnect", function(){
		console.log(socket.id + " --> disconnect");
		if(typeof socketClients[socket.id] !== "undefined"){
			var clientChan = chans[socketClients[socket.id].chan];
			clientChan.removeClient(socketClients[socket.id]);
		}
	});

	socket.on("getChanSwitchConfPopupHtml", function(){
		console.log(socket.id + " --> getChanSwitchConfPopupHtml");
		fs.readFile("chanSwitchConfPopup.html", "utf8", function(err, data){
			if(err){
				throw err;
			}
			global.io.sockets.to(socket.id).emit("chanSwitchConfPopupHtml", data);
		});
	});

	socket.once("chanSwitchConfirmed", function(){
		console.log(socket.id + " --> chanSwitchConfirmed");
		socket.on("message", function(data){
			var clientWithMsg = chans[data.chan].clients[socket.id];
			if(clientWithMsg){
				clientWithMsg.lastMessageTime = Date.now();
				if(!(clientWithMsg.isPulling || clientWithMsg.pullInitTimeout)){
					 clientWithMsg.startPullInitTimeout();
				 }
				socket.to(data.chan).emit("message", {
					text: data.text,
					socketId: functions.sanitizeIdForJquery(clientWithMsg.socket.id)
				});
			}
		});

		socket.on("newPullTime", function(data){
			console.log(socket.id + " --> newPullTime");
			chans[socketClients[socket.id].chan].clients[socket.id].pullTime = data.pullTime;
			socket.to(data.chan).emit("newPullTime", {
				socketId: functions.sanitizeIdForJquery(socket.id),
				pullTime: data.pullTime
			});
		});

		socket.on("cbSyncRequest", function(data){
			console.log(socket.id + " --> cbSyncRequest");
			functions.sendCbSync(data.socketId, socket.id, data.chan);
		});

		socket.on("pullCompleted", function(data){
			console.log(socket.id + " --> pullCompleted");
			chans[socketClients[data.socketId].chan].clients[data.socketId].isPulling = false;
			for(id in chans[socketClients[data.socketId].chan].clients){
				if(id !== socket.id){
					functions.sendCbSync(data.socketId, id, socketClients[data.socketId].chan);
				}
			}	
		});

		socket.on("chanSwitch", function(data){
			console.log(socket.id + " --> chanSwitch");
			if(!chans[data.newChanName]){
				new Chan(data.newChanName, data.newChanDisplayName);
			}
			var client = chans[socketClients[socket.id].chan].clients[socket.id];
			client.switchChan(chans[data.newChanName]);
		});

		socket.on("newUsername", function(data){
			console.log(socket.id + " --> newUsername");
			chans[data.chan].clients[socket.id].changeUsername(data.newName);
			socket.to(data.chan).emit("newUsername", {
				socketId: functions.sanitizeIdForJquery(socket.id),
				newName: data.newName
			});
		});

		socket.on("getSignUpPopupHtml", function(data){
			console.log(socket.id + " --> getSignUpPopupHtml");
			fs.readFile("signUpPopup.html", {"encoding": "utf8"}, function(err, html){
				if(err) throw err;
				io.sockets.to(socket.id).emit("signUpPopupHtml", html);
			});
		});

		socket.on("regUser", function(data){
		console.log(socket.id + " --> regUser");
				var clientToRegister = chans[data.chan].clients[socket.id];
		if(registeredUsers[data.username]){
			if(functions.verifyPassword(registeredUsers[data.username].password, data.password)){
				clientToRegister.updateBasedOnRegData(registeredUsers[data.username]);
				functions.updateRegUsers();
						functions.updateRegUsersFile();
					} else { 
				io.sockets.to(socket.id).emit("wrongPassword");
						return;
			}
		} else {
			clientToRegister.register(data.username, data.password);
		}
			io.sockets.to(socket.id).emit("userRegistered", {
				defaultChanName: clientToRegister.defaultChan.name,
				defaultChanDisplayName: clientToRegister.defaultChan.displayName
			});
		});

		socket.on("newDefChan", function(data){
				console.log(socket.id + " --> newDefChan");
			chans[data.chanName].clients[socket.id].defaultChan = chans[data.chanName];
				functions.updateRegUsers();
			functions.updateRegUsersFile();
		});
	});
});

function serveFile(path, res) {
	fs.readFile(path, function(err, data) {
		if (err) return handleErr(err, res);
		res.writeHead(200, {
			"Content-type": mime.lookup(path)
		});
		res.end(data.toString());
	});
}

function handleErr(err, res) {
	res = typeof res === "undefined" ? null : res;
	console.log(err);
	if (res) res.end("Server Error");
}

function throw404(res){
	res.statusCode = 404;
	res.end();
}
