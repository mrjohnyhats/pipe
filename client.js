var socket = io();
var me = 0;
var talking = true;
var chanName;
var chanDisplayName;
var clients = {};
var chanChosen = false;

//TODO: sometimes, when client is still pushing in one chan, and client switches, then cb in new chan starts to pull

socket.on("connect", function(){
	confirmChanSwitch();
	socket.on("generateCbs", function(data){
		console.log("server: generateCbs");
		deRenderAllCb();
		removeAllFromUserList();
		clients = data.clients;
		chanName = data.chanName;
		chanDisplayName = data.chanDisplayName;
		me = clients[data.yourId];
		renderAllCb();
		addAllClientsToUserList();
		updateChanIndicator();
		updateCbStyles();
		if(Object.keys(clients).length > 1){
			syncAllCbs();
		}	
	});

	socket.on("clientJoin", function(data){
		console.log("server: clientJoin");
		clients[data.client.socketId] = data.client;
		renderNewCb(data.client.unSanitizedSocketId);
		addToUserList(data.client);
		updateCbStyles();
	});

	socket.on("clientPart", function(data){
		console.log("server: clientPart");
		clients[data.client.socketId] = undefined;
		delete clients[data.client.socketId];
		deRenderCb(data.client.socketId);
		removeFromUserList(data.client);
		updateCbStyles();
	});

	socket.on("message", function(data){
		console.log("server: message");
		$("#chatBox" + data.socketId + " #sentWords").append(" " + data.text);
		if($("#chatBox" + data.socketId).width() > $(window).width() && !clients[data.socketId].isPulling){
			showLatestWords(data.socketId);
		}
		requestCbSync(data.socketId);
	});

	socket.on("startPull", function(data){
		console.log("server: startPull");
		clients[data.socketId].pullStartTime = Date.now();
		clients[data.socketId].isPulling = true;
		prepareCbForPull(data.socketId);
		startPullInterval(data.socketId);
	});

	socket.on("cbSync", function(data){
		console.log("server: cbSync");
		$("#chatBox"+data.socketId + " #sentWords").text(data.text);
		console.log("isPulling = " + data.isPulling);
		console.log("isPuliing clientside = " + clients[data.socketId].isPulling);
		console.log("right value = " + $("#chatBox" + data.socketId).css("right"));
		if(data.isPulling && !clients[data.socketId].isPulling){
			clients[data.socketId].isPulling = true;
			clients[data.socketId].pullStartTime = data.pullStartTime;
			clients[data.socketId].pullTime = convertWidthToPullTime($("#chatBox" + data.socketId).width());
			var pullTimePassed = Date.now() - clients[data.socketId].pullStartTime;
			prepareCbForPull(data.socketId, function(){
				$("#chatBox" + data.socketId).css("right", convertPullTimeToWidth(pullTimePassed)).promise().done(function(){
					startPullInterval(data.socketId);
				});
			});
		} else if(!data.isPulling && (clients[data.socketId].isPulling || parseInt($("#chatBox"+data.socketId).css("right")) > 0)){
			finishPull(data.socketId);
		}
	});

	socket.on("newPullTime", function(data){
		console.log("server: newPullTime");
		clients[data.socketId].pullTime = data.pullTime;
	});

	socket.on("newUsername", function(data){
		console.log("server: newUsername");
		clients[data.socketId].displayName = data.newName;
		updateUserListing(data.socketId, data.newName);
	});

	socket.on("completePull", function(data){
		console.log("server: completePull");
		finishPull(socketId);
	});

	socket.on("textRequest", function(){
		console.log("server: textRequest");
		sendCbText();
	});

	/*socket.on("chanSwitchConf", function(){
		console.log("server: chanSwitchConf");
		talking = false;
		renderChanSwitchConfPopup();
	});*/
	//might still be useful
});

function updateChanIndicator(){
	$("#chanIndicator").text(chanName);
}

function renderNewCb(unsanitizedId){
	$("#clients").append('<div id="chatBox' + unsanitizedId + '" class="chatBox"><span id="sentWords"></span><span id="unsentWord"></span></div>');
}

