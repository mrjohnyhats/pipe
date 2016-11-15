$(document).ready(function(){
	socket.on("userRegistered", function(){
		$("#userList").append("<center><button>Set " + chanDisplayName + " as default channel</button></center>");
		$("#userList button").attr("id", "defaultChanButton");
		$("#userList button").on("click", function(){
			setCurChanAsDef();
		});
	});
	$("#inputbox").focus();

	$("#inputbox").blur(function(){
		if(talking){
			$("#inputbox").focus();
		}
	});

	$("#inputbox").on("input", function(){
		if(talking){
			registerKeyPress();
		}
	});

	$("#chanSwitchInterface").mouseenter(function(){
		var curChan = chanName;
		var chanSwitched = function(){
			return curChan == chanName;
		}
		$("#chanSwitchInterface").css({
			"top": "-18vh"
		});

		$("#chanSwitchInterface").one("mouseleave", function(){
			//if the chanSwitchInterface is open and blocking the screen
			if(!talking && !$("#signUpPopup").length && !$("#chanSwitchConfPopup").length){
				talking = true;
				$("#inputbox").focus();
			}

			$("#chanSwitchInterface").css({
				"top": "-19vh",
				"z-index": "2"
			});
		});
	});

	$("#chanSwitchInterface").on("click", function(){
		talking = false;
		$("#chanSwitchInterface").css({
			"top": "0",
			"z-index": "4"
		});
	});


	$("#chanSwitchInterface #submit").on("click", function(){
		processNewChanRequest($("#textBox").val());
		$("#chanSwitchInterface #submit").blur();
	});
	$("#chanSwitchInterface #textBox").on("keypress", function(e){
		if(e.keyCode == 13){
			$("#chanSwitchInterface #submit").trigger("click");
		}
	});

	$("#userList").on("mouseenter", function(){
		if(parseInt($("#userList").css("left")) < -28.85){
			$("#userList").css("left", "-28.85vw");
		}

		$("#userList").one("mouseleave", function(event){
			if(!$("#userList #" + me.socketId).find(getElemUnderCursor(event)).length){
				$("#userList").css("left", "-29.85vw");
				if(!$("#signUpPopup").length){
					talking = true;
					$("#inputbox").focus();
				}
			}
		});
	});

	$("#userList").on("click", function(){
		talking = false;
		$("#userList").css("left", 0);

		$("#userList #" + me.socketId).one("click", function(){
			renderNewUsernameBox();
			$("#myUsernameListing").focus();
			$("#myUsernameListing").one("blur", function(){
				handleNewUsername($("#myUsernameListing").val().trim());
			});
		});
	});
	$("#signUp").on("click", function(){
		if(!$("#signUpPopup").length){
			talking = false;
			renderSignUpPopup();
		}
	});
	$(window).on("focus", function(){
		console.log("window focused");
		syncAllCbs();
	});
});
