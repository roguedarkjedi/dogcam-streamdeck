/* global $CC, Utils, $SD */

$SD.on('connected', (jsonObj) => connected(jsonObj));

function connected(jsn) {
	var keyArray = ["up", "down", "reset", "left", "right", "aitoggle"];
	
	for (var keyAction in keyArray)
	{
		$SD.on('com.roguedarkjedi.dogcam.'+keyAction+'.keyDown', (jsonObj) => action.onKeyDown(jsonObj));
		$SD.on('com.roguedarkjedi.dogcam.'+keyAction+'.sendToPlugin', (jsonObj) => action.onSendToPlugin(jsonObj));
	}
	
	// TODO: Eventually make this a global setting
	$SD.on('com.roguedarkjedi.dogcam.reset.didReceiveSettings', (jsonObj) => action.onDidReceiveSettings(jsonObj));
	
	// This displays a warning if something didn't go right
	$SD.on('com.roguedarkjedi.dogcam.reset.willAppear', (jsonObj) => action.onWillAppear(jsonObj));
	$SD.on('applicationDidLaunch', (jsonObj) => action.onApplicationStarted(jsonObj));
	$SD.on('applicationDidTerminate', (jsonObj) => action.onApplicationExit(jsonObj));
	
};

/** ACTIONS */

const action = {
	settings:{},
	websocket: null,
	resetContext: "",
	applicationRunning: false,
	aiDisabled: false,
	
	startDogcamConnect: function() {
		if (action.websocket != null) {
			console.log("Connect was called but we are already connected!");
			return;
		}
		action.websocket = new WebSocket("ws://"+action.settings["websocketaddr"]+"/");
		action.websocket.onopen = function(event) {
			console.log("Dogcam Connection established");
		};
		action.websocket.onmessage = function(msg) {
			console.log("Dogcam Got message "+msg);
		};
		action.websocket.onerror = function(msg) {
			console.log("Dogcam ERROR " + msg);
			$SD.api.showAlert(action.resetContext);
			action.websocket = null;
		};
	},
	
	exitDogcam: function(force) {
		// Don't kill the websocket if OBS gets restarted
		if (action.applicationRunning && force === undefined) {
			console.log("Application was restarted");
			return;
		}
		
		if (action.websocket != null) {
			console.log("Closing the dogcam connection");
			action.websocket.close(1000, "done");
		}
		action.websocket = null;
	},
	
	onApplicationStarted: function(jsn) {
		action.applicationRunning = true;
		
		if (Object.keys(action.settings).length === 0) {
			console.log("Missing settings to connect to dogcam! Will call again.");
			setTimeout(function(jsn) {action.onApplicationStarted(jsn);}, 5000);
			return;
		}
		
		console.log("Starting countdown for connection to dogcam");
		setTimeout(action.startDogcamConnect, 40000);
	},
	
	onApplicationExit: function(jsn) {
		action.applicationRunning = false;
		console.log("Starting countdown for disconnection handling");
		setTimeout(action.exitDogcam, 15000);
	},
	
	onDidReceiveSettings: function(jsn) {
		console.log("Got settings event!");
		action.settings = Utils.getProp(jsn, 'payload.settings', {});
	},

	onKeyDown: function (jsn) {
	
		if (action.websocket == null) {
			console.log("Dropping push down event as the websocket is not valid at this time");
			return;
		}

		var actionType = jsn.action.replace("com.roguedarkjedi.dogcam.", "");
		switch (actionType) {
		case "up":
		case "down":
			action.websocket.send('{"servo": "tilt", "action": "'+actionType+'"}');
			break;
		case "left":
		case "right":
			action.websocket.send('{"servo": "pan", "action": "'+actionType+'"}');
			break;
		case "reset":
			action.websocket.send('{"servo": "tilt", "action": "resetall"}');
			$SD.api.showOk(jsn.context);
			break;
		case "aitoggle":
			var aiCommand = (action.aiDisabled) ? "enableai" : "disableai";
			action.websocket.send('{"action": "'+aiCommand+'"}');
			$SD.api.setTitle(jsn.context, (action.aiDisabled) ? "AI Enabled" : "AI Disabled");
			action.aiDisabled = !action.aiDisabled;
			break;
		default:
			console.log("Action type: "+actionType+" is not recognized!");
		}
	},
	
	onWillAppear: function(jsn) {
		// Save this context value
		console.log("Context object cached");
		action.resetContext = jsn.context;
		$SD.api.getSettings(jsn.context, []);
	},

	onSendToPlugin: function (jsn) {
		const sdpi_collection = Utils.getProp(jsn, 'payload.forceconnect', {});
		if ((sdpi_collection.value && sdpi_collection.value !== undefined) || sdpi_collection == 1) {
			console.log("Force connection started!");
			this.exitDogcam(true);
			this.startDogcamConnect();
		}
	},

	saveSettings: function (jsn, sdpi_collection) {
		console.log('saveSettings:', jsn);
		if (sdpi_collection != null && sdpi_collection.hasOwnProperty('key') && sdpi_collection.key != '') {
			if (sdpi_collection.value && sdpi_collection.value !== undefined) {
				this.settings[sdpi_collection.key] = sdpi_collection.value;
				console.log('setSettings....', this.settings);
				$SD.api.setSettings(jsn.context, this.settings);
			}
		}
		else {
			$SD.api.setSettings(jsn.context, this.settings);
		}
	}
};