function deRenderCb(id){
	if($("#chatBox" + id).length){
		$("#chatBox" + id).remove();
	}
}

function renderAllCb(){
	for(socketId in clients){
		renderNewCb(clients[socketId].unSanitizedSocketId);
	}
}

function deRenderAllCb(){
	$("#clients").empty();
}

function addAllClientsToUserList(){
	for(id in clients){
		addToUserList(clients[id]);
	}
}

function convertPullTimeElapsed(pullTimeElapsed){
	return pullTimeElapsed * 1.5;
}

function updateCbStyles(){
	var clientIds = Object.keys(clients);
	for(id in clients){
		$("#chatBox" + id).css("background-color", "rgb(222, " + (72 + 20 * clientIds.indexOf(id)) + ", 72)");
	}
	$("#clients div").css({
		"height": (100 / clientIds.length) + "%",
		"font-size": (200 / clientIds.length) + "px"
	});
}

function removeAllFromUserList(){
	$("#userList").empty();
}

function addToUserList(client){
	name = client.displayName;
	if(name === me.displayName){
		name = '<span id="myUsernameListing">' + name + '<span>';
	}
	$("#userList").append('<div id="'+ client.unSanitizedSocketId +'">' + name + '</div>');
}

function updateUserListing(socketId, newName){
	$("#userList #" + socketId).first().text(newName);
}

function removeFromUserList(client){
	$("#userList #" + client.socketId).remove();
}


function registerKeyPress(){
	var inputboxVal = $("#inputbox").val();
	if(inputboxVal[inputboxVal.length-1] == " " ||  inputboxVal[inputboxVal.length-1] == "\n"){
		console.log("registered space or enter");
		sendMessage($("#chatBox" + me.socketId + " #unsentWord"));
		$("#chatBox" + me.socketId + " #sentWords").append(" ");
		removeUnderlineFromLastWord();
		$("#inputbox").val("");
		updatePullTime();
	} else {
		$("#chatBox" + me.socketId + " #unsentWord").html(inputboxVal);
	}
	if(!me.isPulling && $("#chatBox" + me.socketId).width() > $(window).width()){
		showLatestWords(me.socketId);
	}
	function removeUnderlineFromLastWord(){
		 var underlinedText = $("#chatBox" + me.socketId + " #unsentWord").text();
		 $("#chatBox" + me.socketId + " #unsentWord").text("");
		 var sentWords = $("#chatBox" + me.socketId + " #sentWords").text();
		 $("#chatBox" + me.socketId + " #sentWords").text(sentWords + underlinedText);
	}
}

function sendMessage(unsentWordElem){
	var textWidth = me.isPulling ? unsentWordElem.width() : 0;
	socket.emit("message", {
		text: unsentWordElem.text(),
		textWidth: textWidth,
		chan: chanName
	});
}

function convertWidthToPullTime(width){
	return width * 2;
}

function convertPullTimeToWidth(pullTime){
	return pullTime / 2;
}

function updatePullTime(){
	var sentWordsWidth = $("#chatBox" + me.socketId + " #sentWords").width();
	me.pullTime = convertWidthToPullTime(sentWordsWidth);
	sendPullTime();
}

function sendPullTime(){
	socket.emit("newPullTime", {
		pullTime: me.pullTime,
		chan: chanName
	});
}

function prepareCbForPull(socketId, cb){
	cb = cb ? cb : null;
	trimCb(socketId);
	enablePullTransition(socketId);
	if(cb) cb();
	$("#unsentWord").html("");
}

