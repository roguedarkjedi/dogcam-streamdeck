/* global $CC, Utils, $SD */

$SD.on('connected', (jsonObj) => connected(jsonObj));

function connected(jsn) {
	$SD.on('com.roguedarkjedi.dogcam.reset.keyDown', (jsonObj) => action.onKeyDown(jsonObj));
	$SD.on('com.roguedarkjedi.dogcam.up.keyDown', (jsonObj) => action.onKeyDown(jsonObj));
	$SD.on('com.roguedarkjedi.dogcam.down.keyDown', (jsonObj) => action.onKeyDown(jsonObj));
	$SD.on('com.roguedarkjedi.dogcam.left.keyDown', (jsonObj) => action.onKeyDown(jsonObj));
	$SD.on('com.roguedarkjedi.dogcam.right.keyDown', (jsonObj) => action.onKeyDown(jsonObj));
	
	// TODO: Make global settings
	$SD.on('com.roguedarkjedi.dogcam.reset.willAppear', (jsonObj) => action.onWillAppear(jsonObj));
	$SD.on('com.roguedarkjedi.dogcam.reset.didReceiveSettings', (jsonObj) => action.onDidReceiveSettings(jsonObj));
	
	$SD.on('applicationDidLaunch', (jsonObj) => action.onApplicationStarted(jsonObj));
	$SD.on('applicationDidTerminate', (jsonObj) => action.onApplicationExit(jsonObj));
	$SD.on('com.roguedarkjedi.dogcam.reset.sendToPlugin', (jsonObj) => action.onSendToPlugin(jsonObj));
};

/** ACTIONS */

const action = {
	settings:{},
	websocket: null,
	resetContext: "",
	applicationRunning: false,
	
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
		var angularDirection = 1.0;
		var moveType = "moverel";
		
		if (action.settings) {
			if (action.settings.hasOwnProperty('degreestep')) {
				angularDirection = action.settings["degreestep"];
			}
			if (action.settings.hasOwnProperty('movemethod')) {
				moveType = action.settings["movemethod"];
			}
		}
		
		if (action.websocket == null) {
			console.log("Dropping push down event as the websocket is not valid at this time");
			return;
		}

		var actionType = jsn.action.replace("com.roguedarkjedi.dogcam.", "");
		switch (actionType) {
		case "up":
			action.websocket.send('{"servo": "tilt", "action": "'+moveType+'", "angle": -'+angularDirection+'}');
			break;
		case "down":
			action.websocket.send('{"servo": "tilt", "action": "'+moveType+'", "angle": '+angularDirection+'}');
			break;
		case "left":
			action.websocket.send('{"servo": "pan", "action": "'+moveType+'", "angle": -'+angularDirection+'}');
			break;
		case "right":
			action.websocket.send('{"servo": "pan", "action": "'+moveType+'", "angle": '+angularDirection+'}');
			break;
		case "reset":
			action.websocket.send('{"servo": "tilt", "action": "resetall"}');
			$SD.api.showOk(jsn.context);
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
		/**
		* this is a message sent directly from the Property Inspector 
		* (e.g. some value, which is not saved to settings) 
		* You can send this event from Property Inspector (see there for an example)
		*/ 
		const sdpi_collection = Utils.getProp(jsn, 'payload.forceconnect', {});
		if ((sdpi_collection.value && sdpi_collection.value !== undefined) || sdpi_collection == 1) {
			console.log("Force connection started!");
			this.exitDogcam(true);
			this.startDogcamConnect();
		}
	},

	/**
	* This snippet shows, how you could save settings persistantly to Stream Deck software
	* It is not used in this example plugin.
	*/

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