function startPullInterval(socketId){
	var startingRight = $("#chatBox" + socketId).css("right");
	var incrementTime = 10;
	var client = clients[socketId];
	$("#chatBox" + socketId).promise().done(init);
	function init(){
		console.log($("#chatBox" + socketId + " #sentWords").width());
		var pullTimeElapsed = 0;

		clients[socketId].pullInterval = setInterval(function(socketId){
			incrementPullWidth();
			pullTimeElapsed+=incrementTime;
			if(pullTimeElapsed >= client.pullTime){
				finishPull(socketId);
			} else {
				pullTimeElapsed = convertWidthToPullTime(parseInt($("#chatBox" + socketId).css("right")));
			}
		}, incrementTime, socketId);

		function incrementPullWidth(){
			var curRight = parseInt($("#chatBox" + socketId).css("right"));
			if($("#chatBox" + socketId).width() - curRight > $(window).width()){
				showLatestWords(socketId);
			} else {
				$("#chatBox" + socketId).css("right", curRight + convertPullTimeToWidth(incrementTime));
			}
		}
	}
}

function enablePullTransition(socketId){
	$("#chatBox" + socketId).css("transition", "right ease-in-out 0.01s");
}

function disablePullTransition(socketId){
	$("#chatBox" + socketId).css("transition", "right ease-in-out 0.1s");
}

function trimCb(socketId){
	$("#chatBox" + socketId).animate({
		"min-width": $("#chatBox" + socketId + " #sentWords").width()
	}, 200);
}

function finishPull(socketId){
	clearInterval(clients[socketId].pullInterval);
	clients[socketId].pullInterval = undefined;
	delete clients[socketId].pullInterval;
	disablePullTransition(socketId);
	clients[socketId].isPulling = false;
	$("#chatBox" + socketId).css("min-width", "100vw");
	$("#chatBox" + socketId + " #sentWords").text("");
	$("#chatBox" + socketId).css("right", 0);
	sendPullCompletion(clients[socketId].unSanitizedSocketId);
}

function sendPullCompletion(socketId){
	socket.emit("pullCompleted", {
		socketId : socketId	
	});
}

function sendChanSwitch(chanDisplayName){
	socket.emit("chanSwitch", {
		newChanName: chanDisplayName.toLowerCase(),
		newChanDisplayName: chanDisplayName
	});
}

function processNewChanRequest(inputVal){
	if(verifyChanSwitchAndThrowErr(inputVal)){
		$("#chanSwitchInterface #textBox").val("");
		if(me.isPulling) finishPull(me.socketId);
		//confirmChanSwitch(inputVal);
		socket.emit("chanSwitch", {
			newChanName: inputVal.toLowerCase().trim(),
			newChanDisplayName: inputVal.trim()
		});
		confirmChanSwitch();
	}
}

function changeUserListDefChanButtonVal(){
	$("#userList button").val("Set " + chanDisplayName + " as default channel");
}

function verifyChanSwitchAndThrowErr(chanSwitch){
	if(chanSwitch.length < 3){
		alert("channel names can't be less than 3 characters long");
	} else {
		return true;
	}
	return false;
}

function renderNewUsernameBox(){
	var myUserListing = $("#userList #" + me.socketId);
	myUserListing.empty();
	myUserListing.append('<textarea id="myUsernameListing"></textarea>');
}

function renderDislaynameAsListing(){
	var myUserListing = $("#userList #" + me.socketId);
	myUserListing.empty();
	myUserListing.append('<span id="myUsernameListing">' + me.displayName + '</span>')
}

function verifyUsernameAndThrowErr(newUsername){
	if(newUsername.length < 3){
		alert("username too short, must be at least 3 characters long");
	} else if(newUsername == me.displayName && me.registered) {
		alert("already logged in with that username");
	} else if(getAllUsernamesInChan().indexOf(newUsername.toLowerCase()) > -1){
		alert("username already taken, please choose another one");
	} else if(newUsername.length > 300){
		alert("username too long, usernames can't have more than 300 characters");
	} else {
		return true;
	}
	return false;
}

function verifyPasswordAndThrowErr(password){
	if(password.length < 5){
		alert("password too sort, all passwords must be at least 5 characters long");
	} else {
		return true;
	}
	return false;
}

function getAllUsernamesInChan(){
	var out = [];
	for(id in clients){
		out.push(clients[id].displayName.toLowerCase());
	}
	return out;
}

function sendNewUsername(newUsername){
	socket.emit("newUsername", {
		chan: chanName,
		newName: newUsername
	});
}

function switchToOldUsername(){
	renderDislaynameAsListing();
}

function handleNewUsername(newName){
	if($("#userList #" + me.socketId).has("textarea")){
		if(verifyUsernameAndThrowErr(newName)){
			instantiateNewUsername(newName);
			sendNewUsername(newName);
		} else {
			switchToOldUsername();
		}
	}
}

function instantiateNewUsername(newName){
	me.displayName = newName;
	renderDislaynameAsListing();
}

function getElemUnderCursor(event){
	var xPos = event.pageX;
	var yPos = event.pageY;

	return $(document.elementFromPoint(xPos, yPos));
}

function renderSignUpPopup(){
	getSignUpPopupHtml(function(html){
		$("body").append(html);
		$("#signUpPopup").hide().fadeIn(200);
	});
}

function getSignUpPopupHtml(callback){
	socket.emit("getSignUpPopupHtml");
	socket.once("signUpPopupHtml", function(html){
		callback(html);
	});
}

function regUser(username, password){
	console.log("registering user with name " + username);
	var passwordHash = encryptPassword(password);
	sendRegData(username, passwordHash);
	socket.once("userRegistered", function(data){
		instantiateNewUsername(username);
		me.registered = true;
		if(data.defaultChanName !== me.chan){
			renderChanSwitchPrompt(data.defaultChanDisplayName);
		}
		me.defaultChanName = data.defaultChanName;
		me.defaultChanDisplayName = data.defaultChanDisplayName;
		$("#inputbox").focus();
	});
	socket.once("wrongPassword", function(){
		alert("username or password incorrect");
	});
}

function renderChanSwitchPrompt(chanDisplayName, requestLim){
	var requestLim = requestLim ? requestLim : 3;
	socket.emit("getChanSwitchPromptHtml");
	socket.once("chanSwitchPromptHtml", function(html){
		if(html){
			talking = false;
			var parsedHtml = $(html);
			parsedHtml.find("p").append(chanDisplayName);
			$("body").append(parsedHtml);
		} else if(requestLim) {
			requestLim--;
			renderChanSwitchPrompt(chanDisplayName, requestLim);
		} else {
			throw error("couldn't get html for chanSwitchPrompt");
		}
	});
}

function removeSignUpPopup(){
	$("#signUpPopup").fadeOut(200);
	setTimeout(function(){
		$("#signUpPopup").remove();
	}, 200);
}

function encryptPassword(password){
	return CryptoJS.SHA1(password).toString();
}

function sendRegData(username, password){
	socket.emit("regUser", {
		chan: chanName,
		username: username,
		password: password
	});
}

function syncAllCbs(){
	for(socketId in clients){
		if(socketId !== me.socketId){
			requestCbSync(socketId);
		}
	}
}

function requestCbSync(socketId){
	socket.emit("cbSyncRequest", {
		chan: chanName,
		socketId: clients[socketId].unSanitizedSocketId
	});
}

function sendCbText(){
	socket.emit("curText", $("#chatBox" + me.socketId + " #sentWords").text());
}

function renderChanSwitchConfPopup(){
	getChanSwitchConfPopupHtml(function(html){
		$("body").append(html);
		$("#chanSwitchConfPopup").hide().fadeIn(200);
	});
}

function getChanSwitchConfPopupHtml(callback){
	socket.emit("getChanSwitchConfPopupHtml");
	socket.once("chanSwitchConfPopupHtml", callback);
}

function removeChanConfPopup(){
	$("#chanSwitchConfPopup").fadeOut(200);
	setTimeout(function(){
		$("#chanSwitchConfPopup").remove();
	}, 200);
}

function showLatestWords(socketId){
	var cb = $("#chatBox" + socketId);
	cb.css("right", cb.width() - $(window).width());
}

function setCurChanAsDef(){
	me.defaultChanName = chanName;
	me.defaultChanDisplayName = chanDisplayName;
	sendDefChan();
}

function sendDefChan(){
	socket.emit("setDefChan", {
		chanName: chanName
	});
}

function confirmChanSwitch(inputVal){
	talking = false;
	renderChanSwitchConfPopup();
}
